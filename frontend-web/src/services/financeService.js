// Acceso a datos del módulo de Finanzas.
//
// - Lee `payments`, `pos_sales` y `operating_expenses` con paginación explícita
//   y rango de fechas aplicado en el servidor.
// - Cualquier error de página invalida la consulta completa: nunca devuelve
//   totales parciales.
// - El modo local (sin Supabase configurado) queda aislado en funciones
//   propias y solo se usa cuando no existe backend.

import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/financePagination'
import { periodQueryBounds } from '../lib/financeMetrics'

const PAYMENT_COLUMNS = 'id, monto, metodo_pago, estado_pago, created_at, transaction_id'
const POS_SALE_COLUMNS = 'id, receipt_number, total, metodo_pago, created_at'
const EXPENSE_COLUMNS = 'id, concepto, categoria, monto, metodo_pago, created_at'

export const LOCAL_SALES_KEY = 'gym_pos_sales'
export const LOCAL_EXPENSES_KEY = 'gym_reception_expenses'

export const defaultFinanceSource = {
  configured: isSupabaseConfigured,
  client: supabase,
}

export async function hasFinanceSession(client) {
  if (!client?.auth?.getSession) return false
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return Boolean(data?.session)
}

// Consulta paginada de las tres fuentes, independientes entre sí.
// Si una falla, Promise.all rechaza y no se entrega ningún subconjunto.
export async function fetchFinanceRows({ from, to, client = supabase } = {}) {
  if (!client) throw new Error('Supabase no está configurado para leer finanzas.')
  const bounds = periodQueryBounds(from, to)
  if (!bounds) throw new Error('El rango de fechas no es válido.')

  const [payments, posSales, expenses] = await Promise.all([
    fetchAllRows(() => client
      .from('payments')
      .select(PAYMENT_COLUMNS)
      .eq('estado_pago', 'completado')
      .gte('created_at', bounds.start)
      .lt('created_at', bounds.end)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })),
    fetchAllRows(() => client
      .from('pos_sales')
      .select(POS_SALE_COLUMNS)
      .gte('created_at', bounds.start)
      .lt('created_at', bounds.end)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })),
    fetchAllRows(() => client
      .from('operating_expenses')
      .select(EXPENSE_COLUMNS)
      .gte('created_at', bounds.start)
      .lt('created_at', bounds.end)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })),
  ])

  return { payments, posSales, expenses }
}

export async function insertFinanceExpense(payload, client = supabase) {
  if (!client) throw new Error('No hay conexión con la base de datos.')
  const { error } = await client.from('operating_expenses').insert({
    concepto: String(payload.concepto || '').trim(),
    categoria: payload.categoria,
    monto: Number(payload.monto),
    metodo_pago: payload.metodo_pago,
  })
  if (error) throw error
}

function readLocalArray(storage, key) {
  if (!storage) return []
  const raw = storage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Modo local legítimo: solo se usa cuando no hay Supabase configurado.
// Normaliza las claves locales a los nombres reales de la base.
export function readLocalFinanceData(storage = globalThis.window?.localStorage) {
  const sales = readLocalArray(storage, LOCAL_SALES_KEY).map((sale) => ({
    id: sale.id,
    total: sale.total,
    metodo_pago: sale.metodo_pago || sale.metodoPago,
    created_at: sale.created_at || sale.createdAt,
  }))
  const expenses = readLocalArray(storage, LOCAL_EXPENSES_KEY).map((expense) => ({
    id: expense.id,
    concepto: expense.concepto,
    categoria: expense.categoria,
    monto: expense.monto,
    metodo_pago: expense.metodo_pago || expense.metodoPago,
    created_at: expense.created_at || expense.createdAt,
  }))
  return { payments: [], posSales: sales, expenses }
}

export function appendLocalFinanceExpense(payload, storage = globalThis.window?.localStorage) {
  if (!storage) throw new Error('El almacenamiento local no está disponible.')
  const rows = readLocalArray(storage, LOCAL_EXPENSES_KEY)
  const saved = {
    id: globalThis.crypto?.randomUUID?.() || `local-${Date.now()}`,
    concepto: String(payload.concepto || '').trim(),
    categoria: payload.categoria,
    monto: Number(payload.monto),
    metodo_pago: payload.metodo_pago,
    createdAt: new Date().toISOString(),
  }
  storage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify([saved, ...rows]))
  return saved
}
