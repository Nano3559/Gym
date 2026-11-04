import { useEffect, useState } from 'react'
import { getProjection, saveProjection, restartProjectionPeriod } from '../services/projectionService.js'
const button='min-h-12 rounded-xl border border-line px-4 disabled:opacity-50'
const kg=value=>Number.isFinite(value)?`${value.toFixed(2)} kg`:'No disponible'
function Evaluation({summary}){
  return <div className="space-y-2 text-sm"><p>{summary.count} emisiones evaluables · error absoluto medio {kg(summary.mae)} · sesgo (previsto − observado) {kg(summary.bias)} · referencia de peso constante suavizado {kg(summary.constantMae)} · referencia de tendencia reciente {kg(summary.recentMae)}.</p><p>Comparación de anclajes ({summary.anchorComparisonCount??0} emisiones): error usando último día observado {kg(summary.latestAnchorMae)} · persistencia del último día observado {kg(summary.latestConstantMae)}. Es un diagnóstico; no cambia automáticamente el método.</p></div>
}
export default function ProjectionPanel({timezone,refreshToken}){
  const [packet,setPacket]=useState(null),[revision,setRevision]=useState(0),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const [confirmRestart,setConfirmRestart]=useState(false)
  useEffect(()=>{
    let live=true
    getProjection(timezone).then(value=>{if(live){setPacket({value,timezone,refreshToken,revision,operation:crypto.randomUUID()});setError('')}}).catch(e=>{if(live)setError(e.code==='PGRST202'?'Aplica la migración 19 para abrir la proyección.':e.message||'No se pudo consultar la proyección.')})
    return()=>{live=false}
  },[timezone,refreshToken,revision])
  const data=packet?.timezone===timezone&&packet?.refreshToken===refreshToken&&packet?.revision===revision?packet.value:null
  const snapshot=data?.snapshot
  async function save(){
    if(busy||!data?.canSave)return
    setBusy(true);setError('');setMessage('')
    try{await saveProjection(snapshot,packet.operation);setMessage('Proyección emitida y conservada para evaluar sus resultados.');setRevision(v=>v+1)}
    catch(e){setError(e.message||'No se pudo emitir. Puedes reintentar sin duplicarla.')}
    finally{setBusy(false)}
  }
  return <section className="space-y-3 rounded-xl border border-accent/40 p-4">
    <h4 className="text-lg font-bold">Proyección experimental a 7 días</h4>
    <p className="text-sm text-muted">Usa los últimos 28 días terminados hasta ayer, independientemente del periodo del balance. Anticipa el nivel de peso suavizado de la próxima semana; no un pesaje individual. No usa IA entrenada.</p>
    <button className={button} disabled={busy} onClick={()=>{setError('');setRevision(v=>v+1)}}>Actualizar proyección</button>
    <button type="button" className={button} disabled={busy} onClick={()=>setConfirmRestart(true)}>Iniciar nuevo periodo por cambio de hábitos</button>
    {confirmRestart&&<div className="space-y-3 rounded-xl border border-line p-3"><p>Se conservarán tus registros y pronósticos anteriores. El nuevo periodo empezará mañana en la zona de tu perfil; necesitarás 28 días completos desde entonces. No se trasladará el ajuste anterior. También puedes usarlo tras una interrupción prolongada.</p><button type="button" className={button} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const day=await restartProjectionPeriod();setMessage(`Nuevo periodo desde ${day}. Registra 28 días completos antes de emitir.`);setConfirmRestart(false);setRevision(v=>v+1)}catch(e){setError(e.message||'No se pudo iniciar el periodo.')}finally{setBusy(false)}}}>Confirmar nuevo periodo</button><button type="button" className={button} disabled={busy} onClick={()=>setConfirmRestart(false)}>Conservar periodo actual</button></div>}
    {error&&<p role="alert" className="text-red-300">{error}</p>}{message&&<p role="status">{message}</p>}
    {!data?<p role="status">Consultando historial de proyección...</p>:<>
      <ProjectionDetails data={data} busy={busy} onSave={()=>void save()}/>
    </>}
  </section>
}

export function ProjectionDetails({data,busy=false,onSave}){
  const snapshot=data.snapshot
  const timezone=snapshot.timezone
  return <>
      {!snapshot.ready?<><p className="font-semibold">Datos insuficientes para emitir</p><ul className="list-disc pl-5 text-sm">{snapshot.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></>:<>
        <p>Referencia suavizada al {snapshot.asOf}: <strong>{kg(snapshot.anchor)}</strong>.</p>
        <p className="text-sm text-muted">La referencia es la mediana de la última semana, no un pesaje tomado al cierre. Último día observado: {snapshot.latestWeightDay??'No registrado'} · {kg(snapshot.latestWeight)}. El anclaje alternativo se evalúa por separado.</p>
        <p>Para el {snapshot.targetDay}: <strong>{kg(snapshot.projected)}</strong>. Escenarios según los ritmos semanales observados: {kg(snapshot.scenarios.low)} a {kg(snapshot.scenarios.high)}.</p>
        <p className="text-sm text-muted">Los escenarios no son un intervalo de confianza ni cubren todos los cambios posibles. La referencia y la evaluación usan medianas semanales.</p>
        <p className="text-sm">Ritmo reciente: {kg(snapshot.rawSlope*7)}/semana · ritmo suavizado para proyectar: {kg(snapshot.slope*7)}/semana.</p>
        <p className="text-sm">Balance registrado medio: {Math.round(snapshot.meanBalance)} kcal/día · parámetro experimental separado: {snapshot.correction>0?'+':''}{snapshot.correction} kcal/día · corrección aplicada: {snapshot.appliedCorrection} kcal/día · balance de seguimiento: {Math.round(snapshot.effectiveBalance)} kcal/día.</p>
        <p className="text-sm text-muted">{snapshot.reason} Solo se aplica la parte que reduce la magnitud del balance sin cambiar su signo. Esta corrección es una atenuación conservadora de seguimiento, no una medición del gasto real. No se convierte en kilos y no altera la proyección de peso, que depende de los pesajes.</p>
        <p className="text-sm">{snapshot.goalEstimate?`Escenario de llegada a ${snapshot.goalEstimate.target} kg: ${snapshot.goalEstimate.earliest} a ${snapshot.goalEstimate.latest}. `:''}{snapshot.goalReason}</p>
        <button className={`${button} bg-accent`} disabled={busy||!data.canSave} onClick={onSave}>{busy?'Guardando...':'Emitir y guardar esta proyección'}</button>
        {!data.canSave&&<p className="text-sm text-muted">Las emisiones se separan al menos siete días. El historial conserva la emisión anterior; esta vista es un recálculo con los registros vigentes.</p>}
      </>}
      <details><summary className="min-h-12 cursor-pointer py-3">Evaluación e historial de las últimas 12 emisiones</summary><div className="space-y-3">
        <Evaluation summary={data.summary}/>
        <p className="text-xs text-muted">El horizonte son siete días desde el corte de datos de ayer. Compara con la mediana de al menos tres días distintos con pesajes posteriores a la hora real de emisión y hasta la fecha objetivo. No rellena días vacíos.</p>
        {!data.history.length&&<p>Aún no hay emisiones guardadas.</p>}
        {data.history.map(row=>{const evaluation=data.evaluation.find(e=>e.id===row.id);return <article key={row.id} className="rounded-xl border border-line p-3 text-sm"><p>{row.as_of} → {row.snapshot.targetDay}: {kg(row.snapshot.projected)} · método {row.method_version}</p><p>Corrección separada: {row.snapshot.correction} kcal/día. {row.snapshot.reason}</p><p>{evaluation?.status}{evaluation?.status==='Evaluada'?` · observado ${kg(evaluation.actual)} · error ${kg(evaluation.error)}`:''}</p></article>})}
      </div></details>
      <details><summary className="min-h-12 cursor-pointer py-3">Comprobación retrospectiva temporal (últimos 84 días)</summary><Evaluation summary={data.backtest.summary}/><p className="text-xs text-muted">Simulación con orígenes semanales: en cada origen se usan solo pesajes de sus 28 días anteriores. Reutiliza registros corregidos actualmente; no sustituye la evaluación de emisiones realmente guardadas. Pocos intervalos o errores menores no demuestran precisión clínica ni mejora generalizable.</p></details>
      <p className="text-xs text-muted">Método observed-weekly-v2 · zona {timezone} · consulta {data.readAt?new Date(data.readAt).toLocaleString('es',{timeZone:timezone}):'sin fecha'}. Requiere cuatro semanas con al menos tres días de pesaje cada una, 28 días energéticos completos y un pesaje reciente. Las métricas no mezclan métodos anteriores. Ningún cambio individual modifica registros originales.</p>
  </>
}
