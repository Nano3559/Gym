import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

const STORAGE_KEY = 'gym_global_settings'
const DEFAULTS = {
  nombre: 'IronForge Gym',
  telefono: '',
  correo: '',
  direccion: '',
  horario: { lunes: '06:00–22:00', martes: '06:00–22:00', miercoles: '06:00–22:00', jueves: '06:00–22:00', viernes: '06:00–22:00', sabado: '08:00–18:00', domingo: 'Cerrado' },
  terminos_legales: '',
}
const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

export default function GymSettings({ onToast }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (sessionData?.session) {
          const { data, error } = await supabase.from('gym_settings').select('*').eq('id', true).maybeSingle()
          if (error) throw error
          if (data) setSettings(data)
          return
        }
      }
      const local = window.localStorage.getItem(STORAGE_KEY)
      if (local) setSettings({ ...DEFAULTS, ...JSON.parse(local) })
    }
    load().catch((error) => onToast(`No se pudo cargar configuración: ${error.message}`, 'error'))
      .finally(() => setLoading(false))
  }, [onToast])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (sessionData?.session) {
          const { error } = await supabase.from('gym_settings').upsert({ id: true, ...settings })
          if (error) throw error
        } else {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
        }
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      }
      onToast('Configuración global guardada.')
    } catch (error) {
      onToast(`No se pudo guardar la configuración: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted">Cargando configuración…</p>
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }))

  return (
    <section className="max-w-4xl rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold uppercase text-white">Configuración Global</h2>
      <p className="mt-1 text-sm text-muted">Datos de contacto, horarios y términos legales del gimnasio.</p>
      <form onSubmit={save} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['nombre', 'Nombre del gimnasio'],
            ['telefono', 'Teléfono'],
            ['correo', 'Correo de contacto'],
            ['direccion', 'Dirección'],
          ].map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold uppercase text-muted">{label}
              <input className="field mt-1.5" value={settings[key] || ''}
                onChange={(event) => set(key, event.target.value)} />
            </label>
          ))}
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase text-muted">Horarios de apertura</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2 text-sm capitalize text-white">
                {day}
                <input className="field max-w-48" value={settings.horario?.[day] || ''}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    horario: { ...current.horario, [day]: event.target.value },
                  }))} />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-xs font-semibold uppercase text-muted">Términos legales
          <textarea rows={6} maxLength={10000} className="field mt-1.5"
            value={settings.terminos_legales || ''}
            onChange={(event) => set('terminos_legales', event.target.value)} />
        </label>
        <button disabled={saving} className="rounded-xl bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
    </section>
  )
}
