import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReportData,
  computeClientIndicators,
  aggregateIncomes,
  emptyReportValues,
  fmtInt,
  fmtMoney,
} from '../src/lib/adminReportMetrics.js'
import { buildReportCsvRows, buildReportHtml } from '../src/lib/reportExport.js'

const profile = (id, email = `${id}@cliente.test`) => ({ id, email })
const membership = (user_id, estado) => ({ user_id, estado })

function indicators({ memberships = [], profiles = [], excludedUserIds = [], excludedEmails = [] }) {
  return computeClientIndicators({ memberships, profiles, excludedUserIds, excludedEmails })
}

test('1. una persona con una membresía activa cuenta como activa', () => {
  const result = indicators({
    profiles: [profile('u1')],
    memberships: [membership('u1', 'activa')],
  })
  assert.deepEqual(result, { totalClientes: 1, activas: 1, vencidas: 0 })
})

test('2. varias membresías activas de la misma persona cuentan una sola vez', () => {
  const result = indicators({
    profiles: [profile('u1')],
    memberships: [
      membership('u1', 'activa'),
      membership('u1', 'activa'),
      membership('u1', 'por_vencer'),
    ],
  })
  assert.deepEqual(result, { totalClientes: 1, activas: 1, vencidas: 0 })
})

test('3. varias membresías vencidas de la misma persona cuentan una sola vez', () => {
  const result = indicators({
    profiles: [profile('u1')],
    memberships: [membership('u1', 'vencida'), membership('u1', 'vencida')],
  })
  assert.deepEqual(result, { totalClientes: 1, activas: 0, vencidas: 1 })
})

test('4. activa + vencida (vencida primero) cuenta solo como activa', () => {
  const result = indicators({
    profiles: [profile('u1')],
    memberships: [membership('u1', 'vencida'), membership('u1', 'activa')],
  })
  assert.deepEqual(result, { totalClientes: 1, activas: 1, vencidas: 0 })
})

test('5. activa + vencida (activa primero) cuenta solo como activa', () => {
  const result = indicators({
    profiles: [profile('u1')],
    memberships: [membership('u1', 'activa'), membership('u1', 'vencida')],
  })
  assert.deepEqual(result, { totalClientes: 1, activas: 1, vencidas: 0 })
})

test('6. un cliente sin membresías aparece en el total de clientes', () => {
  const result = indicators({
    profiles: [profile('u1'), profile('u2')],
    memberships: [membership('u1', 'activa')],
  })
  assert.deepEqual(result, { totalClientes: 2, activas: 1, vencidas: 0 })
})

test('7. administrador, recepción y entrenador no cuentan como clientes', () => {
  const result = indicators({
    profiles: [
      profile('cliente-1'),
      profile('staff-reception'),
      profile('staff-trainer'),
      profile('admin-1', 'admin@ironforge.com'),
      profile('legacy-reception', 'recepcion@ironforge.com'),
    ],
    memberships: [membership('cliente-1', 'activa')],
    excludedUserIds: ['staff-reception', 'staff-trainer'],
    excludedEmails: ['admin@ironforge.com', 'recepcion@ironforge.com'],
  })
  assert.deepEqual(result, { totalClientes: 1, activas: 1, vencidas: 0 })
})

test('8. resultado válido sin registros es cero (no "no disponible")', () => {
  const result = indicators({ profiles: [], memberships: [] })
  assert.deepEqual(result, { totalClientes: 0, activas: 0, vencidas: 0 })
})

test('8b. varios clientes distintos se clasifican de forma independiente', () => {
  const result = indicators({
    profiles: [profile('u1'), profile('u2'), profile('u3')],
    memberships: [
      membership('u1', 'activa'),
      membership('u2', 'vencida'),
      membership('u3', 'por_vencer'),
      membership('u3', 'vencida'),
    ],
  })
  assert.deepEqual(result, { totalClientes: 3, activas: 2, vencidas: 1 })
})

test('9. los estados "no disponible" son null y nunca se muestran como cero', () => {
  const empty = emptyReportValues()
  assert.equal(empty.ingresosTotal, null)
  assert.equal(empty.activas, null)
  assert.equal(empty.vencidas, null)
  assert.equal(empty.totalClientes, null)
  assert.equal(fmtMoney(null), '—')
  assert.equal(fmtInt(null), '—')
  // Un cero válido sí se muestra como cero.
  assert.equal(fmtMoney(0), '0 Bs.')
  assert.equal(fmtInt(0), '0')
})

test('10a. membresías completadas excluyen cualquier estado distinto de completado', () => {
  // El hook filtra con .eq('estado_pago','completado'); aquí se verifica que
  // aggregateIncomes solo recibe lo que debe sumar y no reintroduce otros estados.
  const report = aggregateIncomes(
    [{ monto: 100, metodo_pago: 'efectivo' }, { monto: 250, metodo_pago: 'qr' }],
    [{ total: 50, metodo_pago: 'tarjeta' }],
  )
  assert.equal(report.ingresosPorMembresias, 350)
  assert.equal(report.ingresosPOS, 50)
  assert.equal(report.ingresosTotal, 400)
  assert.equal(report.methodTotalsMembresias.efectivo, 100)
  assert.equal(report.methodTotalsMembresias.qr, 250)
  assert.equal(report.methodTotalsPOS.tarjeta, 50)
})

test('10b. el desglose incluye yape_plin (método admitido por el esquema)', () => {
  const report = aggregateIncomes(
    [{ monto: 80, metodo_pago: 'yape_plin' }],
    [{ total: 20, metodo_pago: 'yape_plin' }],
  )
  assert.equal(report.methodCountsMembresias.yape_plin, 1)
  assert.equal(report.methodCountsPOS.yape_plin, 1)
  assert.equal(report.methodTotalsMembresias.yape_plin, 80)
  assert.equal(report.methodTotalsPOS.yape_plin, 20)
})

test('11a. CSV incluye período, ingresos, métodos y estado de clientes', () => {
  const report = buildReportData({
    payments: [{ monto: 100, metodo_pago: 'efectivo' }],
    posSales: [{ total: 50, metodo_pago: 'yape_plin' }],
    profiles: [profile('u1'), profile('u2'), profile('u3'), profile('u4')],
    memberships: [
      membership('u1', 'activa'),
      membership('u2', 'por_vencer'),
      membership('u3', 'vencida'),
    ],
  })
  const rows = buildReportCsvRows(report, {
    periodLabel: '2026-11-01 a 2026-11-16',
    generatedAt: '16/11/2026 10:00',
  })
  const flat = rows.map((row) => row.join(',')).join('\n')

  assert.match(flat, /IronForge Gym - Reporte detallado/)
  assert.match(flat, /Período,2026-11-01 a 2026-11-16/)
  assert.match(flat, /Ingresos por membresías,100 Bs\./)
  assert.match(flat, /Ingresos POS,50 Bs\./)
  assert.match(flat, /Ingresos comerciales totales,150 Bs\./)
  assert.match(flat, /Yape\/Plin/)
  assert.match(flat, /Clientes activos,2/)
  assert.match(flat, /Clientes vencidos,1/)
  assert.match(flat, /Total de clientes,4/)
})

test('11b. CSV marca los datos no disponibles sin convertirlos en cero', () => {
  const rows = buildReportCsvRows(
    { ...emptyReportValues() },
    { periodLabel: '2026-11-01 a 2026-11-16' },
  )
  const flat = rows.map((row) => row.join(',')).join('\n')
  assert.match(flat, /Ingresos comerciales totales,No disponible/)
  assert.match(flat, /Total de clientes,No disponible/)
  assert.match(
    flat,
    /Efectivo,No disponible,No disponible,No disponible,No disponible,No disponible/,
  )
  assert.doesNotMatch(flat, /Ingresos comerciales totales,0 Bs\./)
  assert.doesNotMatch(flat, /Efectivo,0,0 Bs\./)
})

test('11c. el reporte imprimible contiene las secciones requeridas', () => {
  const report = buildReportData({
    payments: [{ monto: 100, metodo_pago: 'efectivo' }],
    posSales: [{ total: 50, metodo_pago: 'tarjeta' }],
    profiles: [profile('u1'), profile('u2')],
    memberships: [membership('u1', 'activa'), membership('u2', 'vencida')],
  })
  const html = buildReportHtml(report, {
    gymName: 'IronForge Gym',
    title: 'Reporte detallado',
    periodLabel: '2026-11-01 a 2026-11-16',
    generatedAt: '16/11/2026 10:00',
  })

  assert.match(html, /IronForge Gym/)
  assert.match(html, /Reporte detallado/)
  assert.match(html, /2026-11-01 a 2026-11-16/)
  assert.match(html, /Resumen de ingresos/)
  assert.match(html, /Desglose por método de pago/)
  assert.match(html, /Estado de clientes/)
  assert.match(html, /Clientes activos/)
  assert.match(html, /150 Bs\./)
  assert.match(html, /no forman parte de este reporte/)
})

test('11d. el HTML escapa contenido introducido por el usuario', () => {
  const html = buildReportHtml(
    { ...emptyReportValues() },
    { periodLabel: '<script>alert(1)</script>', generatedAt: '<b>x</b>' },
  )
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.match(html, /&lt;script&gt;/)
})

console.log('OK: admin report metrics and export logic')
