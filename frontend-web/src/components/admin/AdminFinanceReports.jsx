import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Wallet } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { downloadCsv } from '../../lib/csv'

const LOCAL_EXPENSES = 'gym_reception_expenses'
const LOCAL_SALES = 'gym_pos_sales'
const CATEGORIES = ['Sueldos', 'Alquiler', 'Servicios', 'Insumos', 'Mantenimiento', 'Otros']

function localDate(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: localDate(start), to: localDate(new Date(end.getTime() - 86400000)) }
}

function amount(value) {
  return `${Number(value || 0).toLocaleString('es-BO')} Bs.`
}

export default function AdminFinanceReports({ onToast }) {
  const defaults = monthBounds()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [incomeRows, setIncomeRows] = useState([])
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState({ concepto: '', categoria: 'Servicios', monto: '', metodo_pago: 'efectivo' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData?.session) {
        const [payments, sales, expenseRows] = await Promise.all([
          supabase.from('payments')
            .select('id, monto, metodo_pago, estado_pago, created_at, transaction_id')
            .eq('estado_pago', 'completado').order('created_at', { ascending: false }).limit(5000),
          supabase.from('pos_sales')
            .select('id, receipt_number, total, metodo_pago, created_at')
            .order('created_at', { ascending: false }).limit(5000),
          supabase.from('operating_expenses')
            .select('id, concepto, categoria, monto, metodo_pago, created_at')
            .order('created_at', { ascending: false }).limit(5000),
        ])
        const failed = [payments, sales, expenseRows].find((result) => result.error)
        if (failed?.error) throw failed.error
        setIncomeRows([
          ...(payments.data || []).map((row) => ({ ...row, tipo: 'Membresía', monto: Number(row.monto) })),
          ...(sales.data || []).map((row) => ({
            ...row,
            tipo: 'POS',
            monto: Number(row.total),
            metodo_pago: row.metodo_pago,
            transaction_id: row.receipt_number,
          })),
        ])
        setExpenses(expenseRows.data || [])
        return
      }
    }
    const localSales = JSON.parse(window.localStorage.getItem(LOCAL_SALES) || '[]')
    const localExpenses = JSON.parse(window.localStorage.getItem(LOCAL_EXPENSES) || '[]')
    setIncomeRows(localSales.map((sale) => ({
      ...sale, tipo: 'POS', monto: Number(sale.total), created_at: sale.createdAt,
      metodo_pago: sale.metodoPago,
    })))
    setExpenses(localExpenses.map((expense) => ({
      ...expense, created_at: expense.createdAt, metodo_pago: expense.metodo_pago || expense.metodoPago,
    })))
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Initial async read loads the finance tables.
    refresh().catch((error) => onToast(`No se pudieron cargar finanzas: ${error.message}`, 'error'))
      .finally(() => setLoading(false))
  }, [refresh, onToast])

  const incomeFiltered = useMemo(() => incomeRows.filter((row) => {
    const date = localDate(row.created_at || row.createdAt)
    return date >= from && date <= to
  }), [incomeRows, from, to])
  const expensesFiltered = useMemo(() => expenses.filter((row) => {
    const date = localDate(row.created_at || row.createdAt)
    return date >= from && date <= to
  }), [expenses, from, to])
  const incomeTotal = incomeFiltered.reduce((sum, row) => sum + Number(row.monto || 0), 0)
  const expensesTotal = expensesFiltered.reduce((sum, row) => sum + Number(row.monto || 0), 0)

  const addExpense = async (event) => {
    event.preventDefault()
    if (!form.concepto.trim() || !Number.isFinite(Number(form.monto)) || Number(form.monto) <= 0) {
      onToast('Ingresa el concepto y un monto válido.', 'error')
      return
    }
    setSaving(true)
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (sessionData?.session) {
          const { error } = await supabase.from('operating_expenses').insert({
            ...form, concepto: form.concepto.trim(), monto: Number(form.monto),
          })
          if (error) throw error
        } else {
          const saved = { ...form, id: `local-${Date.now()}`, monto: Number(form.monto), createdAt: new Date().toISOString() }
          const rows = JSON.parse(window.localStorage.getItem(LOCAL_EXPENSES) || '[]')
          window.localStorage.setItem(LOCAL_EXPENSES, JSON.stringify([saved, ...rows]))
        }
      } else {
        const saved = { ...form, id: `local-${Date.now()}`, monto: Number(form.monto), createdAt: new Date().toISOString() }
        const rows = JSON.parse(window.localStorage.getItem(LOCAL_EXPENSES) || '[]')
        window.localStorage.setItem(LOCAL_EXPENSES, JSON.stringify([saved, ...rows]))
      }
      setForm({ concepto: '', categoria: 'Servicios', monto: '', metodo_pago: 'efectivo' })
      await refresh()
      onToast('Egreso registrado.')
    } catch (error) {
      onToast(`No se pudo registrar el egreso: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const exportAll = () => downloadCsv('estado-de-resultados-ironforge.csv', [
    ['Tipo', 'Fecha', 'Concepto', 'Categoría', 'Método de pago', 'Importe Bs.'],
    ...incomeFiltered.map((row) => ['Ingreso', row.created_at || row.createdAt, row.tipo, '', row.metodo_pago || '', row.monto]),
    ...expensesFiltered.map((row) => ['Egreso', row.created_at || row.createdAt, row.concepto, row.categoria, row.metodo_pago || '', row.monto]),
    ['Resultado neto', '', '', '', '', incomeTotal - expensesTotal],
  ])

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-semibold uppercase text-white">Finanzas · Estado de Resultados</h2>
        <p className="mt-1 text-sm text-muted">Ingresos, egresos y ganancia neta del período.</p>
      </header>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold uppercase text-muted">Desde
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="field mt-1.5" />
            </label>
            <label className="text-xs font-semibold uppercase text-muted">Hasta
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="field mt-1.5" />
            </label>
          </div>
          <button type="button" onClick={exportAll}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-white">
            <Download className="h-4 w-4" /> Exportar ingresos y egresos
          </button>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['Ingresos', incomeTotal, 'text-volt'],
          ['Egresos', expensesTotal, 'text-red-400'],
          ['Ganancia neta', incomeTotal - expensesTotal, 'text-white'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs uppercase text-muted">{label}</p>
            <p className={`mt-2 font-display text-2xl font-bold ${color}`}>{amount(value)}</p>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase text-white">
          <Wallet className="h-4 w-4 text-accent" /> Registrar egreso
        </h3>
        <form onSubmit={addExpense} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="field" placeholder="Concepto: alquiler, luz…" maxLength={160} required
            value={form.concepto} onChange={(event) => setForm((current) => ({ ...current, concepto: event.target.value }))} />
          <select className="field" value={form.categoria}
            onChange={(event) => setForm((current) => ({ ...current, categoria: event.target.value }))}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
          <input type="number" min="0.01" step="0.01" className="field" placeholder="Monto Bs." required
            value={form.monto} onChange={(event) => setForm((current) => ({ ...current, monto: event.target.value }))} />
          <button disabled={saving} className="rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Registrar egreso'}
          </button>
        </form>
      </section>
      {loading ? <p className="text-sm text-muted">Cargando movimientos…</p> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <MovementTable title="Ingresos" rows={incomeFiltered} income />
          <MovementTable title="Egresos" rows={expensesFiltered} />
        </div>
      )}
    </div>
  )
}

function MovementTable({ title, rows, income = false }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <h3 className="border-b border-line px-4 py-3 font-display font-semibold uppercase text-white">{title}</h3>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead><tr className="text-xs uppercase text-muted">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Concepto</th>
            <th className="px-4 py-3">Categoría / método</th>
            <th className="px-4 py-3 text-right">Monto</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || row.transaction_id || `${row.created_at}-${row.monto}`} className="border-t border-line/60">
                <td className="px-4 py-3 text-muted">{new Date(row.created_at || row.createdAt).toLocaleDateString('es-BO')}</td>
                <td className="px-4 py-3 font-medium text-white">{income ? row.tipo : row.concepto}</td>
                <td className="px-4 py-3 text-muted">{income ? row.metodo_pago : row.categoria}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{amount(row.monto)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Sin movimientos para el período.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
