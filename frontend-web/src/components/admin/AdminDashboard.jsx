import { useEffect, useState } from 'react'
import {
  Activity,
  Banknote,
  CalendarCheck,
  CalendarClock,
  ArrowDownRight,
  ArrowUpRight,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import useAdminDashboard from '../../hooks/useAdminDashboard'

const MAX_OCCUPANCY = 100

function KpiCard({ icon: Icon, label, value, sub, tone = 'accent' }) {
  const toneClass =
    tone === 'volt'
      ? 'border-volt/30 bg-volt/10 text-volt'
      : tone === 'amber'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
        : 'border-accent/30 bg-accent/10 text-accent'
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-3 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function ClassBar({ name, booked, occupancy, max }) {
  const width = Math.min(MAX_OCCUPANCY, Math.round((occupancy / max) * 100))
  return (
    <li className="flex items-center gap-4">
      <span className="w-32 shrink-0 truncate text-sm font-semibold text-white">{name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-card">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-volt"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-28 shrink-0 text-right">
        <span className="text-sm font-bold text-white">{booked}</span>
        <span className="ml-1 text-xs text-muted">reservas</span>
        <span className="ml-2 text-xs font-semibold text-volt">{occupancy}%</span>
      </div>
    </li>
  )
}

function DayClassRow({ cls }) {
  const capacity = cls.capacity || cls.capacidad || 0
  const booked = cls.booked || cls.reservas_count || 0
  const occupancy = capacity > 0 ? Math.round((booked / capacity) * 100) : 0
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{cls.name || cls.nombre}</p>
        <p className="text-xs text-muted">
          {cls.time || String(cls.hora_inicio || '').slice(0, 5) || '—'}
          {cls.trainer || cls.entrenador ? ` · ${cls.trainer || cls.entrenador}` : ''}
        </p>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
          occupancy >= 90
            ? 'border-red-500/40 bg-red-500/10 text-red-400'
            : occupancy >= 70
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-volt/40 bg-volt/10 text-volt'
        }`}
      >
        {booked}/{capacity} · {occupancy}%
      </span>
    </li>
  )
}

function monthLabel(offset = 0) {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return date.toLocaleDateString('es-BO', { month: 'long' })
}

function TrendChart({ data, fmtMoney }) {
  const width = 760
  const height = 220
  const inset = { top: 12, right: 12, bottom: 24, left: 12 }
  const plotWidth = width - inset.left - inset.right
  const plotHeight = height - inset.top - inset.bottom
  const maximum = Math.max(1, ...data.flatMap((item) => [item.actual, item.anterior]))
  const points = (key) => data.map((item, index) => {
    const x = inset.left + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotWidth)
    const y = inset.top + plotHeight - (item[key] / maximum) * plotHeight
    return `${x},${y}`
  }).join(' ')
  const currentTotal = data.reduce((sum, item) => sum + item.actual, 0)
  const previousTotal = data.reduce((sum, item) => sum + item.anterior, 0)
  const ticks = [0, 1, 2, 3].map((index) => maximum * (index / 3))

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold uppercase tracking-wide text-white">Tendencia de ingresos</h3>
          <p className="mt-1 text-xs text-muted">Comparación diaria · {monthLabel()} vs. {monthLabel(-1)}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-2 text-white"><i className="h-2.5 w-2.5 rounded-full bg-accent" />Este mes <strong>{fmtMoney(currentTotal)}</strong></span>
          <span className="inline-flex items-center gap-2 text-muted"><i className="h-2.5 w-2.5 rounded-full bg-volt" />Mes anterior <strong>{fmtMoney(previousTotal)}</strong></span>
        </div>
      </div>
      <div className="mt-5 w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Ingresos diarios: ${fmtMoney(currentTotal)} este mes y ${fmtMoney(previousTotal)} el mes anterior`}>
          {ticks.map((tick, index) => {
            const y = inset.top + plotHeight - (index / 3) * plotHeight
            return <line key={index} x1={inset.left} x2={width - inset.right} y1={y} y2={y} stroke="rgba(255,255,255,.09)" strokeDasharray="4 6" />
          })}
          <polyline points={points('anterior')} fill="none" stroke="#d8f34e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={points('actual')} fill="none" stroke="#ff4d00" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x={inset.left} y={height - 4} fill="#9b9ba3" fontSize="11">Día 1</text>
          <text x={width - inset.right} y={height - 4} fill="#9b9ba3" fontSize="11" textAnchor="end">Día {data.length}</text>
        </svg>
      </div>
    </section>
  )
}

function CashFlowSummary({ ingresos, egresos, flujoNeto, fmtMoney }) {
  const maximum = Math.max(1, ingresos, egresos)
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:col-span-2">
      <h3 className="font-display text-base font-semibold uppercase tracking-wide text-white">Flujo de caja del mes</h3>
      <p className="mt-1 text-xs text-muted">Ingresos menos egresos registrados.</p>
      <div className="mt-6 space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-2 text-muted"><ArrowUpRight className="h-4 w-4 text-volt" />Ingresos</span><strong className="text-white">{fmtMoney(ingresos)}</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-volt" style={{ width: `${(ingresos / maximum) * 100}%` }} /></div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-2 text-muted"><ArrowDownRight className="h-4 w-4 text-red-300" />Egresos</span><strong className="text-white">{fmtMoney(egresos)}</strong></div>
          <div className="h-2 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-red-400" style={{ width: `${(egresos / maximum) * 100}%` }} /></div>
        </div>
      </div>
      <div className="mt-7 border-t border-line pt-5">
        <p className="text-xs uppercase tracking-wide text-muted">Flujo neto estimado</p>
        <p className={`mt-1 font-display text-3xl font-bold ${flujoNeto >= 0 ? 'text-volt' : 'text-red-300'}`}>{fmtMoney(flujoNeto)}</p>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">Los egresos provienen de gastos registrados localmente en este navegador.</p>
    </section>
  )
}

export default function AdminDashboard() {
  const {
    today,
    sociosActivos,
    porVencer,
    ingresosMes,
    ingresosMesAnterior,
    nuevasAltas,
    bajasMes,
    tasaChurn,
    egresosMes,
    flujoNeto,
    trend,
    isDemoData,
    reservasDelDia,
    ranking,
    clasesDelDia,
    refresh,
    fmtMoney,
    fmtInt,
  } = useAdminDashboard()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // Refresco inicial best-effort (sincronización con sistema externo).
    // oxlint-disable-next-line react/set-state-in-effect
    refresh().then(() => setRefreshing(false))
  }, [refresh])

  const maxBooked = ranking.length > 0 ? ranking[0].booked : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
            <LayoutDashboard className="h-5 w-5 text-accent" />
            Dashboard de Métricas
          </h2>
          <p className="mt-1 text-xs text-muted">Resumen general del gimnasio · {today}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            refresh().finally(() => setRefreshing(false))
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas KPI principales */}
      {isDemoData && <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-xs text-amber-200">Mostrando métricas de demostración: no se pudo cargar la información financiera real.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={Users}
          label="Socios Activos"
          value={fmtInt(sociosActivos)}
          sub={
            <span className="inline-flex items-center gap-1 text-volt">
              <TrendingUp className="h-3.5 w-3.5" />
              Membresías vigentes
            </span>
          }
          tone="volt"
        />
        <KpiCard
          icon={Banknote}
          label="Ingresos del Mes"
          value={fmtMoney(ingresosMes)}
          sub={`${fmtMoney(ingresosMesAnterior)} el mes anterior`}
        />
        <KpiCard icon={TrendingUp} label="Nuevas Altas" value={fmtInt(nuevasAltas)} sub="Perfiles creados este mes" tone="volt" />
        <KpiCard icon={CalendarClock} label="Bajas / No Renovaciones" value={fmtInt(bajasMes)} sub={`${tasaChurn}% de churn estimado`} tone="amber" />
        <KpiCard icon={CalendarClock} label="Membresías por Vencer" value={fmtInt(porVencer)} sub="A renovar en los próximos 5 días" tone="amber" />
        <KpiCard
          icon={CalendarCheck}
          label="Reservas del Día"
          value={fmtInt(reservasDelDia)}
          sub="Cupos reservados en clases de hoy"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <TrendChart data={trend} fmtMoney={fmtMoney} />
        <CashFlowSummary ingresos={ingresosMes} egresos={egresosMes} flujoNeto={flujoNeto} fmtMoney={fmtMoney} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Clases más concurridas */}
        <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-3">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
            <Activity className="h-4 w-4 text-accent" />
            Clases más concurridas
          </h3>
          <p className="mt-1 text-xs text-muted">Ocupación acumulada por actividad grupal.</p>
          <ul className="mt-5 space-y-4">
            {ranking.map((r) => (
              <ClassBar
                key={r.name}
                name={r.name}
                booked={r.booked}
                occupancy={r.occupancy}
                max={maxBooked}
              />
            ))}
            {ranking.length === 0 && (
              <li className="text-sm text-muted">Aún no hay clases registradas.</li>
            )}
          </ul>
        </div>

        {/* Clases y reservas del día */}
        <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
            <CalendarCheck className="h-4 w-4 text-accent" />
            Clases de hoy
          </h3>
          <p className="mt-1 text-xs text-muted">
            {clasesDelDia.length} clases · {fmtInt(reservasDelDia)} cupos reservados.
          </p>
          <ul className="mt-5 space-y-2.5">
            {clasesDelDia.map((cls) => (
              <DayClassRow key={cls.id || `${cls.name}-${cls.time}-${cls.date}`} cls={cls} />
            ))}
            {clasesDelDia.length === 0 && (
              <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-card/40 px-4 py-8 text-center">
                <UserCheck className="h-8 w-8 text-line" />
                <p className="text-sm text-muted">No hay clases programadas para hoy.</p>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}