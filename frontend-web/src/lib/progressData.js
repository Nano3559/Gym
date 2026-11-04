export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high']

export function validateBirthDate(value,timezone='UTC',now=Date.now()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(`${value}T12:00Z`))||new Date(`${value}T12:00Z`).toISOString().slice(0,10)!==value||value>localDay(now,timezone))throw new Error('Ingresa una fecha de nacimiento válida que no esté en el futuro.')
  return value
}

export function validateWeight(value) {
  const weight = Number(value)
  if (String(value).trim() === '' || !Number.isFinite(weight) || weight < 20 || weight > 500) {
    throw new Error('Ingresa un peso entre 20 y 500 kg.')
  }
  return Math.round(weight * 100) / 100
}

export function validateProfile(input) {
  const height = Number(input.height_cm)
  if (!Number.isFinite(height) || height < 100 || height > 250) throw new Error('Ingresa una estatura entre 100 y 250 cm.')
  if (!ACTIVITY_LEVELS.includes(input.activity_level)) throw new Error('Selecciona tu actividad habitual.')
  if (!['', 'female', 'male'].includes(input.formula_sex ?? '')) throw new Error('Selecciona una opción válida para la fórmula.')
  try { new Intl.DateTimeFormat('es', { timeZone: input.timezone }).format() } catch {
    throw new Error('Selecciona una zona horaria válida, por ejemplo America/La_Paz.')
  }
  if (!input.timezone?.trim()) throw new Error('Indica tu zona horaria.')
  if (input.estimates_paused !== undefined && typeof input.estimates_paused !== 'boolean') throw new Error('Indica si deseas suspender las estimaciones.')
  return { height_cm: Math.round(height * 10) / 10, activity_level: input.activity_level,
    formula_sex: input.formula_sex || null, timezone: input.timezone.trim(), estimates_paused: input.estimates_paused ?? false }
}

export function localDay(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant))
  const field = name => parts.find(part => part.type === name).value
  return `${field('year')}-${field('month')}-${field('day')}`
}

// Offset explícito evita interpretar la hora usando la zona del dispositivo.
// Las horas inexistentes o ambiguas por cambio de horario se rechazan.
export function zonedDateTimeToISO(value, timezone, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Indica fecha y hora del pesaje.')
  const target = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 16) !== value) throw new Error('La fecha no es válida.')
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const render = date => formatter.format(date).replace(' ', 'T')
  const matches = []
  // Zonas IANA actuales usan desplazamientos en múltiplos de 15 minutos.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = target + offset * 60000
    if (render(candidate) === value) matches.push(candidate)
  }
  if (matches.length !== 1) throw new Error('Esa hora es inexistente o ambigua en tu zona horaria. Elige otra hora.')
  if (matches[0] > now) throw new Error('El pesaje no puede estar en el futuro.')
  return new Date(matches[0]).toISOString()
}

export function datetimeInput(instant, timezone) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant)).replace(' ', 'T')
}

export function weightSummary(logs) {
  const sorted = [...logs].sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at) || new Date(a.created_at) - new Date(b.created_at))
  const first = sorted[0]?.weight_kg ?? null
  const latest = sorted.at(-1)?.weight_kg ?? null
  return { first, latest, change: first === null ? null : Math.round((latest - first) * 100) / 100 }
}
