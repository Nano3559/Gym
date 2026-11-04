import { useEffect, useRef, useState } from 'react'
import Modal from './ui/Modal.jsx'
import { getProgress, saveProgressProfile, saveProgressBirthDate, setWeightGoal, saveWeightLog, deleteWeightLog } from '../services/progressService.js'
import { datetimeInput, localDay, weightSummary, zonedDateTimeToISO } from '../lib/progressData.js'
import { progressErrorMessage } from '../lib/progressErrors.js'
import DailyActivityQuestionnaire from './DailyActivityQuestionnaire.jsx'

const activityOptions = { sedentary: 'Sedentaria', light: 'Ligera', moderate: 'Moderada', high: 'Alta' }
const inputClass = 'min-h-12 w-full rounded-xl border border-line bg-card px-3 text-white'
const buttonClass = 'min-h-12 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-50'
const emptyData = { profile: null, goals: [], logs: [] }

export default function ProgressPanel({ onClose, onDiary }) {
  const [data, setData] = useState(emptyData)
  const [profile, setProfile] = useState({ height_cm: '', activity_level: '', formula_sex: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
  const [weight, setWeight] = useState('')
  const [birthDate,setBirthDate]=useState(''),[today]=useState(()=>Date.now())
  const [when, setWhen] = useState('')
  const [editing, setEditing] = useState(null)
  const [target, setTarget] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const operation = useRef({ weight: crypto.randomUUID(), goal: crypto.randomUUID() })
  useEffect(() => {
    let live = true
    getProgress().then(result => {
      if (!live) return
      setData(result)
      setBirthDate(result.birthDate??'')
      if (result.profile) setProfile({ ...result.profile, formula_sex: result.profile.formula_sex ?? '' })
      const zone = result.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      setWhen(datetimeInput(Date.now(), zone))
      setTarget(result.goals.find(goal => !goal.ended_at)?.target_weight_kg ?? '')
      setError('')
    }).catch(failure => { if (live) { setLoadFailed(true); setError(progressErrorMessage(failure)) } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [reload])

  async function run(task, success) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await task()
      const result = await getProgress()
      setData(result)
      setMessage(success)
    } catch (failure) {
      setError(progressErrorMessage(failure))
    } finally { setBusy(false) }
  }
  function changeWeight() { operation.current.weight = crypto.randomUUID() }
  const summary = weightSummary(data.logs)
  const activeGoal = data.goals.find(goal => !goal.ended_at)
  const eventZone = editing?.timezone || data.profile?.timezone || profile.timezone
  function cancelEdit() {
    setEditing(null); setWeight(''); setWhen(datetimeInput(Date.now(), data.profile.timezone)); changeWeight()
  }
  const formatDate = (instant, zone) => new Intl.DateTimeFormat('es', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant))

  return <Modal open onClose={busy ? () => {} : onClose} title="Mi progreso" maxWidth="max-w-3xl">
    <div className="mb-4 space-y-3 rounded-xl border border-accent/40 p-4"><h3 className="text-xl font-bold">Empieza aquí: tus datos para el seguimiento</h3><p>1. Revisa tu fecha de nacimiento. 2. Guarda tu estatura y actividad cotidiana. 3. Añade una meta y tu primer pesaje. Después abre Mi diario para registrar comidas y actividad.</p><p className="text-sm text-muted">Los datos se guardan en tu cuenta real de Supabase. El balance puede consultarse cuando registres y cierres días completos; la proyección necesita cuatro semanas de historial.</p></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/50 p-3 text-red-300">{error}</p>}
    {message && <p role="status" className="mb-4 text-green-400">{message}</p>}
    {!loading && !loadFailed && <button type="button" disabled={busy} className={`${buttonClass} mb-4`} onClick={() => { setLoading(true); setReload(value => value + 1) }}>Recargar progreso y descartar cambios sin guardar</button>}
    {loading ? <p role="status">Cargando progreso...</p> : loadFailed ?
      <button className={buttonClass} onClick={() => { setLoading(true); setLoadFailed(false); setReload(value => value + 1) }}>Reintentar carga</button> : <div className="space-y-6">
      <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={event=>{event.preventDefault();void run(()=>saveProgressBirthDate(birthDate,data.profile?.timezone||'UTC'),'Fecha de nacimiento guardada en tu cuenta.')}}>
        <h4 className="text-lg font-bold">1. Fecha de nacimiento</h4><label>Fecha de nacimiento<input className={inputClass} type="date" required max={localDay(today,data.profile?.timezone||'UTC')} value={birthDate} disabled={busy} onChange={e=>setBirthDate(e.target.value)}/></label><p className="text-sm text-muted">Se usa para calcular tu edad. La estimación inicial de gasto cubre adultos de 19 a 59 años.</p><button disabled={busy} className={buttonClass}>Guardar fecha de nacimiento</button>
      </form>
      <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={event => {
        event.preventDefault()
        void run(async () => {
          const saved = await saveProgressProfile(profile)
          setProfile({ ...saved, formula_sex: saved.formula_sex ?? '' })
          if (!editing) setWhen(datetimeInput(Date.now(), saved.timezone))
        }, 'Perfil de progreso guardado.')
      }}>
        <h4 className="text-lg font-bold">2. Estatura y actividad cotidiana</h4>
        <DailyActivityQuestionnaire disabled={busy} onApply={result=>setProfile({...profile,activity_level:result.activityLevel})}/>
        <p className="text-sm text-muted">Usa el cuestionario si no sabes qué elegir. Al guardar el perfil se conserva el nivel seleccionado abajo; puedes volver a responder cuando cambie tu rutina.</p>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label>Estatura (cm)<input className={inputClass} type="number" min="100" max="250" step="0.1" required value={profile.height_cm} onChange={e => setProfile({ ...profile, height_cm: e.target.value })} /></label>
          <label>Actividad habitual<select className={inputClass} required value={profile.activity_level} onChange={e => setProfile({ ...profile, activity_level: e.target.value })}><option value="">Selecciona una opción</option>{Object.entries(activityOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Sexo para la fórmula de gasto (opcional)<select className={inputClass} value={profile.formula_sex} onChange={e => setProfile({ ...profile, formula_sex: e.target.value })}><option value="">No especificado</option><option value="female">Femenino</option><option value="male">Masculino</option></select></label>
          <label>Zona horaria<input className={inputClass} required value={profile.timezone} placeholder="America/La_Paz" onChange={e => setProfile({ ...profile, timezone: e.target.value })} /></label>
        </fieldset>
        <label className="flex min-h-12 items-center gap-3"><input type="checkbox" disabled={busy} checked={profile.estimates_paused ?? false} onChange={e => setProfile({ ...profile, estimates_paused: e.target.checked })} />Suspender mis estimaciones de gasto y peso</label>
        <p className="text-sm text-muted">Puedes seguir registrando comidas, actividad y pesajes. Esta estimación inicial no cubre embarazo, lactancia ni circunstancias que alteren la interpretación del peso. No necesitas indicar un diagnóstico. Desmarca la opción y guarda para volver a habilitar los cálculos.</p>
        <p className="text-sm text-muted">La estatura y el sexo permiten estimar el gasto en Mi diario; si no se informa el sexo, ese cálculo no estará disponible. La zona horaria organiza los días; cambiarla no cambia pesajes anteriores.</p>
        <button disabled={busy} className={`${buttonClass} bg-accent`}>Guardar perfil y actividad cotidiana</button>
      </form>
      {!data.profile ? <p>Guarda tu perfil para añadir una meta y pesajes.</p> : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen de peso">
          {[['Peso inicial', summary.first], ['Último peso', summary.latest], ['Cambio', summary.change], ['Meta actual', activeGoal?.target_weight_kg]].map(([label, value]) => <div key={label} className="rounded-xl border border-line p-3"><p className="text-sm text-muted">{label}</p><strong>{value == null ? 'Sin registro' : `${Number(value).toLocaleString('es')} kg`}</strong></div>)}
        </div>
        <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={event => {
          event.preventDefault()
          void run(async () => { await setWeightGoal(target, operation.current.goal); operation.current.goal = crypto.randomUUID() }, 'Meta guardada. Las metas anteriores se conservan.')
        }}>
          <h4 className="text-lg font-bold">3. Meta de peso</h4>
          <label>Peso objetivo (kg)<input className={inputClass} required type="number" min="20" max="500" step="0.01" value={target} disabled={busy} onChange={e => { setTarget(e.target.value); operation.current.goal = crypto.randomUUID() }} /></label>
          <p className="text-sm text-muted">La meta es una referencia personal; no es una recomendación ni una fecha prometida de llegada.</p>
          <button disabled={busy} className={buttonClass}>Guardar meta</button>
          {data.goals.length > 0 && <details><summary className="cursor-pointer py-3">Historial de metas ({data.goals.length})</summary><ul>{data.goals.map(goal => <li key={goal.id} className="py-2 text-sm">{goal.target_weight_kg} kg · {formatDate(goal.started_at, data.profile.timezone)} · {goal.ended_at ? 'Anterior' : 'Actual'}</li>)}</ul></details>}
        </form>
        <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={event => {
          event.preventDefault()
          void run(async () => {
            await saveWeightLog({ id: editing?.id, updatedAt: editing?.updated_at, weight,
              measuredAt: zonedDateTimeToISO(when, eventZone), timezone: eventZone, operationId: operation.current.weight })
            cancelEdit()
          }, editing ? 'Pesaje corregido.' : 'Pesaje guardado.')
        }}>
          <h4 className="text-lg font-bold">{editing ? 'Corregir pesaje' : '4. Registrar mi peso'}</h4>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <label>Peso corporal (kg)<input className={inputClass} required type="number" min="20" max="500" step="0.01" value={weight} onChange={e => { setWeight(e.target.value); changeWeight() }} /></label>
            <label>Fecha y hora<input className={inputClass} required type="datetime-local" value={when} onChange={e => { setWhen(e.target.value); changeWeight() }} /></label>
          </fieldset>
          <p className="text-sm text-muted">Hora en {eventZone}. Puedes registrar varios pesajes al día.</p>
          <div className="flex flex-wrap gap-3"><button disabled={busy} className={`${buttonClass} bg-accent`}>{editing ? 'Guardar corrección' : 'Guardar pesaje'}</button>{editing && <button type="button" disabled={busy} className={buttonClass} onClick={cancelEdit}>Cancelar edición</button>}</div>
        </form>
        <section className="rounded-xl border border-line p-4">
          <h4 className="text-lg font-bold">Historial de peso ({data.logs.length})</h4>
          {!data.logs.length && <p className="mt-3 text-muted">Todavía no registraste pesajes.</p>}
          <ul className="max-h-96 overflow-y-auto">{data.logs.map(log => <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <div><strong>{log.weight_kg} kg</strong><p className="text-sm text-muted">{formatDate(log.measured_at, log.timezone)} · {log.timezone}</p>{log.updated_at !== log.created_at && <p className="text-xs text-muted">Última actualización: {formatDate(log.updated_at, log.timezone)}</p>}</div>
            <div className="flex gap-2"><button disabled={busy} className={buttonClass} aria-label={`Editar pesaje de ${log.weight_kg} kg del ${log.local_date}`} onClick={() => { setEditing(log); setWeight(log.weight_kg); setWhen(datetimeInput(log.measured_at, log.timezone)); setDeleting(null); changeWeight() }}>Editar</button><button disabled={busy} className={buttonClass} aria-label={`Eliminar pesaje de ${log.weight_kg} kg del ${log.local_date}`} onClick={() => setDeleting(log)}>Eliminar</button></div>
          </li>)}</ul>
          {deleting && <div role="alert" className="mt-4 space-y-3 rounded-xl border border-red-500/50 p-3"><p>¿Eliminar el pesaje de {deleting.weight_kg} kg del {formatDate(deleting.measured_at, deleting.timezone)}? Esta acción no se puede deshacer.</p><div className="flex flex-wrap gap-3"><button disabled={busy} className={buttonClass} onClick={() => void run(async () => { await deleteWeightLog(deleting.id, deleting.updated_at); if (editing?.id === deleting.id) cancelEdit(); setDeleting(null) }, 'Pesaje eliminado.')}>Confirmar eliminación</button><button disabled={busy} className={buttonClass} onClick={() => setDeleting(null)}>Conservar pesaje</button></div></div>}
        </section>
      </>}
    </div>}
    {onDiary&&!loadFailed&&<div className="mt-5 space-y-2"><button type="button" className={`${buttonClass} bg-accent`} disabled={busy||!data.profile||!data.logs.length||!data.birthDate} onClick={onDiary}>Continuar a Mi diario</button><p className="text-sm text-muted">Completa fecha de nacimiento, perfil y al menos un pesaje para continuar con el gasto diario.</p></div>}
    {busy && <p role="status" className="mt-3">Guardando cambios...</p>}
  </Modal>
}
