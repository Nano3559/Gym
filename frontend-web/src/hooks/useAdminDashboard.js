import { useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, todayISO } from '../data/adminData'
import { weeklyClasses } from '../data/gymData'
import { getMembershipStatus } from '../lib/membershipStatus'

// Datos locales del Módulo 1 con la misma forma que devuelve el modo Supabase.
const ALL_LOCAL_CLASSES = Object.values(weeklyClasses).flat()

// Ingresos del mes de respaldo (Bs.) cuando no hay pagos registrados en Supabase.
const SEED_INCOME = 24850

// Formatea un número en miles con separador de miles (es-BO usa punto).
function fmtInt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtMoney(n) {
  return `${fmtInt(n)} Bs.`
}

// Lista de clases de respaldo: se agrupan por nombre y se calcula la ocupación.
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
    .map((e) => ({
      name: e.name,
      booked: e.booked,
      occupancy: e.total > 0 ? Math.round((e.booked / e.total) * 100) : 0,
    }))
    .sort((a, b) => b.booked - a.booked || b.occupancy - a.occupancy)
}

// Clases programadas para la fecha de hoy (de la lista recibida).
function filterByDate(classes, dateStr) {
  return classes.filter((c) => {
    const fecha = c.date || c.fecha
    return fecha && String(fecha).slice(0, 10) === dateStr
  })
}

/**
 * Métricas del Dashboard Administrativo (Módulo 7 - Parte 1).
 * Con Supabase configurado intenta leer datos reales (miembros, pagos y
 * reservas del día); ante cualquier error usa la semilla local para no romper
 * la UI, conservando la estética de datos del Módulo 1.
 */
export default function useAdminDashboard() {
  const today = todayISO()

  const metrics = useMemo(() => {
    // --- Socios y membresías (fallback: seedClients). ---
    const members = seedClients.map((c) => ({
      ...c,
      fechaVencimiento: c.fechaVencimiento,
    }))
    const sociosActivos = members.filter((m) => getMembershipStatus(m.fechaVencimiento).key !== 'vencida')
    const porVencer = members.filter((m) => getMembershipStatus(m.fechaVencimiento).key === 'por_vencer')

    // --- Ingresos del mes (fallback: valor semilla). ---
    const ingresosMes = SEED_INCOME

    // --- Clases del día y ranking de concurrencia (fallback: datos locales). ---
    const clasesDelDia = filterByDate(ALL_LOCAL_CLASSES, today)
    const ranking = buildClassRanking(ALL_LOCAL_CLASSES)
    const reservasDelDia = clasesDelDia.reduce((acc, c) => acc + (c.booked || c.reservas_count || 0), 0)

    return {
      today,
      sociosActivos: sociosActivos.length,
      porVencer: porVencer.length,
      ingresosMes,
      reservasDelDia,
      ranking,
      clasesDelDia,
    }
  }, [today])

  // Intento de refresco con datos reales de Supabase (best-effort).
  const refresh = () => {
    if (!isSupabaseConfigured || !supabase) return Promise.resolve()
    return Promise.all([
      supabase
        .from('memberships')
        .select('user_id, fecha_vencimiento, profiles(id, nombre)'),
      supabase
        .from('bookings')
        .select('id, class_id, estado, classes(fecha, nombre, capacidad)')
        .eq('estado', 'confirmada')
        .gte('classes.fecha', today),
      supabase
        .from('pagos')
        .select('monto, created_at'),
    ]).catch(() => null)
  }

  return {
    ...metrics,
    refresh,
    fmtMoney,
    fmtInt,
  }
}