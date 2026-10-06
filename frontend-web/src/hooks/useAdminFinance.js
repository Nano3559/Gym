import { useCallback, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const MONTHLY_INCOME_FALLBACK = 24850

function localDate(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function currentAndPreviousMonth() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return {
    current: localDate(start),
    previous: localDate(previous),
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: previous.toISOString(),
  }
}

export default function useAdminFinance() {
  const [finance, setFinance] = useState({
    currentIncome: MONTHLY_INCOME_FALLBACK,
    previousIncome: 0,
    currentExpenses: 0,
    previousExpenses: 0,
    newMembers: 0,
    churned: 0,
    available: false,
  })
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    const bounds = currentAndPreviousMonth()
    const [payments, sales, expenses, profiles, memberships] = await Promise.all([
      supabase
        .from('payments')
        .select('monto, created_at, user_id')
        .eq('estado_pago', 'completado')
        .gte('created_at', bounds.previousStart)
        .lt('created_at', bounds.end),
      supabase
        .from('pos_sales')
        .select('total, created_at')
        .gte('created_at', bounds.previousStart)
        .lt('created_at', bounds.end),
      supabase
        .from('operating_expenses')
        .select('monto, created_at')
        .gte('created_at', bounds.previousStart)
        .lt('created_at', bounds.end),
      supabase
        .from('profiles')
        .select('id, created_at')
        .gte('created_at', bounds.start)
        .lt('created_at', bounds.end),
      supabase
        .from('memberships')
        .select('user_id, fecha_vencimiento')
        .gte('fecha_vencimiento', bounds.start)
        .lt('fecha_vencimiento', bounds.end),
    ])
    const failed = [payments, sales, expenses, profiles, memberships].find((result) => result.error)
    if (failed?.error) {
      setError(failed.error.message)
      throw failed.error
    }
    const sum = (rows, valueKey, month) =>
      (rows || []).filter((row) => localDate(row.created_at) === month)
        .reduce((total, row) => total + Number(row[valueKey] || 0), 0)
    const renewed = new Set((payments.data || []).map((payment) => payment.user_id))
    const expiredUsers = new Set((memberships.data || []).map((membership) => membership.user_id))
    setFinance({
      currentIncome: sum(payments.data, 'monto', bounds.current) + sum(sales.data, 'total', bounds.current),
      previousIncome: sum(payments.data, 'monto', bounds.previous) + sum(sales.data, 'total', bounds.previous),
      currentExpenses: sum(expenses.data, 'monto', bounds.current),
      previousExpenses: sum(expenses.data, 'monto', bounds.previous),
      newMembers: profiles.data?.length || 0,
      churned: [...expiredUsers].filter((userId) => !renewed.has(userId)).length,
      available: true,
    })
    setError('')
  }, [])

  return { ...finance, error, refresh }
}
