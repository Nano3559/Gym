import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FINANCE_CSV_HEADER,
  PAYMENT_METHOD_NAMES,
  buildFinanceCsvRows,
  buildMovements,
  currentMonthBounds,
  dateKey,
  filterMovementsByPeriod,
  formatCsvAmount,
  formatMoney,
  normalizePayment,
  periodQueryBounds,
  resolveFinanceMode,
  summarizeMovements,
  toCents,
} from '../src/lib/financeMetrics.js'
import { fetchAllRows } from '../src/lib/financePagination.js'
import { downloadCsv } from '../src/lib/csv.js'

const payment = (overrides = {}) => ({
  id: 'p1',
  monto: 250,
  metodo_pago: 'efectivo',
  estado_pago: 'completado',
  created_at: '2026-03-10T15:00:00Z',
  transaction_id: 'tx-1',
  ...overrides,
})

const sale = (overrides = {}) => ({
  id: 's1',
  receipt_number: 'POS-1',
  total: 40,
  metodo_pago: 'qr',
  created_at: '2026-03-11T15:00:00Z',
  ...overrides,
})

const expense = (overrides = {}) => ({
  id: 'e1',
  concepto: 'Alquiler',
  categoria: 'Alquiler',
  monto: 100,
  metodo_pago: 'transferencia',
  created_at: '2026-03-12T15:00:00Z',
  ...overrides,
})

test('1. los pagos completados se incluyen', () => {
  const movement = normalizePayment(payment())
  assert.ok(movement)
  assert.equal(movement.type, 'Ingreso')
  assert.equal(movement.subtype, 'Membresía')
  assert.equal(movement.amountCents, 25000)
})

test('2. pagos pendientes, fallidos o expirados se excluyen', () => {
  for (const estado of ['pendiente', 'fallido', 'expirado', 'rechazado']) {
    assert.equal(normalizePayment(payment({ estado_pago: estado })), null, estado)
  }
})

test('3. membresías y POS se suman por separado', () => {
  const movements = buildMovements({
    payments: [payment()],
    posSales: [sale()],
    expenses: [],
  })
  const summary = summarizeMovements(movements)
  assert.equal(summary.membershipCents, 25000)
  assert.equal(summary.posCents, 4000)
  assert.equal(summary.incomeCents, 29000)
  assert.equal(summary.expenseCents, 0)
})

test('4. los egresos quedan separados de los ingresos', () => {
  const movements = buildMovements({
    payments: [payment()],
    posSales: [sale()],
    expenses: [expense()],
  })
  const summary = summarizeMovements(movements)
  assert.equal(summary.incomeCents, 29000)
  assert.equal(summary.expenseCents, 10000)
  assert.equal(summary.count, 3)
  assert.equal(movements.filter((movement) => movement.type === 'Egreso').length, 1)
})

test('5. ganancia neta positiva, cero y negativa', () => {
  const positive = summarizeMovements(buildMovements({
    payments: [payment({ monto: 300 })],
    expenses: [expense({ monto: 100 })],
  }))
  assert.equal(positive.netCents, 20000)

  const zero = summarizeMovements(buildMovements({
    payments: [payment({ monto: 100 })],
    expenses: [expense({ monto: 100 })],
  }))
  assert.equal(zero.netCents, 0)

  const negative = summarizeMovements(buildMovements({
    payments: [payment({ monto: 50 })],
    expenses: [expense({ monto: 100 })],
  }))
  assert.equal(negative.netCents, -5000)
})

test('6. el filtro de fechas es inclusivo en ambos extremos', () => {
  const movements = buildMovements({
    payments: [
      payment({ id: 'a', created_at: '2026-03-01T04:00:00Z' }),
      payment({ id: 'b', created_at: '2026-03-15T04:00:00Z' }),
      payment({ id: 'c', created_at: '2026-03-31T04:00:00Z' }),
      payment({ id: 'd', created_at: '2026-04-01T04:00:00Z' }),
    ],
  })
  const filtered = filterMovementsByPeriod(movements, '2026-03-01', '2026-03-31')
  assert.deepEqual(filtered.map((movement) => movement.reference).sort(), ['a', 'b', 'c'])
})

test('7. el cambio de mes y de año se calcula con la zona del gimnasio', () => {
  assert.equal(dateKey('2026-01-01T02:30:00Z'), '2025-12-31')
  assert.equal(dateKey('2026-01-01T04:30:00Z'), '2026-01-01')
  assert.deepEqual(periodQueryBounds('2026-12-01', '2026-12-31'), {
    start: '2026-12-01T00:00:00-04:00',
    end: '2027-01-01T00:00:00-04:00',
  })
  assert.deepEqual(currentMonthBounds(new Date('2026-12-15T12:00:00Z')), {
    from: '2026-12-01',
    to: '2026-12-31',
  })
  assert.deepEqual(currentMonthBounds(new Date('2026-02-10T12:00:00Z')), {
    from: '2026-02-01',
    to: '2026-02-28',
  })
})

test('8. los movimientos combinados se ordenan de más reciente a más antiguo', () => {
  const movements = buildMovements({
    payments: [payment({ id: 'p-old', created_at: '2026-03-01T12:00:00Z' })],
    posSales: [sale({ id: 's-new', created_at: '2026-03-20T12:00:00Z' })],
    expenses: [expense({ id: 'e-mid', created_at: '2026-03-10T12:00:00Z' })],
  })
  assert.deepEqual(movements.map((movement) => movement.reference), ['s-new', 'e-mid', 'p-old'])
})

test('9. los métodos de pago se etiquetan, incluido yape_plin', () => {
  assert.equal(PAYMENT_METHOD_NAMES.yape_plin, 'Yape/Plin')
  const movement = normalizePayment(payment({ metodo_pago: 'yape_plin' }))
  assert.equal(movement.methodLabel, 'Yape/Plin')
  const saleMovement = buildMovements({ posSales: [sale({ metodo_pago: 'tarjeta' })] })[0]
  assert.equal(saleMovement.methodLabel, 'Tarjeta')
})

test('10. cada movimiento expone un identificador fiable', () => {
  const movements = buildMovements({
    payments: [payment()],
    posSales: [sale()],
    expenses: [expense()],
  })
  assert.deepEqual(movements.map((movement) => movement.reference).sort(), ['e1', 'p1', 's1'])
  assert.ok(movements.every((movement) => movement.id.includes(':')))
})

test('11. se deduplica por identificador, no por monto ni fecha', () => {
  const duplicated = buildMovements({
    payments: [
      payment({ id: 'same' }),
      payment({ id: 'same' }),
    ],
  })
  assert.equal(duplicated.length, 1)

  const legitimate = buildMovements({
    expenses: [
      expense({ id: 'e1', monto: 75, created_at: '2026-03-10T12:00:00Z' }),
      expense({ id: 'e2', monto: 75, created_at: '2026-03-10T12:00:00Z' }),
    ],
  })
  assert.equal(legitimate.length, 2)
})

test('12. los importes se suman en centavos sin errores de coma flotante', () => {
  assert.equal(toCents(0.1) + toCents(0.2), 30)
  const summary = summarizeMovements(buildMovements({
    payments: [payment({ monto: 0.1 }), payment({ id: 'p2', monto: 0.2 })],
  }))
  assert.equal(summary.incomeCents, 30)
  assert.equal(formatCsvAmount(30), '0.30')
})

test('13. el CSV tiene exactamente siete columnas y conserva el identificador', () => {
  const movements = buildMovements({
    payments: [payment()],
    posSales: [sale()],
    expenses: [expense()],
  })
  const rows = buildFinanceCsvRows(movements)
  assert.deepEqual(rows[0], FINANCE_CSV_HEADER)
  assert.equal(rows.length, 4)
  for (const row of rows) assert.equal(row.length, 7)
  assert.equal(rows[0][0], 'Fecha')
  assert.equal(rows[0][6], 'Identificador')
  assert.ok(rows.slice(1).some((row) => row[6] === 'p1'))
  assert.ok(rows.slice(1).every((row) => /^\d{2}\/\d{2}\/\d{4}$/.test(row[0])))
})

test('14. downloadCsv escapa comas, comillas y agrega BOM', async () => {
  let captured = null
  const originalUrl = globalThis.URL
  const originalDocument = globalThis.document
  globalThis.URL = {
    createObjectURL: (blob) => { captured = blob; return 'blob:test' },
    revokeObjectURL: () => {},
  }
  globalThis.document = {
    createElement: () => ({ click() {}, remove() {} }),
    body: { append() {} },
  }
  try {
    downloadCsv('test.csv', [
      ['Concepto', 'Monto'],
      ['Alquiler, servicios "varios"', '1.00'],
    ])
    const content = new TextDecoder('utf-8', { ignoreBOM: true })
      .decode(await captured.arrayBuffer())
    assert.ok(content.startsWith('\uFEFF'))
    assert.ok(content.includes('"Alquiler, servicios ""varios"""'))
  } finally {
    globalThis.URL = originalUrl
    globalThis.document = originalDocument
  }
})

test('15. la paginación recorre todas las filas en bloques de 1000', async () => {
  const rows = Array.from({ length: 2500 }, (_, index) => ({ id: index }))
  let calls = 0
  const result = await fetchAllRows(() => ({
    range: async (start, end) => {
      calls += 1
      return { data: rows.slice(start, end + 1), error: null }
    },
  }))
  assert.equal(result.length, 2500)
  assert.equal(calls, 3)
})

test('16. un error en una página invalida toda la consulta', async () => {
  const rows = Array.from({ length: 1500 }, (_, index) => ({ id: index }))
  let calls = 0
  await assert.rejects(
    () => fetchAllRows(() => {
      const page = calls
      calls += 1
      return {
        range: async (start, end) => (page === 0
          ? { data: rows.slice(start, end + 1), error: null }
          : { data: null, error: new Error('fallo de red') }),
      }
    }),
    /fallo de red/,
  )
})

test('17. el modo local solo se usa sin Supabase configurado', () => {
  assert.equal(resolveFinanceMode({ configured: false, hasSession: false }), 'local')
  assert.equal(resolveFinanceMode({ configured: true, hasSession: false }), 'auth-required')
  assert.equal(resolveFinanceMode({ configured: true, hasSession: true }), 'remote')
})

test('18. los indicadores usan — cuando no hay valor', () => {
  assert.equal(formatMoney(null), '—')
  assert.equal(formatMoney(undefined), '—')
  assert.match(formatMoney(12345), /Bs\.$/)
})
