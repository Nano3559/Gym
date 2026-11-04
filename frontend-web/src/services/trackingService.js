import { supabase } from '../lib/supabase.js'
import { dayRange, mealPayload } from '../lib/trackingData.js'
import { localDay } from '../lib/progressData.js'
async function owner() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Inicia sesión para registrar tu diario.')
  return data.user.id
}
function check(result) { if (result.error) throw result.error; return result.data }
async function pageAll(table, userId, field, start, end) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const page = check(await supabase.from(table).select('*').eq('user_id', userId).gte(field, start).lt(field, end)
      .order(field, { ascending: false }).order('id').range(offset, offset + 499))
    rows.push(...page); if (page.length < 500) return rows
  }
}
export async function getTrackingDay(day, timezone) {
  const userId = await owner(), [start, end] = dayRange(day, timezone)
  const [meals, sessions, status] = await Promise.all([
    pageAll('meal_logs', userId, 'consumed_at', start, end),
    pageAll('routine_sessions', userId, 'occurred_at', start, end),
    supabase.from('daily_tracking_status').select('*').eq('user_id', userId).eq('local_date', day).eq('timezone', timezone).maybeSingle(),
  ])
  return { meals, sessions, status: check(status) }
}
export async function getTrackingZone() {
  const userId = await owner()
  const profile = check(await supabase.from('progress_profiles').select('timezone').eq('user_id', userId).maybeSingle())
  return profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
export async function saveConsumedMeal(input, { id, operationId, updatedAt, source = 'manual' } = {}) {
  const userId = await owner(), instant = new Date(input.consumed_at)
  if (!Number.isFinite(instant.getTime()) || instant.getTime() > Date.now()) throw new Error('La fecha de consumo no es válida.')
  const payload = { ...mealPayload(input), consumed_at: instant.toISOString(), timezone: input.timezone, local_date: localDay(instant, input.timezone), source }
  if (id) {
    // La edición no cambia cómo se originó el registro (escáner, manual o antiguo).
    delete payload.source
    const row = check(await supabase.from('meal_logs').update(payload).eq('id', id).eq('user_id', userId).eq('updated_at', updatedAt).select().maybeSingle())
    if (!row) throw new Error('La comida cambió en otra sesión. Recarga el diario.')
    return row
  }
  if (!['manual','scan'].includes(source)) throw new Error('Origen de comida no válido.')
  if (!operationId) throw new Error('Falta identificador de guardado.')
  check(await supabase.from('meal_logs').upsert({ ...payload, operation_id: operationId, user_id: userId }, { onConflict: 'user_id,operation_id', ignoreDuplicates: true }))
}
export async function voidMeal(row) {
  const userId = await owner()
  const result = check(await supabase.from('meal_logs').update({ confirmation: 'void' }).eq('id', row.id).eq('user_id', userId)
    .eq('updated_at', row.updated_at).select('id').maybeSingle())
  if (!result) throw new Error('La comida cambió en otra sesión. Recarga el diario.')
}
export async function saveDayStatus(day, timezone, fields) {
  await owner()
  check(await supabase.rpc('set_tracking_day',{ p_day: day, p_timezone: timezone,
    p_meals: fields.meals_complete ?? null, p_activity: fields.activity_complete ?? null }))
}
export async function saveManualActivity(input, operationId) {
  if (!operationId) throw new Error('Falta identificador de guardado.')
  const userId = await owner(), minutes = Number(input.minutes), started = new Date(input.started_at)
  if (!input.title?.trim() || !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440 || !['light','moderate','high'].includes(input.intensity)) throw new Error('Revisa nombre, duración e intensidad de la actividad.')
  const seconds = Math.round(minutes * 60), ended = new Date(started.getTime() + seconds * 1000)
  if (!Number.isFinite(started.getTime()) || ended.getTime() > Date.now() || seconds < 1) throw new Error('La actividad debe haber terminado y tener una fecha válida y al menos un segundo activo.')
  if (localDay(started,input.timezone) !== localDay(new Date(ended.getTime()-1),input.timezone)) throw new Error('La actividad cruza de día. Divídela en registros por día para estimar su gasto.')
  check(await supabase.from('routine_sessions').upsert({ user_id: userId, operation_id: operationId, routine_title: input.title.trim(),
    started_at: started.toISOString(), completed_at: ended.toISOString(), occurred_at: started.toISOString(), timezone: input.timezone,
    local_date: localDay(started,input.timezone), duration_sec: seconds, active_sec: seconds, rest_sec: 0, paused_sec: 0, preparation_sec: 0,
    session_status: 'manual', intensity: input.intensity, exercises: [] }, { onConflict: 'user_id,operation_id', ignoreDuplicates: true }))
}
export async function voidActivity(row) {
  const userId = await owner()
  const result = check(await supabase.from('routine_sessions').update({ session_status: 'void' }).eq('id', row.id).eq('user_id', userId)
    .eq('updated_at', row.updated_at).select('id').maybeSingle())
  if (!result) throw new Error('La actividad cambió en otra sesión. Recarga el diario.')
}
