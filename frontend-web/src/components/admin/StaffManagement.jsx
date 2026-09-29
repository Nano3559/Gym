import { useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, RefreshCw, Shield, UserRound, UserRoundCheck, UserRoundX } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Gestión de clientes' },
  { key: 'attendance', label: 'Control de asistencia' },
  { key: 'pos', label: 'Punto de venta' },
  { key: 'cash', label: 'Control de caja' },
]
const DEFAULT_PERMISSIONS = {
  reception: ['dashboard', 'clients', 'attendance', 'pos', 'cash'],
  trainer: ['dashboard', 'attendance'],
}
const EMPTY_FORM = { fullName: '', email: '', password: '', role: 'reception', permissions: DEFAULT_PERMISSIONS.reception, active: true }

export default function StaffManagement({ onToast }) {
  const [staff, setStaff] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState(null)

  const invoke = async (body) => {
    if (!isSupabaseConfigured || !supabase) throw new Error('Configura Supabase antes de gestionar cuentas de staff.')
    const { data, error: invokeError } = await supabase.functions.invoke('admin-manage-staff', { body })
    if (invokeError) throw invokeError
    if (data?.error) throw new Error(data.error)
    return data
  }

  const loadStaff = async () => {
    setLoading(true)
    try {
      const data = await invoke({ action: 'list' })
      setStaff(data.staff || [])
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el personal. Verifica el despliegue de la Edge Function.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadStaff()
  }, [])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditing('new')
    setError('')
  }

  const openEdit = (member) => {
    setForm({
      fullName: member.full_name,
      email: member.email,
      password: '',
      role: member.role,
      permissions: member.permissions || [],
      active: member.active,
    })
    setEditing(member)
    setError('')
  }

  const close = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  const changeRole = (role) => setForm((current) => ({ ...current, role, permissions: DEFAULT_PERMISSIONS[role] }))

  const togglePermission = (permission) => setForm((current) => {
    const selected = current.permissions.includes(permission)
    const permissions = selected
      ? current.permissions.filter((item) => item !== permission)
      : [...current.permissions, permission]
    return { ...current, permissions: permission === 'dashboard' && selected ? permissions : [...new Set(['dashboard', ...permissions])] }
  })

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const action = editing === 'new' ? 'create' : 'update'
      const payload = {
        action,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        role: form.role,
        permissions: form.permissions,
        active: form.active,
      }
      if (action === 'create') payload.password = form.password
      else payload.userId = editing.user_id
      const result = await invoke(payload)
      if (action === 'create') setCreatedCredentials({ email: form.email.trim(), password: form.password })
      onToast?.(action === 'create' ? 'Cuenta de staff creada.' : 'Permisos y datos de staff actualizados.')
      close()
      await loadStaff()
      if (result.staff && action === 'create') setStaff((current) => current.some((member) => member.user_id === result.staff.user_id) ? current : [result.staff, ...current])
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (member) => {
    try {
      await invoke({
        action: 'update',
        userId: member.user_id,
        fullName: member.full_name,
        email: member.email,
        role: member.role,
        permissions: member.permissions || [],
        active: !member.active,
      })
      await loadStaff()
      onToast?.(member.active ? 'Acceso del miembro de staff suspendido.' : 'Acceso del miembro de staff reactivado.')
    } catch (updateError) {
      setError(updateError.message || 'No se pudo cambiar el acceso.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white"><Shield className="h-5 w-5 text-accent" /> Gestión de Staff y Permisos</h2>
          <p className="mt-1 text-xs text-muted">Crea accesos para recepción y entrenadores, y asigna las secciones autorizadas.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadStaff} disabled={loading} aria-label="Actualizar personal" className="rounded-xl border border-line p-2.5 text-muted hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover"><Plus className="h-4 w-4" /> Alta de staff</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p>}
      {createdCredentials && (
        <section className="rounded-xl border border-volt/30 bg-volt/5 p-5">
          <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-5 w-5 text-volt" /><div className="min-w-0 flex-1"><h3 className="font-display text-sm font-semibold uppercase text-volt">Credenciales iniciales</h3><p className="mt-2 text-sm text-white">Correo: {createdCredentials.email}</p><p className="mt-1 break-all font-mono text-sm text-white">Contraseña temporal: {createdCredentials.password}</p><p className="mt-2 text-xs text-muted">Entrégalas directamente al miembro del equipo y pídele que cambie la contraseña después de iniciar sesión.</p></div><button type="button" onClick={() => setCreatedCredentials(null)} aria-label="Ocultar credenciales" className="rounded-md p-1 text-muted hover:text-white">×</button></div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((member) => (
          <article key={member.user_id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent"><UserRound className="h-5 w-5" /></span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${member.active ? 'border-volt/30 bg-volt/10 text-volt' : 'border-line text-muted'}`}>{member.active ? 'Activo' : 'Suspendido'}</span>
            </div>
            <h3 className="mt-4 font-semibold text-white">{member.full_name}</h3>
            <p className="mt-1 text-sm text-muted">{member.email}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-accent">{member.role === 'reception' ? 'Recepcionista' : 'Entrenador'}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(member.permissions || []).map((permission) => <span key={permission} className="rounded-md border border-line bg-card px-2 py-1 text-[10px] text-muted">{PERMISSIONS.find((item) => item.key === permission)?.label || permission}</span>)}
            </div>
            <div className="mt-4 flex gap-2 border-t border-line pt-4">
              <button type="button" onClick={() => openEdit(member)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-white hover:border-accent hover:text-accent"><Pencil className="h-3.5 w-3.5" /> Editar permisos</button>
              <button type="button" onClick={() => toggleActive(member)} aria-label={member.active ? 'Suspender acceso' : 'Reactivar acceso'} className={`rounded-lg border p-2 ${member.active ? 'border-red-400/20 text-red-300 hover:bg-red-400/10' : 'border-volt/20 text-volt hover:bg-volt/10'}`}>{member.active ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}</button>
            </div>
          </article>
        ))}
        {!loading && staff.length === 0 && <p className="rounded-xl border border-dashed border-line p-8 text-sm text-muted">Aún no hay cuentas de staff creadas.</p>}
      </div>

      <Modal open={Boolean(editing)} onClose={close} title={editing === 'new' ? 'Crear cuenta de staff' : 'Editar miembro de staff'}>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Nombre completo<input className="field mt-1.5" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required /></label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Correo de acceso<input className="field mt-1.5" type="email" autoComplete="off" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label>
          {editing === 'new' && <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Contraseña temporal<input className="field mt-1.5" type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required /><span className="mt-1 block normal-case text-muted">Mínimo 10 caracteres; solo se muestra al crear la cuenta.</span></label>}
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Rol<select className="field mt-1.5" value={form.role} onChange={(event) => changeRole(event.target.value)}><option value="reception">Recepcionista</option><option value="trainer">Entrenador</option></select></label>
          <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Permisos de acceso</legend><div className="grid gap-2 sm:grid-cols-2">{PERMISSIONS.map((permission) => <label key={permission.key} className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-white"><input type="checkbox" checked={form.permissions.includes(permission.key)} disabled={permission.key === 'dashboard'} onChange={() => togglePermission(permission.key)} />{permission.label}</label>)}</div></fieldset>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"><KeyRound className="h-4 w-4" />{saving ? 'Procesando...' : editing === 'new' ? 'Crear cuenta y credenciales' : 'Guardar rol y permisos'}</button>
        </form>
      </Modal>
    </div>
  )
}
