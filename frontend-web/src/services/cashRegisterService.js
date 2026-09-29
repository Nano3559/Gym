import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  closeCashShift as closeLocalShift,
  getActiveCashShift as getLocalActiveShift,
  getCashOperations,
  getCashShifts,
  openCashShift as openLocalShift,
} from './receptionCashService'

function fromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    operator: row.operator_email,
    openingCash: Number(row.opening_cash),
    openedAt: row.opened_at,
    closingCash: row.closing_cash == null ? null : Number(row.closing_cash),
    expectedCash: row.expected_cash == null ? null : Number(row.expected_cash),
    difference: row.difference == null ? null : Number(row.difference),
    closedAt: row.closed_at,
  }
}

function localTransactions(shiftId) {
  return getCashOperations().filter((operation) => operation.shiftId === shiftId).map((operation) => ({
    id: operation.id,
    shift_id: operation.shiftId,
    transaction_type: operation.type,
    description: operation.description,
    amount: operation.amount,
    payment_method: operation.method,
    created_at: operation.time,
  }))
}

export async function loadCurrentCashShift() {
  if (!isSupabaseConfigured || !supabase) return { shift: getLocalActiveShift(), local: true }
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { shift: null, local: false }
  const { data, error } = await supabase.from('cash_register_shifts')
    .select('*')
    .eq('user_id', authData.user.id)
    .is('closed_at', null)
    .maybeSingle()
  if (error) throw error
  return { shift: fromRow(data), local: false }
}

export async function loadCashShiftTransactions(shiftId, local = false) {
  if (!isSupabaseConfigured || !supabase || local) return localTransactions(shiftId)
  const { data, error } = await supabase.from('cash_register_transactions')
    .select('id, shift_id, transaction_type, description, amount, payment_method, created_at')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function loadMyCashShifts(local = false) {
  if (!isSupabaseConfigured || !supabase || local) return getCashShifts()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return []
  const { data, error } = await supabase.from('cash_register_shifts')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('opened_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function openCashRegisterShift(amount) {
  if (!isSupabaseConfigured || !supabase) return { shift: openLocalShift(amount), local: true }
  const { data, error } = await supabase.rpc('open_cash_register_shift', { p_opening_cash: Number(amount) })
  if (error) throw error
  return { shift: fromRow(data), local: false }
}

export async function closeCashRegisterShift(shiftId, countedCash, expectedCash, local = false) {
  if (!isSupabaseConfigured || !supabase || local) {
    return { shift: closeLocalShift(shiftId, countedCash, expectedCash), local: true }
  }
  const { data, error } = await supabase.rpc('close_cash_register_shift', {
    p_shift_id: shiftId,
    p_closing_cash: Number(countedCash),
  })
  if (error) throw error
  return { shift: fromRow(data), local: false }
}

export async function recordCashExpense({ shiftId, description, amount, method, local = false, category = 'Gasto' }) {
  if (!isSupabaseConfigured || !supabase || local) {
    return { local: true, operation: {
      type: 'expense', description: `${category}: ${description}`, amount: Number(amount), method,
      shiftId, date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
    } }
  }
  const { data, error } = await supabase.rpc('record_cash_expense', {
    p_shift_id: shiftId,
    p_description: `${category}: ${description}`,
    p_amount: Number(amount),
    p_payment_method: method,
  })
  if (error) throw error
  return { local: false, transactionId: data }
}

export async function loadCashAudit() {
  if (!isSupabaseConfigured || !supabase) {
    const shifts = getCashShifts().map((shift) => ({
      id: shift.id,
      userId: null,
      operator: shift.operator || 'Recepción (local)',
      openingCash: Number(shift.openingCash),
      openedAt: shift.openedAt,
      closingCash: shift.closingCash == null ? null : Number(shift.closingCash),
      expectedCash: shift.expectedCash == null ? null : Number(shift.expectedCash),
      difference: shift.difference == null ? null : Number(shift.difference),
      closedAt: shift.closedAt,
    }))
    return { shifts, transactions: getCashOperations().map((op) => ({
      ...op,
      shift_id: op.shiftId,
      transaction_type: op.type,
      payment_method: op.method,
    })), local: true }
  }
  const { data: shiftRows, error: shiftError } = await supabase.from('cash_register_shifts')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(200)
  if (shiftError) throw shiftError
  const ids = (shiftRows || []).map((shift) => shift.id)
  const { data: transactionRows, error: transactionError } = ids.length
    ? await supabase.from('cash_register_transactions')
      .select('id, shift_id, user_id, transaction_type, description, amount, payment_method, created_at')
      .in('shift_id', ids)
      .order('created_at', { ascending: false })
    : { data: [], error: null }
  if (transactionError) throw transactionError
  return { shifts: (shiftRows || []).map(fromRow), transactions: transactionRows || [], local: false }
}
