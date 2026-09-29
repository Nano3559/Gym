import { useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CalendarRange,
  FileBarChart,
  Users,
  Activity,
  FileDown,
  Plus,
  ReceiptText,
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
    expenses,
    classRanking,
    activas,
    vencidas,
    totalClientes,
    refresh,
    createExpense,
    isDemoPayments,
    expensesAreLocal,
    dataError,
    fmtMoney,
    fmtInt,
  } = useAdminReports()

  const [rangeType, setRangeType] = useState('mes')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    categoria: 'Alquiler',
    descripcion: '',
    monto: '',
    metodo: 'efectivo',
    fecha: todayStr(),
  })
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [expenseMessage, setExpenseMessage] = useState('')

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
  const filteredExpenses = expenses.filter((expense) => inRange(expense.fecha, rangeType, from, to))
  const egresosTotal = filteredExpenses.reduce((total, expense) => total + (Number(expense.monto) || 0), 0)
  const resultadoNeto = ingresosTotal - egresosTotal
  const maxMethod = Math.max(1, ...METHOD_KEYS.map((k) => byMethod[k].total))

  const activeShare = totalClientes > 0 ? Math.round((activas / totalClientes) * 100) : 0
  const maxClass = classRanking.length ? classRanking[0].booked : 1

  const exportCsv = (filename, headers, rows) => {
    const escapeCell = (value) => {
      let text = String(value ?? '')
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
      return `"${text.replaceAll('"', '""')}"`
    }
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExpenseSubmit = async (event) => {
    event.preventDefault()
    const amount = Number(expenseForm.monto)
    if (!expenseForm.descripcion.trim() || !Number.isFinite(amount) || amount <= 0) {
      setExpenseMessage('Ingresa una descripción y un importe mayor que cero.')
      return
    }
    setExpenseSaving(true)
    setExpenseMessage('')
    const result = await createExpense({ ...expenseForm, descripcion: expenseForm.descripcion.trim(), monto: amount })
    setExpenseSaving(false)
    if (!result.ok) {
      setExpenseMessage(result.message)
      return
    }
    setExpenseForm((current) => ({ ...current, descripcion: '', monto: '' }))
    setExpenseMessage(result.local ? 'Gasto guardado localmente en este navegador.' : 'Gasto guardado en Supabase.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
            <FileBarChart className="h-5 w-5 text-accent" />
            Reportes detallados
          </h2>
          <p className="mt-1 text-xs text-muted">
            Análisis por período · Ingresos, egresos, flujo financiero y actividad de clientes.
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

      {(dataError || isDemoPayments || expensesAreLocal) && (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200">
          {dataError || (isDemoPayments ? 'Los ingresos mostrados son datos de demostración.' : 'Los egresos mostrados se guardan localmente en este navegador.')}
          {!dataError && isDemoPayments && expensesAreLocal ? ' Los gastos también son locales.' : ''}
        </p>
      )}

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

      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white"><ReceiptText className="h-4 w-4 text-accent" /> Egresos · Gastos operativos</h3>
            <p className="mt-1 text-xs text-muted">Registra sueldos, alquiler, servicios, mantenimiento, compras y otros gastos.</p>
          </div>
          <button
            type="button"
            onClick={() => exportCsv(
              `ingresos-${todayStr()}.csv`,
              ['Fecha', 'Cliente', 'Método', 'Recibo', 'Importe (Bs.)'],
              filtered.map((payment) => [payment.fecha, payment.cliente, METHOD_NAMES[payment.metodo] || payment.metodo, payment.receiptId || payment.id, payment.monto])
            )}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-white hover:border-accent hover:text-accent"
          ><FileDown className="h-4 w-4" /> Exportar ingresos CSV</button>
        </div>

        <form onSubmit={handleExpenseSubmit} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-xs text-muted">Categoría
            <select className="field mt-1.5" value={expenseForm.categoria} onChange={(event) => setExpenseForm((current) => ({ ...current, categoria: event.target.value }))}>
              {['Sueldos', 'Alquiler', 'Luz', 'Agua', 'Mantenimiento', 'Compra de suplementos', 'Servicios', 'Otros'].map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted sm:col-span-2">Descripción
            <input className="field mt-1.5" value={expenseForm.descripcion} onChange={(event) => setExpenseForm((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Detalle del gasto" required />
          </label>
          <label className="text-xs text-muted">Importe (Bs.)
            <input className="field mt-1.5" type="number" min="0.01" step="0.01" value={expenseForm.monto} onChange={(event) => setExpenseForm((current) => ({ ...current, monto: event.target.value }))} required />
          </label>
          <label className="text-xs text-muted">Fecha
            <input className="field mt-1.5" type="date" value={expenseForm.fecha} onChange={(event) => setExpenseForm((current) => ({ ...current, fecha: event.target.value }))} required />
          </label>
          <div className="flex items-end">
            <button disabled={expenseSaving} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-hover disabled:opacity-60"><Plus className="h-4 w-4" />{expenseSaving ? 'Guardando...' : 'Registrar gasto'}</button>
          </div>
          <label className="text-xs text-muted">Medio de pago
            <select className="field mt-1.5" value={expenseForm.metodo} onChange={(event) => setExpenseForm((current) => ({ ...current, metodo: event.target.value }))}>
              {METHOD_KEYS.map((key) => <option key={key} value={key}>{METHOD_NAMES[key]}</option>)}
            </select>
          </label>
          {expenseMessage && <p className="self-end pb-3 text-xs text-muted" role="status">{expenseMessage}</p>}
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-sm text-muted">{filteredExpenses.length} gastos · Total <strong className="text-red-300">{fmtMoney(egresosTotal)}</strong></p>
          <button
            type="button"
            onClick={() => exportCsv(
              `egresos-${todayStr()}.csv`,
              ['Fecha', 'Categoría', 'Descripción', 'Método', 'Importe (Bs.)'],
              filteredExpenses.map((expense) => [expense.fecha, expense.categoria, expense.descripcion, METHOD_NAMES[expense.metodo] || expense.metodo, expense.monto])
            )}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-white hover:border-accent hover:text-accent"
          ><FileDown className="h-4 w-4" /> Exportar egresos CSV</button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-line bg-card/40 text-xs uppercase text-muted"><th className="px-3 py-2.5">Fecha</th><th className="px-3 py-2.5">Categoría</th><th className="px-3 py-2.5">Descripción</th><th className="px-3 py-2.5">Método</th><th className="px-3 py-2.5 text-right">Importe</th></tr></thead>
            <tbody>
              {filteredExpenses.map((expense) => <tr key={expense.id} className="border-b border-line/60"><td className="px-3 py-3 text-muted">{expense.fecha}</td><td className="px-3 py-3 text-white">{expense.categoria}</td><td className="px-3 py-3 text-muted">{expense.descripcion}</td><td className="px-3 py-3 text-muted">{METHOD_NAMES[expense.metodo] || expense.metodo}</td><td className="px-3 py-3 text-right font-semibold text-red-300">{fmtMoney(expense.monto)}</td></tr>)}
              {!filteredExpenses.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">No hay gastos para este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-surface to-volt/5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Estado de resultados · {RANGE_OPTIONS.find((option) => option.value === rangeType)?.label}</p>
            <h3 className="mt-2 font-display text-lg font-semibold uppercase text-white">Ingresos − egresos = resultado neto</h3>
          </div>
          <p className={`font-display text-4xl font-bold ${resultadoNeto >= 0 ? 'text-volt' : 'text-red-300'}`}>{fmtMoney(resultadoNeto)}</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-black/20 p-4"><p className="text-xs uppercase text-muted">Ingresos</p><p className="mt-1 text-lg font-bold text-white">{fmtMoney(ingresosTotal)}</p></div>
          <div className="rounded-lg border border-line bg-black/20 p-4"><p className="text-xs uppercase text-muted">Egresos</p><p className="mt-1 text-lg font-bold text-red-300">− {fmtMoney(egresosTotal)}</p></div>
          <div className="rounded-lg border border-line bg-black/20 p-4"><p className="text-xs uppercase text-muted">Margen neto</p><p className="mt-1 text-lg font-bold text-white">{ingresosTotal > 0 ? `${Math.round((resultadoNeto / ingresosTotal) * 100)}%` : '—'}</p></div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">El resultado usa únicamente pagos completados y gastos registrados para el período seleccionado. No incluye impuestos, depreciación ni gastos no registrados.</p>
      </section>

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