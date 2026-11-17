// Lógica pura del módulo de Finanzas.
//
// No depende de React ni de Supabase. Trabaja con los campos reales que
// devuelven las tablas `payments`, `pos_sales` y `operating_expenses`.
//
// Los importes se normalizan a centavos (enteros) para evitar errores de coma
// flotante al sumar. No se modifican los valores almacenados en la base.

export const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'qr', label: 'QR' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta', label: 'Tarjeta' },
  { key: 'yape_plin', label: 'Yape/Plin' },
]

export const PAYMENT_METHOD_NAMES = Object.fromEntries(
  PAYMENT_METHODS.map((method) => [method.key, method.label]),
)

export const EXPENSE_CATEGORIES = [
  'Sueldos',
  'Alquiler',
  'Servicios',
  'Insumos',
  'Mantenimiento',
  'Otros',
]

export const FINANCE_CSV_HEADER = [
  'Fecha',
  'Tipo',
  'Concepto',
  'Categoría',
  'Método de pago',
  'Monto',
  'Identificador',
]

// Bolivia no aplica horario de verano: UTC-4 todo el año.
export const GYM_UTC_OFFSET = '-04:00'
const GYM_OFFSET_MS = -4 * 60 * 60 * 1000
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function toCents(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const adjustment = number >= 0 ? Number.EPSILON : -Number.EPSILON
  return Math.round((number + adjustment) * 100)
}

export function centsToAmount(cents) {
  return Number.isFinite(cents) ? cents / 100 : null
}

export function formatMoney(cents) {
  if (cents == null || !Number.isFinite(cents)) return '—'
  const formatted = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
  return `${formatted} Bs.`
}

export function formatCsvAmount(cents) {
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : ''
}

// Fecha local del gimnasio (YYYY-MM-DD) a partir de un timestamp.
export function dateKey(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' && DATE_KEY_RE.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() + GYM_OFFSET_MS).toISOString().slice(0, 10)
}

export function formatDateDisplay(value) {
  const key = dateKey(value)
  if (!key) return '—'
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

export function addDays(dateString, days) {
  if (!DATE_KEY_RE.test(dateString || '')) return ''
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

// Período del mes calendario actual en fecha local del gimnasio.
export function currentMonthBounds(now = new Date()) {
  const today = dateKey(now)
  if (!today) return { from: '', to: '' }
  const [year, month] = today.split('-')
  const from = `${year}-${month}-01`
  const nextYear = month === '12' ? String(Number(year) + 1) : year
  const nextMonth = month === '12' ? '01' : String(Number(month) + 1).padStart(2, '0')
  return { from, to: addDays(`${nextYear}-${nextMonth}-01`, -1) }
}

// Límites ISO para consultar Supabase con el rango local inclusivo.
export function periodQueryBounds(from, to) {
  if (!DATE_KEY_RE.test(from || '') || !DATE_KEY_RE.test(to || '') || from > to) {
    return null
  }
  const endExclusive = addDays(to, 1)
  if (!endExclusive) return null
  return {
    start: `${from}T00:00:00${GYM_UTC_OFFSET}`,
    end: `${endExclusive}T00:00:00${GYM_UTC_OFFSET}`,
  }
}

function methodLabel(method) {
  if (!method) return '—'
  return PAYMENT_METHOD_NAMES[method] || method
}

function baseMovement({
  source,
  type,
  subtype,
  concept,
  category,
  method,
  amountCents,
  date,
  identifier,
}) {
  return {
    id: identifier ? `${source}:${identifier}` : '',
    dedupeKey: identifier ? `${source}:${identifier}` : null,
    source,
    type,
    subtype,
    concept,
    category,
    method: method || '',
    methodLabel: methodLabel(method),
    amountCents,
    amount: centsToAmount(amountCents),
    date: date || '',
    reference: identifier ? String(identifier) : '',
  }
}

export function normalizePayment(row) {
  if (!row) return null
  if (row.estado_pago != null && row.estado_pago !== 'completado') return null
  const amountCents = toCents(row.monto)
  if (amountCents == null || amountCents < 0) return null
  return baseMovement({
    source: 'pago',
    type: 'Ingreso',
    subtype: 'Membresía',
    concept: 'Membresía',
    category: 'Membresía',
    method: row.metodo_pago,
    amountCents,
    date: row.created_at,
    identifier: row.id || row.transaction_id,
  })
}

export function normalizePosSale(row) {
  if (!row) return null
  const amountCents = toCents(row.total)
  if (amountCents == null || amountCents <= 0) return null
  return baseMovement({
    source: 'pos',
    type: 'Ingreso',
    subtype: 'POS',
    concept: 'Venta POS',
    category: 'POS',
    method: row.metodo_pago,
    amountCents,
    date: row.created_at,
    identifier: row.id || row.receipt_number,
  })
}

export function normalizeExpense(row) {
  if (!row) return null
  const amountCents = toCents(row.monto)
  if (amountCents == null || amountCents <= 0) return null
  return baseMovement({
    source: 'egreso',
    type: 'Egreso',
    subtype: 'Egreso',
    concept: String(row.concepto || '').trim() || 'Egreso',
    category: row.categoria || '—',
    method: row.metodo_pago,
    amountCents,
    date: row.created_at,
    identifier: row.id,
  })
}

function movementTime(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

// Normaliza, deduplica por identificador fiable y ordena de más reciente a
// más antiguo. Nunca deduplica por monto/fecha: dos movimientos legítimos con
// el mismo importe y fecha deben conservarse.
export function buildMovements({ payments = [], posSales = [], expenses = [] } = {}) {
  const normalized = [
    ...(payments || []).map(normalizePayment),
    ...(posSales || []).map(normalizePosSale),
    ...(expenses || []).map(normalizeExpense),
  ].filter(Boolean)

  const seen = new Set()
  const movements = []
  for (const movement of normalized) {
    if (movement.dedupeKey) {
      if (seen.has(movement.dedupeKey)) continue
      seen.add(movement.dedupeKey)
    }
    movements.push({
      ...movement,
      id: movement.dedupeKey || `${movement.source}:${movements.length}`,
    })
  }

  return movements.sort((a, b) => {
    const timeDiff = movementTime(b.date) - movementTime(a.date)
    if (timeDiff !== 0) return timeDiff
    return String(b.id).localeCompare(String(a.id))
  })
}

export function filterMovementsByPeriod(movements = [], from = '', to = '') {
  return (movements || []).filter((movement) => {
    const key = dateKey(movement.date)
    if (!key) return false
    if (from && key < from) return false
    if (to && key > to) return false
    return true
  })
}

export function summarizeMovements(movements = []) {
  let membershipCents = 0
  let posCents = 0
  let expenseCents = 0

  for (const movement of movements || []) {
    if (movement.type === 'Ingreso') {
      if (movement.subtype === 'Membresía') membershipCents += movement.amountCents
      else posCents += movement.amountCents
    } else if (movement.type === 'Egreso') {
      expenseCents += movement.amountCents
    }
  }

  const incomeCents = membershipCents + posCents
  return {
    membershipCents,
    posCents,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    count: (movements || []).length,
  }
}

export function buildFinanceCsvRows(movements = []) {
  return [
    [...FINANCE_CSV_HEADER],
    ...(movements || []).map((movement) => [
      formatDateDisplay(movement.date),
      movement.type,
      movement.concept,
      movement.category,
      movement.methodLabel,
      formatCsvAmount(movement.amountCents),
      movement.reference || '',
    ]),
  ]
}

// Decide el origen de datos sin mezclar modos:
// - Sin Supabase configurado: modo local explícito.
// - Con Supabase y sin sesión: no se leen datos locales.
// - Con Supabase y sesión: datos remotos.
export function resolveFinanceMode({ configured, hasSession }) {
  if (!configured) return 'local'
  return hasSession ? 'remote' : 'auth-required'
}
