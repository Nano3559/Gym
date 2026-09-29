import { useCallback, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, shiftDate } from '../data/adminData'
import { weeklyClasses } from '../data/gymData'
import { getMembershipStatus } from '../lib/membershipStatus'
import { appendCashOperation, getCashOperations } from '../services/receptionCashService'

export const METHOD_KEYS = ['efectivo', 'qr', 'transferencia', 'tarjeta']

export const METHOD_NAMES = {
  efectivo: 'Efectivo',
  qr: 'QR',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

const PAY_METHODS = ['qr', 'efectivo', 'transferencia', 'tarjeta']
const CLIENT_NAMES = [
  'Carlos Pérez',
  'María López',
  'Jorge Ramírez',
  'Ana Torres',
  'Luis Fernández',
  'Romina Gutiérrez',
  'Diego Vargas',
]
const PLAN_PRICES = [180, 240, 300]

// Pagos semilla distribuidos en los últimos 40 días para los reportes.
function buildSeedPayments() {
  const payments = []
  for (let d = 0; d < 40; d += 1) {
    const count = 2 + ((d * 7) % 4)
    for (let i = 0; i < count; i += 1) {
      payments.push({
        id: `pay-${d}-${i}`,
        fecha: shiftDate(-d),
        metodo: PAY_METHODS[(d + i) % PAY_METHODS.length],
        monto: PLAN_PRICES[(d + i) % PLAN_PRICES.length],
        cliente: CLIENT_NAMES[(d + i) % CLIENT_NAMES.length],
      })
    }
  }
  // Pagos de hoy para que el rango "Hoy" tenga datos.
  payments.push(
    { id: 'pay-today-1', fecha: shiftDate(0), metodo: 'efectivo', monto: 240, cliente: 'María López' },
    { id: 'pay-today-2', fecha: shiftDate(0), metodo: 'qr', monto: 300, cliente: 'Luis Fernández' },
    { id: 'pay-today-3', fecha: shiftDate(0), metodo: 'tarjeta', monto: 180, cliente: 'Romina Gutiérrez' },
    { id: 'pay-today-4', fecha: shiftDate(0), metodo: 'transferencia', monto: 240, cliente: 'Diego Vargas' }
  )
  return payments
}

const SEED_PAYMENTS = buildSeedPayments()

function fmtInt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtMoney(n) {
  return `${fmtInt(n)} Bs.`
}

/**
 * Datos para los reportes del panel administrativo (Módulo 7 - Parte 2).
 * Provee pagos, clases y clientes semilla; con Supabase configurado intenta
 * leer datos reales (best-effort) y ante cualquier error usa la semilla local.
 */
export default function useAdminReports() {
  const [payments, setPayments] = useState(SEED_PAYMENTS)
  const [expenses, setExpenses] = useState(() => getCashOperations()
    .filter((entry) => entry.type === 'expense')
    .map((entry) => ({
      ...entry,
      fecha: entry.date,
      monto: Number(entry.amount) || 0,
      categoria: entry.category || 'Otros',
      descripcion: entry.description || '',
      metodo: entry.method || 'efectivo',
    })))
  const [isDemoPayments, setIsDemoPayments] = useState(true)
  const [expensesAreLocal, setExpensesAreLocal] = useState(true)
  const [dataError, setDataError] = useState('')

  const reports = useMemo(() => {
    // Concurrencia por clase (agrupada por nombre sobre la parrilla semanal).
    const byName = new Map()
    for (const list of Object.values(weeklyClasses)) {
      for (const c of list) {
        const entry = byName.get(c.name) || { name: c.name, total: 0, booked: 0 }
        entry.total += c.capacity || 0
        entry.booked += c.booked || 0
        byName.set(c.name, entry)
      }
    }
    const classRanking = [...byName.values()]
      .map((e) => ({
        name: e.name,
        booked: e.booked,
        capacity: e.total,
        occupancy: e.total > 0 ? Math.round((e.booked / e.total) * 100) : 0,
      }))
      .sort((a, b) => b.booked - a.booked)

    // Estado de clientes/membresías.
    const activas = seedClients.filter((c) => getMembershipStatus(c.fechaVencimiento).key !== 'vencida')
    const vencidas = seedClients.filter((c) => getMembershipStatus(c.fechaVencimiento).key === 'vencida')

    return {
      classRanking,
      clients: seedClients,
      activas: activas.length,
      vencidas: vencidas.length,
      totalClientes: seedClients.length,
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setDataError('Supabase no está configurado: se muestran datos demo y egresos locales de este navegador.')
      return
    }
    const [paymentsResult, expensesResult, profilesResult] = await Promise.all([
      supabase.from('payments')
        .select('id, user_id, monto, metodo_pago, estado_pago, transaction_id, created_at')
        .eq('estado_pago', 'completado')
        .order('created_at', { ascending: false }),
      supabase.from('operational_expenses')
        .select('id, category, description, amount, payment_method, expense_date, created_at')
        .order('expense_date', { ascending: false }),
      supabase.from('profiles').select('id, nombre, apellido'),
    ])
    if (paymentsResult.error || expensesResult.error || profilesResult.error) {
      setDataError(paymentsResult.error?.message || expensesResult.error?.message || profilesResult.error?.message || 'No se pudieron cargar los datos financieros.')
      return
    }
    const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]))
    setPayments((paymentsResult.data || []).map((payment) => ({
      id: payment.id,
      receiptId: payment.transaction_id,
      fecha: String(payment.created_at).slice(0, 10),
      metodo: payment.metodo_pago,
      monto: Number(payment.monto) || 0,
      cliente: `${profileById.get(payment.user_id)?.nombre || ''} ${profileById.get(payment.user_id)?.apellido || ''}`.trim(),
    })))
    setExpenses((expensesResult.data || []).map((expense) => ({
      id: expense.id,
      fecha: expense.expense_date,
      categoria: expense.category,
      descripcion: expense.description,
      metodo: expense.payment_method,
      monto: Number(expense.amount) || 0,
    })))
    setIsDemoPayments(false)
    setExpensesAreLocal(false)
    setDataError('')
  }, [])

  const createExpense = useCallback(async (expense) => {
    if (isSupabaseConfigured && supabase) {
      const { data: userResult, error: userError } = await supabase.auth.getUser()
      if (userError || !userResult.user) return { ok: false, message: 'No se pudo identificar al administrador.' }
      const { data, error } = await supabase
        .from('operational_expenses')
        .insert({
          category: expense.categoria,
          description: expense.descripcion,
          amount: expense.monto,
          payment_method: expense.metodo,
          expense_date: expense.fecha,
          created_by: userResult.user.id,
        })
        .select('id, category, description, amount, payment_method, expense_date')
        .single()
      if (error) return { ok: false, message: error.message }
      setExpenses((current) => [{
        id: data.id,
        fecha: data.expense_date,
        categoria: data.category,
        descripcion: data.description,
        metodo: data.payment_method,
        monto: Number(data.amount) || 0,
      }, ...current])
      return { ok: true, local: false }
    }

    try {
      const saved = appendCashOperation({
        type: 'expense',
        category: expense.categoria,
        description: expense.descripcion,
        amount: expense.monto,
        method: expense.metodo,
        date: expense.fecha,
      })
      setExpenses((current) => [{
        id: saved.id,
        fecha: saved.date,
        categoria: saved.category,
        descripcion: saved.description,
        metodo: saved.method,
        monto: Number(saved.amount) || 0,
      }, ...current])
      setExpensesAreLocal(true)
      return { ok: true, local: true }
    } catch {
      return { ok: false, message: 'No se pudo guardar el gasto en este navegador.' }
    }
  }, [])

  return {
    ...reports,
    payments,
    expenses,
    isDemoPayments,
    expensesAreLocal,
    dataError,
    refresh,
    createExpense,
    fmtMoney,
    fmtInt,
  }
}