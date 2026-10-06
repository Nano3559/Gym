import { useState } from 'react'
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react'

function money(value) {
  return `${Number(value || 0).toLocaleString('es-BO')} Bs.`
}

export function CashRegister({ session, sessions, sales, expenses, onOpen, onClose, onToast }) {
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [observation, setObservation] = useState('')
  const [busy, setBusy] = useState(false)

  const submitOpen = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await onOpen(opening)
      setOpening('')
      onToast('Caja abierta. Registra tu fondo inicial.')
    } catch (error) {
      onToast(`No se pudo abrir la caja: ${error.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitClose = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await onClose({ reportedCash: counted, observation })
      setCounted('')
      setObservation('')
      onToast(`Caja cerrada. Diferencia: ${money(result.diferencia)}.`)
    } catch (error) {
      onToast(`No se pudo cerrar la caja: ${error.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const sessionStart = session ? new Date(session.inicio || session.startedAt).getTime() : 0
  const cashSales = session
    ? sales.filter((sale) => sale.metodo_pago === 'efectivo' || sale.metodoPago === 'efectivo')
      .filter((sale) => new Date(sale.created_at || sale.createdAt).getTime() >= sessionStart)
      .reduce((sum, sale) => sum + Number(sale.total), 0)
    : 0
  const cashExpenses = session
    ? expenses.filter((expense) => (expense.metodo_pago || expense.metodoPago || 'efectivo') === 'efectivo')
      .filter((expense) => new Date(expense.created_at || expense.createdAt).getTime() >= sessionStart)
      .reduce((sum, expense) => sum + Number(expense.monto), 0)
    : 0
  const expected = session
    ? Number(session.apertura_efectivo ?? session.openingCash) + cashSales - cashExpenses
    : 0

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          session ? 'bg-volt/10 text-volt' : 'bg-amber-400/10 text-amber-300'
        }`}>
          {session ? <LockKeyholeOpen className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold uppercase text-white">Control de Caja</h2>
          <p className="text-sm text-muted">
            {session ? 'Turno abierto' : 'Abre una caja para comenzar a registrar ventas'}
          </p>
        </div>
      </div>

      {!session ? (
        <form onSubmit={submitOpen} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Efectivo inicial (Bs.)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
              className="field"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-volt px-4 py-3 font-bold text-ink disabled:opacity-50"
          >
            {busy ? 'Abriendo…' : 'Abrir caja'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitClose} className="mt-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-card p-4">
              <dt className="text-xs text-muted">Fondo inicial</dt>
              <dd className="mt-1 font-bold text-white">{money(session.apertura_efectivo ?? session.openingCash)}</dd>
            </div>
            <div className="rounded-xl border border-line bg-card p-4">
              <dt className="text-xs text-muted">Ingresos en efectivo</dt>
              <dd className="mt-1 font-bold text-white">{money(cashSales)}</dd>
            </div>
            <div className="rounded-xl border border-line bg-card p-4">
              <dt className="text-xs text-muted">Efectivo esperado</dt>
              <dd className="mt-1 font-bold text-volt">{money(expected)}</dd>
            </div>
          </dl>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Efectivo contado al cierre (Bs.)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
              className="field"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Observación (opcional)
            </span>
            <input
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              className="field"
              maxLength={500}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Cerrando…' : 'Cerrar caja y hacer corte'}
          </button>
        </form>
      )}

      {sessions.length > 0 && (
        <p className="mt-4 text-xs text-muted">Historial de cortes: {sessions.length} turnos.</p>
      )}
    </section>
  )
}

export function CashAudit({ sessions }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase text-white">Auditoría de Cajas</h2>
        <p className="mt-1 text-sm text-muted">Aperturas, cierres y diferencias reportadas por recepción.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-card/40 text-xs uppercase text-muted">
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Cierre</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Fondo</th>
              <th className="px-4 py-3">Esperado</th>
              <th className="px-4 py-3">Declarado</th>
              <th className="px-4 py-3">Diferencia</th>
              <th className="px-4 py-3">Observación</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-b border-line/60 text-muted">
                <td className="px-4 py-3">{new Date(session.inicio || session.startedAt).toLocaleString('es-BO')}</td>
                <td className="px-4 py-3">{session.cierre || session.closedAt
                  ? new Date(session.cierre || session.closedAt).toLocaleString('es-BO')
                  : 'Abierta'}</td>
                <td className="px-4 py-3">{session.staffName || session.staff_id || '—'}</td>
                <td className="px-4 py-3">{money(session.apertura_efectivo ?? session.openingCash)}</td>
                <td className="px-4 py-3">{money(session.efectivo_esperado ?? session.expectedCash)}</td>
                <td className="px-4 py-3">{money(session.efectivo_declarado ?? session.reportedCash)}</td>
                <td className={`px-4 py-3 font-semibold ${
                  Number(session.diferencia ?? session.difference) === 0 ? 'text-volt' : 'text-red-400'
                }`}>
                  {session.cierre || session.closedAt
                    ? money(session.diferencia ?? session.difference)
                    : 'Pendiente'}
                </td>
                <td className="px-4 py-3">{session.observacion || '—'}</td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Aún no hay turnos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
