import { supabase } from '../lib/supabase.js'
import { dayRange } from '../lib/trackingData.js'
import { MET_ACTIVITIES, validateEnergySnapshot } from '../lib/energyData.js'
async function owner(){if(!supabase)throw new Error('Supabase no está configurado.');const{data,error}=await supabase.auth.getUser();if(error||!data?.user)throw new Error('Inicia sesión.');return data.user.id}
function check(result){if(result.error)throw result.error;return result.data}
export async function getEnergyInputs(day,timezone){
  const id=await owner(),[start,end]=dayRange(day,timezone)
  const annotations=[],sessions=[]
  for(let offset=0;;offset+=500){const page=check(await supabase.from('energy_activity_annotations').select('*').eq('user_id',id).order('session_id').range(offset,offset+499));annotations.push(...page);if(page.length<500)break}
  for(let offset=0;;offset+=500){const page=check(await supabase.from('routine_sessions').select('*').eq('user_id',id).gt('completed_at',start).lt('occurred_at',end).order('id').range(offset,offset+499));sessions.push(...page);if(page.length<500)break}
  const results=await Promise.all([
    supabase.from('progress_profiles').select('*').eq('user_id',id).maybeSingle(),
    supabase.from('profiles').select('fecha_nacimiento').eq('id',id).single(),
    supabase.from('weight_logs').select('*').eq('user_id',id).lt('measured_at',end).order('measured_at',{ascending:false}).order('created_at',{ascending:false}).order('id').limit(1).maybeSingle(),
    supabase.from('daily_energy_estimates').select('*').eq('user_id',id).eq('local_date',day).eq('timezone',timezone).order('created_at',{ascending:false}).limit(5),
  ])
  const [profile,base,weight,previous]=results.map(check)
  return {profile,birthDate:base.fecha_nacimiento,weight,annotations,previous,sessions}
}
export async function classifyActivity(sessionId,code){const id=await owner();if(!sessionId)throw new Error('Falta identificar la sesión.');if(code&&!Object.hasOwn(MET_ACTIVITIES,code))throw new Error('Categoría de actividad no válida.');if(!code){check(await supabase.from('energy_activity_annotations').delete().eq('session_id',sessionId).eq('user_id',id));return}check(await supabase.from('energy_activity_annotations').upsert({session_id:sessionId,user_id:id,activity_code:code,updated_at:new Date().toISOString()}))}
export async function saveEnergySnapshot(snapshot,operationId){
  const verified=validateEnergySnapshot(snapshot)
  if(!operationId)throw new Error('Falta identificador de guardado.')
  const id=await owner()
  check(await supabase.from('daily_energy_estimates').upsert({user_id:id,local_date:verified.day,timezone:verified.timezone,method_version:verified.version,operation_id:operationId,snapshot:verified},{onConflict:'user_id,operation_id',ignoreDuplicates:true}))
}
