import { localDay } from './progressData.js'
import { compareWeightTrend } from './weightTrendData.js'
import { dayRange } from './trackingData.js'
export const PROJECTION_CONFIG=Object.freeze({version:'observed-weekly-v2',horizon:7,history:28,maxSlope:0.1,slopeStep:0.01,correctionStep:25,maxCorrection:200,refreshDays:7,maxGoalDays:28})
export function shiftDay(day,amount){const date=new Date(`${day}T12:00Z`);date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10)}
const gap=(a,b)=>(Date.parse(`${b}T12:00Z`)-Date.parse(`${a}T12:00Z`))/86400000
const median=xs=>{const sorted=[...xs].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2}
const clamp=(x,limit)=>Math.max(-limit,Math.min(limit,x))
const round=x=>Math.round(x*10000)/10000

// Pure descriptive forecast. Energy is never converted into kg with a fixed coefficient.
export function makeProjection({weights,balance,asOf,timezone,goal=null,previous=null,restartOn=null,now=Date.now()}){
  const start=shiftDay(asOf,-27),comparison=compareWeightTrend(weights,balance,start,asOf,timezone,now)
  const issues=[...comparison.issues]
  if(restartOn){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(restartOn)||!Number.isFinite(Date.parse(`${restartOn}T12:00Z`))||new Date(`${restartOn}T12:00Z`).toISOString().slice(0,10)!==restartOn)issues.push('No se pudo verificar el inicio del nuevo periodo.')
    else if(start<restartOn)issues.push(`El nuevo periodo empieza el ${restartOn}. Se requieren 28 días completos posteriores al reinicio.`)
    if(previous&&previous.as_of<restartOn)previous=null
  }
  if(asOf!==shiftDay(localDay(now,timezone),-1))issues.push('La emisión requiere los 28 días terminados hasta ayer en esta zona.')
  const weeks=Array.from({length:4},(_,i)=>{
    const from=shiftDay(start,i*7),to=shiftDay(from,6),points=comparison.daily.filter(p=>p.day>=from&&p.day<=to)
    return {from,to,count:points.length,kg:points.length>=3?median(points.map(p=>p.kg)):null}
  })
  const last=comparison.daily.at(-1)
  if(!last||gap(last.day,asOf)>2)issues.push('Falta un pesaje de los últimos 3 días del periodo.')
  const compatible=[PROJECTION_CONFIG.version,'observed-weekly-v1'].includes(previous?.snapshot?.version)&&previous?.timezone===timezone
  if(previous&&!compatible)issues.push('La proyección anterior usa otro método o zona; no se encadena automáticamente.')
  const elapsed=previous?gap(previous.as_of,asOf):null
  const chainReset=compatible&&(elapsed>28||previous.snapshot.version!==PROJECTION_CONFIG.version)
  const prior=compatible&&!chainReset?previous.snapshot:null
  if(previous&&(!Number.isFinite(elapsed)||elapsed<0))issues.push('El historial contiene una emisión posterior al periodo seleccionado.')
  const slopes=weeks.slice(1).map((w,i)=>w.kg!=null&&weeks[i].kg!=null?(w.kg-weeks[i].kg)/7:null)
  if(slopes.some(s=>s!=null&&Math.abs(s)>PROJECTION_CONFIG.maxSlope+1e-9))issues.push('Los cambios semanales superan el límite inicial de 0,7 kg por semana para esta proyección.')
  const ready=comparison.sufficient&&issues.length===0&&slopes.every(Number.isFinite)
  if(!ready)return {version:PROJECTION_CONFIG.version,ready:false,asOf,timezone,issues,weeks,comparison}
  const rawSlope=median(slopes),due=!previous||elapsed>=PROJECTION_CONFIG.refreshDays
  const priorSlope=Number(prior?.slope),priorCorrection=Number(prior?.correction??0)
  if(prior&&(!Number.isFinite(priorSlope)||Math.abs(priorSlope)>0.1||!Number.isFinite(priorCorrection)||Math.abs(priorCorrection)>200))return {version:PROJECTION_CONFIG.version,asOf,timezone,ready:false,issues:['La proyección anterior no es compatible con los límites del método.']}
  const slope=prior?(due?priorSlope+clamp(rawSlope-priorSlope,PROJECTION_CONFIG.slopeStep):priorSlope):rawSlope
  const inputBalance=[...new Map(balance.rows.filter(r=>r.day>=start&&r.day<=asOf).map(r=>[r.day,r])).values()].sort((a,b)=>a.day.localeCompare(b.day))
  const mean=inputBalance.reduce((sum,r)=>sum+r.balance,0)/28
  let correction=priorCorrection,reason='Se conserva el ajuste anterior; no hay una nueva discrepancia persistente evaluable.'
  if(!prior){reason=chainReset?'Interrupción superior a 28 días o cambio de versión: nueva cadena con ajuste energético cero y el historial reciente.':'Primera emisión del periodo: ajuste energético cero; se necesita una emisión posterior para modificarlo.'}
  else if(!due){reason='Se conserva el ajuste: aún no pasaron siete días desde la emisión anterior.'}
  else if(comparison.persistent){
    // Conservative attenuation toward zero, not an inferred physiological expenditure.
    const target=comparison.persistent==='deficit'?Math.min(200,Math.max(0,-mean)):Math.max(-200,Math.min(0,-mean))
    correction=priorCorrection+clamp(target-priorCorrection,PROJECTION_CONFIG.correctionStep)
    reason='Dos intervalos discordantes: atenuación experimental del balance hacia cero, limitada a 25 kcal/día por revisión y 200 en total; no identifica la causa.'
  }
  const anchor=weeks[3].kg,targetDay=shiftDay(asOf,7)
  // A retained parameter must never amplify a balance of the opposite sign.
  const appliedCorrection=mean<0?Math.max(0,Math.min(correction,-mean)):mean>0?Math.min(0,Math.max(correction,-mean)):0
  // Scenarios are observed weekly speeds plus the smoothed speed, not confidence bounds.
  const speeds=[...slopes,slope],low=anchor+Math.min(...speeds)*7,high=anchor+Math.max(...speeds)*7
  const projected=anchor+slope*7
  let goalEstimate=null,goalReason='No hay una meta de pérdida de peso activa.'
  const target=Number(goal?.target_weight_kg)
  if(goal&&Number.isFinite(target)){
    if(target<20||target>500)goalReason='La meta está fuera del rango admitido. Revisa Mi progreso.'
    else if(target>=anchor||target>=last.kg)goalReason='La meta ya está en el nivel suavizado o en la mediana del último día observado; no se estima otra fecha.'
    else if(!slopes.every(s=>s<=-0.01)||slope>=-0.01)goalReason='La tendencia descendente todavía no es suficientemente consistente.'
    else{
      const durations=[...slopes,slope].map(s=>(target-anchor)/s),earliest=Math.ceil(Math.min(...durations)-1e-8),latest=Math.ceil(Math.max(...durations)-1e-8)
      if(latest<=28){goalEstimate={earliest:shiftDay(asOf,earliest),latest:shiftDay(asOf,latest),target};goalReason='Escenario condicionado a mantener los ritmos observados; no es una fecha garantizada.'}
      else goalReason='La meta queda fuera del horizonte inicial de 28 días; aún no se estima una fecha.'
    }
  }
  return {version:PROJECTION_CONFIG.version,validationVersion:'projection-inputs-v2',ready:true,asOf,timezone,start,targetDay,horizon:7,anchor,latestWeight:last.kg,latestWeightDay:last.day,latestAnchorProjected:round(last.kg+slope*7),chainReset,restartOn,rawSlope:round(rawSlope),recentSlope:round(slopes.at(-1)),slope:round(slope),slopes:slopes.map(round),projected:round(projected),scenarios:{low:round(low),high:round(high)},correction:round(correction),appliedCorrection:round(appliedCorrection),meanBalance:round(mean),effectiveBalance:round(mean+appliedCorrection),reason,goalEstimate,goalReason,previousId:previous?.id??null,weeks,
    inputs:{weights:comparison.observed.map(p=>({id:p.id,weight_kg:p.kg,measured_at:new Date(p.time).toISOString()})),balance:inputBalance,calculatedAt:new Date(now).toISOString(),restartOn,goal,previousId:previous?.id??null,previousParameters:compatible&&previous?{version:previous.snapshot.version,slope:previous.snapshot.slope,correction:previous.snapshot.correction,asOf:previous.as_of,timezone,id:previous.id}:null,config:PROJECTION_CONFIG}}
}

export function evaluateProjections(history,weights,timezone,asOf){
  return history.filter(p=>p.timezone===timezone).map(row=>{
    const s=row.snapshot
    if(s?.version!==PROJECTION_CONFIG.version)return{id:row.id,asOf:row.as_of,status:'Método anterior: conservado sin mezclar métricas'}
    if(s.targetDay>asOf)return{id:row.id,asOf:row.as_of,status:'Pendiente de pesajes posteriores'}
    const emitted=Date.parse(row.created_at)
    if(!Number.isFinite(emitted))return{id:row.id,asOf:row.as_of,status:'Emisión sin fecha verificable'}
    if(![s.anchor,s.recentSlope,s.projected].every(Number.isFinite))return{id:row.id,asOf:row.as_of,status:'Pronóstico no válido para evaluar'}
    const observed=compareWeightTrend(weights.filter(w=>Date.parse(w?.measured_at)>emitted),{rows:[]},shiftDay(row.as_of,1),s.targetDay,timezone,Date.parse(dayRange(s.targetDay,timezone)[1])-1)
    if(observed.issues.some(issue=>issue.includes('contradictorias')))return{id:row.id,asOf:row.as_of,status:'Pesajes posteriores contradictorios'}
    if(observed.daily.length<3)return{id:row.id,asOf:row.as_of,status:'Datos posteriores insuficientes'}
    const actual=median(observed.daily.map(p=>p.kg)),constant=s.anchor,recent=s.anchor+s.recentSlope*7
    return{id:row.id,asOf:row.as_of,status:'Evaluada',actual,forecast:s.projected,error:Math.abs(s.projected-actual),constantError:Math.abs(constant-actual),recentError:Math.abs(recent-actual),signedError:s.projected-actual,weightDays:observed.daily.length,
      latestAnchorError:Number.isFinite(s.latestAnchorProjected)?Math.abs(s.latestAnchorProjected-actual):null,latestConstantError:Number.isFinite(s.latestWeight)?Math.abs(s.latestWeight-actual):null}
  })
}

export function summarizeEvaluation(rows){
  const evaluated=rows.filter(r=>r.status==='Evaluada')
  const average=key=>{const usable=evaluated.filter(r=>Number.isFinite(r[key]));return usable.length?usable.reduce((sum,r)=>sum+r[key],0)/usable.length:null}
  return {count:evaluated.length,mae:average('error'),bias:average('signedError'),constantMae:average('constantError'),recentMae:average('recentError'),latestAnchorMae:average('latestAnchorError'),latestConstantMae:average('latestConstantError'),anchorComparisonCount:evaluated.filter(r=>Number.isFinite(r.latestAnchorError)&&Number.isFinite(r.latestConstantError)).length}
}

export function validateProjectionSnapshot(snapshot,now=Date.now()){
  if(!snapshot?.ready||!snapshot.inputs||snapshot.validationVersion!=='projection-inputs-v2')throw new Error('Actualiza la proyección antes de guardarla.')
  const calculatedAt=Date.parse(snapshot.inputs.calculatedAt)
  if(!Number.isFinite(calculatedAt)||calculatedAt>now)throw new Error('La fecha de cálculo no es válida para emitir.')
  const p=snapshot.inputs.previousParameters
  const replay=makeProjection({weights:snapshot.inputs.weights,balance:{rows:snapshot.inputs.balance},asOf:snapshot.asOf,timezone:snapshot.timezone,goal:snapshot.inputs.goal,restartOn:snapshot.inputs.restartOn,
    previous:p?{id:p.id,as_of:p.asOf,timezone:p.timezone,snapshot:p}:null,now:Date.parse(snapshot.inputs.calculatedAt)})
  if(!replay.ready||Object.keys(replay).some(key=>JSON.stringify(replay[key])!==JSON.stringify(snapshot[key])))throw new Error('La proyección no coincide con sus entradas. Actualiza el cálculo.')
  return replay
}

export function backtestProjection(weights,balance,asOf,timezone,restartOn=null){
  const history=[],start=shiftDay(asOf,-83)
  let previous=null
  for(let index=27;index+7<84;index+=7){
    const origin=shiftDay(start,index),next=shiftDay(origin,1)
    const now=Date.parse(dayRange(next,timezone)[0])+3600000
    const snapshot=makeProjection({weights,balance,asOf:origin,timezone,previous,restartOn,now})
    if(snapshot.ready){previous={id:`backtest-${origin}`,as_of:origin,timezone,snapshot,created_at:new Date(now).toISOString()};history.push(previous)}
  }
  const rows=evaluateProjections(history,weights,timezone,asOf)
  return {rows,summary:summarizeEvaluation(rows)}
}
