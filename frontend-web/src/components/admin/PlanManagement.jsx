import { useState } from 'react'
import { BadgeCheck, Check, Edit3, Plus, Settings2, X, Zap } from 'lucide-react'
import Modal from '../ui/Modal'
import { usePlans } from '../../context/PlansContext'

const EMPTY_FORM = {
  id: '',
  name: '',
  price: 180,
  durationDays: 30,
  description: '',
  featuresText: '',
  highlighted: false,
  active: true,
}

function featuresFromText(text) {
  return text
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
}

export default function PlanManagement({ onToast }) {
  const { plans, savePlan, togglePlan } = usePlans()
  const [editing, setEditing] = useState(null) // null | 'new' | plan object
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  const openEdit = (plan) => {
    setForm({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description,
      featuresText: (plan.features || []).join('\n'),
      highlighted: plan.highlighted,
      active: plan.active,
    })
    setErrors({})
    setEditing(plan)
  }

  const openNew = () => {
    setForm({ ...EMPTY_FORM, id: `plan-${Date.now()}` })
    setErrors({})
    setEditing('new')
  }

  const close = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
  }

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio'
    if (!(Number(form.price) > 0)) errs.price = 'Ingresa un precio válido en Bs.'
    if (!(Number(form.durationDays) > 0)) errs.durationDays = 'Ingresa la duración en días'
    const features = featuresFromText(form.featuresText)
    if (features.length === 0) errs.featuresText = 'Añade al menos una característica (una por línea)'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const plan = {
      id: form.id,
      name: form.name.trim(),
      price: Number(form.price),
      durationDays: Number(form.durationDays),
      description: form.description.trim(),
      features,
      highlighted: form.highlighted,
      active: form.active,
    }
    await savePlan(plan)
    onToast?.(editing === 'new' ? 'Plan creado correctamente.' : 'Plan actualizado correctamente.')
    close()
  }

  const handleToggle = async (plan) => {
    await togglePlan(plan.id)
    onToast?.(plan.active ? 'Plan desactivado.' : 'Plan activado.')
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent'
  const errText = (k) =>
    errors[k] ? <p className="mt-1 text-xs text-red-400">{errors[k]}</p> : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
            <Settings2 className="h-5 w-5 text-accent" />
            Gestión de Planes
          </h2>
          <p className="mt-1 text-xs text-muted">
            Precios, duración, características y visibilidad de los planes de membresía.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          Nuevo plan
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`rounded-2xl border p-6 ${
              plan.highlighted ? 'border-accent bg-gradient-to-b from-accent/10 to-card' : 'border-line bg-surface'
            } ${!plan.active ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold uppercase text-white">
                  {plan.name}
                </h3>
                <p className="text-xs text-muted">{plan.description || plan.tagline}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  plan.active
                    ? 'border-volt/40 bg-volt/10 text-volt'
                    : 'border-line bg-card text-muted'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${plan.active ? 'bg-volt' : 'bg-muted'}`} />
                {plan.active ? 'Activo' : 'Desactivado'}
              </span>
            </div>

            <div className="mt-4 flex items-end gap-1">
              <span className="text-sm font-semibold text-muted">{plan.currency}</span>
              <span className="font-display text-3xl font-bold text-white">{plan.price}</span>
              <span className="mb-1 text-sm text-muted">{plan.period}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Duración: {plan.durationDays} días</p>

            <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
              {(plan.features || []).slice(0, 4).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-muted">
                  <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="truncate">{feature}</span>
                </li>
              ))}
              {(plan.features || []).length > 4 && (
                <li className="text-xs text-muted">+{(plan.features || []).length - 4} más</li>
              )}
            </ul>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(plan)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-white transition hover:border-accent hover:text-accent"
              >
                <Edit3 className="h-4 w-4" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleToggle(plan)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  plan.active
                    ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                    : 'border-volt/40 text-volt hover:bg-volt/10'
                }`}
              >
                {plan.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Modal de creación / edición */}
      <Modal
        open={Boolean(editing)}
        onClose={close}
        title={editing === 'new' ? 'Nuevo plan de membresía' : 'Editar plan'}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Nombre del plan
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Ej: Plan Fit"
              className={inputClass}
            />
            {errText('name')}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Precio (Bs.)
              </label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={set('price')}
                className={inputClass}
              />
              {errText('price')}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Duración (días)
              </label>
              <input
                type="number"
                min="1"
                value={form.durationDays}
                onChange={set('durationDays')}
                className={inputClass}
              />
              {errText('durationDays')}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Descripción
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={set('description')}
              placeholder="Breve descripción del plan"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Características (una por línea)
            </label>
            <textarea
              rows={4}
              value={form.featuresText}
              onChange={set('featuresText')}
              placeholder={'Acceso al gimnasio\nTodas las clases grupales'}
              className={inputClass}
            />
            {errText('featuresText')}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.highlighted}
              onChange={set('highlighted')}
              className="h-4 w-4 accent-accent"
            />
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <Zap className="h-4 w-4 text-accent" />
              Marcar como más popular
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="btn-sheen inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
            >
              <BadgeCheck className="h-4 w-4" />
              Guardar plan
            </button>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-muted transition hover:text-white"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}