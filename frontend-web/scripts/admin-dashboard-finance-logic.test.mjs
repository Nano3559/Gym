import assert from 'node:assert/strict'
import test from 'node:test'
import {
  currentMonthBounds,
  periodQueryBounds,
} from '../src/lib/financeMetrics.js'
import {
  buildDashboardFinanceSnapshot,
  previousMonthBounds,
  summarizeFinancePeriod,
} from '../src/lib/dashboardFinanceMetrics.js'

const payment = (overrides = {}) => ({
  id: 'p1',
  monto: 250,
  metodo_pago: 'efectivo',
  estado_pago: 'completado',
  created_at: '2026-03-10T15:00:00-04:00',
  transaction_id: 'tx-1',
  user_id: 'u1',
  ...overrides,
})

const sale = (overrides = {}) => ({
  id: 's1',
  receipt_number: 'POS-1',
  total: 40,
  metodo_pago: 'qr',
  created_at: '2026-03-11T15:00:00-04:00',
  ...overrides,
})

const expense = (overrides = {}) => ({
  id: 'e1',
  concepto: 'Alquiler',
  categoria: 'Alquiler',
  monto: 100,
  metodo_pago: 'transferencia',
  created_at: '2026-03-12T15:00:00-04:00',
  ...overrides,
})

test('1. el mes anterior a enero pertenece a diciembre del año anterior', () => {
  assert.deepEqual(previousMonthBounds(new Date('2026-01-15T12:00:00Z')), {
    from: '2025-12-01',
    to: '2025-12-31',
  })
})

test('2. diciembre se calcula como mes anterior de enero del año siguiente', () => {
  assert.deepEqual(previousMonthBounds(new Date('2027-01-01T12:00:00Z')), {
    from: '2026-12-01',
    to: '2026-12-31',
  })
})

test('3. febrero respeta años bisiestos y no bisiestos', () => {
  assert.deepEqual(previousMonthBounds(new Date('2028-03-10T12:00:00Z')), {
    from: '2028-02-01',
    to: '2028-02-29',
  })
  assert.deepEqual(previousMonthBounds(new Date('2027-03-10T12:00:00Z')), {
    from: '2027-02-01',
    to: '2027-02-28',
  })
})

test('4. los límites del período usan la zona fija de Bolivia (-04:00)', () => {
  const previous = previousMonthBounds(new Date('2026-03-15T12:00:00Z'))
  assert.deepEqual(periodQueryBounds(previous.from, previous.to), {
    start: '2026-02-01T00:00:00-04:00',
    end: '2026-03-01T00:00:00-04:00',
  })
  // 01:30 UTC del 1 de marzo sigue siendo 28 de febrero en Bolivia.
  assert.equal(currentMonthBounds(new Date('2026-03-01T01:30:00Z')).from, '2026-02-01')
})

test('5. los ingresos suman membresías y ventas POS', () => {
  const summary = summarizeFinancePeriod({
    payments: [payment()],
    posSales: [sale()],
    expenses: [],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(summary.membershipCents, 25000)
  assert.equal(summary.posCents, 4000)
  assert.equal(summary.incomeCents, 29000)
  assert.equal(summary.income, 290)
  assert.equal(summary.expenseCents, 0)
})

test('6. los egresos quedan separados y el neto se calcula correctamente', () => {
  const summary = summarizeFinancePeriod({
    payments: [payment()],
    posSales: [sale()],
    expenses: [expense()],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(summary.incomeCents, 29000)
  assert.equal(summary.expenseCents, 10000)
  assert.equal(summary.netCents, 19000)
  assert.equal(summary.net, 190)
})

test('7. los importes se suman en centavos sin errores de coma flotante', () => {
  const summary = summarizeFinancePeriod({
    payments: [
      payment({ id: 'p1', monto: 0.1 }),
      payment({ id: 'p2', monto: 0.2 }),
    ],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(summary.incomeCents, 30)
  assert.equal(summary.income, 0.3)
})

test('8. solo los pagos completados cuentan como ingreso', () => {
  const completed = summarizeFinancePeriod({
    payments: [payment()],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(completed.incomeCents, 25000)

  const pending = summarizeFinancePeriod({
    payments: [payment({ estado_pago: 'pendiente' })],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(pending.incomeCents, 0)
  assert.equal(pending.count, 0)
})

test('9. la deduplicación es por identificador y conserva movimientos legítimos', () => {
  const duplicated = summarizeFinancePeriod({
    payments: [payment({ id: 'same' }), payment({ id: 'same' })],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(duplicated.count, 1)

  const legitimate = summarizeFinancePeriod({
    expenses: [
      expense({ id: 'e1', monto: 75 }),
      expense({ id: 'e2', monto: 75 }),
    ],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(legitimate.count, 2)
  assert.equal(legitimate.expenseCents, 15000)
})

test('10. el filtro del período es inclusivo con fechas locales de Bolivia', () => {
  const summary = summarizeFinancePeriod({
    payments: [
      payment({ id: 'in-start', created_at: '2026-02-01T00:00:00-04:00' }),
      payment({ id: 'in-end', created_at: '2026-02-28T23:30:00-04:00' }),
      payment({ id: 'out-march', created_at: '2026-03-01T00:30:00-04:00' }),
      payment({ id: 'out-january', created_at: '2026-01-31T23:30:00-04:00' }),
    ],
    from: '2026-02-01',
    to: '2026-02-28',
  })
  assert.equal(summary.count, 2)
  assert.deepEqual(
    summary.incomeCents,
    50000,
  )
})

test('11. un período válido sin movimientos produce ceros reales', () => {
  const summary = summarizeFinancePeriod({
    payments: [],
    posSales: [],
    expenses: [],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(summary.incomeCents, 0)
  assert.equal(summary.expenseCents, 0)
  assert.equal(summary.netCents, 0)
  assert.equal(summary.count, 0)

  const snapshot = buildDashboardFinanceSnapshot({ current: summary, previous: summary })
  assert.equal(snapshot.currentIncome, 0)
  assert.equal(snapshot.previousIncome, 0)
  assert.equal(snapshot.currentExpenses, 0)
  assert.equal(snapshot.currentNet, 0)
  assert.equal(snapshot.currentIncomeCents, 0)
})

test('12. un período no disponible queda en null y nunca se convierte en cero', () => {
  const snapshot = buildDashboardFinanceSnapshot({})
  assert.equal(snapshot.currentIncome, null)
  assert.equal(snapshot.previousIncome, null)
  assert.equal(snapshot.currentExpenses, null)
  assert.equal(snapshot.previousExpenses, null)
  assert.equal(snapshot.currentNet, null)
  assert.equal(snapshot.currentIncomeCents, null)
  assert.equal(snapshot.previousNetCents, null)

  const zero = summarizeFinancePeriod({})
  const withZero = buildDashboardFinanceSnapshot({ current: zero })
  assert.equal(withZero.currentIncome, 0)
  assert.equal(withZero.previousIncome, null)
})

test('13. la instantánea compara mes actual y anterior en centavos y Bs.', () => {
  const current = summarizeFinancePeriod({
    payments: [payment({ monto: 300 })],
    expenses: [expense({ monto: 100 })],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  const previous = summarizeFinancePeriod({
    payments: [payment({ id: 'p-old', monto: 200, created_at: '2026-02-10T15:00:00-04:00' })],
    expenses: [expense({ id: 'e-old', monto: 50, created_at: '2026-02-10T15:00:00-04:00' })],
    from: '2026-02-01',
    to: '2026-02-28',
  })
  const snapshot = buildDashboardFinanceSnapshot({ current, previous })
  assert.equal(snapshot.currentIncomeCents, 30000)
  assert.equal(snapshot.previousIncomeCents, 20000)
  assert.equal(snapshot.currentExpenseCents, 10000)
  assert.equal(snapshot.previousExpenseCents, 5000)
  assert.equal(snapshot.currentNetCents, 20000)
  assert.equal(snapshot.previousNetCents, 15000)
  assert.equal(snapshot.currentIncome, 300)
  assert.equal(snapshot.previousIncome, 200)
  assert.equal(snapshot.currentExpenses, 100)
  assert.equal(snapshot.previousExpenses, 50)
  assert.equal(snapshot.currentNet, 200)
  assert.equal(snapshot.previousNet, 150)
})

test('14. el neto puede ser positivo, cero o negativo sin perder precisión', () => {
  const positive = summarizeFinancePeriod({
    payments: [payment({ monto: 300 })],
    expenses: [expense({ monto: 100 })],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(positive.netCents, 20000)

  const zero = summarizeFinancePeriod({
    payments: [payment({ monto: 100 })],
    expenses: [expense({ monto: 100 })],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(zero.netCents, 0)

  const negative = summarizeFinancePeriod({
    payments: [payment({ monto: 50 })],
    expenses: [expense({ monto: 100 })],
    from: '2026-03-01',
    to: '2026-03-31',
  })
  assert.equal(negative.netCents, -5000)
  assert.equal(negative.net, -50)
})
