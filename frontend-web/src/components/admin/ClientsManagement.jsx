import { useState } from 'react'
import { RefreshCw, Search, User } from 'lucide-react'
import Modal from '../ui/Modal'
import { getMembershipStatus } from '../../lib/membershipStatus'
import { PLAN_LIST, METODOS_PAGO } from '../../data/adminData'

const STATUS_STYLES = {
  activa: 'border-volt/40 bg-volt/10 text-volt',
  por_vencer: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  vencida: 'border-red-500/50 bg-red-500/10 text-red-400',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status.key]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status.key === 'activa'
            ? 'bg-volt'
            : status.key === 'por_vencer'
              ? 'bg-amber-400'
              : 'bg-red-500'
        }`}
      />
      {status.label}
    </span>
  )
}

export default function ClientsManagement({ clients, onRenewMembership, onToast }) {
  const [filter, setFilter] = useState('')
  const [renewClient, setRenewClient] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('completo')
  const [metodoPago, setMetodoPago] = useState('efectivo')

  const rows = clients
    .filter((c) => {
      const q = filter.trim().toLowerCase()
      if (!q) return true
      return (
        `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
        String(c.ci || '').includes(q) ||
        String(c.id || '').toLowerCase().includes(q)
      )
    })
    .map((c) => ({ ...c, status: getMembershipStatus(c.fechaVencimiento) }))

  const openRenew = (client) => {
    setRenewClient(client)
    setSelectedPlan(client.plan || 'completo')
    setMetodoPago('efectivo')
  }

  const handleConfirmRenew = async () => {
    if (!renewClient) return
    const updated = await onRenewMembership(renewClient.id, selectedPlan, metodoPago)
    if (updated) onToast(`Membresía renovada para ${updated.nombre} ${updated.apellido}.`)
    setRenewClient(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Gestión de clientes
          </h2>
          <p className="mt-1 text-xs text-muted">
            Consulta el estado de cada socio y renueva sus membresías.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nombre, CI o código"
            className="field pl-10"
            aria-label="Filtrar clientes"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card/40 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">CI</th>
                <th className="px-4 py-3 font-semibold">Teléfono</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Inicio</th>
                <th className="px-4 py-3 font-semibold">Vencimiento</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line/60 transition hover:bg-card/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card-2 text-xs font-bold text-accent">
                        {c.nombre[0]}
                        {c.apellido[0]}
                      </span>
                      <span className="font-semibold text-white">
                        {c.nombre} {c.apellido}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.ci}</td>
                  <td className="px-4 py-3 text-muted">{c.telefono}</td>
                  <td className="px-4 py-3 font-medium text-white">{c.planNombre || c.plan}</td>
                  <td className="px-4 py-3 text-muted">{c.fechaInicio || '—'}</td>
                  <td className="px-4 py-3 text-muted">{c.fechaVencimiento || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openRenew(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-accent hover:text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Renovar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No hay clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(renewClient)}
        onClose={() => setRenewClient(null)}
        title="Renovar membresía"
      >
        {renewClient && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-card-2 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-white">
                  {renewClient.nombre} {renewClient.apellido}
                </p>
                <p className="text-xs text-muted">
                  CI {renewClient.ci} · Vence el {renewClient.fechaVencimiento || '—'}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Plan a renovar
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PLAN_LIST.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setSelectedPlan(p.code)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      selectedPlan === p.code
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-line text-muted hover:border-accent/40 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Método de pago
              </p>
              <div className="grid grid-cols-2 gap-2">
                {METODOS_PAGO.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMetodoPago(m.key)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${
                      metodoPago === m.key
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-line text-muted hover:border-accent/40 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-card-2 px-4 py-3 text-sm text-muted">
              La membresía se extenderá{' '}
              <span className="font-semibold text-white">30 días</span> a partir de la fecha de
              vencimiento vigente.
            </div>

            <button
              type="button"
              onClick={handleConfirmRenew}
              className="btn-sheen flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
            >
              <RefreshCw className="h-4 w-4" />
              Confirmar renovación
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}