import { CalendarDays, CalendarPlus, Clock3, User, XCircle, Inbox } from 'lucide-react'
import Modal from './ui/Modal'

const statusStyle = {
  Confirmada: 'bg-volt/15 text-volt',
  Cancelada: 'bg-red-500/15 text-red-400',
}

// Módulo 2: formatea la fecha en que se creó la reserva.
function formatCreatedAt(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyBookingsModal({ open, onClose, bookings, onCancel }) {
  return (
    <Modal open={open} onClose={onClose} title="Mis reservas" maxWidth="max-w-xl">
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card-2">
            <Inbox className="h-8 w-8 text-muted" />
          </span>
          <p className="mt-4 font-semibold text-white">Aún no tienes reservas</p>
          <p className="mt-1 text-sm text-muted">
            Revisa los horarios y reserva tu primera clase.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-line bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{booking.className}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyle[booking.status]}`}
                  >
                    {booking.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-accent" />
                    {booking.date || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-accent" />
                    {booking.time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-accent" />
                    {booking.trainer}
                  </span>
                  {formatCreatedAt(booking.createdAt) && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarPlus className="h-3.5 w-3.5 text-accent" />
                      Reservada el {formatCreatedAt(booking.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              {booking.status === 'Confirmada' && (
                <button
                  type="button"
                  onClick={() => onCancel(booking.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}