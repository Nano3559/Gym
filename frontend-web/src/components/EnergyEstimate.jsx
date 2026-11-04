import { useEffect, useRef, useState } from 'react'
import { BACKGROUND_FACTORS, MET_ACTIVITIES, estimateEnergy } from '../lib/energyData.js'
import { getEnergyInputs, classifyActivity, saveEnergySnapshot } from '../services/energyService.js'
import DailyActivityQuestionnaire from './DailyActivityQuestionnaire.jsx'
import { progressErrorMessage } from '../lib/progressErrors.js'
const control='min-h-12 rounded-xl border border-line bg-card px-3 disabled:opacity-50'
export default function EnergyEstimate({day,timezone,sessions,status,onSaved}){
  const [inputs,setInputs]=useState(null),[factor,setFactor]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
  const operation=useRef(crypto.randomUUID())
  const factorDirty=useRef(false)
  const [activityAnswers,setActivityAnswers]=useState(null)
  useEffect(()=>{
    let live=true
    getEnergyInputs(day,timezone).then(value=>{if(live){setInputs({...value,sourceSessions:sessions,sourceStatus:status});const saved=value.previous[0]?.snapshot;if(!factorDirty.current&&saved?.inputs?.factor){setFactor(String(saved.inputs.factor));setActivityAnswers(saved.inputs.activityAnswers??null)}setError('');operation.current=crypto.randomUUID()}}).catch(failure=>{if(live)setError(progressErrorMessage(failure))})
    return()=>{live=false}
  },[day,timezone,sessions,status,revision])
  const ready=inputs&&inputs.sourceSessions===sessions&&inputs.sourceStatus===status
  const estimate=ready?estimateEnergy({...inputs,day,timezone,factor,activityAnswers,activityComplete:Boolean(status?.activity_complete)}):null
  return <section className="space-y-3 rounded-xl border border-accent/40 p-4">
    <h4 className="text-lg font-bold">Gasto energético estimado</h4>
    <p className="text-sm text-muted">Estimación orientativa para adultos de 19 a 59 años. No es una medición ni un objetivo de alimentación. El balance se consulta en el resumen del diario.</p>
    {error&&<p role="alert" className="text-red-300">{error}<button className={control} onClick={()=>setRevision(value=>value+1)}>Reintentar</button></p>}
    {!ready?<p role="status">Cargando datos del gasto...</p>:<>
      <p className="text-sm">Responde según tu jornada del {day}. Guarda después la estimación para conservar la actividad elegida y sus respuestas en ese día.</p>
      <DailyActivityQuestionnaire disabled={busy} onApply={result=>{factorDirty.current=true;setFactor(result.factor);setActivityAnswers(result.answers);setNotice('Actividad cotidiana aplicada. Guarda la estimación para conservarla.');operation.current=crypto.randomUUID()}}/>
      <label className="block">Actividad cotidiana de ese día, sin entrenamientos<select className={`${control} mt-2 w-full`} value={factor} disabled={busy} onChange={e=>{factorDirty.current=true;setFactor(e.target.value);setActivityAnswers(null);setNotice('');operation.current=crypto.randomUUID()}}><option value="">Selecciona una opción</option>{Object.entries(BACKGROUND_FACTORS).map(([value,label])=><option key={value} value={value}>{label} (factor {value})</option>)}</select></label>
      <p className="text-xs text-muted">Los factores son supuestos orientativos de esta primera versión, no valores medidos ni calibrados para ti. No se usa automáticamente el nivel habitual del perfil, que podría incluir ejercicio.</p>
      {inputs.sessions.filter(row=>row.session_status!=='void'&&Number(row.active_sec)>0).map(row=><label className="block" key={row.id}>Categoría de «{row.routine_title}»<select className={`${control} mt-2 w-full`} disabled={busy} value={inputs.annotations.find(item=>item.session_id===row.id)?.activity_code||''} onChange={async e=>{
        setBusy(true);setError('');setNotice('')
        try{await classifyActivity(row.id,e.target.value);setInputs({...await getEnergyInputs(day,timezone),sourceSessions:sessions,sourceStatus:status});operation.current=crypto.randomUUID()}catch{setError('No se pudo guardar la categoría. Reintenta.')}finally{setBusy(false)}
      }}><option value="">No especificada / no corresponde al catálogo</option>{Object.entries(MET_ACTIVITIES).map(([code,item])=><option key={code} value={code}>{item.label} ({item.met} MET)</option>)}</select></label>)}
      {estimate?.issues.length>0&&<ul className="list-disc space-y-2 pl-5 text-sm text-amber-300">{estimate.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
      {estimate?.base!=null&&<dl className="grid grid-cols-2 gap-3 text-sm"><div><dt>Reposo del día</dt><dd>{estimate.resting} kcal</dd></div><div><dt>Incremento cotidiano estimado</dt><dd>{estimate.background} kcal</dd></div><div><dt>Ejercicio adicional conocido</dt><dd>{estimate.exercise} kcal</dd></div><div><dt>Gasto total {estimate.complete?'estimado':'provisional'}</dt><dd className="font-bold">{estimate.total==null?'No disponible':`${estimate.total} kcal`}</dd></div></dl>}
      <p className="text-xs text-muted">Se calcula una base para todo el día y se sustituye la parte ya incluida durante los minutos de ejercicio. No se suman de nuevo ni el reposo ni las calorías brutas de la sesión.</p>
      {estimate?.details?.map(row=><p key={row.id} className="text-xs text-muted">{row.title}: {Math.round(row.minutes)} min · bruto {Math.round(row.gross)} kcal − base ya incluida {Math.round(row.replaced)} kcal = {Math.round(row.extra)} kcal adicionales. {row.source&&<a href={row.source} target="_blank" rel="noreferrer" className="underline">Referencia de la categoría ({row.met} MET)</a>}</p>)}
      {estimate?.total!=null&&<button className={control} disabled={busy} onClick={async()=>{setBusy(true);setNotice('');try{await saveEnergySnapshot(estimate,operation.current);setNotice('Estimación guardada con sus datos y versión.');setInputs({...await getEnergyInputs(day,timezone),sourceSessions:sessions,sourceStatus:status});onSaved?.()}catch{setError('No se pudo confirmar el guardado. Puedes reintentar sin duplicarlo.')}finally{setBusy(false)}}}>Guardar estimación del día</button>}
      {notice&&<p role="status" className="text-green-400">{notice}</p>}
      {inputs.previous.length>0&&<details><summary className="min-h-12 cursor-pointer py-3">Últimas cinco estimaciones guardadas de este día</summary><ul>{inputs.previous.map(row=><li key={row.id} className="py-2 text-sm">{row.snapshot.total} kcal · {row.snapshot.complete?'Completa':'Provisional'} · {new Date(row.created_at).toLocaleString('es',{timeZone:timezone})}<details><summary className="min-h-12 cursor-pointer py-3">Ver datos utilizados</summary><p>Peso: {row.snapshot.inputs?.weight?.weight_kg} kg · Estatura: {row.snapshot.inputs?.profile?.height_cm} cm · Edad: {row.snapshot.age} años · Factor cotidiano: {row.snapshot.inputs?.factor}</p><p>Base: {row.snapshot.base} kcal · Ejercicio adicional: {row.snapshot.exercise} kcal.</p><ul>{row.snapshot.details?.map(item=><li key={item.id}>{item.title}: {Math.round(item.minutes)} min · {item.met??'Sin ejercicio'} MET.</li>)}</ul></details></li>)}</ul></details>}
      <p className="text-xs text-muted">Métodos: <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Mifflin–St Jeor</a> y <a className="underline" href="https://pacompendium.com/adult-compendium/" target="_blank" rel="noreferrer">Compendio de Actividades Físicas 2024</a>. Las categorías MET son aproximaciones poblacionales; los minutos registrados no equivalen a una medición del esfuerzo.</p>
    </>}
  </section>
}
