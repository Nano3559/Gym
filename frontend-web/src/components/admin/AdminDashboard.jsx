import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Banknote,
  Cake,
  CalendarCheck,
  CalendarClock,
  ChartNoAxesColumn,
  LayoutDashboard,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react'
import useAdminDashboard from '../../hooks/useAdminDashboard'
import useAdminFinance from '../../hooks/useAdminFinance'

const MAX_OCCUPANCY = 100

function KpiCard({ icon: Icon, label, value, sub, tone = 'accent' }) {
  const toneClass =
    tone === 'volt'
      ? 'border-volt/30 bg-volt/10 text-volt'
      : tone === 'amber'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
        : 'border-accent/30 bg-accent/10 text-accent'
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-0.5 font-display text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-3 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function ClassBar({ name, booked, occupancy, max }) {
  const width = Math.min(MAX_OCCUPANCY, Math.round((occupancy / max) * 100))
  return (
    <li className="flex items-center gap-4">
      <span className="w-32 shrink-0 truncate text-sm font-semibold text-white">{name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-card">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-volt"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-28 shrink-0 text-right">
        <span className="text-sm font-bold text-white">{booked}</span>
        <span className="ml-1 text-xs text-muted">reservas</span>
        <span className="ml-2 text-xs font-semibold text-volt">{occupancy}%</span>
      </div>
    </li>
  )
}

function DayClassRow({ cls }) {
  const capacity = cls.capacity || cls.capacidad || 0
  const booked = cls.booked || cls.reservas_count || 0
  const occupancy = capacity > 0 ? Math.round((booked / capacity) * 100) : 0
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{cls.name || cls.nombre}</p>
        <p className="text-xs text-muted">
          {cls.time || String(cls.hora_inicio || '').slice(0, 5) || '—'}
          {cls.trainer || cls.entrenador ? ` · ${cls.trainer || cls.entrenador}` : ''}
        </p>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
          occupancy >= 90
            ? 'border-red-500/40 bg-red-500/10 text-red-400'
            : occupancy >= 70
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-volt/40 bg-volt/10 text-volt'
        }`}
      >
        {booked}/{capacity} · {occupancy}%
      </span>
    </li>
  )
}

function isBirthdayToday(client, today) {
  const birthday = client.fechaNacimiento || client.fecha_nacimiento || client.birthDate
  if (!birthday) return false
  const [year, month, day] = String(birthday).slice(0, 10).split('-')
  return month === today.slice(5, 7) && day === today.slice(8, 10) && Number(year) > 0
}

function QuickAction({ icon: Icon, label, onClick, tone = 'accent' }) {
  const colors = tone === 'volt'
    ? 'border-volt/30 bg-volt/10 text-volt hover:bg-volt/20'
    : tone === 'amber'
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
      : 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/20'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition ${colors}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="font-semibold text-white">{label}</span>
    </button>
  )
}

export default function AdminDashboard({
  isAdmin = false,
  clients = [],
  accessAlerts = [],
  incomeToday = 0,
  onNewMember,
  onOpenPos,
  onOpenExpense,
  onOpenProducts,
  onToast,
  showReceptionActions = true,
}) {
  const {
    today,
    sociosActivos,
    porVencer,
    ingresosMes,
    reservasDelDia,
    ranking,
    clasesDelDia,
    refresh,
    fmtMoney,
    fmtInt,
  } = useAdminDashboard({ includeMonthlyIncome: isAdmin })
  const {
    currentIncome,
    previousIncome,
    currentExpenses,
    newMembers,
    churned,
    available: financeAvailable,
    refresh: refreshFinance,
  } = useAdminFinance()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([refresh(), isAdmin ? refreshFinance() : Promise.resolve()])
      .catch((error) => {
        onToast?.(`No se pudieron actualizar las métricas: ${error.message}`, 'error')
      })
      .finally(() => {
        if (mounted) setRefreshing(false)
      })
    return () => { mounted = false }
  }, [refresh, refreshFinance, isAdmin, onToast])

  const maxBooked = ranking.length > 0 ? ranking[0].booked : 1
  const birthdayAlerts = clients
    .filter((client) => isBirthdayToday(client, today))
    .map((client) => ({
      id: `birthday-${client.id}`,
      type: 'birthday',
      title: `Cumpleaños: ${client.nombre} ${client.apellido}`.trim(),
      detail: 'Socio cumple años hoy.',
    }))
  const alerts = [...birthdayAlerts, ...accessAlerts].slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
            <LayoutDashboard className="h-5 w-5 text-accent" />
            Dashboard de Métricas
          </h2>
          <p className="mt-1 text-xs text-muted">Resumen general del gimnasio · {today}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            Promise.all([refresh(), isAdmin ? refreshFinance() : Promise.resolve()])
              .catch((error) => onToast?.(`No se pudieron actualizar las métricas: ${error.message}`, 'error'))
              .finally(() => setRefreshing(false))
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {showReceptionActions && (
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="font-display text-base font-semibold uppercase tracking-wide text-white">
          Accesos directos
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <QuickAction icon={UserPlus} label="Nuevo Socio" onClick={onNewMember} tone="volt" />
          <QuickAction icon={ShoppingCart} label="Nueva Venta (POS)" onClick={onOpenPos} />
          <QuickAction icon={Wallet} label="Registrar Gasto" onClick={onOpenExpense} tone="amber" />
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onOpenProducts}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition hover:text-accent"
          >
            <Package className="h-4 w-4" />
            Administrar catálogo de productos
          </button>
        )}
      </section>
      )}

      {/* Tarjetas KPI principales */}
      <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
        <KpiCard
          icon={Users}
          label="Socios Activos"
          value={fmtInt(sociosActivos)}
          sub={
            <span className="inline-flex items-center gap-1 text-volt">
              <TrendingUp className="h-3.5 w-3.5" />
              Membresías vigentes
            </span>
          }
          tone="volt"
        />
        <KpiCard
          icon={CalendarClock}
          label="Membresías por Vencer"
          value={fmtInt(porVencer)}
          sub="A renovar en los próximos 5 días"
          tone="amber"
        />
        {isAdmin ? (
          <KpiCard
            icon={Banknote}
            label="Ingresos del Mes"
            value={fmtMoney(financeAvailable ? currentIncome : ingresosMes)}
            sub="Monto acumulado en Bs."
          />
        ) : showReceptionActions ? (
          <KpiCard
            icon={Banknote}
            label="Ingresos del Turno"
            value={fmtMoney(incomeToday)}
            sub="Ingresos desde la apertura de caja · Bs."
          />
        ) : null}
        <KpiCard
          icon={CalendarCheck}
          label="Reservas del Día"
          value={fmtInt(reservasDelDia)}
          sub="Cupos reservados en clases de hoy"
        />
        {isAdmin && (
          <>
            <KpiCard
              icon={UserPlus}
              label="Nuevas Altas este Mes"
              value={fmtInt(newMembers)}
              sub="Perfiles registrados en el mes"
              tone="volt"
            />
            <KpiCard
              icon={UserMinus}
              label="Bajas / No Renovaciones"
              value={fmtInt(churned)}
              sub="Membresías vencidas sin renovación"
              tone="amber"
            />
          </>
        )}
      </div>

      {isAdmin && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase text-white">
              <ChartNoAxesColumn className="h-4 w-4 text-accent" />
              Tendencia de ingresos
            </h3>
            <p className="mt-1 text-xs text-muted">Comparación del mes actual con el anterior.</p>
            {financeAvailable ? (
              <div className="mt-5 space-y-4">
                {[
                  { label: 'Mes anterior', value: previousIncome },
                  { label: 'Este mes', value: currentIncome },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">{row.label}</span>
                      <span className="font-semibold text-white">{fmtMoney(row.value)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-card">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-volt"
                        style={{
                          width: `${Math.max(
                            row.value > 0 ? 3 : 0,
                            Math.round(row.value / Math.max(1, previousIncome, currentIncome) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Conecta Supabase para comparar los ingresos registrados por mes.</p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase text-white">
              <Banknote className="h-4 w-4 text-accent" />
              Resumen de flujo de caja
            </h3>
            <p className="mt-1 text-xs text-muted">Ingresos menos egresos · mes actual.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-volt/25 bg-volt/5 p-4">
                <p className="text-xs uppercase text-muted">Ingresos</p>
                <p className="mt-1 font-display text-xl font-bold text-volt">{fmtMoney(currentIncome)}</p>
              </div>
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                <p className="text-xs uppercase text-muted">Egresos</p>
                <p className="mt-1 font-display text-xl font-bold text-red-400">{fmtMoney(currentExpenses)}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-accent/25 bg-accent/5 p-4">
                <p className="text-xs uppercase text-muted">Resultado neto</p>
                <p className="mt-1 font-display text-2xl font-bold text-white">
                  {fmtMoney(currentIncome - currentExpenses)}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          Centro de alertas
          {alerts.length > 0 && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">
              {alerts.length}
            </span>
          )}
        </h3>
        {alerts.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {alerts.map((alert) => {
              const Icon = alert.type === 'birthday' ? Cake : AlertTriangle
              return (
                <li
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    alert.type === 'birthday'
                      ? 'border-accent/25 bg-accent/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
                    alert.type === 'birthday' ? 'text-accent' : 'text-red-400'
                  }`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{alert.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{alert.detail}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No hay alertas pendientes por el momento.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Clases más concurridas */}
        <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-3">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
            <Activity className="h-4 w-4 text-accent" />
            Clases más concurridas
          </h3>
          <p className="mt-1 text-xs text-muted">Ocupación acumulada por actividad grupal.</p>
          <ul className="mt-5 space-y-4">
            {ranking.map((r) => (
              <ClassBar
                key={r.name}
                name={r.name}
                booked={r.booked}
                occupancy={r.occupancy}
                max={maxBooked}
              />
            ))}
            {ranking.length === 0 && (
              <li className="text-sm text-muted">Aún no hay clases registradas.</li>
            )}
          </ul>
        </div>

        {/* Clases y reservas del día */}
        <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
            <CalendarCheck className="h-4 w-4 text-accent" />
            Clases de hoy
          </h3>
          <p className="mt-1 text-xs text-muted">
            {clasesDelDia.length} clases · {fmtInt(reservasDelDia)} cupos reservados.
          </p>
          <ul className="mt-5 space-y-2.5">
            {clasesDelDia.map((cls) => (
              <DayClassRow key={cls.id || `${cls.name}-${cls.time}-${cls.date}`} cls={cls} />
            ))}
            {clasesDelDia.length === 0 && (
              <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-card/40 px-4 py-8 text-center">
                <UserCheck className="h-8 w-8 text-line" />
                <p className="text-sm text-muted">No hay clases programadas para hoy.</p>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}