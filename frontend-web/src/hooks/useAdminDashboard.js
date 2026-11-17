import { useCallback, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { todayISO, seedClients } from '../data/adminData'
import { weeklyClasses } from '../data/gymData'
import { getMembershipStatus } from '../lib/membershipStatus'

const ALL_LOCAL_CLASSES = isSupabaseConfigured ? [] : Object.values(weeklyClasses).flat()

const EMPTY_METRICS = {
  sociosActivos: null,
  porVencer: null,
  reservasDelDia: null,
  ranking: [],
  clasesDelDia: [],
}

function fmtInt(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtMoney(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${fmtInt(value)} Bs.`
}

function buildClassRanking(classes) {
  const byName = new Map()
  for (const item of classes) {
    const name = item.name || item.nombre || 'Clase'
    const entry = byName.get(name) || { name, total: 0, booked: 0 }
    entry.total += item.capacity || 0
    entry.booked += item.booked || item.reservas_count || 0
    byName.set(name, entry)
  }
  return [...byName.values()]
    .map((item) => ({
      name: item.name,
      booked: item.booked,
      occupancy: item.total > 0 ? Math.round((item.booked / item.total) * 100) : 0,
    }))
    .sort((a, b) => b.booked - a.booked || b.occupancy - a.occupancy)
}

function filterByDate(classes, date) {
  return classes.filter((item) => {
    const classDate = item.date || item.fecha
    return classDate && String(classDate).slice(0, 10) === date
  })
}

function getDemoMetrics(today) {
  const activeClients = seedClients.filter((client) =>
    getMembershipStatus(client.fechaVencimiento).key !== 'vencida')
  const expiringClients = seedClients.filter((client) =>
    getMembershipStatus(client.fechaVencimiento).key === 'por_vencer')
  const classesToday = filterByDate(ALL_LOCAL_CLASSES, today)

  return {
    sociosActivos: activeClients.length,
    porVencer: expiringClients.length,
    reservasDelDia: classesToday.reduce(
      (total, item) => total + (item.booked || item.reservas_count || 0),
      0,
    ),
    ranking: buildClassRanking(ALL_LOCAL_CLASSES),
    clasesDelDia: classesToday,
  }
}

function summarizeMemberships(memberships) {
  const statusByUser = new Map()
  for (const membership of memberships) {
    if (!membership.user_id) continue
    const status = getMembershipStatus(membership.fecha_vencimiento).key
    const statuses = statusByUser.get(membership.user_id) || new Set()
    statuses.add(status)
    statusByUser.set(membership.user_id, statuses)
  }

  let sociosActivos = 0
  let porVencer = 0
  for (const statuses of statusByUser.values()) {
    if (statuses.has('activa')) sociosActivos += 1
    else if (statuses.has('por_vencer')) porVencer += 1
  }
  return { sociosActivos, porVencer }
}

function summarizeClasses(classes, bookings, today) {
  const bookingsByClass = new Map()
  for (const booking of bookings) {
    if (!booking.class_id) continue
    bookingsByClass.set(
      booking.class_id,
      (bookingsByClass.get(booking.class_id) || 0) + 1,
    )
  }

  const allClasses = classes.map((item) => ({
    id: item.id,
    name: item.nombre || 'Clase',
    trainer: item.entrenador || '',
    time: item.hora_inicio || '',
    date: item.fecha ? String(item.fecha).slice(0, 10) : '',
    capacity: Number(item.capacidad) || 0,
    booked: Math.max(
      bookingsByClass.get(item.id) || 0,
      Number(item.reservas_count) || 0,
    ),
  }))
  const clasesDelDia = allClasses.filter((item) => item.date === today)
  const ranking = allClasses
    .map((item) => ({
      name: item.name,
      booked: item.booked,
      occupancy: item.capacity > 0
        ? Math.round((item.booked / item.capacity) * 100)
        : 0,
    }))
    .sort((a, b) => b.booked - a.booked || b.occupancy - a.occupancy)

  return {
    clasesDelDia,
    reservasDelDia: clasesDelDia.reduce((total, item) => total + item.booked, 0),
    ranking,
  }
}

export default function useAdminDashboard({
  authUser = null,
  authLoading = false,
} = {}) {
  const today = todayISO()
  const demoMode = !isSupabaseConfigured || !supabase
  const [metrics, setMetrics] = useState(() =>
    demoMode ? getDemoMetrics(today) : EMPTY_METRICS)
  const [sociosError, setSociosError] = useState('')
  const [clasesError, setClasesError] = useState('')

  const refresh = useCallback(async () => {
    if (demoMode) {
      setMetrics(getDemoMetrics(today))
      setSociosError('')
      setClasesError('')
      return
    }
    if (authLoading) return
    if (!authUser) {
      setMetrics(EMPTY_METRICS)
      setSociosError('Sin sesión activa')
      setClasesError('Sin sesión activa')
      return
    }

    setMetrics(EMPTY_METRICS)
    setSociosError('')
    setClasesError('')
    try {
      const [membershipsResp, classesResp] = await Promise.all([
        supabase
          .from('memberships')
          .select('user_id, fecha_vencimiento'),
        supabase
          .from('classes')
          .select('id, fecha, nombre, capacidad, entrenador, hora_inicio, reservas_count')
          .gte('fecha', today)
          .eq('activo', true)
      ])
      const classIds = (classesResp.data || []).map((item) => item.id)
      const bookingsResp = classesResp.error || classIds.length === 0
        ? { data: [], error: null }
        : await supabase
          .from('bookings')
          .select('class_id')
          .eq('estado', 'confirmada')
          .in('class_id', classIds)

      const nextMetrics = { ...EMPTY_METRICS }
      if (membershipsResp.error) {
        setSociosError(membershipsResp.error.message || 'Error al cargar socios')
      } else {
        Object.assign(nextMetrics, summarizeMemberships(membershipsResp.data || []))
      }

      if (classesResp.error) {
        setClasesError(classesResp.error.message || 'Error al cargar clases')
      } else {
        Object.assign(nextMetrics, summarizeClasses(
          classesResp.data || [],
          bookingsResp.error ? [] : bookingsResp.data || [],
          today,
        ))
        if (bookingsResp.error) {
          setClasesError(bookingsResp.error.message || 'Error al cargar reservas')
        }
      }
      setMetrics(nextMetrics)
    } catch (error) {
      setMetrics(EMPTY_METRICS)
      const message = error.message || 'Error al actualizar el Dashboard'
      setSociosError(message)
      setClasesError(message)
    }
  }, [authLoading, authUser, demoMode, today])

  return {
    today,
    ...metrics,
    sociosError,
    clasesError,
    refresh,
    fmtMoney,
    fmtInt,
    demoMode,
  }
}
