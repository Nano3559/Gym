import { useMemo, useState } from 'react'
import { Banknote, CheckCircle2, CircleDollarSign, LockKeyhole, Printer, UnlockKeyhole } from 'lucide-react'
import {
  closeCashShift,
  getActiveCashShift,
  getCashOperations,
  getCashShifts,
  openCashShift,
} from '../../services/receptionCashService'

const money = (amount) => `${Number(amount).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.`
const dateTime = (value) => new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })

export default function CashControl({ onToast }) {
  const [activeShift, setActiveShift] = useState(getActiveCashShift)
  const [shifts, setShifts] = useState(getCashShifts)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [error, setError] = useState('')
  const [lastCut, setLastCut] = useState(null)

  const shiftOperations = useMemo(() => {
    if (!activeShift) return []
    return getCashOperations().filter((operation) => operation.shiftId === activeShift.id)
  }, [activeShift])
  const cashTotals = useMemo(() => shiftOperations.reduce((totals, operation) => {
    if (operation.method !== 'efectivo') return totals
    if (operation.type === 'sale') totals.sales += Number(operation.amount) || 0
    if (operation.type === 'expense') totals.expenses += Number(operation.amount) || 0
    return totals
  }, { sales: 0, expenses: 0 }), [shiftOperations])
  const expectedCash = activeShift
    ? Number(activeShift.openingCash) + cashTotals.sales - cashTotals.expenses
    : 0

  const handleOpenShift = (event) => {
    event.preventDefault()
    const amount = Number(openingAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Ingresa un monto inicial válido, igual o mayor que cero.')
      return
    }
    const shift = openCashShift(amount)
    if (!shift) {
      setError('Ya existe un turno abierto en este navegador.')
      return
    }
    setActiveShift(shift)
    setShifts(getCashShifts())
    setOpeningAmount('')
    setError('')
    onToast('Turno de caja abierto.')
  }

  const handleCloseShift = (event) => {
    event.preventDefault()
    const amount = Number(closingAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Ingresa el efectivo contado, igual o mayor que cero.')
      return
    }
    const cut = closeCashShift(activeShift.id, amount, expectedCash)
    if (!cut) {
      setError('No se encontró el turno abierto para cerrar.')
      return
    }
    setLastCut(cut)
    setActiveShift(null)
    setShifts(getCashShifts())
    setClosingAmount('')
    setError('')
    onToast('Corte de caja registrado.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">Control de caja</h2>
        <p className="mt-1 text-xs text-muted">Apertura de turno, control de efectivo y corte de cierre.</p>
      </div>

      {activeShift ? (
        <>
          <section className="flex flex-col gap-4 rounded-xl border border-volt/30 bg-volt/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-volt"><UnlockKeyhole className="h-4 w-4" /> Turno abierto</p>
              <p className="mt-2 text-sm text-white">Apertura: {dateTime(activeShift.openedAt)}</p>
              <p className="mt-1 text-xs text-muted">Efectivo inicial: {money(activeShift.openingCash)}</p>
            </div>
            <span className="rounded-lg border border-volt/20 bg-black/20 px-4 py-2 font-display text-xl font-bold text-white">{money(expectedCash)} esperado</span>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-5"><p className="text-xs uppercase tracking-wide text-muted">Efectivo inicial</p><p className="mt-2 font-display text-2xl font-bold text-white">{money(activeShift.openingCash)}</p></div>
            <div className="rounded-xl border border-line bg-surface p-5"><p className="text-xs uppercase tracking-wide text-muted">Ventas en efectivo</p><p className="mt-2 font-display text-2xl font-bold text-volt">{money(cashTotals.sales)}</p></div>
            <div className="rounded-xl border border-line bg-surface p-5"><p className="text-xs uppercase tracking-wide text-muted">Gastos en efectivo</p><p className="mt-2 font-display text-2xl font-bold text-red-300">{money(cashTotals.expenses)}</p></div>
          </section>

          <form onSubmit={handleCloseShift} className="max-w-xl space-y-4 rounded-xl border border-line bg-surface p-5">
            <div>
              <h3 className="font-display text-base font-semibold uppercase text-white">Cerrar turno y hacer corte</h3>
              <p className="mt-1 text-xs text-muted">Cuenta el efectivo físico. El sistema comparará el monto con el saldo esperado.</p>
            </div>
            <label className="block text-sm text-muted">Efectivo contado (Bs.)<input className="field mt-2" type="number" min="0" step="0.01" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} required /></label>
            <div className="flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3 text-sm"><span className="text-muted">Diferencia esperada</span><strong className="text-white">{closingAmount === '' ? 'Se calculará al cerrar' : money(Number(closingAmount) - expectedCash)}</strong></div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-hover"><LockKeyhole className="h-4 w-4" /> Registrar cierre</button>
          </form>
        </>
      ) : (
        <section className="max-w-xl rounded-xl border border-line bg-surface p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent"><CircleDollarSign className="h-5 w-5" /></span>
          <h3 className="mt-4 font-display text-base font-semibold uppercase text-white">Abrir turno</h3>
          <p className="mt-1 text-sm text-muted">Registra el efectivo físico con el que inicia la caja. Las ventas POS se habilitan al abrir el turno.</p>
          <form onSubmit={handleOpenShift} className="mt-5 space-y-4">
            <label className="block text-sm text-muted">Efectivo inicial (Bs.)<input className="field mt-2" type="number" min="0" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} required /></label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-hover"><Banknote className="h-4 w-4" /> Abrir caja</button>
          </form>
        </section>
      )}

      {lastCut && (
        <section className="cash-receipt max-w-xl rounded-xl border border-volt/30 bg-volt/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-volt"><CheckCircle2 className="h-4 w-4" /> Corte registrado</p><p className="mt-2 text-sm text-white">Turno iniciado {dateTime(lastCut.openedAt)} y cerrado {dateTime(lastCut.closedAt)}</p></div>
            <button type="button" onClick={() => window.print()} aria-label="Imprimir corte de caja" className="rounded-lg border border-line p-2 text-muted hover:text-white print:hidden"><Printer className="h-4 w-4" /></button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Efectivo inicial</dt><dd className="mt-1 font-semibold text-white">{money(lastCut.openingCash)}</dd></div>
            <div><dt className="text-muted">Efectivo esperado</dt><dd className="mt-1 font-semibold text-white">{money(lastCut.expectedCash)}</dd></div>
            <div><dt className="text-muted">Efectivo contado</dt><dd className="mt-1 font-semibold text-white">{money(lastCut.closingCash)}</dd></div>
            <div><dt className="text-muted">Diferencia</dt><dd className={`mt-1 font-semibold ${lastCut.difference === 0 ? 'text-volt' : 'text-amber-300'}`}>{money(lastCut.difference)}</dd></div>
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="font-display text-base font-semibold uppercase text-white">Turnos anteriores</h3>
        {shifts.filter((shift) => shift.closedAt).length ? (
          <ul className="mt-3 divide-y divide-line">
            {shifts.filter((shift) => shift.closedAt).slice(0, 8).map((shift) => (
              <li key={shift.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                <span className="text-muted">{dateTime(shift.closedAt)}</span>
                <span className="text-white">Esperado {money(shift.expectedCash)} · Contado {money(shift.closingCash)}</span>
                <strong className={shift.difference === 0 ? 'text-volt' : 'text-amber-300'}>Dif. {money(shift.difference)}</strong>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">Aún no hay cierres registrados.</p>}
      </section>
      <p className="text-xs text-muted">Los turnos y movimientos se guardan localmente en este navegador; todavía no se sincronizan con una caja central.</p>
    </div>
  )
}
