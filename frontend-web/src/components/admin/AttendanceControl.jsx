import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  User,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  X,
} from 'lucide-react'
import { getMembershipStatus } from '../../lib/membershipStatus'

const STATUS_STYLES = {
  activa: {
    badge: 'border-volt/40 bg-volt/10 text-volt',
    dot: 'bg-volt',
    allowed: true,
  },
  por_vencer: {
    badge: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400',
    allowed: true,
  },
  vencida: {
    badge: 'border-red-500/50 bg-red-500/10 text-red-400',
    dot: 'bg-red-500',
    allowed: false,
  },
  congelada: {
    badge: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400',
    allowed: false,
  },
}

function getAccessReasons(client) {
  const membership = getMembershipStatus(client.fechaVencimiento)
  const frozen = client.congeladaHasta && new Date(client.congeladaHasta) > new Date()
  const reasons = []
  if (!client.photo) reasons.push('sin fotografía registrada')
  if (Number(client.deuda || 0) > 0) reasons.push(`deuda pendiente de Bs ${Number(client.deuda).toFixed(2)}`)
  if (frozen) reasons.push('membresía congelada')
  if (membership.key === 'vencida') reasons.push('membresía vencida')
  return reasons
}

function Avatar({ photo, nombre, apellido }) {
  if (photo) {
    return <img src={photo} alt={`Foto de ${nombre} ${apellido}`} className="h-20 w-20 rounded-2xl border border-line object-cover" />
  }
  return (
    <span className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/40 bg-red-500/10 text-[10px] font-semibold text-red-300">
      <User className="h-6 w-6" />
      Sin foto
    </span>
  )
}

export default function AttendanceControl({
  clients,
  attendance,
  onRegisterAttendance,
  onToast,
  onBlockedAccess,
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const searchRef = useRef(null)

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) || null,
    [clients, selectedId]
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return clients
      .filter((c) => {
        const fullName = `${c.nombre} ${c.apellido}`.toLowerCase()
        return (
          fullName.includes(q) ||
          String(c.ci || '').includes(q) ||
          String(c.id || '').toLowerCase().includes(q)
        )
      })
      .slice(0, 6)
  }, [clients, query])

  const membershipStatus = selected ? getMembershipStatus(selected.fechaVencimiento) : null
  const isFrozen = Boolean(selected?.congeladaHasta && new Date(selected.congeladaHasta) > new Date())
  const status = isFrozen ? { key: 'congelada', label: 'Congelada' } : membershipStatus
  const style = selected ? STATUS_STYLES[status.key] : null
  const accessReasons = selected ? getAccessReasons(selected) : []
  const daysRemaining = selected?.fechaVencimiento
    ? Math.ceil((new Date(`${selected.fechaVencimiento}T23:59:59`) - new Date()) / 86400000)
    : null
  const financiallyCurrent = Number(selected?.deuda || 0) <= 0
  const canEnter = Boolean(selected && accessReasons.length === 0)

  useEffect(() => {
    searchRef.current?.focus()
  }, [selectedId])

  const playFeedback = (success) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = success ? 880 : 220
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.26)
    oscillator.onended = () => context.close()
  }

  const handleSelect = (client) => {
    setSelectedId(client.id)
    setQuery('')
    const reasons = getAccessReasons(client)
    const allowed = reasons.length === 0
    playFeedback(allowed)
    if (!allowed) {
      onBlockedAccess?.(client, reasons.join(', '))
    }
  }

  const handleRegister = async () => {
    if (!selected || !canEnter) return
    await onRegisterAttendance(selected, 'permitido')
    playFeedback(true)
    onToast('Ingreso confirmado correctamente.')
    setSelectedId(null)
    setQuery('')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Columna izquierda: búsqueda */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Buscar socio
          </h2>
          <p className="mt-1 text-xs text-muted">
            Por CI, código de membresía o nombre.
          </p>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              ref={searchRef}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results.length === 1) {
                  event.preventDefault()
                  handleSelect(results[0])
                }
              }}
              placeholder="Ej: 7054321, cli-1001 o María"
              className="field pl-10"
              aria-label="Buscar socio"
            />
          </div>

          {query.trim() && (
            <ul className="mt-3 overflow-hidden rounded-xl border border-line bg-card">
              {results.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted">Sin resultados.</li>
              )}
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card-2 text-xs font-bold text-accent">
                      {c.nombre[0]}
                      {c.apellido[0]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {c.nombre} {c.apellido}
                      </span>
                      <span className="block text-xs text-muted">
                        CI {c.ci} · {c.planNombre || c.plan}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Columna derecha: ficha del socio */}
      <div className="lg:col-span-3">
        {!selected ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 p-8 text-center">
            <User className="h-12 w-12 text-line" />
            <p className="mt-4 font-display text-lg font-semibold uppercase text-muted">
              Ficha del socio
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Busca y selecciona un cliente para ver su información y registrar su ingreso.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar
                photo={selected.photo}
                nombre={selected.nombre}
                apellido={selected.apellido}
              />
              {!selected.photo && (
                <span className="max-w-24 text-center text-xs font-semibold text-red-400">
                  Foto no registrada
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-2xl font-bold uppercase text-white">
                    {selected.nombre} {selected.apellido}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${style.badge}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">CI: {selected.ci}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Plan actual</p>
                <p className="mt-1 font-semibold text-white">
                  {selected.planNombre || selected.plan}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Tiempo restante</p>
                <p className={`mt-1 font-semibold ${daysRemaining >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {daysRemaining === null ? 'Sin membresía' : daysRemaining < 0 ? 'Vencida' : `${daysRemaining} días`}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Estado financiero</p>
                <p className={`mt-1 font-semibold ${financiallyCurrent ? 'text-volt' : 'text-red-400'}`}>
                  {financiallyCurrent ? 'Al día' : `Deuda ${Number(selected.deuda).toLocaleString('es-BO')} Bs.`}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Vencimiento</p>
                <p className="mt-1 font-semibold text-white">{selected.fechaVencimiento || '—'}</p>
              </div>
            </div>

            {!canEnter && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-4">
                <ShieldAlert className="h-6 w-6 shrink-0 text-red-400" />
                <div>
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-red-400">
                    Acceso denegado
                  </p>
                  <p className="text-xs text-red-300/80">
                    {accessReasons.join(' · ')}.
                  </p>
                </div>
              </div>
            )}

            {canEnter && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-volt/30 bg-volt/5 px-4 py-4">
                <ShieldCheck className="h-6 w-6 shrink-0 text-volt" />
                <div>
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-volt">
                    Acceso permitido
                  </p>
                  <p className="text-xs text-volt/80">
                    {status.key === 'por_vencer'
                      ? 'La membresía está por vencer. Considera recordar la renovación.'
                      : 'La membresía se encuentra vigente.'}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={canEnter ? handleRegister : () => playFeedback(false)}
                disabled={!canEnter}
                className={`inline-flex min-h-16 flex-1 items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-black uppercase tracking-wide text-white transition disabled:cursor-not-allowed ${
                  canEnter
                    ? 'bg-volt text-ink hover:bg-volt/80'
                    : 'bg-red-600 hover:bg-red-600'
                }`}
              >
                {canEnter ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
                {canEnter ? 'Confirmar Ingreso' : 'Denegar Ingreso'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null)
                  setQuery('')
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-muted transition hover:text-white"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asistencias del día */}
      <div className="lg:col-span-5">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
              <Clock3 className="h-5 w-5 text-accent" />
              Asistencias de hoy
            </h2>
            <span className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-muted">
              {attendance.length} registros
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Hora</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">CI</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-b border-line/60 transition hover:bg-card/50">
                    <td className="px-4 py-3 font-mono text-white">{a.hora}</td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {a.client?.nombre} {a.client?.apellido}
                    </td>
                    <td className="px-4 py-3 text-muted">{a.client?.ci}</td>
                    <td className="px-4 py-3 text-muted">{a.plan}</td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      Aún no hay asistencias registradas hoy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}