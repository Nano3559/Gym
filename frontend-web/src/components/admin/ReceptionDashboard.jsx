import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  Cake,
  ClipboardPlus,
  Plus,
  ReceiptText,
  UserRoundPlus,
  Wallet,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { METODOS_PAGO, todayISO } from '../../data/adminData'
import { getMembershipStatus } from '../../lib/membershipStatus'
import { appendCashOperation, getCashOperations } from '../../services/receptionCashService'
import { loadCashShiftTransactions, loadCurrentCashShift, recordCashExpense } from '../../services/cashRegisterService'

function readCashEntries() {
  return getCashOperations()
}

function money(amount) {
  return `${Math.round(amount).toLocaleString('es-BO')} Bs.`
}

function QuickAction({ icon: Icon, label, onClick, tone = 'accent' }) {
  const styles = tone === 'volt'
    ? 'border-volt/30 bg-volt/10 text-volt hover:bg-volt/20'
    : tone === 'red'
      ? 'border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20'
      : 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/20'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-28 flex-col items-start justify-between rounded-xl border p-4 text-left transition ${styles}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-bold">{label}</span>
    </button>
  )
}

function CashEntryModal({ type, onClose, onSave, clients }) {
  const isSale = type === 'sale'
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('efectivo')
  const [clientId, setClientId] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Indica un concepto y un importe mayor que cero.')
      return
    }
    const client = clients.find((item) => item.id === clientId)
    onSave({
      type,
      description: description.trim(),
      amount: parsedAmount,
      method,
      clientName: client ? `${client.nombre} ${client.apellido}`.trim() : '',
    })
  }

  return (
    <Modal open onClose={onClose} title={isSale ? 'Nueva venta (POS)' : 'Registrar gasto'}>
      <form className="space-y-4" onSubmit={submit}>
        {isSale && (
          <label className="block text-sm text-muted">
            Socio (opcional)
            <select className="field mt-2" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Venta sin socio asociado</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.nombre} {client.apellido}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm text-muted">
          {isSale ? 'Producto o concepto' : 'Concepto del gasto'}
          <input
            autoFocus
            className="field mt-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={isSale ? 'Ej. renovación de membresía' : 'Ej. insumos de limpieza'}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          Importe (Bs.)
          <input
            className="field mt-2"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          Método de pago
          <select className="field mt-2" value={method} onChange={(event) => setMethod(event.target.value)}>
            {METODOS_PAGO.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">
          Los movimientos se guardan en este navegador y no se sincronizan con la caja del servidor.
        </p>
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-hover" type="submit">
          <Plus className="h-4 w-4" /> Registrar {isSale ? 'venta' : 'gasto'}
        </button>
      </form>
    </Modal>
  )
}

export default function ReceptionDashboard({ clients, attendance, onNewClient, onOpenPOS, onToast }) {
  const today = todayISO()
  const [cashEntries, setCashEntries] = useState(readCashEntries)
  const [entryType, setEntryType] = useState(null)

  const todayEntries = useMemo(
    () => cashEntries.filter((entry) => entry.date === today),
    [cashEntries, today]
  )
  const [activeShift, setActiveShift] = useState(null)
  const [shiftTransactions, setShiftTransactions] = useState([])
  const [localShift, setLocalShift] = useState(false)

  useEffect(() => {
    let mounted = true
    loadCurrentCashShift()
      .then(async (result) => {
        if (!mounted) return
        setActiveShift(result.shift)
        setLocalShift(result.local)
        setShiftTransactions(result.shift ? await loadCashShiftTransactions(result.shift.id, result.local) : [])
      })
      .catch(() => {
        if (mounted) setActiveShift(null)
      })
    return () => { mounted = false }
  }, [])
  const cashSummary = useMemo(() => todayEntries.reduce((summary, entry) => {
    if (entry.type === 'sale') summary.sales += entry.amount
    else summary.expenses += entry.amount
    return summary
  }, { sales: 0, expenses: 0 }), [todayEntries])
  const cashOnly = (localShift
    ? todayEntries.filter((entry) => entry.shiftId === activeShift?.id)
    : shiftTransactions).reduce((summary, entry) => {
    if ((entry.method || entry.payment_method) !== 'efectivo') return summary
    const type = entry.type || entry.transaction_type
    if (type === 'sale') summary.sales += Number(entry.amount) || 0
    if (type === 'expense') summary.expenses += Number(entry.amount) || 0
    return summary
  }, { sales: 0, expenses: 0 })
  const currentCash = Number(activeShift?.openingCash || 0) + cashOnly.sales - cashOnly.expenses

  const alerts = useMemo(() => {
    const birthdays = clients.filter((client) => {
      if (!client.fechaNacimiento) return false
      const [, month, day] = client.fechaNacimiento.split('-')
      const [, todayMonth, todayDay] = today.split('-')
      return month === todayMonth && day === todayDay
    }).map((client) => ({
      id: `birthday-${client.id}`,
      icon: Cake,
      title: `Cumpleaños: ${client.nombre} ${client.apellido}`,
      detail: 'Hoy',
      tone: 'text-volt',
    }))

    const expiredCheckIns = attendance
      .filter((item) => item.fecha === today)
      .map((item) => {
        const client = clients.find((candidate) => candidate.id === item.client?.id)
        return client && getMembershipStatus(client.fechaVencimiento).key === 'vencida'
          ? { item, client }
          : null
      })
      .filter(Boolean)
      .map(({ item, client }) => ({
        id: `expired-${item.id}`,
        icon: AlertTriangle,
        title: `Ingreso con cuota vencida: ${client.nombre} ${client.apellido}`,
        detail: item.hora || 'Ingreso registrado hoy',
        tone: 'text-red-300',
      }))

    return [...expiredCheckIns, ...birthdays]
  }, [attendance, clients, today])

  const saveCashEntry = async (entry) => {
    const currentShift = await loadCurrentCashShift()
    const shift = currentShift.shift
    if (!shift) {
      onToast('Abre un turno en Control de Caja antes de registrar movimientos.', 'error')
      setEntryType(null)
      return
    }
    try {
      const savedExpense = await recordCashExpense({
        shiftId: shift.id,
        description: entry.description,
        amount: entry.amount,
        method: entry.method,
        local: currentShift.local,
      })
      const nextEntry = appendCashOperation({
        ...(savedExpense.operation || {}),
        ...entry,
        type: 'expense',
        date: today,
        time: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
        shiftId: shift.id,
        method: entry.method,
      })
      setShiftTransactions((current) => [{ ...nextEntry, transaction_type: 'expense', payment_method: entry.method }, ...current])
      const nextEntries = [nextEntry, ...cashEntries]
      setCashEntries(nextEntries)
      setEntryType(null)
      onToast(`${entry.type === 'sale' ? 'Venta' : 'Gasto'} registrado en la caja del turno.`)
    } catch (error) {
      onToast(error.message || 'No se pudo registrar el gasto en la caja.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">Operación de recepción</h2>
        <p className="mt-1 text-xs text-muted">Caja y alertas del día · {today}</p>
      </div>

      <section aria-label="Accesos directos" className="grid gap-3 sm:grid-cols-3">
        <QuickAction icon={UserRoundPlus} label="Nuevo socio" onClick={onNewClient} />
        <QuickAction icon={ReceiptText} label="Nueva venta (POS)" onClick={onOpenPOS} tone="volt" />
        <QuickAction icon={ClipboardPlus} label="Registrar gasto" onClick={() => setEntryType('expense')} tone="red" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de caja actual">
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"><Wallet className="h-4 w-4 text-accent" /> Caja actual</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{money(currentCash)}</p>
            <p className="mt-1 text-xs text-muted">{activeShift ? 'Saldo en efectivo del turno' : 'Abre un turno para iniciar caja'}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"><Banknote className="h-4 w-4 text-volt" /> Ventas del día</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{money(cashSummary.sales)}</p>
          <p className="mt-1 text-xs text-muted">{todayEntries.filter((entry) => entry.type === 'sale').length} operaciones</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"><ReceiptText className="h-4 w-4 text-red-300" /> Gastos del día</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{money(cashSummary.expenses)}</p>
          <p className="mt-1 text-xs text-muted">{todayEntries.filter((entry) => entry.type === 'expense').length} registros</p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h3 className="font-display text-base font-semibold uppercase tracking-wide text-white">Centro de alertas</h3>
            <p className="mt-1 text-xs text-muted">Cumpleaños e ingresos con membresía vencida de hoy.</p>
          </div>
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-bold text-white">{alerts.length}</span>
        </div>
        <ul className="divide-y divide-line">
          {alerts.map((alert) => {
            const Icon = alert.icon
            return (
              <li key={alert.id} className="flex items-center gap-3 py-3">
                <Icon className={`h-4 w-4 shrink-0 ${alert.tone}`} />
                <span className="min-w-0 flex-1 text-sm text-white">{alert.title}</span>
                <span className="text-xs text-muted">{alert.detail}</span>
              </li>
            )
          })}
          {alerts.length === 0 && <li className="py-5 text-sm text-muted">No hay alertas operativas por ahora.</li>}
        </ul>
      </section>

      {entryType && (
        <CashEntryModal
          type={entryType}
          clients={clients}
          onClose={() => setEntryType(null)}
          onSave={saveCashEntry}
        />
      )}
    </div>
  )
}