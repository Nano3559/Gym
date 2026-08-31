import { useMemo, useState } from 'react'
import {
  CalendarCheck,
  Clock3,
  User,
  Flame,
  History,
  Lock,
  Moon,
  Info,
} from 'lucide-react'
import { scheduleDays } from '../data/gymData'
import { isClassIncluded } from '../lib/planAccess'

const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB']
const MONTH_ABBR = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
]

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

function ClassCard({ cls, dayId, planCode, onReserve, onPlanBlocked }) {
  const available = cls.capacity - cls.booked
  const full = available <= 0
  const notIncluded = Boolean(planCode) && !isClassIncluded(planCode, dayId, cls.time)

  const handleClick = () => {
    if (notIncluded) {
      onPlanBlocked?.(cls)
      return
    }
    onReserve(cls)
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-card p-3 transition hover:border-accent/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-white">{cls.name}</p>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-volt">
          <Flame className="h-3 w-3" />
          {cls.name !== 'Open Gym' ? 'Grupal' : 'Libre'}
        </span>
      </div>

      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        <User className="h-3.5 w-3.5 text-accent" />
        {cls.trainer}
      </p>

      <div className="flex-1">
        <CapacityBar available={available} capacity={cls.capacity} />
      </div>

      <div className="mt-3">
        {notIncluded ? (
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[11px] font-semibold text-muted"
            title="No incluido en tu plan"
          >
            <Lock className="h-3 w-3" />
            No incluido
          </button>
        ) : (
          <button
            type="button"
            disabled={full}
            onClick={handleClick}
            className={`w-full rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
              full
                ? 'cursor-not-allowed border border-line text-muted'
                : 'btn-sheen bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {full ? 'Completa' : 'Reservar'}
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyCell() {
  return (
    <div className="flex h-full min-h-16 items-center justify-center rounded-xl border border-dashed border-line/50 text-[11px] text-muted/50">
      —
    </div>
  )
}

export default function Schedules({
  classesByDay,
  onReserve,
  onViewBookings,
  bookingsCount,
  planCode,
  onPlanBlocked,
}) {
  const [activeDay, setActiveDay] = useState('lun')

  // Fechas exactas de la semana actual (Lunes a Domingo) calculadas automáticamente.
  const week = useMemo(() => {
    const now = new Date()
    const diffToMonday = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - diffToMonday)
    return scheduleDays.map((day, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      return {
        id: day.id,
        name: day.name,
        abbr: DAY_ABBR[date.getDay()],
        dayNum: String(date.getDate()).padStart(2, '0'),
        month: MONTH_ABBR[date.getMonth()],
      }
    })
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Horarios únicos ordenados para las filas de la matriz.
  const allTimes = useMemo(() => {
    const set = new Set()
    for (const list of Object.values(classesByDay || {})) {
      for (const cls of list) set.add(cls.time)
    }
    return [...set].sort()
  }, [classesByDay])

  const getClassesAt = (dayId, time) =>
    (classesByDay?.[dayId] || []).filter((cls) => cls.time === time)

  const activeClasses = classesByDay?.[activeDay] || []
  const activeLabel = week.find((d) => d.id === activeDay)

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
              Vista semanal de todas las clases con cupos en tiempo real. Los
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

        <div className="mt-6 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-muted">
          <Info className="h-4 w-4 shrink-0 text-accent" />
          <span>
            Nota: Puedes reservar un máximo de <strong className="font-semibold text-white">5 clases
            grupales por día</strong>.
          </span>
        </div>

        {/* ------- Vista escritorio: matriz semanal de 7 columnas ------- */}
        <div className="mt-10 hidden overflow-hidden rounded-2xl border border-line bg-card lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-line bg-card-2">
                  <th className="w-16 px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Hora
                  </th>
                  {week.map((day) => (
                    <th key={day.id} className="px-2 py-4 text-center">
                      <span className="block text-[11px] font-bold uppercase tracking-widest text-accent">
                        {day.abbr}
                      </span>
                      <span className="mt-0.5 block font-display text-lg font-bold text-white">
                        {day.dayNum} {day.month}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTimes.map((time) => (
                  <tr key={time} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-white">
                        <Clock3 className="h-4 w-4 text-accent" />
                        {time}
                      </span>
                    </td>
                    {week.map((day) => {
                      const list = getClassesAt(day.id, time)
                      return (
                        <td key={day.id} className="w-[12%] px-2 py-3 align-top">
                          <div className="space-y-2">
                            {list.length === 0 ? (
                              <EmptyCell />
                            ) : (
                              list.map((cls) => (
                                <ClassCard
                                  key={cls.id}
                                  cls={cls}
                                  dayId={day.id}
                                  planCode={planCode}
                                  onReserve={onReserve}
                                  onPlanBlocked={onPlanBlocked}
                                />
                              ))
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ------- Vista móvil: pestañas diarias con fecha destacada ------- */}
        <div className="mt-10 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {week.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => setActiveDay(day.id)}
                className={`flex shrink-0 flex-col items-center rounded-xl px-4 py-2.5 transition ${
                  activeDay === day.id
                    ? 'bg-accent text-white shadow-lg shadow-accent/30'
                    : 'border border-line bg-card text-muted hover:border-accent/50 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {day.abbr}
                </span>
                <span className="mt-0.5 text-sm font-bold">{day.dayNum}</span>
                <span className="text-[10px] opacity-80">{day.month}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line bg-card-2 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
                  {activeLabel?.abbr} · {activeLabel?.name}
                </p>
                <p className="font-display text-2xl font-bold uppercase text-white">
                  {activeLabel?.dayNum} {activeLabel?.month}
                </p>
              </div>
              {activeDay === 'dom' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted">
                  <Moon className="h-3.5 w-3.5" />
                  Cerrado
                </span>
              )}
            </div>
            <div className="p-4">
              {activeClasses.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  {activeDay === 'dom'
                    ? 'Domingo: cerrado. ¡Recarga energías para la próxima semana!'
                    : 'No hay clases programadas este día.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {activeClasses.map((cls) => (
                    <div key={cls.id} className="flex items-stretch gap-3">
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-card-2">
                        <Clock3 className="h-4 w-4 text-accent" />
                        <span className="mt-1 font-display text-sm font-bold text-white">
                          {cls.time}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <ClassCard
                          cls={cls}
                          dayId={activeDay}
                          planCode={planCode}
                          onReserve={onReserve}
                          onPlanBlocked={onPlanBlocked}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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