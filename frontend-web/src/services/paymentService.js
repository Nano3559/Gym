import { supabase, isSupabaseConfigured } from '../lib/supabase'

const MONEDA = 'BOB'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Servicio de pagos (Módulo 5).
 * Toda operación verifica que Supabase esté configurado; en caso contrario
 * devuelve errores controlados para que la landing local siga funcionando.
 */

/**
 * Resuelve el ID de un plan a un UUID válido que exista en `plans`.
 * Los planes de la landing usan slugs legibles ("basico", "completo", ...) o
 * nombres ("Plan Básico"), mientras que la BD `plans` usa UUIDs, así que
 * traducimos buscando primero por `codigo` (slug) y después por `nombre`.
 * Si no se encuentra, se usa como respaldo un plan real (el más económico),
 * evitando así asignar un UUID inexistente y romper la clave foránea.
 * @param {string} planId ID del plan (slug, nombre o UUID).
 * @returns {Promise<string|null>} UUID real del plan, o null si no hay BD.
 */
async function resolverPlanIdUUID(planId) {
  if (!planId) return null
  if (UUID_REGEX.test(planId)) return planId

  if (!isSupabaseConfigured || !supabase) return null

  // 1) Match exacto por `codigo` (slug), fuente que usa la landing.
  const { data: porCodigo } = await supabase
    .from('plans')
    .select('id')
    .eq('codigo', planId)
    .maybeSingle()
  if (porCodigo?.id) return porCodigo.id

  // 2) Match por `nombre` (búsqueda insensible a mayúsculas).
  const { data: porNombre } = await supabase
    .from('plans')
    .select('id')
    .ilike('nombre', `%${planId}%`)
    .maybeSingle()
  if (porNombre?.id) return porNombre.id

  // 3) Respaldo: un plan real existente en la BD (no un UUID inventado).
  const { data: respaldo } = await supabase
    .from('plans')
    .select('id')
    .order('precio', { ascending: true })
    .limit(1)
    .maybeSingle()
  return respaldo?.id || null
}

/** Genera un ID de transacción único (prefijo legible + uuid corto). */
export function generarTransactionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `txn-${crypto.randomUUID().slice(0, 13)}`
  }
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Construye el payload JSON que codifica el QR de pago.
 * @param {object} user  Perfil/usuario (debe exponer id y email).
 * @param {object} plan  Plan (debe exponer id, nombre y precio).
 * @param {string} transactionId ID de transacción.
 * @returns {string} Cadena JSON con los datos del QR.
 */
export function generarPayloadQR(user, plan, transactionId) {
  const payload = {
    transaction_id: transactionId,
    monto: Number(plan.precio),
    moneda: MONEDA,
    plan_id: plan.id,
    plan_nombre: plan.nombre,
    user_id: user?.id || null,
    email: user?.email || null,
    timestamp: new Date().toISOString(),
  }
  return JSON.stringify(payload)
}

/**
 * Inserta el pago inicial en `payments` con estado 'pendiente'.
 * Requiere política RLS de INSERT para el usuario autenticado.
 */
export async function crearRegistroPagoPendiente({ userId, planId, monto, metodoPago, transactionId, qrPayload }) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase no está configurado.' }
  }
  const planUUID = await resolverPlanIdUUID(planId)
  const fila = {
    user_id: userId,
    monto,
    metodo_pago: metodoPago,
    estado_pago: 'pendiente',
    transaction_id: transactionId,
    qr_code_payload: qrPayload,
  }
  if (planUUID) fila.plan_id = planUUID
  const { error } = await supabase.from('payments').insert(fila)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/**
 * Confirma el pago llamando a la RPC `procesar_pago_exitoso`.
 * Crea/renueva la membresía y actualiza profiles.plan_id de forma atómica.
 */
export async function confirmarPagoExitoso({ transactionId, userId, planId, monto, metodoPago }) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase no está configurado.' }
  }
  const planUUID = await resolverPlanIdUUID(planId)
  if (!planUUID) {
    return { ok: false, message: 'No se pudo resolver un plan válido para confirmar el pago.' }
  }
  const { data, error } = await supabase.rpc('procesar_pago_exitoso', {
    p_transaction_id: transactionId,
    p_user_id: userId,
    p_plan_id: planUUID,
    p_monto: monto,
    p_metodo_pago: metodoPago,
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true, membership: data }
}

/**
 * Se suscribe a cambios realtime en `payments` para detectar el estado de una
 * transacción. `onUpdate` recibe la fila actualizada. Devuelve la función que
 * cancela la suscripción.
 */
export function escucharEstadoPago(transactionId, onUpdate) {
  if (!isSupabaseConfigured || !supabase) return () => {}

  const channel = supabase
    .channel(`pago-${transactionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `transaction_id=eq.${transactionId}`,
      },
      (payload) => {
        onUpdate(payload.new || null)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}