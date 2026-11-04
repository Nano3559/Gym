import { localDay } from './progressData.js'
export const NUTRIENTS = ['calorias', 'proteinas_g', 'carbohidratos_g', 'grasas_g']
export function mealPayload(input) {
  if (!input.alimento?.trim() || !input.portion?.trim()) throw new Error('Indica alimento y porción.')
  const portions = Number(input.portions)
  if (!Number.isFinite(portions) || portions < 0.01 || portions > 100 || Math.abs(portions * 100 - Math.round(portions * 100)) > 1e-8) throw new Error('Indica entre 0,01 y 100 porciones, con un máximo de dos decimales.')
  const base = {}
  for (const key of NUTRIENTS) {
    const value = Number(input[key])
    if (String(input[key] ?? '').trim() === '' || !Number.isFinite(value) || value < 0 || value > 50000) throw new Error('Los nutrientes deben ser números entre 0 y 50000.')
    base[key] = value
  }
  const totals = Object.fromEntries(NUTRIENTS.map(key => [key, Math.round(base[key] * portions * (key === 'calorias' ? 1 : 100)) / (key === 'calorias' ? 1 : 100)]))
  if (Object.values(totals).some(value => value > 99999)) throw new Error('La cantidad total es demasiado grande. Revisa la porción.')
  return { ...totals, alimento: input.alimento.trim(), descripcion: input.descripcion || '', portion: input.portion.trim(), portions,
    nutrition_per_portion: base, es_comida: true, confirmation: 'confirmed' }
}
export function dayRange(day, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T12:00Z`)) || new Date(`${day}T12:00Z`).toISOString().slice(0,10)!==day) throw new Error('Día no válido.')
  const boundary = target => {
    const center = Date.parse(`${target}T00:00Z`)
    let low = center - 36*3600000, high = center + 36*3600000
    while (low < high) { const middle=Math.floor((low+high)/2); if(localDay(middle,timezone)<target) low=middle+1; else high=middle }
    return low
  }
  const start = boundary(day)
  if (localDay(start,timezone)!==day) throw new Error('Ese día no existió en la zona horaria seleccionada.')
  const next = new Date(`${day}T12:00Z`); next.setUTCDate(next.getUTCDate() + 1)
  return [new Date(start).toISOString(),new Date(boundary(next.toISOString().slice(0,10))).toISOString()]
}
export function mealTotals(rows) {
  return rows.filter(row => row.confirmation === 'confirmed' && row.es_comida)
    .reduce((totals, row) => Object.fromEntries(NUTRIENTS.map(key => [key, Math.round((totals[key] + Number(row[key] || 0)) * 100) / 100])), Object.fromEntries(NUTRIENTS.map(key => [key, 0])))
}

// Reloj independiente de React: contabiliza transiciones, no ticks de temporizador.
export function createSessionClock(now = Date.now) {
  let last = now(), mode = 'preparation', totals = { active: 0, rest: 0, preparation: 0, paused: 0 }
  const flush = () => { const current = now(); if (mode) totals[mode] += Math.max(0, current - last); last = current }
  return {
    transition(next) { flush(); mode = next },
    snapshot() { flush(); return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.floor(value / 1000)])) },
  }
}
