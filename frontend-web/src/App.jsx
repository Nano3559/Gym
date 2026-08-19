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
import Toast from './components/Toast'
import { weeklyClasses } from './data/gymData'

export default function App() {
  const [isRegisterOpen, setRegisterOpen] = useState(false)
  const [registerPlan, setRegisterPlan] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  const [bookingClass, setBookingClass] = useState(null)
  const [pendingBooking, setPendingBooking] = useState(null)
  const [bookings, setBookings] = useState([])
  const [showBookings, setShowBookings] = useState(false)

  const [extraBooked, setExtraBooked] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const scrollTo = useCallback((href) => {
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const classesByDay = useMemo(() => {
    const result = {}
    for (const [day, list] of Object.entries(weeklyClasses)) {
      result[day] = list.map((cls) => ({
        ...cls,
        booked: cls.booked + (extraBooked[cls.id] || 0),
      }))
    }
    return result
  }, [extraBooked])

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
      setCurrentUser(user)
      setRegisterOpen(false)
      showToast(`¡Bienvenido/a, ${user.nombre}! Tu cuenta fue creada correctamente.`)
      if (pendingBooking) {
        setBookingClass(pendingBooking)
        setPendingBooking(null)
      }
    },
    [pendingBooking, showToast]
  )

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
      })
      return
    }
    setBookingClass(item)
  }, [])

  const handleGoRegister = useCallback(() => {
    setPendingBooking(bookingClass)
    setBookingClass(null)
    setRegisterOpen(true)
  }, [bookingClass])

  const handleConfirmBooking = useCallback(
    (booking) => {
      const newBooking = {
        ...booking,
        id: `${booking.classId}-${Date.now()}`,
        status: 'Confirmada',
      }
      setBookings((prev) => [newBooking, ...prev])
      setExtraBooked((prev) => ({
        ...prev,
        [booking.classId]: (prev[booking.classId] || 0) + 1,
      }))
      showToast('Reserva realizada correctamente.')
    },
    [showToast]
  )

  const handleCancelBooking = useCallback(
    (id) => {
      const booking = bookings.find((b) => b.id === id)
      if (!booking) return
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'Cancelada' } : b))
      )
      setExtraBooked((prev) => ({
        ...prev,
        [booking.classId]: Math.max(0, (prev[booking.classId] || 0) - 1),
      }))
      showToast('Reserva cancelada.', 'error')
    },
    [bookings, showToast]
  )

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
      <Navbar onInscribirme={handleInscribirme} onVerPlanes={handleVerPlanes} />

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
          onViewBookings={() => setShowBookings(true)}
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

      <BookingModal
        bookingClass={bookingClass}
        currentUser={currentUser}
        onClose={() => setBookingClass(null)}
        onConfirm={handleConfirmBooking}
        onGoRegister={handleGoRegister}
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