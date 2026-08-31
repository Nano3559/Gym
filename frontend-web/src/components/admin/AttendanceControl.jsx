import { useMemo, useState } from 'react'
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
}

function Avatar({ photo, nombre, apellido }) {
  const initials = `${(nombre || '?')[0]}${(apellido || '')[0] || ''}`.toUpperCase()
  if (photo) {
    return <img src={photo} alt={`Foto de ${nombre} ${apellido}`} className="h-20 w-20 rounded-2xl border border-line object-cover" />
  }
  return (
    <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-line bg-card-2 font-display text-2xl font-bold text-accent">
      {initials}
    </span>
  )
}

export default function AttendanceControl({ clients, attendance, onRegisterAttendance, onToast }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

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

  const status = selected ? getMembershipStatus(selected.fechaVencimiento) : null
  const style = selected ? STATUS_STYLES[status.key] : null

  const handleSelect = (client) => {
    setSelectedId(client.id)
    setQuery('')
  }

  const handleRegister = async () => {
    if (!selected) return
    await onRegisterAttendance(selected)
    onToast('¡Asistencia registrada correctamente!')
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
              onChange={(e) => setQuery(e.target.value)}
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

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Plan actual</p>
                <p className="mt-1 font-semibold text-white">
                  {selected.planNombre || selected.plan}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Inicio</p>
                <p className="mt-1 font-semibold text-white">
                  {selected.fechaInicio || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-card px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Vencimiento</p>
                <p className="mt-1 font-semibold text-white">
                  {selected.fechaVencimiento || '—'}
                </p>
              </div>
            </div>

            {!style.allowed && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-4">
                <ShieldAlert className="h-6 w-6 shrink-0 text-red-400" />
                <div>
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-red-400">
                    Acceso denegado - Membresía vencida
                  </p>
                  <p className="text-xs text-red-300/80">
                    El socio debe renovar su membresía antes de ingresar.
                  </p>
                </div>
              </div>
            )}

            {style.allowed && (
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
                onClick={handleRegister}
                disabled={!style.allowed}
                className="btn-sheen inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" />
                Registrar Asistencia
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