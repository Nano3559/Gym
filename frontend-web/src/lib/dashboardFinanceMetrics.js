// Lógica pura de los indicadores financieros del Dashboard.
//
// No depende de React ni de Supabase. Reutiliza las reglas ya probadas del
// módulo de Finanzas (`financeMetrics.js`) y solo añade lo necesario para
// comparar el mes actual con el anterior:
//
// - `previousMonthBounds` calcula el mes anterior con la zona del gimnasio.
// - `summarizeFinancePeriod` normaliza, deduplica, filtra y suma un período.
// - `buildDashboardFinanceSnapshot` devuelve centavos y montos, usando `null`
//   cuando no existe un resultado válido (nunca convierte un error en cero).

import {
  addDays,
  buildMovements,
  centsToAmount,
  currentMonthBounds,
  filterMovementsByPeriod,
  summarizeMovements,
} from './financeMetrics.js'

// Rango inclusivo (YYYY-MM-DD) del mes anterior al indicado por `now`.
// `currentMonthBounds` ya aplica la zona fija de Bolivia (-04:00).
export function previousMonthBounds(now = new Date()) {
  const current = currentMonthBounds(now)
  if (!current.from) return { from: '', to: '' }
  const lastDay = addDays(current.from, -1)
  if (!lastDay) return { from: '', to: '' }
  const [year, month] = lastDay.split('-')
  return { from: `${year}-${month}-01`, to: lastDay }
}

// Resumen de un período con los mismos criterios que la pantalla de Finanzas:
// pagos completados + ventas POS como ingresos, egresos separados y neto.
export function summarizeFinancePeriod({
  payments = [],
  posSales = [],
  expenses = [],
  from = '',
  to = '',
} = {}) {
  const movements = filterMovementsByPeriod(
    buildMovements({ payments, posSales, expenses }),
    from,
    to,
  )
  const totals = summarizeMovements(movements)
  return {
    membershipCents: totals.membershipCents,
    posCents: totals.posCents,
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    netCents: totals.netCents,
    count: totals.count,
    income: centsToAmount(totals.incomeCents),
    expenses: centsToAmount(totals.expenseCents),
    net: centsToAmount(totals.netCents),
  }
}

function centsOrNull(summary, key) {
  if (!summary || !Number.isFinite(summary[key])) return null
  return summary[key]
}

function amountOrNull(summary, key) {
  const cents = centsOrNull(summary, key)
  return cents == null ? null : centsToAmount(cents)
}

// Instantánea para el contrato del Dashboard. Si falta un período (error o
// consulta fallida), sus valores quedan en `null`; un período válido sin
// movimientos produce ceros reales.
export function buildDashboardFinanceSnapshot({ current = null, previous = null } = {}) {
  return {
    currentIncomeCents: centsOrNull(current, 'incomeCents'),
    previousIncomeCents: centsOrNull(previous, 'incomeCents'),
    currentExpenseCents: centsOrNull(current, 'expenseCents'),
    previousExpenseCents: centsOrNull(previous, 'expenseCents'),
    currentNetCents: centsOrNull(current, 'netCents'),
    previousNetCents: centsOrNull(previous, 'netCents'),
    currentIncome: amountOrNull(current, 'incomeCents'),
    previousIncome: amountOrNull(previous, 'incomeCents'),
    currentExpenses: amountOrNull(current, 'expenseCents'),
    previousExpenses: amountOrNull(previous, 'expenseCents'),
    currentNet: amountOrNull(current, 'netCents'),
    previousNet: amountOrNull(previous, 'netCents'),
  }
}
