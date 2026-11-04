import { dayRange } from './trackingData.js'
import { ENERGY_VERSION, estimateEnergy } from './energyData.js'

export function periodDays(start,end) {
  const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'') && Number.isFinite(Date.parse(`${value}T12:00Z`)) && new Date(`${value}T12:00Z`).toISOString().slice(0,10)===value
  if(!valid(start)||!valid(end))throw new Error('Selecciona fechas válidas.')
  const count=Math.round((Date.parse(`${end}T12:00Z`)-Date.parse(`${start}T12:00Z`))/86400000)+1
  if(count<1||count>31)throw new Error('Selecciona un periodo de 1 a 31 días.')
  return Array.from({length:count},(_,index)=>new Date(Date.parse(`${start}T12:00Z`)+index*86400000).toISOString().slice(0,10))
}

function signature(input) {
  const profile=input?.profile,weight=input?.weight
  return JSON.stringify({profile:profile?[profile.height_cm,profile.formula_sex,profile.updated_at,Boolean(profile.estimates_paused)]:null,birthDate:input?.birthDate,
    weight:weight?[weight.id,Number(weight.weight_kg),weight.measured_at,weight.updated_at]:null,
    factor:Number(input?.factor),activityComplete:Boolean(input?.activityComplete),
    sessions:(input?.sessions||[]).filter(s=>s.session_status!=='void').map(s=>[s.id,s.updated_at,s.session_status,s.active_sec,s.started_at,s.completed_at,s.duration_sec,s.rest_sec,s.preparation_sec,s.paused_sec]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    annotations:(input?.annotations||[]).filter(a=>(input?.sessions||[]).some(s=>s.id===a.session_id&&s.session_status!=='void')).map(a=>[a.session_id,a.activity_code]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
  })
}

function confirmedIntake(meals) {
  const seen=new Map(),issues=[]
  let total=0
  for(const meal of meals){
    const signature=JSON.stringify([meal.consumed_at,meal.confirmation,meal.es_comida,meal.calorias])
    if(meal.id&&seen.has(meal.id)){
      if(seen.get(meal.id)!==signature)issues.push('Hay versiones contradictorias de una comida. Actualiza el diario.')
      continue
    }
    if(meal.id)seen.set(meal.id,signature)
    if(meal.confirmation==='void')continue
    if(meal.confirmation==='legacy'){issues.push('Hay comidas antiguas sin revisar.');continue}
    if(meal.confirmation!=='confirmed'){issues.push('Hay comidas sin un estado de confirmación válido.');continue}
    const value=meal.calorias
    if(meal.es_comida!==true||!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>99999){
      issues.push('Hay una comida confirmada con calorías o datos inválidos. Corrígela antes de evaluar el día.');continue
    }
    total+=Number(value)
  }
  return {total:issues.length?null:Math.round(total*100)/100,issues:[...new Set(issues)]}
}

export function calculatePeriodBalance(data,start,end,timezone,now=Date.now()) {
  if(!Number.isFinite(now))throw new Error('No se pudo verificar la fecha de consulta.')
  const rows=periodDays(start,end).map(day=>{
    let bounds
    try{bounds=dayRange(day,timezone)}catch(error){return{day,eligible:false,balance:null,issues:[error.message]}}
    const [from,to]=bounds.map(Date.parse),closed=to<=now
    const meals=(data.meals||[]).filter(m=>Date.parse(m.consumed_at)>=from&&Date.parse(m.consumed_at)<to)
    const sessions=(data.sessions||[]).filter(s=>Date.parse(s.completed_at)>from&&Date.parse(s.occurred_at)<to)
    const weights=(data.weights||[]).filter(w=>Date.parse(w.measured_at)<to).sort((a,b)=>Date.parse(b.measured_at)-Date.parse(a.measured_at)||Date.parse(b.created_at)-Date.parse(a.created_at)||String(a.id).localeCompare(String(b.id)))
    const status=(data.statuses||[]).find(s=>s.local_date===day&&s.timezone===timezone)
    const latest=(data.estimates||[]).filter(e=>e.local_date===day&&e.timezone===timezone).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||String(b.id).localeCompare(String(a.id)))[0]
    const intake=confirmedIntake(meals),issues=[...intake.issues]
    if(!closed)issues.push(from>now?'Día futuro: todavía no es evaluable.':'Día en curso: no se compara una ingesta parcial con un gasto de día entero.')
    if(status?.meals_complete!==true)issues.push('Alimentación incompleta.')
    if(status?.activity_complete!==true)issues.push('Actividad incompleta.')
    if(!latest)issues.push('Falta guardar la selección de actividad cotidiana en Gasto energético.')
    else if(latest.method_version!==ENERGY_VERSION||latest.snapshot?.version!==ENERGY_VERSION)issues.push('La estimación guardada usa un método no compatible.')
    const compatible=latest?.method_version===ENERGY_VERSION&&latest?.snapshot?.version===ENERGY_VERSION
    const inputs={day,timezone,profile:data.profile,birthDate:data.birthDate,weight:weights[0],sessions,annotations:data.annotations||[],
      factor:compatible?latest.snapshot.inputs?.factor:null,activityComplete:status?.activity_complete===true}
    // El total guardado no es una fuente autoritativa: recalcular desde los registros actuales.
    const energy=compatible?estimateEnergy({...inputs,now}):null
    if(energy?.total==null&&compatible)issues.push(...(energy?.issues||['Gasto no disponible.']))
    const eligible=closed&&status?.meals_complete===true&&status?.activity_complete===true&&intake.total!=null&&energy?.total!=null&&energy.complete
    const balance=eligible?Math.round(intake.total-energy.total):null
    return {day,intake:intake.total,expenditure:energy?.total??null,balance,eligible,issues,
      recalculated:compatible&&signature(inputs)!==signature(latest.snapshot.inputs),estimateId:latest?.id??null,
      label:balance==null?'Datos incompletos':balance<0?'Déficit':balance>0?'Superávit':'Equilibrio'}
  })
  const covered=rows.filter(row=>row.eligible)
  const excludedReasons=Object.entries(rows.filter(row=>!row.eligible).reduce((counts,row)=>{
    for(const issue of new Set(row.issues))counts[issue]=(counts[issue]||0)+1
    return counts
  },{})).map(([reason,days])=>({reason,days}))
  return {rows,days:rows.length,covered:covered.length,complete:covered.length===rows.length,
    excluded:rows.length-covered.length,coveragePercent:Math.round(covered.length/rows.length*100),excludedReasons,
    accumulated:covered.length?covered.reduce((sum,row)=>sum+row.balance,0):null,
    intake:covered.length?covered.reduce((sum,row)=>sum+row.intake,0):null,
    expenditure:covered.length?covered.reduce((sum,row)=>sum+row.expenditure,0):null,
    readAt:data.read_at||null}
}
