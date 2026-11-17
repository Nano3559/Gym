import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { buildPanelSections } from '../../lib/panelSections'
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
import AdminDashboard from './AdminDashboard'
import AdminReports from './AdminReports'
import ClientsManagement from './ClientsManagement'
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
  const { user: authUser, loading: authLoading } = useAuth()
  const isAdmin = isAdminUser
  const isTrainer = staffRole === 'trainer' && !isAdmin
  const { visible, panelTitle, panelSubtitle } = buildPanelSections({ isAdmin, isTrainer })
  const [tab, setTab] = useState('dashboard')
  const [posOpen, setPosOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [accessAlerts, setAccessAlerts] = useState([])
  const prevVisibleRef = useRef(visible.map(s => s.key))
  const {
    clients,
    attendance,
    loading: clientsLoading,
    error: clientsError,
    registerAttendance,
    renewMembership,
    getClientHistory,
    updateClient,
    freezeMembership,
    refresh: refreshClients,
  } = useAdminClients({ authUser, isAdmin })
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
  // Al abrir/cerrar el panel, restablecer a Dashboard
  useEffect(() => {
    if (open) setTab('dashboard')
  }, [open])

  // Al cambiar de rol, restablecer a Dashboard para evitar estados inconsistentes
  useEffect(() => {
    if (!open) return
    // Solo restablecer si el nuevo rol cambia las secciones visibles
    const prevVisible = prevVisibleRef.current
    const newVisible = visible.map(s => s.key)
    if (prevVisible && JSON.stringify(prevVisible) !== JSON.stringify(newVisible)) {
      setTab('dashboard')
    }
    prevVisibleRef.current = newVisible
  }, [isAdmin, isTrainer, open])

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
    if (!open || authLoading) return undefined
    Promise.all([refreshClients(), refreshCommerce()]).catch((error) => {
      onToast(`No se pudieron actualizar los datos del panel: ${error.message}`, 'error')
    })
  }, [open, authLoading, refreshClients, refreshCommerce, onToast])

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
                  {panelTitle}
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <ClipboardCheck className="h-3.5 w-3.5 text-accent" />
                  {panelSubtitle}
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
            {visible.map((section) => {
              const isActive = tab === section.key
              const baseClass =
                'inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition'
              const modifierClass =
                isActive ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'
              const classes = `${baseClass} ${modifierClass}`.trim()
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setTab(section.key)}
                  className={classes}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {tab === 'dashboard' ? (
          <AdminDashboard
            isAdmin={isAdmin}
            authUser={authUser}
            authLoading={authLoading}
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
        ) : tab === 'clients' ? (
          <ClientsManagement
            clients={clients}
            loading={clientsLoading}
            error={clientsError}
            onRenewMembership={renewMembership}
            onToast={onToast}
            onNewMember={onOpenNewMember}
            onGetHistory={getClientHistory}
            onUpdateClient={updateClient}
            onFreezeMembership={freezeMembership}
            isAdmin={isAdmin}
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
        ) : null}
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