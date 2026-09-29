import { useCallback, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, todayISO } from '../data/adminData'
import { weeklyClasses } from '../data/gymData'
import { getMembershipStatus } from '../lib/membershipStatus'
import { getCashOperations } from '../services/receptionCashService'

const ALL_LOCAL_CLASSES = Object.values(weeklyClasses).flat()
const SEED_INCOME = 24850
const SEED_PREVIOUS_INCOME = 22100

function fmtInt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtMoney(n) {
  return `${fmtInt(n)} Bs.`
}

function buildClassRanking(classes) {
  const byName = new Map()
  for (const c of classes) {
    const name = c.name || c.nombre || 'Clase'
    const entry = byName.get(name) || { name, total: 0, booked: 0 }
    entry.total += c.capacity || 0
    entry.booked += c.booked || c.reservas_count || 0
    byName.set(name, entry)
  }
  return [...byName.values()]
    .map((entry) => ({
      name: entry.name,
      booked: entry.booked,
      occupancy: entry.total > 0 ? Math.round((entry.booked / entry.total) * 100) : 0,
    }))
    .sort((a, b) => b.booked - a.booked || b.occupancy - a.occupancy)
}

function filterByDate(classes, dateStr) {
  return classes.filter((item) => {
    const date = item.date || item.fecha
    return date && String(date).slice(0, 10) === dateStr
  })
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthContext(now = new Date()) {
  return {
    currentStart: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    nextStart: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    previousStart: dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    currentDays: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    previousDays: new Date(now.getFullYear(), now.getMonth(), 0).getDate(),
    today: dateKey(now),
  }
}

function fallbackSeries(total, days, salt) {
  if (!days) return []
  const weights = Array.from({ length: days }, (_, index) => 1 + ((index * 7 + salt) % 6))
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  let assigned = 0
  return weights.map((weight, index) => {
    const amount = index === days - 1 ? total - assigned : Math.round((total * weight) / weightTotal)
    assigned += amount
    return amount
  })
}

function sumLocalExpenses(monthPrefix) {
  return getCashOperations()
    .filter((operation) => operation.type === 'expense' && String(operation.date || '').startsWith(monthPrefix))
    .reduce((total, operation) => total + (Number(operation.amount) || 0), 0)
}

function makeDemoFinance(now = new Date()) {
  const range = monthContext(now)
  const current = fallbackSeries(SEED_INCOME, now.getDate(), 3)
  const previous = fallbackSeries(SEED_PREVIOUS_INCOME, range.previousDays, 5)
  const expenses = sumLocalExpenses(range.currentStart.slice(0, 7))
  return {
    ingresosMes: SEED_INCOME,
    ingresosMesAnterior: SEED_PREVIOUS_INCOME,
    nuevasAltas: 8,
    bajasMes: 2,
    tasaChurn: 20,
    egresosMes: expenses,
    flujoNeto: SEED_INCOME - expenses,
    trend: Array.from({ length: range.currentDays }, (_, index) => ({
      dia: index + 1,
      actual: current[index] || 0,
      anterior: previous[index] || 0,
    })),
    isDemoData: true,
    sociosActivos: seedClients.filter((client) => getMembershipStatus(client.fechaVencimiento).key !== 'vencida').length,
    porVencer: seedClients.filter((client) => getMembershipStatus(client.fechaVencimiento).key === 'por_vencer').length,
  }
}

function buildFinance(payments, profiles, memberships, now = new Date()) {
  const range = monthContext(now)
  const currentMonth = range.currentStart.slice(0, 7)
  const previousMonth = range.previousStart.slice(0, 7)
  const currentPayments = payments.filter((payment) => String(payment.created_at).slice(0, 7) === currentMonth)
  const previousPayments = payments.filter((payment) => String(payment.created_at).slice(0, 7) === previousMonth)
  const sumPayments = (list) => list.reduce((sum, payment) => sum + (Number(payment.monto) || 0), 0)
  const currentIncome = sumPayments(currentPayments)
  const previousIncome = sumPayments(previousPayments)
  const currentValues = Array(range.currentDays).fill(0)
  const previousValues = Array(range.previousDays).fill(0)

  for (const payment of currentPayments) {
    const day = Number(String(payment.created_at).slice(8, 10))
    if (day > 0 && day <= currentValues.length) currentValues[day - 1] += Number(payment.monto) || 0
  }
  for (const payment of previousPayments) {
    const day = Number(String(payment.created_at).slice(8, 10))
    if (day > 0 && day <= previousValues.length) previousValues[day - 1] += Number(payment.monto) || 0
  }

  const latestMemberships = new Map()
  for (const membership of memberships) {
    const current = latestMemberships.get(membership.user_id)
    const membershipStart = membership.fecha_inicio || membership.created_at
    const currentStart = current?.fecha_inicio || current?.created_at
    if (!current || String(membershipStart) > String(currentStart)) {
      latestMemberships.set(membership.user_id, membership)
    }
  }
  const latest = [...latestMemberships.values()]
  const expiredThisMonth = latest.filter((membership) => {
    const expiry = String(membership.fecha_vencimiento || '').slice(0, 10)
    return expiry.startsWith(currentMonth) && expiry < range.today
  }).length
  const activeAtMonthStart = latest.filter((membership) => {
    const start = String(membership.fecha_inicio || membership.created_at || '').slice(0, 10)
    const expiry = String(membership.fecha_vencimiento || '').slice(0, 10)
    return start < range.currentStart && expiry >= range.currentStart
  }).length
  const active = latest.filter((membership) => {
    const expiry = String(membership.fecha_vencimiento || '').slice(0, 10)
    return expiry >= range.today && ['activa', 'por_vencer'].includes(membership.estado)
  })
  const expiring = active.filter((membership) => {
    const expiry = new Date(`${membership.fecha_vencimiento.slice(0, 10)}T00:00:00`)
    const currentDate = new Date(`${range.today}T00:00:00`)
    const days = Math.ceil((expiry - currentDate) / 86400000)
    return days >= 0 && days <= 5
  }).length
  const newProfiles = profiles.filter((profile) => String(profile.created_at || '').slice(0, 7) === currentMonth).length
  const expenses = sumLocalExpenses(currentMonth)

  return {
    ingresosMes: currentIncome,
    ingresosMesAnterior: previousIncome,
    nuevasAltas: newProfiles,
    bajasMes: expiredThisMonth,
    tasaChurn: activeAtMonthStart ? Math.round((expiredThisMonth / activeAtMonthStart) * 100) : 0,
    egresosMes: expenses,
    flujoNeto: currentIncome - expenses,
    trend: Array.from({ length: range.currentDays }, (_, index) => ({
      dia: index + 1,
      actual: currentValues[index] || 0,
      anterior: previousValues[index] || 0,
    })),
    isDemoData: false,
    sociosActivos: active.length,
    porVencer: expiring,
  }
}

export default function useAdminDashboard() {
  const today = todayISO()
  const [finance, setFinance] = useState(makeDemoFinance)
  const metrics = useMemo(() => {
    const classesToday = filterByDate(ALL_LOCAL_CLASSES, today)
    return {
      today,
      reservasDelDia: classesToday.reduce((total, item) => total + (item.booked || item.reservas_count || 0), 0),
      ranking: buildClassRanking(ALL_LOCAL_CLASSES),
      clasesDelDia: classesToday,
    }
  }, [today])

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    const range = monthContext()
    try {
      const [paymentsResult, profilesResult, membershipsResult] = await Promise.all([
        supabase.from('payments')
          .select('monto, created_at')
          .eq('estado_pago', 'completado')
          .gte('created_at', `${range.previousStart}T00:00:00`)
          .lt('created_at', `${range.nextStart}T00:00:00`),
        supabase.from('profiles')
          .select('id, created_at')
          .lt('created_at', `${range.nextStart}T00:00:00`),
        supabase.from('memberships')
          .select('user_id, fecha_inicio, fecha_vencimiento, estado, created_at'),
      ])
      if (paymentsResult.error || profilesResult.error || membershipsResult.error) {
        setFinance(makeDemoFinance())
        return
      }
      setFinance(buildFinance(
        paymentsResult.data || [],
        profilesResult.data || [],
        membershipsResult.data || []
      ))
    } catch {
      setFinance(makeDemoFinance())
    }
  }, [])

  return {
    ...metrics,
    ...finance,
    refresh,
    fmtMoney,
    fmtInt,
  }
}
