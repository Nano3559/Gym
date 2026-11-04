import { useCallback, useEffect, useState } from 'react'
import { UserPlus, UserRoundCog } from 'lucide-react'
import Modal from '../ui/Modal'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

const STORAGE_KEY = 'gym_staff_accounts'

export default function StaffManagement({ onToast }) {
  const [staff, setStaff] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'reception' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData?.session) {
        const { data, error } = await supabase.from('staff_accounts').select('*').order('nombre')
        if (error) throw error
        setStaff(data || [])
        return
      }
    }
    setStaff(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'))
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Load staff from the configured data source.
    load().catch((error) => onToast(`No se pudo cargar el staff: ${error.message}`, 'error'))
  }, [load, onToast])

  const startCreate = () => {
    setEditing(null)
    setForm({ nombre: '', email: '', password: '', rol: 'reception' })
    setOpen(true)
  }

  const startEdit = (member) => {
    setEditing(member)
    setForm({ nombre: member.nombre, email: member.email, password: '', rol: member.rol })
    setOpen(true)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!form.nombre.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      onToast('Revisa el nombre y el correo del empleado.', 'error')
      return
    }
    if (!editing && form.password.length < 8) {
      onToast('La contraseña inicial debe tener al menos 8 caracteres.', 'error')
      return
    }
    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } =
        isSupabaseConfigured && supabase
          ? await supabase.auth.getSession()
          : { data: { session: null }, error: null }
      if (sessionError) throw sessionError
      if (sessionData?.session && supabase) {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: {
            action: editing ? 'update' : 'create',
            userId: editing?.user_id,
            nombre: form.nombre,
            email: form.email,
            password: form.password,
            rol: form.rol,
          },
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
      } else {
        const list = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
        const row = {
          ...editing,
          user_id: editing?.user_id || `demo-staff-${Date.now()}`,
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          rol: form.rol,
          activo: true,
        }
        const next = editing
          ? list.map((entry) => entry.user_id === editing.user_id ? row : entry)
          : [...list, row]
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      await load()
      onToast(editing ? 'Cuenta de staff actualizada.' : 'Cuenta creada. Comparte la contraseña inicial de forma segura.')
      setOpen(false)
    } catch (error) {
      onToast(`No se pudo guardar el empleado: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (member) => {
    try {
      const { data: sessionData, error: sessionError } =
        isSupabaseConfigured && supabase
          ? await supabase.auth.getSession()
          : { data: { session: null }, error: null }
      if (sessionError) throw sessionError
      if (sessionData?.session && supabase) {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: { action: 'deactivate', userId: member.user_id },
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
      } else {
        const list = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map((row) =>
          row.user_id === member.user_id ? { ...row, activo: false } : row
        )))
      }
      await load()
      onToast('Cuenta desactivada.')
    } catch (error) {
      onToast(`No se pudo desactivar: ${error.message}`, 'error')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase text-white">Gestión de Staff y Permisos</h2>
          <p className="mt-1 text-sm text-muted">Administra cuentas, roles y acceso de recepción y entrenadores.</p>
        </div>
        <button type="button" onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white">
          <UserPlus className="h-4 w-4" /> Alta de personal
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {staff.map((member) => (
          <article key={member.user_id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-accent/10 p-3 text-accent"><UserRoundCog className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{member.nombre}</p>
                <p className="truncate text-sm text-muted">{member.email}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${member.activo ? 'bg-volt/10 text-volt' : 'bg-red-500/10 text-red-400'}`}>
                {member.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="mt-3 text-sm capitalize text-muted">Rol: {member.rol === 'trainer' ? 'Entrenador' : 'Recepción'}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => startEdit(member)}
                className="rounded-lg border border-line px-3 py-2 text-sm text-white">Editar</button>
              {member.activo && (
                <button type="button" onClick={() => deactivate(member)}
                  className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400">Desactivar</button>
              )}
            </div>
          </article>
        ))}
        {staff.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            No se han creado cuentas de personal.
          </p>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar cuenta de staff' : 'Crear cuenta de staff'}>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-xs font-semibold uppercase text-muted">Nombre
            <input className="field mt-1.5" required value={form.nombre}
              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} />
          </label>
          <label className="block text-xs font-semibold uppercase text-muted">Correo
            <input type="email" className="field mt-1.5" required value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          {!editing && (
            <label className="block text-xs font-semibold uppercase text-muted">Contraseña inicial
              <input type="password" minLength={8} className="field mt-1.5" required value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            </label>
          )}
          <label className="block text-xs font-semibold uppercase text-muted">Rol
            <select className="field mt-1.5" value={form.rol}
              onChange={(event) => setForm((current) => ({ ...current, rol: event.target.value }))}>
              <option value="reception">Recepción</option>
              <option value="trainer">Entrenador</option>
            </select>
          </label>
          <p className="rounded-lg bg-card p-3 text-xs text-muted">
            Recepción: clientes, asistencia, POS y caja. Entrenador: perfiles mínimos y asistencia; sin finanzas ni gestión de clientes.
          </p>
          <button disabled={saving} className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar cuenta'}
          </button>
        </form>
      </Modal>
    </section>
  )
}
