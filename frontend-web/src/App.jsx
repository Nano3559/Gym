import { useCallback, useMemo, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import About from './components/About'
import Services from './components/Services'
import Plans from './components/Plans'
import Trainers from './components/Trainers'
import Schedules from './components/Schedules'
import Gallery from './components/Gallery'
import Contact from './components/Contact'
import Footer from './components/Footer'
import RegisterModal from './components/RegisterModal'
import BookingModal from './components/BookingModal'
import MyBookingsModal from './components/MyBookingsModal'
import LoginModal from './components/LoginModal'
import Toast from './components/Toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import useClasses from './hooks/useClasses'
import useBookings from './hooks/useBookings'

function AppContent() {
  const { user: authUser, profile, signOut } = useAuth()

  // Módulo 2: clases desde Supabase (con Realtime) o datos locales del Módulo 1.
  const {
    classesByDay: baseClassesByDay,
    allSessions,
    usingDatabase,
    refresh: refreshClasses,
  } = useClasses()

  const [isRegisterOpen, setRegisterOpen] = useState(false)
  const [registerPlan, setRegisterPlan] = useState('')
  const [isLoginOpen, setLoginOpen] = useState(false)

  const [bookingClass, setBookingClass] = useState(null)
  const [pendingBooking, setPendingBooking] = useState(null)
  const [confirmingBooking, setConfirmingBooking] = useState(false)
  const [localBookings, setLocalBookings] = useState([])
  const [showBookings, setShowBookings] = useState(false)

  const [extraBooked, setExtraBooked] = useState({})
  const [toast, setToast] = useState(null)

  // Usuario autenticado (null si no hay sesión). Conserva la forma que el
  // Módulo 1 esperaba: { nombre, ... }.
  const currentUser = useMemo(() => {
    if (!authUser) return null
    return {
      id: authUser.id,
      email: authUser.email,
      ...(profile || {}),
      nombre: profile?.nombre || 'Cliente',
    }
  }, [authUser, profile])

  // Módulo 2: reservas reales del usuario (Supabase) + locales (fallback/servicios).
  const { bookings: dbBookings, createBooking, cancelBooking } = useBookings(authUser?.id)
  const bookings = useMemo(() => [...dbBookings, ...localBookings], [dbBookings, localBookings])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const scrollTo = useCallback((href) => {
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const classesByDay = useMemo(() => {
    if (usingDatabase) return baseClassesByDay
    const result = {}
    for (const [day, list] of Object.entries(baseClassesByDay)) {
      result[day] = list.map((cls) => ({
        ...cls,
        booked: cls.booked + (extraBooked[cls.id] || 0),
      }))
    }
    return result
  }, [baseClassesByDay, usingDatabase, extraBooked])

  // Sesiones reales disponibles para la clase seleccionada (una por fecha).
  const availableDates = useMemo(() => {
    if (!usingDatabase || !bookingClass || bookingClass.localOnly) return null
    return allSessions
      .filter((s) => s.name === bookingClass.name && s.time === bookingClass.time)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [usingDatabase, bookingClass, allSessions])

  const handleSelectSessionDate = useCallback(
    (dateStr) => {
      const sibling = allSessions.find(
        (s) =>
          bookingClass &&
          s.name === bookingClass.name &&
          s.time === bookingClass.time &&
          s.date === dateStr
      )
      if (sibling) setBookingClass(sibling)
    },
    [allSessions, bookingClass]
  )

  const handleInscribirme = useCallback(() => {
    setRegisterPlan('')
    setRegisterOpen(true)
  }, [])

  const handleVerPlanes = useCallback(() => {
    scrollTo('#planes')
  }, [scrollTo])

  const handleSelectPlan = useCallback((plan) => {
    setRegisterPlan(plan.id)
    setRegisterOpen(true)
  }, [])

  const handleRegisterSuccess = useCallback(
    (user) => {
      setRegisterOpen(false)
      showToast(`¡Bienvenido/a, ${user.nombre}! Tu cuenta fue creada correctamente.`)
      if (pendingBooking) {
        setBookingClass(pendingBooking)
        setPendingBooking(null)
      }
    },
    [pendingBooking, showToast]
  )

  const handleLoginSuccess = useCallback(() => {
    setLoginOpen(false)
    showToast('¡Sesión iniciada correctamente!')
    if (pendingBooking) {
      setBookingClass(pendingBooking)
      setPendingBooking(null)
    }
  }, [pendingBooking, showToast])

  const handleLogout = useCallback(async () => {
    await signOut()
    setLocalBookings([])
    setExtraBooked({})
    setShowBookings(false)
    showToast('Sesión cerrada correctamente.')
  }, [signOut, showToast])

  const handleReserve = useCallback((item) => {
    if (item.schedule) {
      const timeMatch = item.schedule.match(/(\d{2}:\d{2})/)
      setBookingClass({
        id: item.id,
        name: item.name,
        trainer: 'Equipo IronForge',
        time: timeMatch ? timeMatch[1] : '09:00',
        capacity: 20,
        booked: 0,
        localOnly: true,
      })
      return
    }
    setBookingClass(item)
  }, [])

  const handleGoRegister = useCallback(() => {
    setPendingBooking(bookingClass)
    setBookingClass(null)
    // Con Supabase activo primero ofrecemos iniciar sesión (desde ahí se puede
    // pasar al registro). Sin Supabase se conserva el flujo del Módulo 1.
    if (usingDatabase) setLoginOpen(true)
    else setRegisterOpen(true)
  }, [bookingClass, usingDatabase])

  const handleConfirmBooking = useCallback(
    async (booking) => {
      // Módulo 2: reserva persistente en la tabla bookings vía RPC.
      if (usingDatabase && currentUser && !booking.localOnly) {
        setConfirmingBooking(true)
        const result = await createBooking(booking.classId)
        setConfirmingBooking(false)
        if (!result.ok) {
          showToast(result.message, 'error')
          return false
        }
        refreshClasses()
        showToast('Reserva realizada correctamente.')
        return true
      }

      // Flujo local del Módulo 1 (sin Supabase o servicios informativos).
      const newBooking = {
        ...booking,
        id: `${booking.classId}-${Date.now()}`,
        status: 'Confirmada',
        local: true,
      }
      setLocalBookings((prev) => [newBooking, ...prev])
      setExtraBooked((prev) => ({
        ...prev,
        [booking.classId]: (prev[booking.classId] || 0) + 1,
      }))
      showToast('Reserva realizada correctamente.')
      return true
    },
    [usingDatabase, currentUser, createBooking, refreshClasses, showToast]
  )

  const handleCancelBooking = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id)
      if (!booking) return

      if (usingDatabase && !booking.local) {
        const result = await cancelBooking(id)
        if (result.ok) showToast('Reserva cancelada.', 'error')
        else showToast(result.message, 'error')
        refreshClasses()
        return
      }

      setLocalBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'Cancelada' } : b))
      )
      setExtraBooked((prev) => ({
        ...prev,
        [booking.classId]: Math.max(0, (prev[booking.classId] || 0) - 1),
      }))
      showToast('Reserva cancelada.', 'error')
    },
    [bookings, usingDatabase, cancelBooking, refreshClasses, showToast]
  )

  const handleViewBookings = useCallback(() => {
    // Las reservas son privadas: con Supabase activo requieren sesión.
    if (usingDatabase && !currentUser) {
      setLoginOpen(true)
      return
    }
    setShowBookings(true)
  }, [usingDatabase, currentUser])

  const handleSendMessage = useCallback(
    (form) => {
      showToast(`Gracias ${form.nombre}, tu mensaje fue enviado. Te contactaremos pronto.`)
    },
    [showToast]
  )

  const handleNavigate = useCallback(
    (href) => {
      scrollTo(href)
    },
    [scrollTo]
  )

  return (
    <div className="min-h-screen bg-ink text-white">
      <Navbar
        onInscribirme={handleInscribirme}
        onVerPlanes={handleVerPlanes}
        user={currentUser}
        onLogin={() => setLoginOpen(true)}
        onLogout={handleLogout}
      />

      <main>
        <Hero onInscribirme={handleInscribirme} onVerPlanes={handleVerPlanes} />
        <Marquee />
        <About />
        <Services onBookService={handleReserve} />
        <Plans onSelectPlan={handleSelectPlan} />
        <Trainers />
        <Schedules
          classesByDay={classesByDay}
          onReserve={handleReserve}
          onViewBookings={handleViewBookings}
          bookingsCount={bookings.filter((b) => b.status === 'Confirmada').length}
        />
        <Gallery />
        <Contact onSend={handleSendMessage} />
      </main>

      <Footer onNavigate={handleNavigate} />

      <RegisterModal
        key={`${isRegisterOpen}-${registerPlan}`}
        open={isRegisterOpen}
        onClose={() => {
          setRegisterOpen(false)
          setPendingBooking(null)
        }}
        defaultPlan={registerPlan}
        onSuccess={handleRegisterSuccess}
      />

      <LoginModal
        open={isLoginOpen}
        onClose={() => setLoginOpen(false)}
        onGoRegister={() => {
          setLoginOpen(false)
          setRegisterOpen(true)
        }}
        onSuccess={handleLoginSuccess}
      />

      <BookingModal
        bookingClass={bookingClass}
        currentUser={currentUser}
        onClose={() => setBookingClass(null)}
        onConfirm={handleConfirmBooking}
        onGoRegister={handleGoRegister}
        availableDates={availableDates}
        confirming={confirmingBooking}
        onSelectDate={handleSelectSessionDate}
      />

      <MyBookingsModal
        open={showBookings}
        onClose={() => setShowBookings(false)}
        bookings={bookings}
        onCancel={handleCancelBooking}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
