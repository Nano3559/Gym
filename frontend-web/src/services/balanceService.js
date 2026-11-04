import { compareWeightTrend } from '../lib/weightTrendData.js'
import { supabase } from '../lib/supabase.js'
import { periodDays, calculatePeriodBalance } from '../lib/balanceData.js'
export async function getPeriodBalance(start,end,timezone) {
  periodDays(start,end)
  if(!supabase)throw new Error('Supabase no está configurado.')
  const{data:auth,error:authError}=await supabase.auth.getUser()
  if(authError||!auth?.user)throw new Error('Inicia sesión para consultar tu balance.')
  const{data,error}=await supabase.rpc('get_balance_data',{p_start:start,p_end:end,p_timezone:timezone})
  if(error)throw error
  if(!data||!Array.isArray(data.meals)||!Array.isArray(data.weights)||!Array.isArray(data.sessions)||!Array.isArray(data.statuses)||!Array.isArray(data.estimates)||!Array.isArray(data.annotations))throw new Error('La respuesta del balance no está completa. Reintenta la consulta.')
  const now=Date.now()
  const balance=calculatePeriodBalance(data,start,end,timezone,now)
  return {...balance,comparison:compareWeightTrend(data.weights,balance,start,end,timezone,now)}
}
