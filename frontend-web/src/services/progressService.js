import { supabase } from '../lib/supabase.js'
import { validateProfile, validateWeight, validateBirthDate, localDay } from '../lib/progressData.js'

async function owner() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Inicia sesión con tu cuenta para guardar tu progreso.')
  return data.user.id
}
function check(result) { if (result.error) throw result.error; return result.data }

export async function getProgress() {
  const userId = await owner()
  const [profile, goals, account] = await Promise.all([
    supabase.from('progress_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('weight_goals').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    supabase.from('profiles').select('fecha_nacimiento').eq('id',userId).maybeSingle(),
  ])
  // Paginar pesajes para no truncar silenciosamente el historial a 50 o 1000 filas.
  const logs = []
  for (let offset = 0; ; offset += 500) {
    const rows = check(await supabase.from('weight_logs').select('*').eq('user_id', userId)
      .order('measured_at', { ascending: false }).order('id').range(offset, offset + 499))
    logs.push(...rows)
    if (rows.length < 500) break
  }
  return { profile: check(profile), goals: check(goals), logs, birthDate:check(account)?.fecha_nacimiento??null }
}

export async function saveProgressBirthDate(value,timezone){
  const userId=await owner(),birthDate=validateBirthDate(value,timezone)
  const row=check(await supabase.from('profiles').update({fecha_nacimiento:birthDate}).eq('id',userId).select('fecha_nacimiento').maybeSingle())
  if(!row)throw new Error('No se encontró el perfil de tu cuenta. Completa tu registro antes de guardar la fecha.')
  return row
}

export async function saveProgressProfile(input) {
  const userId = await owner()
  const payload = { ...validateProfile(input), user_id: userId }
  if (input.updated_at) {
    const row = check(await supabase.from('progress_profiles').update(payload).eq('user_id', userId)
      .eq('updated_at', input.updated_at).select().maybeSingle())
    if (!row) throw new Error('El perfil cambió en otra sesión. Recarga el progreso antes de guardarlo.')
    return row
  }
  const result = await supabase.from('progress_profiles').insert(payload).select().single()
  if (result.error?.code === '23505') throw new Error('El perfil ya se creó en otra sesión. Recarga el progreso antes de guardarlo.')
  return check(result)
}

export async function setWeightGoal(weight, operationId) {
  await owner()
  return check(await supabase.rpc('set_weight_goal', { p_target: validateWeight(weight), p_operation: operationId }))
}

export async function saveWeightLog({ id, weight, measuredAt, timezone, operationId, updatedAt }) {
  const userId = await owner()
  const instant = new Date(measuredAt)
  if (!Number.isFinite(instant.getTime()) || instant.getTime() > Date.now()) throw new Error('Fecha del pesaje no válida.')
  const payload = { weight_kg: validateWeight(weight), measured_at: instant.toISOString(), timezone,
    local_date: localDay(instant, timezone) }
  if (id) {
    const result = check(await supabase.from('weight_logs').update(payload).eq('id', id).eq('user_id', userId)
      .eq('updated_at', updatedAt).select().maybeSingle())
    if (!result) throw new Error('El pesaje cambió en otra sesión. Recarga el historial antes de editarlo.')
    return result
  }
  check(await supabase.from('weight_logs').upsert({ ...payload, user_id: userId, operation_id: operationId },
    { onConflict: 'user_id,operation_id', ignoreDuplicates: true }))
}

export async function deleteWeightLog(id, updatedAt) {
  const userId = await owner()
  const row = check(await supabase.from('weight_logs').delete().eq('id', id).eq('user_id', userId)
    .eq('updated_at', updatedAt).select('id').maybeSingle())
  if (!row) throw new Error('El pesaje cambió en otra sesión. Recarga el historial.')
}
