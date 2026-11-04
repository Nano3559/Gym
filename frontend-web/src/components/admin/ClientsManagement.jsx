import { useState } from 'react'
import { Download, Ellipsis, ExternalLink, Plus, RefreshCw, Search, User } from 'lucide-react'
import Modal from '../ui/Modal'
import { getMembershipStatus } from '../../lib/membershipStatus'
import { PLAN_LIST, METODOS_PAGO } from '../../data/adminData'
import { downloadCsv } from '../../lib/csv'

const STATUS_STYLES = {
  activa: 'border-volt/40 bg-volt/10 text-volt',
  por_vencer: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  vencida: 'border-red-500/50 bg-red-500/10 text-red-400',
  congelada: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
}

function whatsappLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.length === 8 ? `591${digits}` : digits}`
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

export default function ClientsManagement({
  clients,
  onRenewMembership,
  onToast,
  onNewMember,
  onGetHistory,
  onUpdateClient,
  onFreezeMembership,
  isAdmin = false,
}) {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [renewClient, setRenewClient] = useState(null)
  const [detailClient, setDetailClient] = useState(null)
  const [history, setHistory] = useState({ payments: [], attendance: [] })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [profileClient, setProfileClient] = useState(null)
  const [freezeClient, setFreezeClient] = useState(null)
  const [freezeDays, setFreezeDays] = useState('7')
  const [saving, setSaving] = useState(false)
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
      status: c.congeladaHasta && new Date(c.congeladaHasta) > new Date()
        ? { key: 'congelada', label: 'Congelada' }
        : getMembershipStatus(c.fechaVencimiento),
    }))
    .filter((c) => statusFilter === 'todos'
      || (statusFilter === 'activos'
        ? c.status.key === 'activa' || c.status.key === 'por_vencer'
        : c.status.key === 'vencida'))

  const openDetails = async (client) => {
    setDetailClient(client)
    setHistoryLoading(true)
    try {
      setHistory(await onGetHistory?.(client.id) || { payments: [], attendance: [] })
    } catch (error) {
      onToast(`No se pudo cargar el historial: ${error.message}`, 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ['todos', 'Todos'],
            ['activos', 'Solo Activos'],
            ['vencidos', 'Solo Vencidos'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                statusFilter === key
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => downloadCsv('socios-ironforge.csv', [
                ['Nombre', 'Apellido', 'CI', 'Teléfono', 'Plan', 'Inicio', 'Vencimiento', 'Estado'],
                ...rows.map((c) => [c.nombre, c.apellido, c.ci, c.telefono,
                  c.planNombre || c.plan, c.fechaInicio, c.fechaVencimiento, c.status.label]),
              ])}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-white"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          )}
          <button
            type="button"
            onClick={onNewMember}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuevo Socio
          </button>
        </div>
      </div>
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
                      <button
                        type="button"
                        onClick={() => openDetails(c)}
                        className="text-left font-semibold text-white hover:text-accent"
                      >
                        {c.nombre} {c.apellido}
                      </button>
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
                        <RefreshCw className="h-3.5 w-3.5" />
                        Renovar
                      </button>
                      <details className="relative text-left">
                        <summary
                          aria-label={`Acciones de ${c.nombre} ${c.apellido}`}
                          className="list-none cursor-pointer rounded-lg border border-line p-2 text-muted hover:text-white"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-line bg-surface p-1 shadow-xl">
                          <button type="button" onClick={() => setProfileClient({ ...c })}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-card">
                            Editar Perfil
                          </button>
                          <button type="button" onClick={() => openDetails(c)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-card">
                            {isAdmin ? 'Ver Historial de Pagos' : 'Ver perfil'}
                          </button>
                          <button type="button" onClick={() => { setFreezeClient(c); setFreezeDays('7') }}
                            disabled={!c.membershipId}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-card disabled:opacity-40">
                            Congelar Membresía
                          </button>
                          {whatsappLink(c.telefono) ? (
                            <a href={whatsappLink(c.telefono)}
                              target="_blank" rel="noreferrer"
                              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white hover:bg-card">
                              Contactar por WhatsApp <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="block px-3 py-2 text-sm text-muted">Sin teléfono registrado</span>
                          )}
                        </div>
                      </details>
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
              La membresía se extenderá según la duración del plan desde el vencimiento actual
              (o desde hoy si ya venció).
            </div>

            <button
              type="button"
            onClick={async () => {
              setSaving(true)
              try {
                await handleConfirmRenew()
              } catch (error) {
                onToast(`No se pudo renovar la membresía: ${error.message}`, 'error')
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            className="btn-sheen flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
            >
            <RefreshCw className="h-4 w-4" />
            {saving ? 'Procesando…' : 'Confirmar renovación'}
            </button>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(detailClient)}
        onClose={() => setDetailClient(null)}
        title="Perfil e historial del socio"
        maxWidth="max-w-3xl"
      >
        {detailClient && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {detailClient.photo
                ? <img src={detailClient.photo} alt={`Foto de ${detailClient.nombre}`} className="h-20 w-20 rounded-xl object-cover" />
                : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-card text-2xl font-bold text-accent">{detailClient.nombre?.[0]}</span>}
              <div>
                <h3 className="font-display text-xl font-bold text-white">{detailClient.nombre} {detailClient.apellido}</h3>
                <p className="text-sm text-muted">{detailClient.telefono} · CI {detailClient.ci}</p>
              </div>
            </div>
            {isAdmin && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="text-xs uppercase text-muted">Life Time Value · pagos completados</p>
                <p className="mt-1 font-display text-2xl font-bold text-white">
                  {history.payments.filter((item) => item.estado_pago === 'completado')
                    .reduce((sum, item) => sum + Number(item.monto), 0).toLocaleString('es-BO')} Bs.
                </p>
              </div>
            )}
            <section>
              <h4 className="mb-2 font-semibold text-white">Historial de pagos y comprobantes</h4>
              {historyLoading ? <p className="text-sm text-muted">Cargando historial…</p>
                : history.payments.length ? (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {history.payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm">
                        <span className="text-muted">{new Date(payment.created_at).toLocaleDateString('es-BO')} · {payment.estado_pago}</span>
                        <span className="font-semibold text-white">{Number(payment.monto).toLocaleString('es-BO')} Bs.</span>
                        {payment.transaction_id && <span className="text-xs text-accent">Recibo {payment.receipt_number || payment.transaction_id}</span>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">No hay pagos en el historial disponible.</p>}
            </section>
            <section>
              <h4 className="mb-2 font-semibold text-white">Historial de asistencias</h4>
              {history.attendance.slice(0, 15).map((entry) => (
                <p key={entry.id} className="border-b border-line py-2 text-sm text-muted">
                  {new Date(entry.fecha).toLocaleString('es-BO')} · {entry.estado}
                </p>
              ))}
              {!history.attendance.length && <p className="text-sm text-muted">Sin asistencias registradas.</p>}
            </section>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(profileClient)} onClose={() => setProfileClient(null)} title="Editar perfil">
        {profileClient && (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setSaving(true)
              try {
                await onUpdateClient(profileClient)
                onToast('Perfil actualizado.')
                setProfileClient(null)
              } catch (error) {
                onToast(`No se pudo actualizar el perfil: ${error.message}`, 'error')
              } finally {
                setSaving(false)
              }
            }}
            className="space-y-4"
          >
            {['nombre', 'apellido', 'telefono'].map((field) => (
              <label key={field} className="block text-xs font-semibold uppercase text-muted">
                {field}
                <input className="field mt-1.5" value={profileClient[field] || ''}
                  onChange={(event) => setProfileClient((current) => ({ ...current, [field]: event.target.value }))} required />
              </label>
            ))}
            <label className="block text-xs font-semibold uppercase text-muted">
              Fotografía del socio
              <input type="file" accept="image/*" capture="user" className="field mt-1.5"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
                    onToast('Elige una imagen de menos de 8 MB.', 'error')
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const image = new Image()
                    image.onload = () => {
                      const scale = Math.min(1, 480 / Math.max(image.width, image.height))
                      const canvas = document.createElement('canvas')
                      canvas.width = Math.max(1, Math.round(image.width * scale))
                      canvas.height = Math.max(1, Math.round(image.height * scale))
                      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
                      setProfileClient((current) => ({ ...current, photo: canvas.toDataURL('image/jpeg', 0.68) }))
                    }
                    image.src = String(reader.result)
                  }
                  reader.readAsDataURL(file)
                }} />
            </label>
            {profileClient.photo && <img src={profileClient.photo} alt="Vista previa" className="h-24 w-24 rounded-xl object-cover" />}
            <button disabled={saving || !profileClient.photo}
              className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        )}
      </Modal>
      <Modal open={Boolean(freezeClient)} onClose={() => setFreezeClient(null)} title="Congelar membresía">
        <form onSubmit={async (event) => {
          event.preventDefault()
          try {
            await onFreezeMembership(freezeClient.membershipId, Number(freezeDays))
            onToast(`Membresía congelada por ${freezeDays} días.`)
            setFreezeClient(null)
          } catch (error) {
            onToast(`No se pudo congelar la membresía: ${error.message}`, 'error')
          }
        }} className="space-y-4">
          <p className="text-sm text-muted">{freezeClient?.nombre} {freezeClient?.apellido}</p>
          <label className="block text-xs font-semibold uppercase text-muted">Días (1–90)
            <input type="number" min="1" max="90" value={freezeDays} onChange={(event) => setFreezeDays(event.target.value)} className="field mt-1.5" />
          </label>
          <button className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white">Confirmar congelamiento</button>
        </form>
      </Modal>
    </div>
  )
}