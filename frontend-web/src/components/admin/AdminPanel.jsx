import { useEffect, useState } from 'react'
import { ClipboardCheck, Dumbbell, FileBarChart, LayoutDashboard, Settings2, Users, X } from 'lucide-react'
import useAdminClients from '../../hooks/useAdminClients'
import AttendanceControl from './AttendanceControl'
import ClientsManagement from './ClientsManagement'
import AdminDashboard from './AdminDashboard'
import AdminReports from './AdminReports'
import PlanManagement from './PlanManagement'

export default function AdminPanel({ open, onClose, onToast, isAdminUser = false }) {
  const [tab, setTab] = useState('dashboard')
  const admin = useAdminClients()
  const isAdmin = isAdminUser

  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
            <button
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
            </button>
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
            <button
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
            </button>
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
        {tab === 'dashboard' ? (
          <AdminDashboard />
        ) : tab === 'attendance' ? (
          <AttendanceControl
            clients={admin.clients}
            attendance={admin.attendance}
            onRegisterAttendance={admin.registerAttendance}
            onToast={onToast}
          />
        ) : tab === 'reports' && isAdmin ? (
          <AdminReports />
        ) : tab === 'plans' && isAdmin ? (
          <PlanManagement onToast={onToast} />
        ) : (
          <ClientsManagement
            clients={admin.clients}
            onRenewMembership={admin.renewMembership}
            onToast={onToast}
          />
        )}
      </main>
    </div>
  )
}