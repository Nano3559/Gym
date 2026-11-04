// Utilidades de estado de membresía (Módulo 6).
// Devuelve la cantidad de días que faltan para el vencimiento (negativo si ya venció).

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const end = new Date(dateStr)
  if (Number.isNaN(end.getTime())) return null
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

/**
 * Estado dinámico de una membresía según su fecha de vencimiento:
 *   - 'activa':      vence en más de 5 días.
 *   - 'por_vencer':  vence entre 1 y 5 días a partir de hoy.
 *   - 'vencida':     ya venció (menor o igual a hoy).
 */
export function getMembershipStatus(dateStr) {
  const d = daysUntil(dateStr)
  if (d === null || d <= 0) return { key: 'vencida', label: 'Vencida' }
  if (d <= 5) return { key: 'por_vencer', label: 'Por vencer' }
  return { key: 'activa', label: 'Activa' }
}