// Lógica pura del módulo de Reportes.
//
// Se separa del hook para poder probar los cálculos sin React, sin DOM y sin
// red. El esquema real NO tiene `profiles.role`: el rol funcional vive en
// `app_metadata.gym_role` (admin | reception | trainer | member) y el personal
// de recepción/entrenadores se registra en `staff_accounts`.
//
// Por eso el total de clientes se calcula como:
//   perfiles únicos  -  personal conocido (staff_accounts + cuentas de staff
//   actuales + correos de respaldo que `current_gym_role()` trata como staff).

export const METHOD_KEYS = ['efectivo', 'qr', 'transferencia', 'tarjeta', 'yape_plin']

export const METHOD_NAMES = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  yape_plin: 'Yape/Plin',
}

// Roles que `public.current_gym_role()` puede devolver para personal.
export const STAFF_ROLES = ['admin', 'reception', 'trainer']

// Correos que la función SQL `current_gym_role()` clasifica como staff aunque
// el usuario no tenga `app_metadata.gym_role` explícito.
export const STAFF_FALLBACK_EMAILS = ['admin@ironforge.com', 'recepcion@ironforge.com']

export const EMPTY_METHOD_VALUES = () =>
  Object.fromEntries(METHOD_KEYS.map((method) => [method, 0]))

// Estado "sin datos": null distingue "no disponible" de un cero válido.
export function emptyReportValues() {
  return {
    payments: [],
    ingresosPorMembresias: null,
    ingresosPOS: null,
    ingresosTotal: null,
    methodCountsMembresias: EMPTY_METHOD_VALUES(),
    methodCountsPOS: EMPTY_METHOD_VALUES(),
    methodTotalsMembresias: EMPTY_METHOD_VALUES(),
    methodTotalsPOS: EMPTY_METHOD_VALUES(),
    activas: null,
    vencidas: null,
    totalClientes: null,
  }
}

export function aggregateIncomes(payments = [], posSales = []) {
  const methodCountsMembresias = EMPTY_METHOD_VALUES()
  const methodCountsPOS = EMPTY_METHOD_VALUES()
  const methodTotalsMembresias = EMPTY_METHOD_VALUES()
  const methodTotalsPOS = EMPTY_METHOD_VALUES()

  let ingresosPorMembresias = 0
  for (const payment of payments) {
    const amount = Number(payment?.monto) || 0
    ingresosPorMembresias += amount
    const method = payment?.metodo_pago
    if (METHOD_KEYS.includes(method)) {
      methodCountsMembresias[method] += 1
      methodTotalsMembresias[method] += amount
    }
  }

  let ingresosPOS = 0
  for (const sale of posSales) {
    const amount = Number(sale?.total) || 0
    ingresosPOS += amount
    const method = sale?.metodo_pago
    if (METHOD_KEYS.includes(method)) {
      methodCountsPOS[method] += 1
      methodTotalsPOS[method] += amount
    }
  }

  return {
    ingresosPorMembresias,
    ingresosPOS,
    ingresosTotal: ingresosPorMembresias + ingresosPOS,
    methodCountsMembresias,
    methodCountsPOS,
    methodTotalsMembresias,
    methodTotalsPOS,
  }
}

// Calcula indicadores por PERSONA ÚNICA (user_id), no por membresía.
// - activas: al menos una membresía 'activa' o 'por_vencer'.
// - vencidas: al menos una 'vencida' y ninguna 'activa'/'por_vencer'.
// - totalClientes: perfiles únicos que no son personal.
export function computeClientIndicators({
  memberships = [],
  profiles = [],
  excludedUserIds = [],
  excludedEmails = [],
} = {}) {
  const excludedIds = new Set(excludedUserIds.filter(Boolean))
  const excludedEmailSet = new Set(
    excludedEmails.filter(Boolean).map((email) => String(email).trim().toLowerCase()),
  )

  const clientProfiles = profiles.filter((profile) => {
    if (!profile) return false
    if (excludedIds.has(profile.id)) return false
    const email = String(profile.email || '').trim().toLowerCase()
    if (email && excludedEmailSet.has(email)) return false
    return true
  })

  const clientIds = new Set(clientProfiles.map((profile) => profile.id))

  // Agrupar TODOS los estados por usuario antes de clasificar. Así la
  // clasificación no depende del orden en que llegan las membresías.
  const statesByUser = new Map()
  for (const membership of memberships) {
    if (!membership) continue
    if (!clientIds.has(membership.user_id)) continue
    let states = statesByUser.get(membership.user_id)
    if (!states) {
      states = new Set()
      statesByUser.set(membership.user_id, states)
    }
    states.add(membership.estado)
  }

  let activas = 0
  let vencidas = 0
  for (const states of statesByUser.values()) {
    const hasActiveOrPending = states.has('activa') || states.has('por_vencer')
    if (hasActiveOrPending) {
      // Si tiene activas y vencidas, prevalece como activo.
      activas += 1
    } else if (states.has('vencida')) {
      vencidas += 1
    }
  }

  return {
    totalClientes: clientProfiles.length,
    activas,
    vencidas,
  }
}

export function buildReportData({
  payments = [],
  posSales = [],
  memberships = [],
  profiles = [],
  excludedUserIds = [],
  excludedEmails = STAFF_FALLBACK_EMAILS,
} = {}) {
  return {
    ...aggregateIncomes(payments, posSales),
    ...computeClientIndicators({ memberships, profiles, excludedUserIds, excludedEmails }),
  }
}

// null representa "no disponible" y NO debe mostrarse como cero.
export function fmtInt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function fmtMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${fmtInt(value)} Bs.`
}
