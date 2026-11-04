import { useEffect, useRef, useState } from 'react'
import Modal from './ui/Modal.jsx'
import MealEntry from './MealEntry.jsx'
import EnergyEstimate from './EnergyEstimate.jsx'
import BalancePanel from './BalancePanel.jsx'
import ProjectionPanel from './ProjectionPanel.jsx'
import { progressErrorMessage } from '../lib/progressErrors.js'
import { datetimeInput, localDay, zonedDateTimeToISO } from '../lib/progressData.js'
import { MET_ACTIVITIES } from '../lib/energyData.js'
import { mealTotals } from '../lib/trackingData.js'
import { getTrackingDay, getTrackingZone, saveDayStatus, saveManualActivity, voidMeal, voidActivity } from '../services/trackingService.js'
const css = 'min-h-12 w-full rounded-xl border border-line bg-card px-3'
const button = 'min-h-12 rounded-xl border border-line px-4 disabled:opacity-50'
export default function TrackingDiary({ onClose, onProfile }) {
  const [zone, setZone] = useState(''), [day, setDay] = useState(''), [revision, setRevision] = useState(0)
  const [zoneRevision, setZoneRevision] = useState(0)
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState(null), [toVoid, setToVoid] = useState(null)
  const [activity, setActivity] = useState({ title: '', minutes: '', intensity: 'moderate', when: '' })
  const operation = useRef(crypto.randomUUID())
  const [today] = useState(() => Date.now())
  useEffect(() => {
    let live = true
    getTrackingZone().then(value => { if (live) { setZone(value); setDay(localDay(Date.now(), value)); setActivity(old => ({ ...old, when: datetimeInput(Date.now() - 3600000, value) })) } })
      .catch(failure => { if (live) setError(progressErrorMessage(failure)) })
    return () => { live = false }
  }, [zoneRevision])
  useEffect(() => {
    if (!zone || !day) return
    let live = true
    getTrackingDay(day, zone).then(value => { if (live) { setData(value); setError('') } })
      .catch(failure => { if (live) setError(progressErrorMessage(failure)) })
    return () => { live = false }
  }, [zone, day, revision])
  async function run(task) {
    if (busy) return
    setBusy(true); setError('')
    try { await task(); setData(await getTrackingDay(day,zone)) }
    catch (failure) { setError(progressErrorMessage(failure)) }
    finally { setBusy(false) }
  }
  const totals = mealTotals(data?.meals || [])
  return <Modal open onClose={busy ? () => {} : onClose} title="Mi diario" maxWidth="max-w-3xl">
    <div className="mb-4 space-y-3 rounded-xl border border-accent/40 p-4"><h3 className="text-lg font-bold">Tu día, paso a paso</h3><p>Primero registra comidas y actividad. Después confirma que el día esté completo, revisa tu actividad cotidiana y guarda el gasto. Al final encontrarás el balance, la tendencia y la proyección.</p>{onProfile&&<button type="button" disabled={busy} className={button} onClick={onProfile}>Completar o corregir mis datos en Mi progreso</button>}</div>
    {error && <div role="alert" className="mb-4 text-red-300">{error}<button className={button} onClick={() => zone ? setRevision(value => value + 1) : setZoneRevision(value => value + 1)}>Reintentar</button></div>}
    {zone && <div className="space-y-5">
      <label>Día del diario<input type="date" className={css} value={day} max={localDay(today,zone)} disabled={busy} onChange={e => { if (!e.target.value) return; setDay(e.target.value); setActivity(old => ({ ...old, when: `${e.target.value}T${datetimeInput(Date.now()-3600000,zone).slice(11)}` })); operation.current=crypto.randomUUID(); setData(null); setEditor(null); setToVoid(null) }} /></label>
      <p className="text-sm text-muted">Zona: {zone}. Las actividades se muestran en el día de inicio. Los registros antiguos no se consideran confirmados automáticamente.</p>
      {!data ? <p role="status">Cargando día...</p> : <>
        <section className="rounded-xl border border-line p-4"><h4 className="font-bold">Consumo confirmado: {totals.calorias} kcal</h4><p className="text-sm text-muted">Proteínas {totals.proteinas_g} g · Carbohidratos {totals.carbohidratos_g} g · Grasas {totals.grasas_g} g</p><p className="text-sm text-muted">{data.status?.meals_complete ? 'Alimentación del día marcada completa.' : 'Registro alimentario incompleto; el total es provisional.'}</p></section>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => setEditor({ key: crypto.randomUUID() })}>Añadir comida manual</button><button className={button} disabled={busy} onClick={() => setRevision(value => value + 1)}>Actualizar diario</button></div>
        {editor && <MealEntry key={editor.key} row={editor.row} defaultDay={day} timezone={editor.row?.timezone || zone} source={editor.row?.source === 'scan' ? 'scan' : 'manual'} onBusyChange={setBusy} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setRevision(value => value + 1) }} />}
        <ul>{data.meals.map(row => <li key={row.id} className="space-y-2 border-b border-line py-3"><strong>{row.alimento} · {row.calorias} kcal</strong><p className="text-sm text-muted">{row.confirmation === 'confirmed' ? 'Consumo confirmado' : row.confirmation === 'void' ? 'Anulada, no se suma' : 'Registro antiguo sin confirmar'} · {row.source === 'scan' ? 'Escáner' : row.source === 'manual' ? 'Manual' : 'Origen antiguo'} · {new Date(row.consumed_at).toLocaleTimeString('es',{ timeZone: zone, hour: '2-digit', minute: '2-digit' })}</p><p className="text-sm text-muted">{row.portions} × {row.portion || 'Porción no registrada'}</p><div className="flex gap-3"><button className={button} disabled={busy} onClick={() => setEditor({ key: row.id, row })}>Corregir / confirmar</button>{row.confirmation !== 'void' && <button className={button} disabled={busy} onClick={() => setToVoid(row)}>Anular</button>}</div></li>)}</ul>
        {!data.meals.length && <p className="text-muted">No hay comidas registradas. Esto no significa que la ingesta haya sido cero.</p>}
        {toVoid && <div role="alert" className="rounded-xl border border-line p-3"><p>¿Anular {toVoid.alimento || toVoid.routine_title}? Se conservará el registro y dejará de sumarse.</p><button disabled={busy} className={button} onClick={() => void run(async () => { await (toVoid.isActivity ? voidActivity(toVoid) : voidMeal(toVoid)); setToVoid(null) })}>Confirmar anulación</button><button disabled={busy} className={button} onClick={() => setToVoid(null)}>Conservar</button></div>}
        <p className="text-xs text-muted">El tiempo activo de una rutina es el tiempo en fase de ejercicio, excluyendo descansos y pausas; no mide esfuerzo metabólico. Las actividades anuladas se conservan como historial.</p>
        <section className="space-y-3"><h4 className="text-lg font-bold">Actividad realizada</h4><ul>{data.sessions.map(row => <li key={row.id} className="border-b border-line py-3"><strong>{row.routine_title}</strong><p className="text-sm text-muted">{row.session_status === 'void' ? 'Anulada' : row.session_status === 'partial' ? 'Parcial' : row.session_status === 'manual' ? 'Manual' : row.session_status === 'legacy' ? 'Historial antiguo' : 'Completada'} · {Math.round(row.duration_sec/60)} min transcurridos · {row.active_sec == null ? 'Tiempo activo desconocido' : `${Math.round(row.active_sec/60)} min activos`} · {row.intensity || 'Intensidad no especificada'}</p>{row.exercises?.length > 0 && <details><summary className="min-h-12 cursor-pointer py-3">Ver series realizadas</summary><ul>{row.exercises.map((set,index) => <li key={index} className="text-sm text-muted">{set.exerciseId} · serie {set.set} · {set.reps} reps · {set.durationSec || 0}s · {set.loadKg == null ? 'Carga no registrada' : `${set.loadKg} kg`}</li>)}</ul></details>}{row.session_status !== 'void' && <button className={button} disabled={busy} onClick={() => setToVoid({ ...row, isActivity: true })}>Anular actividad</button>}</li>)}</ul>{!data.sessions.length && <p className="text-muted">No hay actividad registrada este día.</p>}</section>
        <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={event => { event.preventDefault(); void run(async () => { await saveManualActivity({ ...activity, timezone: zone, started_at: zonedDateTimeToISO(activity.when,zone) },operation.current); operation.current=crypto.randomUUID(); setActivity(old => ({...old,title:'',minutes:''})) }) }}>
          <h4 className="font-bold">Añadir actividad realizada</h4><p className="text-sm text-muted">Elige una actividad del catálogo y registra minutos activos, sin descansos. Después confirma su categoría en la estimación del gasto.</p><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label>Actividad<select className={css} required value={activity.title} onChange={e => {setActivity({...activity,title:e.target.value});operation.current=crypto.randomUUID()}}><option value="">Selecciona una actividad</option>{Object.entries(MET_ACTIVITIES).map(([code,item]) => <option key={code} value={item.label}>{item.label}</option>)}</select></label>{[['minutes','Minutos activos','number'],['when','Inicio','datetime-local']].map(([key,label,type]) => <label key={key}>{label}<input className={css} required type={type} min={type==='number' ? '0.1' : undefined} step={type==='number' ? '0.1' : undefined} value={activity[key]} onChange={e => {setActivity({...activity,[key]:e.target.value});operation.current=crypto.randomUUID()}} /></label>)}<label>Intensidad<select className={css} value={activity.intensity} onChange={e => {setActivity({...activity,intensity:e.target.value});operation.current=crypto.randomUUID()}}><option value="light">Ligera</option><option value="moderate">Moderada</option><option value="high">Alta</option></select></label></fieldset><button disabled={busy} className={`${button} bg-accent`}>Guardar actividad</button>
        </form>
        <section className="space-y-3 rounded-xl border border-line p-4"><h4 className="font-bold">Completitud del día</h4><p className="text-sm text-muted">Marca cada opción solo cuando hayas registrado todo lo realizado o consumido ese día.</p>{[['meals_complete','Registré toda mi alimentación'],['activity_complete','Registré toda mi actividad (o no hice ejercicio)']].map(([key,label]) => <label key={key} className="flex min-h-12 items-center gap-3"><input type="checkbox" disabled={busy} checked={Boolean(data.status?.[key])} onChange={e => void run(() => saveDayStatus(day,zone,{ [key]: e.target.checked }))} />{label}</label>)}</section>
        <EnergyEstimate key={day+zone} day={day} timezone={zone} sessions={data.sessions} status={data.status} onSaved={()=>setRevision(value=>value+1)} />
        <BalancePanel timezone={zone} refreshToken={data} onSelectDay={value=>{if(busy)return;setDay(value);setData(null);setEditor(null);setToVoid(null);setActivity(old=>({...old,when:`${value}T12:00`}));operation.current=crypto.randomUUID()}} />
        <ProjectionPanel timezone={zone} refreshToken={data} />
      </>}
    </div>}
  </Modal>
}
