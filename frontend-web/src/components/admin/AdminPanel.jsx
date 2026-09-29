import { useEffect, useState } from 'react'
import { Banknote, ClipboardCheck, Dumbbell, FileBarChart, LayoutDashboard, Settings2, ShoppingCart, Users, X, UserCog, SlidersHorizontal } from 'lucide-react'
import useAdminClients from '../../hooks/useAdminClients'
import AttendanceControl from './AttendanceControl'
import ClientsManagement from './ClientsManagement'
import AdminDashboard from './AdminDashboard'
import AdminReports from './AdminReports'
import PlanManagement from './PlanManagement'
import ReceptionDashboard from './ReceptionDashboard'
import ReceptionPOS from './ReceptionPOS'
import CashControl from './CashControl'
import StaffManagement from './StaffManagement'
import CashAudit from './CashAudit'
import GlobalSettings from './GlobalSettings'

function TrainerDashboard({ staffPermissions }) {
  return (
    <section className="max-w-2xl rounded-xl border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold uppercase text-white">Espacio de entrenador</h2>
      <p className="mt-2 text-sm text-muted">Tu acceso está limitado a las secciones autorizadas por administración.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {staffPermissions.map((permission) => <span key={permission} className="rounded-md border border-line bg-card px-3 py-1.5 text-xs text-muted">{permission}</span>)}
      </div>
    </section>
  )
}

export default function AdminPanel({ open, onClose, onToast, onNewClient, childDialogOpen = false, isAdminUser = false, staffRole = 'reception', staffPermissions = [] }) {
  const [tab, setTab] = useState('dashboard')
  const admin = useAdminClients()
  const isAdmin = isAdminUser
  const can = (permission) => isAdmin || staffPermissions.includes(permission) || (!staffPermissions.length && staffRole === 'reception')

  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open || childDialogOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, childDialogOpen, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink" role="dialog" aria-modal="true">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
                <Dumbbell className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-xl font-bold uppercase tracking-wide text-white">
                  {isAdmin ? 'Panel Administrativo' : 'Panel de Recepción'}
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <ClipboardCheck className="h-3.5 w-3.5 text-accent" />
                  {isAdmin
                    ? 'Métricas, reportes y gestión de planes'
                    : 'Control de asistencia y gestión de clientes'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel"
              className="rounded-lg border border-line p-2 text-muted transition hover:border-accent hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex gap-2" aria-label="Secciones del panel">
            {can('dashboard') && <button
              type="button"
              onClick={() => setTab('dashboard')}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                tab === 'dashboard'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>}
            {!isAdmin && can('attendance') && (
              <button
                type="button"
                onClick={() => setTab('attendance')}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  tab === 'attendance'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line text-muted hover:text-white'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                Control de Asistencia
              </button>
            )}
            {can('clients') && <button
              type="button"
              onClick={() => setTab('clients')}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                tab === 'clients'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Gestión de Clientes
            </button>}
            {!isAdmin && (
              <>
                {can('pos') && <button
                  type="button"
                  onClick={() => setTab('pos')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === 'pos' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
                >
                  <ShoppingCart className="h-4 w-4" /> POS
                </button>}
                {can('cash') && <button
                  type="button"
                  onClick={() => setTab('cash')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === 'cash' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
                >
                  <Banknote className="h-4 w-4" /> Caja
                </button>}
              </>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('reports')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'reports'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:text-white'
                  }`}
                >
                  <FileBarChart className="h-4 w-4" />
                  Reportes
                </button>
                <button
                  type="button"
                  onClick={() => setTab('staff')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === 'staff' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
                ><UserCog className="h-4 w-4" /> Staff</button>
                <button
                  type="button"
                  onClick={() => setTab('cashAudit')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === 'cashAudit' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
                ><Banknote className="h-4 w-4" /> Auditoría de Caja</button>
                <button
                  type="button"
                  onClick={() => setTab('settings')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tab === 'settings' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
                ><SlidersHorizontal className="h-4 w-4" /> Configuración</button>
                <button
                  type="button"
                  onClick={() => setTab('plans')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'plans'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:text-white'
                  }`}
                >
                  <Settings2 className="h-4 w-4" />
                  Gestión de Planes
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {tab === 'staff' && isAdmin ? (
          <StaffManagement onToast={onToast} />
        ) : tab === 'cashAudit' && isAdmin ? (
          <CashAudit />
        ) : tab === 'settings' && isAdmin ? (
          <GlobalSettings onToast={onToast} />
        ) : tab === 'dashboard' && can('dashboard') ? (
          isAdmin ? (
            <AdminDashboard />
          ) : staffRole === 'trainer' ? (
            <TrainerDashboard staffPermissions={staffPermissions} />
          ) : (
            <ReceptionDashboard
              clients={admin.clients}
              attendance={admin.attendance}
              onNewClient={onNewClient}
              onOpenPOS={() => setTab('pos')}
              onToast={onToast}
            />
          )
        ) : tab === 'pos' && !isAdmin && can('pos') ? (
          <ReceptionPOS onToast={onToast} onOpenCashControl={() => setTab('cash')} />
        ) : tab === 'cash' && !isAdmin && can('cash') ? (
          <CashControl onToast={onToast} />
        ) : tab === 'attendance' && !isAdmin && can('attendance') ? (
          <AttendanceControl
            clients={admin.clients}
            attendance={admin.attendance}
            onRegisterAttendance={admin.registerAttendance}
            onToast={onToast}
          />
        ) : tab === 'clients' && can('clients') ? (
          <ClientsManagement
            clients={admin.clients}
            onRenewMembership={admin.renewMembership}
            onUpdateClient={admin.updateClient}
            onSetMembershipFrozen={admin.setMembershipFrozen}
            onGetClientPayments={admin.getClientPayments}
            onGetClientHistory={admin.getClientHistory}
            onNewClient={onNewClient}
            onToast={onToast}
            isAdmin={isAdmin}
          />
        ) : tab === 'reports' && isAdmin ? (
          <AdminReports />
        ) : tab === 'plans' && isAdmin ? (
          <PlanManagement onToast={onToast} />
        ) : <p className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">No tienes permiso para ver esta sección.</p>}
      </main>
    </div>
  )
}