export const DEFAULT_FEATURES = {
  basico: [
    'Acceso al gimnasio',
    'Lunes a viernes',
    'Horario limitado (08:00 - 17:00)',
    'Acceso a zona de musculación y cardio',
    'Casilleros y estacionamiento',
  ],
  completo: [
    'Acceso ilimitado',
    'Todas las clases grupales',
    'Lunes a sábado',
    'Horario completo (05:30 - 22:00)',
    'Evaluación física mensual',
    'Casilleros, toalla y parqueo',
  ],
  premium: [
    'Acceso ilimitado 24/7',
    'Todas las clases + priority booking',
    'Entrenador personalizado',
    'Evaluación física completa',
    'Asesoría nutricional',
    'Acceso a la app + seguimiento',
  ],
}

// Devuelve los beneficios de un plan. Usa las características del objeto si
// existen; en caso contrario aplica el fallback por defecto según el código.
export function getPlanFeatures(plan) {
  if (Array.isArray(plan?.features) && plan.features.length) return plan.features
  const code = plan?.id || plan?.code || String(plan?.name || '').toLowerCase()
  if (DEFAULT_FEATURES[code]) return DEFAULT_FEATURES[code]
  const key = Object.keys(DEFAULT_FEATURES).find((k) =>
    String(plan?.name || '').toLowerCase().includes(k)
  )
  return DEFAULT_FEATURES[key] || DEFAULT_FEATURES.basico
}