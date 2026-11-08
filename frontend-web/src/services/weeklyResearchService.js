import { supabase } from '../lib/supabase.js'
export const WEEKLY_CONSENT_POLICY='weekly-consent-v1'
function purpose(value){if(!['training','evaluation'].includes(value))throw new Error('Finalidad no válida.')}
async function owner(){if(!supabase)throw new Error('Supabase no está configurado.');const {data,error}=await supabase.auth.getUser();if(error||!data?.user)throw new Error('Inicia sesión.');return data.user.id}
async function rpc(name,args){await owner();const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
export async function getWeeklyConsents(){const id=await owner();const {data,error}=await supabase.from('weekly_research_consents').select('id,purpose,granted,at,policy_version').eq('user_id',id).order('at',{ascending:false}).order('id',{ascending:false});if(error)throw error;return data??[]}
export async function setWeeklyConsent(value,granted){purpose(value);if(typeof granted!=='boolean')throw new Error('Decisión no válida.');return rpc('set_weekly_research_consent',{p_purpose:value,p_granted:granted,p_policy:WEEKLY_CONSENT_POLICY})}
export async function captureWeeklyProjection(id){if(!id)throw new Error('Emite primero una proyección.');return rpc('capture_weekly_research',{p_projection:id})}
export async function exportWeeklyResearch(value){purpose(value);const data=await rpc('export_weekly_research',{p_purpose:value});if(data?.format!=='weekly-research-export-v1'||data.purpose!==value||!Array.isArray(data.entries)||!Array.isArray(data.weights))throw new Error('Exportación incompleta.');return data}
