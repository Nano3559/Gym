import { supabase, isSupabaseConfigured } from '../lib/supabase'

const MONEDA = 'BOB'

const UUID_FALLBACK = '00000000-0000-0000-0000-000000000001'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Servicio de pagos (Módulo 5).
 * Toda operación verifica que Supabase esté configurado; en caso contrario
 * devuelve errores controlados para que la landing local siga funcionando.
 */

/**
 * Resuelve el ID de un plan a un UUID válido.
 * Los planes de la landing usan slugs legibles ("completo", "basico", ...)
 * mientras que la BD `plans` usa UUIDs, así que traducimos por nombre.
 * @param {string} planId ID del plan (slug o UUID).
 * @returns {Promise<string>} UUID del plan (o un UUID de respaldo si no se resuelve).
 */
async function resolverPlanIdUUID(planId) {
  if (!planId) return UUID_FALLBACK
  if (UUID_REGEX.test(planId)) return planId

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('plans')
      .select('id')
      .ilike('nombre', `%${planId}%`)
      .maybeSingle()
    if (!error && data?.id) return data.id
  }
  return UUID_FALLBACK
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
  const { error } = await supabase.from('payments').insert({
    user_id: userId,
    plan_id: planUUID,
    monto,
    metodo_pago: metodoPago,
    estado_pago: 'pendiente',
    transaction_id: transactionId,
    qr_code_payload: qrPayload,
  })
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