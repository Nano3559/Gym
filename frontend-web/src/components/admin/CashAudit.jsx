import { useEffect, useState } from 'react'
import { Banknote, RefreshCw } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { getCashOperations, getCashShifts } from '../../services/receptionCashService'

const money = (amount) => `${Number(amount || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.`
const stamp = (value) => value ? new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default function CashAudit() {
  const [shifts, setShifts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [localOnly, setLocalOnly] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      if (!isSupabaseConfigured || !supabase) {
        const localShifts = getCashShifts()
        setShifts(localShifts.map((shift) => ({
          id: shift.id,
          operator: shift.operator || 'Recepción (local)',
          openedAt: shift.openedAt,
          closedAt: shift.closedAt,
          openingCash: shift.openingCash,
          expectedCash: shift.expectedCash,
          closingCash: shift.closingCash,
          difference: shift.difference,
        })))
        setTransactions(getCashOperations())
        setLocalOnly(true)
        setError('La caja central requiere Supabase y la migración de auditoría; estos turnos solo existen en este navegador.')
        return
      }
      const { data: shiftRows, error: shiftError } = await supabase
        .from('cash_register_shifts')
        .select('id, user_id, operator_email, opening_cash, opened_at, closing_cash, expected_cash, difference, closed_at')
        .order('opened_at', { ascending: false })
        .limit(100)
      if (shiftError) throw shiftError
      const ids = (shiftRows || []).map((shift) => shift.id)
      const { data: transactionRows, error: transactionError } = ids.length
        ? await supabase.from('cash_register_transactions').select('*').in('shift_id', ids).order('created_at', { ascending: false })
        : { data: [], error: null }
      if (transactionError) throw transactionError
      setShifts((shiftRows || []).map((shift) => ({
        id: shift.id,
        operator: shift.operator_email,
        openedAt: shift.opened_at,
        closedAt: shift.closed_at,
        openingCash: Number(shift.opening_cash),
        expectedCash: shift.expected_cash == null ? null : Number(shift.expected_cash),
        closingCash: shift.closing_cash == null ? null : Number(shift.closing_cash),
        difference: shift.difference == null ? null : Number(shift.difference),
      })))
      setTransactions(transactionRows || [])
      setLocalOnly(false)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar la auditoría de cajas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [])

  const transactionsFor = (shift) => transactions.filter((item) => (item.shift_id || item.shiftId) === shift.id)
  const expectedFromTransactions = (shift) => {
    const cashMovements = transactionsFor(shift).filter((item) => (item.payment_method || item.method) === 'efectivo')
    return Number(shift.openingCash) + cashMovements.reduce((total, item) => {
      const amount = Number(item.amount) || 0
      return total + ((item.transaction_type || item.type) === 'sale' ? amount : -amount)
    }, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase text-white"><Banknote className="h-5 w-5 text-accent" /> Auditoría de Cajas</h2><p className="mt-1 text-xs text-muted">Turnos abiertos/cerrados, efectivo del sistema, declarado y diferencia.</p></div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200">{error}</p>}
      {loading ? <p className="text-sm text-muted">Cargando turnos...</p> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead><tr className="border-b border-line bg-card/40 text-xs uppercase text-muted"><th className="px-4 py-3">Recepcionista</th><th className="px-4 py-3">Apertura</th><th className="px-4 py-3">Cierre</th><th className="px-4 py-3 text-right">Inicial</th><th className="px-4 py-3 text-right">Esperado sistema</th><th className="px-4 py-3 text-right">Contado</th><th className="px-4 py-3 text-right">Diferencia</th><th className="px-4 py-3">Estado</th></tr></thead>
            <tbody>
              {shifts.map((shift) => {
                const computedExpected = expectedFromTransactions(shift)
                const expected = shift.expectedCash == null ? computedExpected : Number(shift.expectedCash)
                const difference = shift.difference == null && shift.closingCash != null ? shift.closingCash - expected : shift.difference
                return <tr key={shift.id} className="border-b border-line/60"><td className="px-4 py-3 font-medium text-white">{shift.operator}</td><td className="px-4 py-3 text-muted">{stamp(shift.openedAt)}</td><td className="px-4 py-3 text-muted">{stamp(shift.closedAt)}</td><td className="px-4 py-3 text-right text-white">{money(shift.openingCash)}</td><td className="px-4 py-3 text-right text-white">{money(expected)}</td><td className="px-4 py-3 text-right text-white">{shift.closingCash == null ? '—' : money(shift.closingCash)}</td><td className={`px-4 py-3 text-right font-bold ${difference == null ? 'text-muted' : difference === 0 ? 'text-volt' : 'text-red-300'}`}>{difference == null ? '—' : money(difference)}</td><td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${shift.closedAt ? 'border-line text-muted' : 'border-volt/30 bg-volt/10 text-volt'}`}>{shift.closedAt ? 'Cerrado' : 'Abierto'}</span></td></tr>
              })}
              {!shifts.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No hay turnos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {localOnly && <p className="text-xs text-muted">Los movimientos locales no son una fuente contable central y solo se muestran como referencia.</p>}
    </div>
  )
}
