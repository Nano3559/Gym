import { useState } from 'react'
import { Lock, Mail, LogIn, UserPlus } from 'lucide-react'
import Modal from './ui/Modal'
import { useAuth } from '../context/AuthContext'

export default function LoginModal({ open, onClose, onGoRegister, onSuccess }) {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ correo: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setForm({ correo: '', password: '' })
    setErrors({})
    setLoading(false)
  }

  const handleClose = () => {
    onClose()
    setTimeout(reset, 250)
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.correo.trim()) errs.correo = 'El correo es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()))
      errs.correo = 'Ingresa un correo válido'
    if (!form.password) errs.password = 'La contraseña es obligatoria'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    const result = await signIn(form.correo.trim(), form.password)
    setLoading(false)

    if (!result.ok) {
      setErrors({ password: result.message })
      return
    }
    handleClose()
    onSuccess?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Iniciar sesión">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="lg-correo" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Mail className="h-3.5 w-3.5 text-accent" />
            Correo electrónico
          </label>
          <input
            id="lg-correo"
            type="email"
            value={form.correo}
            onChange={set('correo')}
            placeholder="ejemplo@correo.com"
            autoComplete="email"
            className={`field ${errors.correo ? 'has-error' : ''}`}
          />
          {errors.correo && <p className="mt-1 text-xs text-red-400">{errors.correo}</p>}
        </div>

        <div>
          <label htmlFor="lg-password" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Lock className="h-3.5 w-3.5 text-accent" />
            Contraseña
          </label>
          <input
            id="lg-password"
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            className={`field ${errors.password ? 'has-error' : ''}`}
          />
          {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-sheen flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>

        <p className="text-center text-sm text-muted">
          ¿Aún no tienes cuenta?{' '}
          <button
            type="button"
            onClick={() => {
              handleClose()
              onGoRegister?.()
            }}
            className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-2 hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Regístrate aquí
          </button>
        </p>
      </form>
    </Modal>
  )
}
