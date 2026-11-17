import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const server = await createServer({
  configFile: 'vite.config.js',
  server: { middlewareMode: true },
  appType: 'custom',
})

const { default: AdminDashboard } = await server.ssrLoadModule('/src/components/admin/AdminDashboard.jsx')
const { addDays, currentMonthBounds } = await server.ssrLoadModule('/src/lib/financeMetrics.js')
const { previousMonthBounds } = await server.ssrLoadModule('/src/lib/dashboardFinanceMetrics.js')

const current = currentMonthBounds()
const previous = previousMonthBounds()
const dayOne = current.from
const dayTwo = addDays(current.from, 1)
const previousDay = previous.from

const timestamp = (dateKeyValue) => `${dateKeyValue}T15:00:00-04:00`

function matches(filter, row) {
  const value = row[filter.col]
  if (filter.op === 'eq') return value === filter.val
  const rowTime = new Date(value).getTime()
  const filterTime = new Date(filter.val).getTime()
  if (filter.op === 'gte') return rowTime >= filterTime
  if (filter.op === 'lt') return rowTime < filterTime
  if (filter.op === 'lte') return rowTime <= filterTime
  return true
}

function makeClient({
  rows = {},
  session = { user: { id: 'admin-1' } },
  failures = {},
  pendingSession = false,
} = {}) {
  const calls = []
  const dataset = {
    payments: [],
    pos_sales: [],
    operating_expenses: [],
    profiles: [],
    memberships: [],
    ...rows,
  }
  const client = {
    auth: {
      getSession: pendingSession
        ? () => new Promise(() => {})
        : async () => ({ data: { session }, error: null }),
    },
    from(table) {
      calls.push(table)
      const filters = []
      const query = {
        select: () => query,
        eq: (col, val) => { filters.push({ op: 'eq', col, val }); return query },
        gte: (col, val) => { filters.push({ op: 'gte', col, val }); return query },
        lt: (col, val) => { filters.push({ op: 'lt', col, val }); return query },
        lte: (col, val) => { filters.push({ op: 'lte', col, val }); return query },
        order: () => query,
        range: async (start, end) => {
          if (failures[table]) {
            return { data: null, error: new Error(`fallo de consulta en ${table}`) }
          }
          const filtered = dataset[table].filter((row) => filters.every((filter) => matches(filter, row)))
          return { data: filtered.slice(start, end + 1), error: null }
        },
      }
      return query
    },
  }
  return { client, calls, failures, dataset }
}

function readyRows() {
  return {
    payments: [
      {
        id: 'p1',
        monto: 250,
        metodo_pago: 'efectivo',
        estado_pago: 'completado',
        created_at: timestamp(dayOne),
        transaction_id: 'tx-1',
        user_id: 'u1',
      },
      {
        id: 'p2',
        monto: 200,
        metodo_pago: 'efectivo',
        estado_pago: 'completado',
        created_at: timestamp(previousDay),
        transaction_id: 'tx-2',
        user_id: 'u3',
      },
      {
        id: 'p3',
        monto: 999,
        metodo_pago: 'efectivo',
        estado_pago: 'pendiente',
        created_at: timestamp(dayTwo),
        transaction_id: 'tx-3',
        user_id: 'u9',
      },
    ],
    pos_sales: [
      {
        id: 's1',
        receipt_number: 'POS-1',
        total: 40,
        metodo_pago: 'qr',
        created_at: timestamp(dayTwo),
      },
    ],
    operating_expenses: [
      {
        id: 'e1',
        concepto: 'Alquiler',
        categoria: 'Alquiler',
        monto: 100,
        metodo_pago: 'transferencia',
        created_at: timestamp(dayTwo),
      },
      {
        id: 'e2',
        concepto: 'Servicios',
        categoria: 'Servicios',
        monto: 50,
        metodo_pago: 'transferencia',
        created_at: timestamp(previousDay),
      },
    ],
    profiles: [
      { id: 'u1', created_at: timestamp(dayOne) },
      { id: 'u4', created_at: timestamp(dayTwo) },
      { id: 'old-profile', created_at: timestamp(previousDay) },
    ],
    memberships: [
      { user_id: 'u1', fecha_vencimiento: timestamp(dayOne) },
      { user_id: 'u2', fecha_vencimiento: timestamp(dayTwo) },
      { user_id: 'old-member', fecha_vencimiento: timestamp(previousDay) },
    ],
  }
}

function nodeText(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  return nodeText(node.children)
}

async function flush(times = 5) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function mount(props) {
  let renderer
  await act(async () => {
    renderer = create(React.createElement(AdminDashboard, props))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  return renderer
}

function textOf(renderer) {
  return nodeText(renderer.toJSON())
}

function kpiValue(renderer, label) {
  const cards = renderer.root.findAll(
    (node) => node.type === 'div'
      && node.props?.className === 'rounded-2xl border border-line bg-surface p-5',
  )
  const card = cards.find((node) => nodeText(node).includes(label))
  assert.ok(card, `no se encontró la tarjeta KPI «${label}»`)
  const value = card.findAllByType('p')
    .find((node) => node.props?.className?.includes('font-display text-2xl'))
  assert.ok(value, `no se encontró el valor de «${label}»`)
  return nodeText(value)
}

function findButton(renderer, label) {
  return renderer.root.findAllByType('button').find((button) => nodeText(button).includes(label))
}

function alertNodes(renderer) {
  return renderer.root.findAll((node) => node.props?.role === 'alert')
}

async function clickRetry(renderer) {
  await act(async () => {
    findButton(renderer, 'Reintentar').props.onClick()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
}

test('1. durante la carga no se muestra el fallback 24.850 ni ceros definitivos', async () => {
  const { client } = makeClient({ pendingSession: true })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '—')
    assert.ok(!text.includes('24.850'))
    assert.match(text, /Cargando ingresos/)
    assert.ok(text.includes('—'))
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('2. un error inicial deja todos los importes en — y muestra un banner persistente', async () => {
  const { client } = makeClient({ failures: { payments: true } })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    assert.ok(alertNodes(renderer).length >= 1)
    assert.match(text, /No se pudieron cargar los indicadores financieros/)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '—')
    assert.ok(!text.includes('24.850'))
    assert.ok(text.includes('Sin datos financieros válidos'))
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('3. un error posterior invalida los importes antes visibles', async () => {
  const source = makeClient({ rows: readyRows() })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client: source.client } })
  try {
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '290 Bs.')
    source.failures.payments = true
    await act(async () => {
      findButton(renderer, 'Actualizar').props.onClick()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await flush()
    const text = textOf(renderer)
    assert.ok(alertNodes(renderer).length >= 1)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '—')
    assert.ok(!text.includes('290 Bs.'), 'no debe conservar cifras obsoletas')
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('4. sin sesión se avisa y no se consultan datos financieros', async () => {
  const { client, calls } = makeClient({ session: null })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    assert.match(text, /Sesión no disponible/)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '—')
    assert.ok(!text.includes('24.850'))
    assert.deepEqual(calls, [])
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('5. un período vacío es un cero real, no un error', async () => {
  const { client } = makeClient({ rows: {} })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '0 Bs.')
    assert.equal(kpiValue(renderer, 'Nuevas Altas este Mes'), '0')
    assert.equal(kpiValue(renderer, 'Bajas / No Renovaciones'), '0')
    assert.equal(alertNodes(renderer).length, 0)
    assert.ok(text.includes('0 Bs.'))
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('6. ingresos, egresos, neto y personas se calculan con los datos reales', async () => {
  const { client } = makeClient({ rows: readyRows() })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '290 Bs.')
    assert.equal(kpiValue(renderer, 'Nuevas Altas este Mes'), '2')
    assert.equal(kpiValue(renderer, 'Bajas / No Renovaciones'), '1')
    assert.ok(text.includes('200 Bs.'), 'mes anterior')
    assert.ok(text.includes('100 Bs.'), 'egresos')
    assert.ok(text.includes('190 Bs.'), 'neto')
    assert.ok(!text.includes('24.850'))
    assert.ok(!text.includes('999 Bs.'), 'los pagos pendientes no suman')
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('7. un fallo de perfiles no oculta los importes financieros', async () => {
  const { client } = makeClient({ rows: readyRows(), failures: { profiles: true } })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '290 Bs.')
    assert.equal(kpiValue(renderer, 'Nuevas Altas este Mes'), '—')
    assert.equal(kpiValue(renderer, 'Bajas / No Renovaciones'), '—')
    assert.match(text, /altas y bajas de socios/)
    assert.match(text, /Los importes financieros sí están disponibles/)
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('8. reintentar recupera los datos tras un error', async () => {
  const source = makeClient({ rows: readyRows(), failures: { payments: true } })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client: source.client } })
  try {
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '—')
    source.failures.payments = false
    await clickRetry(renderer)
    assert.equal(alertNodes(renderer).length, 0)
    assert.equal(kpiValue(renderer, 'Ingresos del Mes'), '290 Bs.')
    assert.equal(kpiValue(renderer, 'Nuevas Altas este Mes'), '2')
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('9. los indicadores no financieros se conservan', async () => {
  const { client } = makeClient({ rows: readyRows() })
  const renderer = await mount({ isAdmin: true, financeSource: { configured: true, client } })
  try {
    const text = textOf(renderer)
    for (const label of [
      'Socios Activos',
      'Membresías por Vencer',
      'Reservas del Día',
      'Clases más concurridas',
      'Clases de hoy',
      'Centro de alertas',
      'Accesos directos',
    ]) {
      assert.ok(text.includes(label), `falta «${label}»`)
    }
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('10. un usuario no administrador mantiene su vista y no consulta finanzas', async () => {
  const { client, calls } = makeClient({ rows: readyRows() })
  const renderer = await mount({
    isAdmin: false,
    incomeToday: 75,
    financeSource: { configured: true, client },
  })
  try {
    const text = textOf(renderer)
    assert.ok(text.includes('Ingresos del Turno'))
    assert.ok(text.includes('75 Bs.'))
    assert.ok(!text.includes('Ingresos del Mes'))
    assert.ok(!text.includes('Tendencia de ingresos'))
    assert.deepEqual(calls, [])
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

await server.close()
