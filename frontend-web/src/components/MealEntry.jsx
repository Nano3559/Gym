import { useEffect, useRef, useState } from 'react'
import { datetimeInput, zonedDateTimeToISO } from '../lib/progressData.js'
import { NUTRIENTS } from '../lib/trackingData.js'
import { getTrackingZone, saveConsumedMeal } from '../services/trackingService.js'
const labels = { calorias: 'Calorías (kcal)', proteinas_g: 'Proteínas (g)', carbohidratos_g: 'Carbohidratos (g)', grasas_g: 'Grasas (g)' }
const css = 'min-h-12 w-full rounded-xl border border-line bg-card px-3'
export default function MealEntry({ analysis = {}, row, timezone, defaultDay, onSaved, onCancel, onBusyChange, source = 'manual' }) {
  const [zone, setZone] = useState(timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [form, setForm] = useState(() => ({ alimento: row?.alimento || analysis.alimento || '', descripcion: row?.descripcion || analysis.descripcion || '',
    portion: row?.portion || 'Porción de referencia', portions: row?.portions || 1,
    ...Object.fromEntries(NUTRIENTS.map(key => [key, row?.nutrition_per_portion?.[key] ?? row?.[key] ?? analysis[key] ?? ''])),
    when: row ? datetimeInput(row.consumed_at, row.timezone || zone) : defaultDay ? `${defaultDay}T${datetimeInput(Date.now(),zone).slice(11)}` : datetimeInput(Date.now(),zone) }))
  const [ready, setReady] = useState(Boolean(timezone))
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState('')
  const operation = useRef(crypto.randomUUID())
  useEffect(() => {
    if (timezone) return
    let live = true
    getTrackingZone().then(value => { if (live) { setZone(value); setForm(old => ({ ...old, when: datetimeInput(Date.now(), value) })); setReady(true) } })
      .catch(() => { if (live) setError('Inicia sesión y comprueba que las migraciones del diario estén aplicadas.') })
    return () => { live = false }
  }, [timezone])
  const change = key => event => { setForm({ ...form, [key]: event.target.value }); operation.current = crypto.randomUUID() }
  return <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={async event => {
    event.preventDefault(); if (busy || saved) return
    setBusy(true); onBusyChange?.(true); setError('')
    try {
      await saveConsumedMeal({ ...form, timezone: row?.timezone || zone, consumed_at: zonedDateTimeToISO(form.when, row?.timezone || zone) },
        { id: row?.id, updatedAt: row?.updated_at, operationId: operation.current, source })
      setSaved(true); onSaved?.()
    } catch (failure) { setError(failure.message || 'No se pudo guardar. Puedes reintentar.') }
    finally { setBusy(false); onBusyChange?.(false) }
  }}>
    <h4 className="font-bold">{row ? 'Corregir y confirmar comida' : 'Confirmar comida consumida'}</h4>
    <p className="text-sm text-muted">Revisa los valores por porción y cuántas porciones consumiste. Solo se suma al diario al confirmar.</p>
    <fieldset disabled={busy || saved || !ready} className="grid gap-3 sm:grid-cols-2">
      <label>Alimento<input className={css} required value={form.alimento} onChange={change('alimento')} /></label>
      <label>Porción de referencia<input className={css} required value={form.portion} onChange={change('portion')} placeholder="Un plato de 250 g" /></label>
      <label>Porciones consumidas<input className={css} required type="number" min="0.01" max="100" step="0.01" value={form.portions} onChange={change('portions')} /></label>
      <label>Fecha y hora de consumo<input className={css} required type="datetime-local" value={form.when} onChange={change('when')} /></label>
      {NUTRIENTS.map(key => <label key={key}>{labels[key]} por porción<input className={css} required type="number" min="0" max="50000" step="0.01" value={form[key]} onChange={change(key)} /></label>)}
    </fieldset>
    <p className="text-xs text-muted">Hora en {row?.timezone || zone}. Las estimaciones del escáner pueden corregirse antes de guardar.</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {saved ? <p role="status" className="text-green-400">Comida guardada en tu diario.</p> : <button disabled={!ready || busy} className="min-h-12 rounded-xl bg-accent px-4 font-bold disabled:opacity-50">{busy ? 'Guardando...' : row ? 'Guardar corrección' : 'Confirmar consumo y guardar'}</button>}
    {onCancel && <button type="button" disabled={busy} className="ml-3 min-h-12 rounded-xl border border-line px-4" onClick={onCancel}>Cancelar</button>}
  </form>
}
