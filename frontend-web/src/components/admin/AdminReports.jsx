import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CalendarRange,
  FileBarChart,
  Users,
  Activity,
} from 'lucide-react'
import useAdminReports, {
  METHOD_KEYS,
  METHOD_NAMES,
} from '../../hooks/useAdminReports'

const RANGE_OPTIONS = [
  { value: 'hoy', label: 'Hoy (Día)' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes', label: 'Este Mes' },
  { value: 'rango', label: 'Rango personalizado' },
]

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function startOfWeek() {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return fmtDate(d)
}

function fmtDate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function monthPrefix(dateStr) {
  return String(dateStr).slice(0, 7)
}

function inRange(dateStr, type, from, to) {
  const today = todayStr()
  if (type === 'hoy') return dateStr === today
  if (type === 'semana') return dateStr >= startOfWeek() && dateStr <= today
  if (type === 'mes') return monthPrefix(dateStr) === monthPrefix(today)
  if (type === 'rango') {
    const a = from || '0000-00-00'
    const b = to || '9999-12-31'
    return dateStr >= a && dateStr <= b
  }
  return true
}

function Bar({ value, max, tone = 'accent' }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-card">
      <div
        className={`h-full rounded-full ${
          tone === 'volt' ? 'bg-volt' : tone === 'amber' ? 'bg-amber-400' : 'bg-gradient-to-r from-accent to-volt'
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export default function AdminReports() {
  const {
    payments,
    classRanking,
    activas,
    vencidas,
    totalClientes,
    refresh,
    fmtMoney,
    fmtInt,
  } = useAdminReports()

  const [rangeType, setRangeType] = useState('mes')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // Refresco inicial best-effort (sincronización con sistema externo).
    // oxlint-disable-next-line react/set-state-in-effect
    refresh().then(() => setRefreshing(false))
  }, [refresh])

  const filtered = useMemo(
    () => payments.filter((p) => inRange(p.fecha, rangeType, from, to)),
    [payments, rangeType, from, to]
  )

  const byMethod = useMemo(() => {
    const map = Object.fromEntries(METHOD_KEYS.map((k) => [k, { count: 0, total: 0 }]))
    for (const p of filtered) {
      const m = map[p.metodo] || (map[p.metodo] = { count: 0, total: 0 })
      m.count += 1
      m.total += p.monto || 0
    }
    return map
  }, [filtered])

  const ingresosTotal = filtered.reduce((acc, p) => acc + (p.monto || 0), 0)
  const maxMethod = Math.max(1, ...METHOD_KEYS.map((k) => byMethod[k].total))

  const activeShare = totalClientes > 0 ? Math.round((activas / totalClientes) * 100) : 0
  const maxClass = classRanking.length ? classRanking[0].booked : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
            <FileBarChart className="h-5 w-5 text-accent" />
            Reportes detallados
          </h2>
          <p className="mt-1 text-xs text-muted">
            Análisis por período · Ingresos, asistencias y estado de clientes.
          </p>
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
          <Activity className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <CalendarRange className="h-4 w-4 text-accent" />
          Filtrar por período
        </h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRangeType(opt.value)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                rangeType === opt.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {rangeType === 'rango' && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="field"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="field"
              />
            </label>
          </div>
        )}
      </div>

      {/* Reporte de ingresos y pagos por método */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
          <Banknote className="h-4 w-4 text-accent" />
          Ingresos y Pagos
        </h3>
        <p className="mt-1 text-xs text-muted">
          {filtered.length} pagos · Total <span className="font-semibold text-volt">{fmtMoney(ingresosTotal)}</span>
        </p>
        <ul className="mt-5 space-y-4">
          {METHOD_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-4">
              <span className="w-28 shrink-0 text-sm font-semibold text-white">
                {METHOD_NAMES[key]}
              </span>
              <Bar value={byMethod[key].total} max={maxMethod} tone={key === 'tarjeta' ? 'amber' : 'accent'} />
              <div className="w-40 shrink-0 text-right">
                <span className="text-sm font-bold text-white">{fmtMoney(byMethod[key].total)}</span>
                <span className="ml-2 text-xs text-muted">{byMethod[key].count} pagos</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reporte de asistencias y reservas */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
            <Users className="h-4 w-4 text-accent" />
            Asistencias y Reservas
          </h3>
          <p className="mt-1 text-xs text-muted">Clases con mayor concurrencia en el período.</p>
          <ul className="mt-5 space-y-4">
            {classRanking.map((c) => (
              <li key={c.name} className="flex items-center gap-4">
                <span className="w-32 shrink-0 truncate text-sm font-semibold text-white">
                  {c.name}
                </span>
                <Bar value={c.booked} max={maxClass} />
                <div className="w-28 shrink-0 text-right">
                  <span className="text-sm font-bold text-white">{c.booked}</span>
                  <span className="ml-1 text-xs text-muted">reservas</span>
                  <span className="ml-2 text-xs font-semibold text-volt">{c.occupancy}%</span>
                </div>
              </li>
            ))}
            {classRanking.length === 0 && (
              <li className="text-sm text-muted">Sin datos en el período.</li>
            )}
          </ul>
        </div>

        {/* Reporte de estado de clientes/membresías */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
            <Users className="h-4 w-4 text-accent" />
            Estado de Clientes / Membresías
          </h3>
          <p className="mt-1 text-xs text-muted">Membresías activas vs. vencidas.</p>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-gradient-to-r from-volt to-accent"
                style={{ width: `${activeShare}%` }}
              />
            </div>
            <span className="text-sm font-bold text-volt">{activeShare}%</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-volt/30 bg-volt/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Activas</p>
              <p className="mt-1 font-display text-3xl font-bold text-volt">{fmtInt(activas)}</p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Vencidas</p>
              <p className="mt-1 font-display text-3xl font-bold text-red-400">{fmtInt(vencidas)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            Total de socios registrados: <span className="font-semibold text-white">{fmtInt(totalClientes)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}