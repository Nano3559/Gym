import { supabase } from '../lib/supabase.js'
import { calculatePeriodBalance } from '../lib/balanceData.js'
import { makeProjection, shiftDay, evaluateProjections, summarizeEvaluation, backtestProjection, validateProjectionSnapshot } from '../lib/projectionData.js'
async function requireOwner(){if(!supabase)throw new Error('Supabase no está configurado.');const {data,error}=await supabase.auth.getUser();if(error||!data?.user)throw new Error('Inicia sesión.');return data.user.id}
export async function getProjection(timezone){
  const userId=await requireOwner()
  const profile=await supabase.from('progress_profiles').select('estimates_paused').eq('user_id',userId).maybeSingle()
  if(profile.error)throw profile.error
  if(profile.data?.estimates_paused)throw new Error('Suspendiste las estimaciones en Mi progreso. El diario y los pesajes siguen disponibles.')
  const {data,error}=await supabase.rpc('get_projection_data',{p_timezone:timezone})
  if(error)throw error
  const fields=['weights','meals','sessions','annotations','statuses','estimates']
  if(!data||!Array.isArray(data.windows)||data.windows.length!==3||!Array.isArray(data.history)||data.windows.some(w=>!w||fields.some(f=>!Array.isArray(w[f]))))throw new Error('La respuesta de proyección está incompleta.')
  const now=Date.now(),asOf=data.asOf
  // Windows overlap only in their query margins. Deduplicate by primary key.
  const weights=[...new Map(data.windows.flatMap(w=>w.weights).map(w=>[w.id,w])).values()]
  const rows=data.windows.flatMap((w,i)=>calculatePeriodBalance(w,shiftDay(asOf,-83+i*28),shiftDay(asOf,-56+i*28),timezone,now).rows)
  const balance={rows},restartOn=data.restartOn??null,previous=data.history.find(row=>!restartOn||row.as_of>=restartOn)??null
  const snapshot=makeProjection({weights,balance,asOf,timezone,goal:data.goal,previous,restartOn,now})
  const evaluation=evaluateProjections(data.history,weights,timezone,asOf)
  return {snapshot,history:data.history,evaluation,summary:summarizeEvaluation(evaluation),backtest:backtestProjection(weights,balance,asOf,timezone,restartOn),readAt:data.read_at,
    canSave:snapshot.ready&&(!previous||asOf>=shiftDay(previous.as_of,7))}
}
export async function saveProjection(snapshot,operationId){
  await requireOwner()
  if(!snapshot?.ready)throw new Error('Completa el historial antes de emitir una proyección.')
  if(!operationId)throw new Error('Falta identificador de emisión.')
  const verified=validateProjectionSnapshot(snapshot)
  const {data,error}=await supabase.rpc('save_progress_projection',{p_snapshot:verified,p_operation:operationId,p_previous:verified.previousId})
  if(error)throw error
  return data
}

export async function restartProjectionPeriod(){
  await requireOwner()
  const {data,error}=await supabase.rpc('restart_progress_projection')
  if(error)throw error
  return data
}
