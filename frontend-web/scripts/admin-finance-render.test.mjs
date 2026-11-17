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

const { default: AdminFinanceReports } = await server.ssrLoadModule('/src/components/admin/AdminFinanceReports.jsx')
const {
  addDays,
  currentMonthBounds,
  formatMoney,
} = await server.ssrLoadModule('/src/lib/financeMetrics.js')

const { from: monthFrom } = currentMonthBounds()
const dayOne = monthFrom
const dayTwo = addDays(monthFrom, 1)

const timestamp = (dateKeyValue) => `${dateKeyValue}T15:00:00-04:00`

function matches(filter, row) {
  const value = row[filter.col]
  if (filter.op === 'eq') return value === filter.val
  const rowTime = new Date(value).getTime()
  const filterTime = new Date(filter.val).getTime()
  if (filter.op === 'gte') return rowTime >= filterTime
  if (filter.op === 'lt') return rowTime < filterTime
  return true
}

function makeClient({ rows = {}, session = { user: { id: 'admin-1' } }, failures = {}, pendingSession = false } = {}) {
  const inserted = []
  const dataset = {
    payments: [],
    pos_sales: [],
    operating_expenses: [],
    ...rows,
  }
  const client = {
    auth: {
      getSession: pendingSession
        ? () => new Promise(() => {})
        : async () => ({ data: { session }, error: null }),
    },
    from(table) {
      const filters = []
      const query = {
        select: () => query,
        eq: (col, val) => { filters.push({ op: 'eq', col, val }); return query },
        gte: (col, val) => { filters.push({ op: 'gte', col, val }); return query },
        lt: (col, val) => { filters.push({ op: 'lt', col, val }); return query },
        order: () => query,
        insert: async (payload) => {
          if (failures[table]) return { error: new Error(`fallo al insertar en ${table}`) }
          inserted.push({ table, payload })
          dataset[table].push({
            id: `nuevo-${inserted.length}`,
            created_at: new Date().toISOString(),
            ...payload,
          })
          return { error: null }
        },
        range: async (start, end) => {
          if (failures[table]) return { data: null, error: new Error(`fallo de consulta en ${table}`) }
          const filtered = dataset[table].filter((row) => filters.every((filter) => matches(filter, row)))
          return { data: filtered.slice(start, end + 1), error: null }
        },
      }
      return query
    },
  }
  return { client, inserted, dataset }
}

function fakeStorage(entries = {}) {
  const data = new Map(Object.entries(entries))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  }
}

function nodeText(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  return nodeText(node.children)
}

async function flush(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function mount(source, { onToast } = {}) {
  let renderer
  await act(async () => {
    renderer = create(React.createElement(AdminFinanceReports, { onToast, financeSource: source }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  return renderer
}

function textOf(renderer) {
  return nodeText(renderer.toJSON())
}

function findButton(renderer, label) {
  return renderer.root.findAllByType('button').find((button) => nodeText(button).includes(label))
}

function findInput(renderer, ariaLabel) {
  return renderer.root.findAllByType('input').find((input) => input.props['aria-label'] === ariaLabel)
}

function findSelect(renderer, ariaLabel) {
  return renderer.root.findAllByType('select').find((select) => select.props['aria-label'] === ariaLabel)
}

const readyRows = () => ({
  payments: [{
    id: 'p1',
    monto: 250,
    metodo_pago: 'efectivo',
    estado_pago: 'completado',
    created_at: timestamp(dayOne),
    transaction_id: 'tx-1',
  }],
  pos_sales: [{
    id: 's1',
    receipt_number: 'POS-1',
    total: 40,
    metodo_pago: 'qr',
    created_at: timestamp(dayOne),
  }],
  operating_expenses: [{
    id: 'e1',
    concepto: 'Alquiler',
    categoria: 'Alquiler',
    monto: 100,
    metodo_pago: 'transferencia',
    created_at: timestamp(dayTwo),
  }],
})

test('1. estado de carga: sin ceros definitivos y exportación deshabilitada', async () => {
  const { client } = makeClient({ pendingSession: true })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
  try {
    const text = textOf(renderer)
    assert.match(text, /Cargando movimientos financieros/)
    assert.ok(text.includes('—'))
    assert.equal(renderer.root.findAllByType('table').length, 0)
    const exportButton = findButton(renderer, 'Exportar CSV')
    assert.ok(exportButton)
    assert.equal(exportButton.props.disabled, true)
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('2. error persistente: mensaje visible, sin tablas y exportación deshabilitada', async () => {
  const { client } = makeClient({ rows: readyRows(), failures: { payments: true } })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
  try {
    const alerts = renderer.root.findAll((node) => node.props?.role === 'alert')
    assert.ok(alerts.length >= 1)
    assert.match(textOf(renderer), /No se pudieron cargar los movimientos financieros/)
    assert.equal(renderer.root.findAllByType('table').length, 0)
    assert.ok(textOf(renderer).includes('—'))
    assert.equal(findButton(renderer, 'Exportar CSV').props.disabled, true)
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('3. estado vacío válido: ceros reales, tablas visibles y exportación habilitada', async () => {
  const { client } = makeClient({ rows: {} })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
  try {
    const text = textOf(renderer)
    assert.ok(text.includes(formatMoney(0)))
    assert.match(text, /Sin movimientos para el período/)
    assert.equal(renderer.root.findAllByType('table').length, 2)
    assert.equal(findButton(renderer, 'Exportar CSV').props.disabled, false)
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('4. totales correctos: membresías + POS − egresos', async () => {
  const { client } = makeClient({ rows: readyRows() })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
  try {
    const text = textOf(renderer)
    assert.ok(text.includes(formatMoney(29000)), 'ingresos')
    assert.ok(text.includes(formatMoney(10000)), 'egresos')
    assert.ok(text.includes(formatMoney(19000)), 'neto')
    assert.match(text, /Membresías/)
    assert.match(text, /POS/)
    assert.match(text, /Membresía/)
    assert.match(text, /Venta POS/)
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('5. el cambio de fechas recalcula los totales con el rango del servidor', async () => {
  const { client, dataset } = makeClient({ rows: readyRows() })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
  try {
    const dateInputs = renderer.root.findAllByType('input').filter((input) => input.props.type === 'date')
    assert.equal(dateInputs.length, 2)
    await act(async () => {
      dateInputs[1].props.onChange({ target: { value: dayOne } })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await flush()
    const text = textOf(renderer)
    assert.ok(text.includes(formatMoney(29000)), 'solo ingresos del día uno')
    assert.ok(text.includes(formatMoney(0)), 'sin egresos del día dos')
    assert.equal(dataset.operating_expenses.length, 1)
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('6. registrar egreso guarda el método elegido y refresca los totales', async () => {
  const { client, inserted } = makeClient({ rows: readyRows() })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
  try {
    const methodSelect = findSelect(renderer, 'Método de pago')
    assert.ok(methodSelect)
    await act(async () => {
      methodSelect.props.onChange({ target: { value: 'yape_plin' } })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      findInput(renderer, 'Concepto').props.onChange({ target: { value: 'Luz' } })
      findInput(renderer, 'Monto').props.onChange({ target: { value: '35.50' } })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => {
      renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await flush(6)
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].table, 'operating_expenses')
    assert.equal(inserted[0].payload.metodo_pago, 'yape_plin')
    assert.equal(inserted[0].payload.concepto, 'Luz')
    assert.equal(inserted[0].payload.monto, 35.5)
    assert.ok(textOf(renderer).includes(formatMoney(13550)), 'egresos actualizados')
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('7. el CSV detallado tiene siete columnas y solo el período', async () => {
  const { client } = makeClient({ rows: readyRows() })
  const renderer = await mount({ configured: true, client, storage: fakeStorage() })
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
    await act(async () => {
      findButton(renderer, 'Exportar CSV').props.onClick()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const content = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await captured.arrayBuffer())
    const lines = content.split('\r\n')
    assert.equal(
      lines[0],
      '\uFEFFFecha,Tipo,Concepto,Categoría,Método de pago,Monto,Identificador',
    )
    assert.equal(lines.length, 4)
    for (const line of lines.slice(1)) {
      assert.equal(line.split(',').length, 7, line)
    }
    assert.ok(lines.some((line) => line.includes('p1')))
    assert.ok(lines.some((line) => line.includes('s1')))
    assert.ok(lines.some((line) => line.includes('e1')))
  } finally {
    await act(async () => { renderer.unmount() })
    globalThis.URL = originalUrl
    globalThis.document = originalDocument
  }
})

test('8. sin sesión no se presentan datos locales ni ceros como reales', async () => {
  const storage = fakeStorage({
    gym_pos_sales: JSON.stringify([{
      id: 'local-sale',
      total: 999,
      metodoPago: 'efectivo',
      createdAt: timestamp(dayOne),
    }]),
    gym_reception_expenses: JSON.stringify([{
      id: 'local-expense',
      concepto: 'Gasto local oculto',
      categoria: 'Otros',
      monto: 500,
      metodoPago: 'efectivo',
      createdAt: timestamp(dayOne),
    }]),
  })
  const { client } = makeClient({ rows: {}, session: null })
  const renderer = await mount({ configured: true, client, storage })
  try {
    const text = textOf(renderer)
    assert.match(text, /Sesión no disponible/)
    assert.ok(!text.includes('Gasto local oculto'))
    assert.ok(!text.includes('Venta POS'))
    assert.equal(renderer.root.findAllByType('table').length, 0)
    assert.equal(renderer.root.findAllByType('form').length, 0)
    assert.equal(findButton(renderer, 'Exportar CSV').props.disabled, true)
    assert.ok(text.includes('—'))
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

test('9. el modo local legítimo se identifica y se separa de los datos reales', async () => {
  const storage = fakeStorage({
    gym_pos_sales: JSON.stringify([{
      id: 'local-sale',
      total: 60,
      metodoPago: 'efectivo',
      createdAt: timestamp(dayOne),
    }]),
    gym_reception_expenses: JSON.stringify([{
      id: 'local-expense',
      concepto: 'Insumos locales',
      categoria: 'Insumos',
      monto: 20,
      metodoPago: 'efectivo',
      createdAt: timestamp(dayOne),
    }]),
  })
  const renderer = await mount({ configured: false, client: null, storage })
  try {
    const text = textOf(renderer)
    assert.match(text, /Modo local/)
    assert.match(text, /Insumos locales/)
    assert.ok(text.includes(formatMoney(6000)))
    assert.ok(text.includes(formatMoney(4000)))
  } finally {
    await act(async () => { renderer.unmount() })
  }
})

await server.close()
