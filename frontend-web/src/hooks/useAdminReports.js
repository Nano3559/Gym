import { useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, shiftDate } from '../data/adminData'
import { weeklyClasses } from '../data/gymData'
import { getMembershipStatus } from '../lib/membershipStatus'

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
      payments: SEED_PAYMENTS,
      classRanking,
      clients: seedClients,
      activas: activas.length,
      vencidas: vencidas.length,
      totalClientes: seedClients.length,
    }
  }, [])

  const refresh = () => {
    if (!isSupabaseConfigured || !supabase) return Promise.resolve()
    return Promise.all([
      supabase.from('pagos').select('monto, metodo, created_at'),
      supabase.from('asistencia').select('id, fecha, plan'),
    ]).catch(() => null)
  }

  return { ...reports, refresh, fmtMoney, fmtInt }
}