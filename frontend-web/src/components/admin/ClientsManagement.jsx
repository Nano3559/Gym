import { useState } from 'react'
import {
  CalendarCheck,
  Check,
  FileDown,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  User,
  WalletCards,
  Snowflake,
  MessageCircle,
  UserRoundPlus,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { getMembershipStatus } from '../../lib/membershipStatus'
import { PLAN_LIST, METODOS_PAGO } from '../../data/adminData'

const STATUS_STYLES = {
  activa: 'border-volt/40 bg-volt/10 text-volt',
  por_vencer: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  vencida: 'border-red-500/50 bg-red-500/10 text-red-400',
  congelada: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status.key]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status.key === 'congelada'
            ? 'bg-sky-400'
            : status.key === 'activa'
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

function EditProfileModal({ client, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nombre: client.nombre || '',
    apellido: client.apellido || '',
    ci: client.ci || '',
    telefono: client.telefono || '',
  }))
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const result = await onSave(form)
    setSaving(false)
    if (result.ok) onClose()
  }

  return (
    <Modal open onClose={onClose} title="Editar perfil">
      <form className="space-y-4" onSubmit={submit}>
        {[
          ['nombre', 'Nombre'], ['apellido', 'Apellido'], ['ci', 'CI'], ['telefono', 'Teléfono'],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm text-muted">
            {label}
            <input
              className="field mt-2"
              value={form[key]}
              onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
              required
            />
          </label>
        ))}
        <button disabled={saving} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          <Check className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </Modal>
  )
}

function PaymentHistoryModal({ client, payments, loading, error, onClose }) {
  return (
    <Modal open onClose={onClose} title={`Pagos · ${client.nombre} ${client.apellido}`}>
      {loading ? (
        <p className="text-sm text-muted">Cargando historial de pagos...</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-300">{error}</p>
      ) : payments.length ? (
        <ul className="divide-y divide-line">
          {payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="text-white">{payment.plans?.nombre || 'Membresía'} · {payment.estado_pago}</span>
              <span className="text-right text-muted">
                <strong className="text-volt">{Number(payment.monto).toLocaleString('es-BO')} Bs.</strong>
                <span className="ml-2">{new Date(payment.created_at).toLocaleDateString('es-BO')}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No hay pagos registrados para este socio.</p>
      )}
    </Modal>
  )
}

export default function ClientsManagement({
  clients,
  onRenewMembership,
  onUpdateClient,
  onSetMembershipFrozen,
  onGetClientPayments,
  onGetClientHistory,
  onNewClient,
  onToast,
  isAdmin = false,
}) {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [renewClient, setRenewClient] = useState(null)
  const [freezeClient, setFreezeClient] = useState(null)
  const [editClient, setEditClient] = useState(null)
  const [historyClient, setHistoryClient] = useState(null)
  const [detailClient, setDetailClient] = useState(null)
  const [detailPayments, setDetailPayments] = useState([])
  const [detailAttendance, setDetailAttendance] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [payments, setPayments] = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsError, setPaymentsError] = useState('')
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
    .map((c) => ({
      ...c,
      status: c.membresiaEstado === 'congelada'
        ? { key: 'congelada', label: 'Congelada' }
        : getMembershipStatus(c.fechaVencimiento),
    }))
    .filter((client) => {
      if (statusFilter === 'vencidos') return client.status.key === 'vencida'
      if (statusFilter === 'activos') return client.status.key === 'activa'
      return true
    })

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

  const handleEditSave = async (changes) => {
    const result = await onUpdateClient(editClient.id, changes)
    onToast(result.ok ? 'Perfil actualizado.' : result.message, result.ok ? 'success' : 'error')
    return result
  }

  const handleFreeze = async () => {
    if (!freezeClient) return
    const shouldFreeze = freezeClient.membresiaEstado !== 'congelada'
    const result = await onSetMembershipFrozen(freezeClient.id, shouldFreeze)
    onToast(
      result.ok
        ? shouldFreeze ? 'Membresía congelada.' : 'Membresía reactivada.'
        : result.message,
      result.ok ? 'success' : 'error'
    )
    setFreezeClient(null)
  }

  const handlePaymentHistory = async (client) => {
    setHistoryClient(client)
    setPayments([])
    setPaymentsError('')
    setPaymentsLoading(true)
    const result = await onGetClientPayments(client.id)
    setPayments(result.payments || [])
    setPaymentsError(result.ok ? '' : result.message)
    setPaymentsLoading(false)
  }

  const handleClientDetails = async (client) => {
    setDetailClient(client)
    setDetailPayments([])
    setDetailAttendance([])
    setDetailError('')
    setDetailLoading(true)
    const result = await onGetClientHistory(client.id)
    setDetailPayments(result.payments || [])
    setDetailAttendance(result.attendance || [])
    setDetailError(result.ok ? '' : result.message)
    setDetailLoading(false)
  }

  const handleWhatsApp = (client) => {
    const phone = String(client.telefono || '').replace(/\D/g, '')
    if (!phone) {
      onToast('Este socio no tiene un número telefónico registrado.', 'error')
      setOpenMenuId(null)
      return
    }
    const internationalPhone = phone.startsWith('591') ? phone : `591${phone.replace(/^0+/, '')}`
    window.open(`https://wa.me/${internationalPhone}`, '_blank', 'noopener,noreferrer')
    setOpenMenuId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Gestión de clientes
          </h2>
          <p className="mt-1 text-xs text-muted">
            Consulta perfiles, membresías, pagos y datos de contacto.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNewClient}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
          >
            <UserRoundPlus className="h-4 w-4" /> Nuevo Socio
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => downloadClientsCsv(clients)}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:border-accent hover:text-accent"
            >
              <FileDown className="h-4 w-4" /> Exportar CSV
            </button>
          )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado">
              {[
                ['todos', 'Todos'], ['vencidos', 'Solo Vencidos'], ['activos', 'Solo Activos'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={statusFilter === value}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${statusFilter === value ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar por nombre, CI o código"
                className="field pl-10"
                aria-label="Buscar clientes"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
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
                      {isAdmin ? (
                        <button type="button" onClick={() => handleClientDetails(c)} className="text-left font-semibold text-white underline-offset-4 hover:text-accent hover:underline">
                          {c.nombre} {c.apellido}
                        </button>
                      ) : (
                        <span className="font-semibold text-white">{c.nombre} {c.apellido}</span>
                      )}
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openRenew(c)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-accent hover:text-white"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Renovar
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Más acciones para ${c.nombre} ${c.apellido}`}
                          aria-expanded={openMenuId === c.id}
                          onClick={() => setOpenMenuId((current) => current === c.id ? null : c.id)}
                          className="rounded-lg border border-line p-2 text-muted transition hover:border-accent hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-line bg-card p-1 text-left shadow-xl">
                            <button type="button" onClick={() => { setEditClient(c); setOpenMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white hover:bg-card-2"><Pencil className="h-4 w-4 text-accent" />Editar Perfil</button>
                            <button type="button" onClick={() => { setOpenMenuId(null); handlePaymentHistory(c) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white hover:bg-card-2"><WalletCards className="h-4 w-4 text-volt" />Ver Historial de Pagos</button>
                            <button type="button" onClick={() => { setFreezeClient(c); setOpenMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white hover:bg-card-2"><Snowflake className="h-4 w-4 text-sky-300" />{c.membresiaEstado === 'congelada' ? 'Reactivar Membresía' : 'Congelar Membresía'}</button>
                            <button type="button" onClick={() => handleWhatsApp(c)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white hover:bg-card-2"><MessageCircle className="h-4 w-4 text-volt" />Contactar por WhatsApp</button>
                          </div>
                        )}
                      </div>
                    </div>
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
      {editClient && (
        <EditProfileModal
          key={editClient.id}
          client={editClient}
          onClose={() => setEditClient(null)}
          onSave={handleEditSave}
        />
      )}
      {historyClient && (
        <PaymentHistoryModal
          client={historyClient}
          payments={payments}
          loading={paymentsLoading}
          error={paymentsError}
          onClose={() => setHistoryClient(null)}
        />
      )}
      {detailClient && (
        <ClientHistoryModal
          client={detailClient}
          payments={detailPayments}
          attendance={detailAttendance}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailClient(null)}
        />
      )}
      {freezeClient && (
        <Modal
          open
          onClose={() => setFreezeClient(null)}
          title={freezeClient.membresiaEstado === 'congelada' ? 'Reactivar membresía' : 'Congelar membresía'}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-sky-300">
                <Snowflake className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-white">{freezeClient.nombre} {freezeClient.apellido}</p>
                <p className="mt-1 text-xs text-muted">
                  {freezeClient.membresiaEstado === 'congelada'
                    ? 'La membresía volverá a estar activa.'
                    : 'El socio perderá temporalmente el acceso incluido en su membresía.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setFreezeClient(null)}
                className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-muted transition hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFreeze}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-hover"
              >
                <Snowflake className="h-4 w-4" />
                {freezeClient.membresiaEstado === 'congelada' ? 'Reactivar' : 'Confirmar congelamiento'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ClientHistoryModal({ client, payments, attendance, loading, error, onClose }) {
  const lifetimeValue = payments
    .filter((payment) => payment.estado_pago === 'completado')
    .reduce((total, payment) => total + (Number(payment.monto) || 0), 0)

  return (
    <Modal open onClose={onClose} title={`${client.nombre} ${client.apellido}`} maxWidth="max-w-3xl">
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['CI', client.ci || '—'],
            ['Teléfono', client.telefono || '—'],
            ['Plan', client.planNombre || client.plan || '—'],
            ['Vencimiento', client.fechaVencimiento || '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-card px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-volt/30 bg-volt/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-volt">Life Time Value</p>
          <p className="mt-1 font-display text-3xl font-bold text-white">{lifetimeValue.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.</p>
          <p className="mt-1 text-xs text-muted">Total de pagos completados registrados en Supabase.</p>
        </section>
        {loading ? (
          <p className="text-sm text-muted">Cargando pagos y asistencias...</p>
        ) : error ? (
          <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="min-w-0">
              <h4 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold uppercase text-white"><WalletCards className="h-4 w-4 text-accent" /> Historial de pagos</h4>
              <div className="max-h-64 overflow-auto rounded-xl border border-line">
                {payments.length ? payments.map((payment) => (
                  <article key={payment.id} className="border-b border-line px-3 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">{payment.plans?.nombre || 'Pago'}</span>
                      <strong className="whitespace-nowrap text-volt">{Number(payment.monto).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.</strong>
                    </div>
                    <p className="mt-1 text-xs text-muted">{new Date(payment.created_at).toLocaleString('es-BO')} · {payment.metodo_pago} · {payment.estado_pago}</p>
                    <p className="mt-1 break-all text-[11px] text-muted">Recibo: {payment.transaction_id || payment.id}</p>
                  </article>
                )) : <p className="px-3 py-5 text-sm text-muted">No hay pagos registrados.</p>}
              </div>
            </section>
            <section className="min-w-0">
              <h4 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold uppercase text-white"><CalendarCheck className="h-4 w-4 text-accent" /> Registro de asistencias</h4>
              <div className="max-h-64 overflow-auto rounded-xl border border-line">
                {attendance.length ? attendance.map((visit) => (
                  <article key={visit.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-white">{new Date(`${visit.fecha}T00:00:00`).toLocaleDateString('es-BO')}</p>
                      <p className="mt-1 text-xs text-muted">{visit.plan || 'Ingreso al gimnasio'}</p>
                    </div>
                    <span className="text-xs text-muted">{String(visit.hora || '').slice(0, 5) || '—'}</span>
                  </article>
                )) : <p className="px-3 py-5 text-sm text-muted">No hay asistencias registradas.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </Modal>
  )
}

function downloadClientsCsv(clients) {
  const headers = ['Nombre', 'Apellido', 'CI', 'Teléfono', 'Correo', 'Plan', 'Fecha de inicio', 'Vencimiento', 'Estado']
  const escapeCell = (value) => {
    let text = String(value ?? '')
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const rows = clients.map((client) => [
    client.nombre,
    client.apellido,
    client.ci,
    client.telefono,
    client.email || client.correo,
    client.planNombre || client.plan,
    client.fechaInicio,
    client.fechaVencimiento,
    client.membresiaEstado === 'congelada' ? 'Congelada' : getMembershipStatus(client.fechaVencimiento).label,
  ])
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `socios-ironforge-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}