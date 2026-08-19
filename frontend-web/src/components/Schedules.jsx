import { useState } from 'react'
import { CalendarCheck, Clock3, User, Users, Flame, History } from 'lucide-react'
import { scheduleDays } from '../data/gymData'

function CapacityBar({ available, capacity }) {
  const pct = Math.round(((capacity - available) / capacity) * 100)
  const full = available <= 0
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${full ? 'bg-red-500' : pct > 75 ? 'bg-volt' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium ${full ? 'text-red-400' : 'text-muted'}`}>
        {full ? 'Lleno' : `${available} cupos`}
      </span>
    </div>
  )
}

export default function Schedules({ classesByDay, onReserve, onViewBookings, bookingsCount }) {
  const [activeDay, setActiveDay] = useState('lun')

  const classes = classesByDay?.[activeDay] || []

  return (
    <section id="horarios" className="relative bg-surface py-20 sm:py-24">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="section-label">
              <span className="h-px w-8 bg-accent" />
              Horarios
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
              Agenda tu <span className="text-gradient">semana</span>
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Selecciona un día y reserva tu clase con cupos en tiempo real. Los
              horarios se actualizan automáticamente al confirmar.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewBookings}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-white transition hover:border-accent hover:text-accent"
          >
            <History className="h-4 w-4" />
            Mis reservas
            {bookingsCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                {bookingsCount}
              </span>
            )}
          </button>
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          {scheduleDays.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setActiveDay(day.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeDay === day.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'border border-line bg-card text-muted hover:border-accent/50 hover:text-white'
              }`}
            >
              {day.name}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line bg-card-2">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Hora
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Clase
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Entrenador
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Cupos
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted">
                      {activeDay === 'dom'
                        ? 'Domingo: cerrado. ¡Recarga energías para la próxima semana!'
                        : 'No hay clases programadas este día.'}
                    </td>
                  </tr>
                )}
                {classes.map((cls) => {
                  const available = cls.capacity - cls.booked
                  const full = available <= 0
                  return (
                    <tr
                      key={cls.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-card-2/50"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 font-display text-base font-semibold text-white">
                          <Clock3 className="h-4 w-4 text-accent" />
                          {cls.time}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{cls.name}</p>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] uppercase tracking-wide text-volt">
                          <Flame className="h-3 w-3" />
                          {cls.name !== 'Open Gym' ? 'Clase grupal' : 'Acceso libre'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                          <User className="h-4 w-4 text-accent" />
                          {cls.trainer}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-32">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                            <Users className="h-3.5 w-3.5 text-accent" />
                            {available}/{cls.capacity}
                          </span>
                          <CapacityBar available={available} capacity={cls.capacity} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          disabled={full}
                          onClick={() => onReserve(cls)}
                          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                            full
                              ? 'cursor-not-allowed border border-line text-muted'
                              : 'btn-sheen bg-accent text-white hover:bg-accent-hover'
                          }`}
                        >
                          {full ? 'Completa' : 'Reservar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted">
          <CalendarCheck className="h-4 w-4 text-accent" />
          Los cupos se confirman al momento de reservar · Sábado Open Gym sin cita previa
        </p>
      </div>
    </section>
  )
}