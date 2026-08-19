import { useMemo, useState } from 'react'
import { CalendarCheck, CalendarDays, Clock3, User, Users, CheckCircle2, LogIn } from 'lucide-react'
import Modal from './ui/Modal'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function BookingModal({ bookingClass, currentUser, onClose, onConfirm, onGoRegister }) {
  const [date, setDate] = useState(todayStr())
  const [confirmed, setConfirmed] = useState(false)
  const minDate = todayStr()
  const maxDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }, [])

  if (!bookingClass) return null

  const available = bookingClass.capacity - bookingClass.booked
  const full = available <= 0

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setDate(todayStr())
      setConfirmed(false)
    }, 250)
  }

  const handleConfirm = () => {
    if (!currentUser) {
      onGoRegister()
      return
    }
    setConfirmed(true)
    onConfirm({
      classId: bookingClass.id,
      className: bookingClass.name,
      trainer: bookingClass.trainer,
      time: bookingClass.time,
      date,
    })
  }

  return (
    <Modal
      open={!!bookingClass}
      onClose={handleClose}
      title={confirmed ? 'Reserva confirmada' : 'Reservar clase'}
    >
      {confirmed ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-volt/15">
            <CheckCircle2 className="h-10 w-10 text-volt" />
          </span>
          <h3 className="mt-5 font-display text-2xl font-bold uppercase text-white">
            Reserva realizada correctamente
          </h3>
          <p className="mt-2 max-w-md text-muted">
            Te esperamos el{' '}
            <span className="font-semibold capitalize text-white">{formatDate(date)}</span> a las{' '}
            <span className="font-semibold text-white">{bookingClass.time}</span> en{' '}
            <span className="font-semibold text-accent">{bookingClass.name}</span>.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 rounded-xl bg-accent px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
          >
            Listo
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {!currentUser && (
            <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
              <LogIn className="h-5 w-5 shrink-0 text-accent" />
              <span className="text-muted">
                Necesitas una cuenta para reservar.{' '}
                <button
                  type="button"
                  onClick={onGoRegister}
                  className="font-semibold text-accent underline-offset-2 hover:underline"
                >
                  Inicia sesión o regístrate aquí
                </button>
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-line">
            <div className="bg-card-2 px-5 py-4">
              <p className="font-display text-xl font-semibold uppercase text-white">
                {bookingClass.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-accent" />
                  {bookingClass.time}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4 text-accent" />
                  {bookingClass.trainer}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-accent" />
                  {available} cupos disponibles
                </span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="bk-date" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <CalendarDays className="h-3.5 w-3.5 text-accent" />
              Selecciona la fecha
            </label>
            <input
              id="bk-date"
              type="date"
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field"
            />
          </div>

          <button
            type="button"
            disabled={full}
            onClick={handleConfirm}
            className={`btn-sheen flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold uppercase tracking-wide transition ${
              full
                ? 'cursor-not-allowed border border-line text-muted'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            Confirmar reserva
          </button>
        </div>
      )}
    </Modal>
  )
}