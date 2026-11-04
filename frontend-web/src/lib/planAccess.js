// Reglas de acceso a clases grupales según el plan activo.
// day: 0 = Domingo, 1 = Lunes, ... 6 = Sábado (getDay de JS).
// horas en formato decimal (08:00 -> 8, 17:00 -> 17).
export const PLAN_ACCESS = {
  basico: { minDay: 1, maxDay: 5, startHour: 8, endHour: 17 },
  completo: { minDay: 1, maxDay: 6, startHour: 5.5, endHour: 22 },
  premium: { minDay: 0, maxDay: 6, startHour: 5.5, endHour: 22 },
}

// Mapeo del id de día de la UI (lun..dom) al número de día de JS.
export const DAY_NUMBER = {
  lun: 1,
  mar: 2,
  mie: 3,
  jue: 4,
  vie: 5,
  sab: 6,
  dom: 0,
}

function toHourFloat(time) {
  const [h, m] = String(time || '').split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h + (Number.isNaN(m) ? 0 : m / 60)
}

// Devuelve true si la clase (día + hora) está dentro de los límites del plan.
export function isClassIncluded(planCode, dayId, time) {
  const access = PLAN_ACCESS[planCode]
  if (!access) return true
  const day = DAY_NUMBER[dayId]
  if (day === undefined) return true
  if (day < access.minDay || day > access.maxDay) return false
  const hour = toHourFloat(time)
  if (hour === null) return true
  return hour >= access.startHour && hour <= access.endHour
}