import { dayRange } from './trackingData.js'
import { assessDailyActivity } from './dailyActivityData.js'
export const ENERGY_VERSION = 'mifflin-met-replacement-v1'
export const BACKGROUND_FACTORS = { '1.4': 'Poco movimiento cotidiano', '1.6': 'Movimiento cotidiano moderado', '1.8': 'Trabajo cotidiano activo' }
// Selección explícita, no inferida por nombre ni por número de repeticiones.
export const MET_ACTIVITIES = {
  '17190': { met: 3.8, label: 'Caminar a 4,5–5,5 km/h en llano', source: 'https://pacompendium.com/walking/' },
  '02054': { met: 3.5, label: 'Pesas: varios ejercicios, 8–15 repeticiones', source: 'https://pacompendium.com/conditioning-exercise/' },
  '02022': { met: 3.8, label: 'Calistenia, esfuerzo moderado', source: 'https://pacompendium.com/conditioning-exercise/' },
  '02024': { met: 2.8, label: 'Calistenia, esfuerzo ligero', source: 'https://pacompendium.com/conditioning-exercise/' },
  '01010': { met: 4, label: 'Bicicleta recreativa a menos de 16 km/h', source: 'https://pacompendium.com/bicycling/' },
  '01200': { met: 6.8, label: 'Bicicleta estática, general', source: 'https://pacompendium.com/bicycling/' },
}
export function ageOnDay(birthDate, day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '') || !Number.isFinite(Date.parse(`${birthDate}T12:00Z`)) || new Date(`${birthDate}T12:00Z`).toISOString().slice(0,10)!==birthDate) return null
  return Number(day.slice(0,4))-Number(birthDate.slice(0,4))-(day.slice(5)<birthDate.slice(5)?1:0)
}
export function estimateEnergy({ day, timezone, profile, birthDate, weight, sessions = [], annotations = [], factor, activityAnswers=null, activityComplete = false, now = Date.now() }) {
  if (!Number.isFinite(now)) throw new Error('No se pudo verificar la fecha del cálculo.')
  const [start,end] = dayRange(day,timezone), issues=[]
  const age=ageOnDay(birthDate,day)
  let assessment=null
  if(activityAnswers){
    try{assessment=assessDailyActivity(activityAnswers);if(assessment.factor!==String(factor))issues.push('La actividad elegida no coincide con el cuestionario. Vuelve a aplicar sus respuestas o selecciona manualmente el nivel.')}
    catch{issues.push('Completa las respuestas de actividad cotidiana antes de calcular.')}
  }
  if (profile?.estimates_paused) issues.push('Suspendiste las estimaciones en Mi progreso. Puedes seguir utilizando el diario.')
  if (Date.parse(start)>now) issues.push('No se estima un día futuro.')
  if (age===null || age<19 || age>59) issues.push('La estimación inicial solo cubre adultos de 19 a 59 años con fecha de nacimiento registrada.')
  if (!profile || !['male','female'].includes(profile.formula_sex)) issues.push('Completa estatura y sexo para la fórmula en Mi progreso.')
  if (!profile || !Number.isFinite(Number(profile.height_cm)) || Number(profile.height_cm)<100 || Number(profile.height_cm)>250) issues.push('Falta una estatura válida.')
  if (!weight || !Number.isFinite(Number(weight.weight_kg)) || !Number.isFinite(Date.parse(weight.measured_at)) || Number(weight.weight_kg)<20 || Number(weight.weight_kg)>500 || Date.parse(weight.measured_at)>=Date.parse(end)) issues.push('Registra un pesaje válido de ese día o anterior.')
  if (weight && Date.parse(start)-Date.parse(weight.measured_at)>30*86400000) issues.push('El pesaje tiene más de 30 días. Añade un pesaje reciente para estimar el gasto.')
  if (weight && Date.parse(weight.measured_at)>now) issues.push('El pesaje todavía está en el futuro.')
  if (profile && Date.parse(profile.updated_at)>now) issues.push('El perfil todavía está en el futuro.')
  if (profile && Date.parse(profile.updated_at)>=Date.parse(end)) issues.push('El perfil actual cambió después de ese día; no se reconstruirá el pasado con datos nuevos.')
  if (profile && !Number.isFinite(Date.parse(profile.updated_at))) issues.push('No se pudo verificar la fecha del perfil.')
  if (!Object.hasOwn(BACKGROUND_FACTORS,String(factor))) issues.push('Selecciona la actividad cotidiana sin entrenamientos.')
  if (issues.length) return { version: ENERGY_VERSION, total: null, issues }
  const kg=Number(weight.weight_kg), rest24=10*kg+6.25*Number(profile.height_cm)-5*age+(profile.formula_sex==='male'?5:-161)
  const dayMinutes=(Date.parse(end)-Date.parse(start))/60000
  const resting=rest24*dayMinutes/1440, base=resting*Number(factor), rate=rest24*Number(factor)/1440
  let extra=0
  const details=[], seen=new Map(), intervals=[]
  for (const row of sessions) {
    if (row.session_status==='void') continue
    if (!row.id) { issues.push('Hay una sesión sin identificador. Revisa el historial.'); continue }
    const signature=JSON.stringify([row.session_status,row.active_sec,row.started_at,row.completed_at,row.duration_sec,row.rest_sec,row.preparation_sec,row.paused_sec])
    if (seen.has(row.id)) {
      if(seen.get(row.id)!==signature) issues.push('Hay versiones contradictorias de una misma sesión. Actualiza el diario.')
      continue
    }
    seen.set(row.id,signature)
    const categories=annotations.filter(item=>item.session_id===row.id)
    if(new Set(categories.map(item=>item.activity_code)).size>1){issues.push('Hay categorías contradictorias para una sesión. Actualiza el diario.');continue}
    const activity=MET_ACTIVITIES[categories[0]?.activity_code]
    const duration=Number(row.active_sec), began=Date.parse(row.started_at), finished=Date.parse(row.completed_at)
    const phaseKeys=['active_sec','rest_sec','preparation_sec','paused_sec']
    const hasPhases=phaseKeys.slice(1).some(key=>row[key]!=null)
    const badTotal=row.duration_sec!=null&&(!Number.isInteger(Number(row.duration_sec))||Number(row.duration_sec)<duration||Number(row.duration_sec)>(finished-began)/1000+1)
    const badPhases=hasPhases&&(phaseKeys.some(key=>row[key]==null||!Number.isInteger(Number(row[key]))||Number(row[key])<0)||!Number.isFinite(Number(row.duration_sec))||phaseKeys.reduce((sum,key)=>sum+Number(row[key]),0)>Number(row.duration_sec)||Number(row.duration_sec)>(finished-began)/1000+1)
    if (!['completed','partial','manual'].includes(row.session_status) || row.active_sec==null || !Number.isInteger(duration) || duration<0 || !Number.isFinite(began) || !Number.isFinite(finished) || finished<began || finished>now || duration>(finished-began)/1000+1 || badPhases || badTotal) {
      issues.push(`Revisa duración y fechas de «${row.routine_title}».`); continue
    }
    if (began<Date.parse(start) || finished>Date.parse(end)) { issues.push(`«${row.routine_title}» cruza un límite del día; divide el registro por días antes de estimarlo.`); continue }
    if (duration===0) { details.push({ id:row.id, title:row.routine_title, minutes:0, gross:0, replaced:0, extra:0 }); continue }
    if (!activity) { issues.push(`Elige una categoría documentada para «${row.routine_title}», o anula el registro si no corresponde.`); continue }
    if (intervals.some(([a,b])=>began<b && finished>a)) issues.push('Hay sesiones con horarios solapados. Revisa los registros para evitar sumar dos veces el ejercicio.')
    intervals.push([began,finished])
    const minutes=duration/60, gross=activity.met*3.5*kg/200*minutes, replaced=rate*minutes, net=Math.max(0,gross-replaced)
    extra+=net
    details.push({ id:row.id,title:row.routine_title,minutes,met:activity.met,code:annotations.find(item=>item.session_id===row.id).activity_code,source:activity.source,gross,replaced,extra:net })
  }
  if (!activityComplete) issues.push('El registro de actividad del día está incompleto; el gasto es provisional.')
  if (Date.parse(end)>now) issues.push('El día aún no ha terminado; se muestra una estimación del día entero, no de lo gastado hasta ahora.')
  const unknown=issues.some(text=>!text.startsWith('El registro de actividad')&&!text.startsWith('El día aún'))
  const round=value=>Math.round(value)
  return { version:ENERGY_VERSION, validationVersion:'energy-inputs-v2',calculatedAt:new Date(now).toISOString(),day,timezone,age,resting:round(resting),background:round(base-resting),base:round(base),exercise:round(extra),
    total:unknown?null:round(base)+round(extra),complete:!issues.length,issues,details,
    inputs:{profile,birthDate,weight,factor:Number(factor),activityComplete,dayMinutes,sessions,annotations,...(assessment?{activityAnswers:assessment.answers,activityAssessmentVersion:assessment.version}:{})} }
}

export function validateEnergySnapshot(snapshot, now=Date.now()) {
  if(snapshot?.total==null)throw new Error('Completa los datos antes de guardar la estimación.')
  const calculatedAt=Date.parse(snapshot.calculatedAt)
  if(snapshot.version!==ENERGY_VERSION||snapshot.validationVersion!=='energy-inputs-v2'||!snapshot.inputs||!Number.isFinite(calculatedAt)||calculatedAt>now)throw new Error('Actualiza el cálculo antes de guardar la estimación.')
  const replay=estimateEnergy({...snapshot.inputs,day:snapshot.day,timezone:snapshot.timezone,now:calculatedAt})
  if(replay.total==null||['resting','background','base','exercise','total','age','complete'].some(key=>replay[key]!==snapshot[key]))throw new Error('La estimación no coincide con sus datos. Actualiza el cálculo.')
  return replay
}
