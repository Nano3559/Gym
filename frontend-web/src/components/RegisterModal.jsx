import { useMemo, useState } from 'react'
import { CheckCircle2, User, Phone, Mail, Home, Cake, CreditCard, HeartPulse, Lock } from 'lucide-react'
import Modal from './ui/Modal'
import { useAuth } from '../context/AuthContext'

const initialForm = {
  nombre: '',
  apellido: '',
  ci: '',
  nacimiento: '',
  telefono: '',
  correo: '',
  direccion: '',
  emergencia: '',
  password: '',
  confirmPassword: '',
}

export default function RegisterModal({ open, onClose, defaultPlan, onSuccess }) {
  const { signUp } = useAuth()
  const [form, setForm] = useState(() => ({
    ...initialForm,
    plan: defaultPlan || '',
  }))
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fecha máxima permitida: 14 años atrás (exige mayoría de 14 años).
  const maxBirthDate = useMemo(() => {
    const pad = (n) => String(n).padStart(2, '0')
    // oxlint-disable-next-line react/purity -- calculado una sola vez al montar
    const d = new Date()
    d.setFullYear(d.getFullYear() - 14)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  const reset = () => {
    setForm(initialForm)
    setErrors({})
    setSuccess(false)
  }

  const handleClose = () => {
    onClose()
    setTimeout(reset, 250)
  }

  const validate = () => {
    const errs = {}
    const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio'
    else if (!namePattern.test(form.nombre.trim())) errs.nombre = 'Solo se permiten letras en este campo'
    if (!form.apellido.trim()) errs.apellido = 'El apellido es obligatorio'
    else if (!namePattern.test(form.apellido.trim()))
      errs.apellido = 'Solo se permiten letras en este campo'
    if (!form.ci.trim()) errs.ci = 'El CI es obligatorio'
    else if (!/^\d{5,10}$/.test(form.ci.trim()))
      errs.ci = 'Ingresa un CI válido (5 a 10 dígitos)'
    if (!form.nacimiento) {
      errs.nacimiento = 'Selecciona tu fecha de nacimiento'
    } else {
      // oxlint-disable-next-line react/purity -- cálculo de edad al validar
      const now = new Date()
      const birth = new Date(`${form.nacimiento}T00:00:00`)
      let age = now.getFullYear() - birth.getFullYear()
      const m = now.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1
      if (age < 14) errs.nacimiento = 'Debes ser mayor de 14 años para registrarte'
    }
    if (!form.telefono.trim()) errs.telefono = 'El teléfono es obligatorio'
    else if (!/^\+?\d{7,12}$/.test(form.telefono.trim()))
      errs.telefono = 'Ingresa un teléfono válido'
    if (!form.correo.trim()) errs.correo = 'El correo es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()))
      errs.correo = 'Ingresa un correo válido'
    if (!form.direccion.trim()) errs.direccion = 'La dirección es obligatoria'
    if (!form.emergencia.trim()) errs.emergencia = 'El contacto de emergencia es obligatorio'
    if (!form.password) errs.password = 'La contraseña es obligatoria'
    else if (form.password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres'
    if (!form.confirmPassword) errs.confirmPassword = 'Confirma tu contraseña'
    else if (form.confirmPassword !== form.password) errs.confirmPassword = 'Las contraseñas no coinciden'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    const result = await signUp(form)
    setSubmitting(false)
    if (!result.ok) {
      setErrors({ password: result.message })
      return
    }
    setNeedsConfirmation(Boolean(result.needsConfirmation))
    setSuccess(true)
    onSuccess(form)
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
  }

  const renderField = ({ name, label, icon: Icon, type = 'text', placeholder, max, error }) => (
    <div>
      <label htmlFor={`rg-${name}`} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5 text-accent" />
        {label} <span className="text-accent">*</span>
      </label>
      <input
        id={`rg-${name}`}
        type={type}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
        max={max}
        className={`field ${error ? 'has-error' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )

  return (
    <Modal open={open} onClose={handleClose} title="Registro de cliente" maxWidth="max-w-2xl">
      {success ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-volt/15">
            <CheckCircle2 className="h-10 w-10 text-volt" />
          </span>
          <h3 className="mt-5 font-display text-2xl font-bold uppercase text-white">
            {needsConfirmation ? '¡Cuenta creada!' : '¡Registro exitoso!'}
          </h3>
          <p className="mt-2 max-w-md text-muted">
            {needsConfirmation ? (
              <>
                Te enviamos un correo a{' '}
                <span className="font-semibold text-white">{form.correo}</span> para confirmar tu
                cuenta. Una vez confirmado podrás iniciar sesión y reservar tus clases.
              </>
            ) : (
              <>
                Bienvenido/a, {form.nombre}. Tu cuenta fue creada correctamente.
                Ya puedes iniciar sesión, elegir un plan y reservar tus clases.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 rounded-xl bg-accent px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
          >
            Continuar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {renderField({
              name: 'nombre',
              label: 'Nombre',
              icon: User,
              placeholder: 'Ej. Juan',
              error: errors.nombre,
            })}
            {renderField({
              name: 'apellido',
              label: 'Apellido',
              icon: User,
              placeholder: 'Ej. Pérez',
              error: errors.apellido,
            })}
            {renderField({
              name: 'ci',
              label: 'Cédula de identidad (CI)',
              icon: CreditCard,
              placeholder: 'Ej. 1234567',
              error: errors.ci,
            })}
            {renderField({
              name: 'nacimiento',
              label: 'Fecha de nacimiento',
              icon: Cake,
              type: 'date',
              max: maxBirthDate,
              error: errors.nacimiento,
            })}
            {renderField({
              name: 'telefono',
              label: 'Teléfono',
              icon: Phone,
              placeholder: 'Ej. +591 71234567',
              error: errors.telefono,
            })}
            {renderField({
              name: 'correo',
              label: 'Correo electrónico',
              icon: Mail,
              type: 'email',
              placeholder: 'ejemplo@correo.com',
              error: errors.correo,
            })}
          </div>

          {renderField({
            name: 'direccion',
            label: 'Dirección',
            icon: Home,
            placeholder: 'Ej. Av. Banzer #1234',
            error: errors.direccion,
          })}

          {renderField({
            name: 'emergencia',
            label: 'Contacto de emergencia (nombre y teléfono)',
            icon: HeartPulse,
            placeholder: 'Ej. María Pérez · +591 70000000',
            error: errors.emergencia,
          })}

          <div className="grid gap-4 sm:grid-cols-2">
            {renderField({
              name: 'password',
              label: 'Contraseña',
              icon: Lock,
              type: 'password',
              placeholder: 'Mínimo 6 caracteres',
              error: errors.password,
            })}
            {renderField({
              name: 'confirmPassword',
              label: 'Confirmar contraseña',
              icon: Lock,
              type: 'password',
              placeholder: 'Repite tu contraseña',
              error: errors.confirmPassword,
            })}
          </div>

          <div className="rounded-xl border border-line bg-card-2 px-4 py-3 text-xs text-muted">
            Al enviar aceptas nuestros términos y políticas de tratamiento de datos.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-sheen w-full rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? 'Creando cuenta…' : 'Crear mi cuenta'}
          </button>
        </form>
      )}
    </Modal>
  )
}