import { useEffect, useState } from 'react'
import { Building2, Save } from 'lucide-react'
import { useGymSettings } from '../../context/GymSettingsContext'

export default function GlobalSettings({ onToast }) {
  const { settings, localOnly, saveSettings } = useGymSettings()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // oxlint-disable-next-line react/set-state-in-effect -- sincroniza formulario al cargar ajustes remotos
  useEffect(() => setForm(settings), [settings])

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const result = await saveSettings(form)
    setSaving(false)
    if (!result.ok) {
      setMessage(result.message)
      onToast?.(result.message, 'error')
      return
    }
    const confirmation = result.local ? 'Configuración guardada en este navegador.' : 'Configuración global guardada.'
    setMessage(confirmation)
    onToast?.(confirmation)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white"><Building2 className="h-5 w-5 text-accent" /> Configuración Global</h2>
        <p className="mt-1 text-xs text-muted">Datos de contacto, horarios y términos visibles en el sitio.</p>
      </div>
      {localOnly && <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-200">Supabase no está disponible: los cambios solo se guardarán en este navegador.</p>}
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Nombre del gimnasio<input className="field mt-1.5" value={form.name} onChange={update('name')} required /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Correo<input className="field mt-1.5" type="email" value={form.email} onChange={update('email')} required /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Teléfono<input className="field mt-1.5" value={form.phone} onChange={update('phone')} required /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">WhatsApp (código país y número)<input className="field mt-1.5" value={form.whatsapp} onChange={update('whatsapp')} required /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-2">Dirección<input className="field mt-1.5" value={form.address} onChange={update('address')} required /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-2">Horarios de apertura<textarea className="field mt-1.5" rows={2} value={form.hours} onChange={update('hours')} required /></label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-2">Términos legales<textarea className="field mt-1.5" rows={6} value={form.legalTerms} onChange={update('legalTerms')} required /></label>
        </div>
        {message && <p role="status" className="text-sm text-muted">{message}</p>}
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Guardar configuración'}</button>
      </form>
    </div>
  )
}
