import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardCheck,
  Dumbbell,
  FileBarChart,
  LayoutDashboard,
  Package,
  Settings2,
  Users,
  Wallet,
  UserRoundCog,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import useAdminClients from '../../hooks/useAdminClients'
import useReceptionCommerce from '../../hooks/useReceptionCommerce'
import AttendanceControl from './AttendanceControl'
import ClientsManagement from './ClientsManagement'
import AdminDashboard from './AdminDashboard'
import AdminReports from './AdminReports'
import PlanManagement from './PlanManagement'
import PosProductsManagement from './PosProductsManagement'
import { ExpenseModal, PosModal } from './ReceptionTransactions'
import { CashAudit, CashRegister } from './CashRegister'
import AdminFinanceReports from './AdminFinanceReports'
import StaffManagement from './StaffManagement'
import GymSettings from './GymSettings'

export default function AdminPanel({
  open,
  onClose,
  onToast,
  onOpenNewMember,
  isAdminUser = false,
  staffRole = 'reception',
}) {
  const [tab, setTab] = useState('dashboard')
  const [posOpen, setPosOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [accessAlerts, setAccessAlerts] = useState([])
  const {
    clients,
    attendance,
    registerAttendance,
    renewMembership,
    getClientHistory,
    updateClient,
    freezeMembership,
    refresh: refreshClients,
  } = useAdminClients()
  const {
    products,
    incomeToday,
    loading: commerceLoading,
    cashSession,
    cashSessions,
    expenses,
    sales,
    refresh: refreshCommerce,
    saveProduct,
    deleteProduct,
    registerSale,
    registerExpense,
    openCashRegister,
    closeCashRegister,
  } = useReceptionCommerce()
  const isAdmin = isAdminUser
  const isTrainer = staffRole === 'trainer' && !isAdmin

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

  useEffect(() => {
    if (!open) return
    Promise.all([refreshClients(), refreshCommerce()]).catch((error) => {
      onToast(`No se pudieron actualizar los datos del panel: ${error.message}`, 'error')
    })
  }, [open, refreshClients, refreshCommerce, onToast])

  const handleBlockedAccess = useCallback((client, reason) => {
    const name = `${client.nombre} ${client.apellido}`.trim()
    const timestamp = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
    setAccessAlerts((current) => [
      {
        id: `${client.id}-${Date.now()}`,
        type: 'expired',
        title: `Ingreso bloqueado: ${name}`,
        detail: `Intento a las ${timestamp}: ${reason}.`,
      },
      ...current,
    ].slice(0, 10))
    registerAttendance(client, 'denegado', reason).catch((error) => {
      onToast(`No se pudo registrar el intento de ingreso: ${error.message}`, 'error')
    })
  }, [registerAttendance, onToast])

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
                  {isAdmin ? 'Panel Administrativo' : isTrainer ? 'Panel de Entrenador' : 'Panel de Recepción'}
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

          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Secciones del panel">
            <button
              type="button"
              onClick={() => setTab('dashboard')}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                tab === 'dashboard'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            {!isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('attendance')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'attendance'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:text-white'
                  }`}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Control de Asistencia
                </button>
                {!isTrainer && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTab('clients')}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        tab === 'clients'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-line text-muted hover:text-white'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      Gestión de Clientes
                    </button>
                  </>
                )}
                {!isTrainer && (
                    <button
                      type="button"
                      onClick={() => setTab('cash')}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        tab === 'cash' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
                      }`}
                    >
                      <Wallet className="h-4 w-4" />
                      Caja
                    </button>
                )}
              </>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('cash')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'cash' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  Caja
                </button>
                <button type="button" onClick={() => setTab('cashAudit')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'cashAudit' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
                  }`}>
                  <Wallet className="h-4 w-4" /> Auditoría de Cajas
                </button>
                <button type="button" onClick={() => setTab('staff')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'staff' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
                  }`}>
                  <UserRoundCog className="h-4 w-4" /> Staff
                </button>
                <button type="button" onClick={() => setTab('settings')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'settings' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
                  }`}>
                  <SlidersHorizontal className="h-4 w-4" /> Configuración
                </button>
                <button
                  type="button"
                  onClick={() => setTab('products')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'products'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-muted hover:text-white'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  Productos POS
                </button>
                <button
                  type="button"
                  onClick={() => setTab('finance')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    tab === 'finance' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  Finanzas
                </button>
                <button
                  type="button"
                  onClick={() => setTab('reports')}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
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
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
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
          <AdminDashboard
            isAdmin={isAdmin}
            clients={clients}
            accessAlerts={accessAlerts}
            incomeToday={incomeToday}
            onNewMember={onOpenNewMember}
            onOpenPos={() => {
              if (!cashSession) {
                setTab('cash')
                onToast('Abre la caja antes de iniciar ventas.', 'error')
                return
              }
              setPosOpen(true)
            }}
            onOpenExpense={() => setExpenseOpen(true)}
            onOpenProducts={() => setTab('products')}
            onToast={onToast}
            showReceptionActions={!isTrainer}
          />
        ) : tab === 'attendance' ? (
          <AttendanceControl
            clients={clients}
            attendance={attendance}
            onRegisterAttendance={registerAttendance}
            onToast={onToast}
            onBlockedAccess={handleBlockedAccess}
          />
        ) : tab === 'cash' && !isTrainer ? (
          <CashRegister
            session={cashSession}
            sessions={cashSessions}
            sales={sales}
            expenses={expenses}
            onOpen={openCashRegister}
            onClose={closeCashRegister}
            onToast={onToast}
          />
        ) : tab === 'cashAudit' && isAdmin ? (
          <CashAudit sessions={cashSessions} />
        ) : tab === 'staff' && isAdmin ? (
          <StaffManagement onToast={onToast} />
        ) : tab === 'settings' && isAdmin ? (
          <GymSettings onToast={onToast} />
        ) : tab === 'reports' && isAdmin ? (
          <AdminReports />
        ) : tab === 'finance' && isAdmin ? (
          <AdminFinanceReports onToast={onToast} />
        ) : tab === 'plans' && isAdmin ? (
          <PlanManagement onToast={onToast} />
        ) : tab === 'products' && isAdmin ? (
          <PosProductsManagement
            products={products}
            onSaveProduct={saveProduct}
            onDeleteProduct={deleteProduct}
            onToast={onToast}
          />
        ) : (
          <ClientsManagement
            clients={clients}
            onRenewMembership={renewMembership}
            onToast={onToast}
            onNewMember={onOpenNewMember}
            onGetHistory={getClientHistory}
            onUpdateClient={updateClient}
            onFreezeMembership={freezeMembership}
            isAdmin={isAdmin}
          />
        )}
      </main>
      <PosModal
        open={posOpen}
        products={products}
        loading={commerceLoading}
        onClose={() => setPosOpen(false)}
        onSave={registerSale}
        onToast={onToast}
      />
      <ExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSave={registerExpense}
        onToast={onToast}
      />
    </div>
  )
}