import { useCallback, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { gymRoleOf } from '../lib/gymRole'
import {
  METHOD_KEYS,
  METHOD_NAMES,
  STAFF_ROLES,
  STAFF_FALLBACK_EMAILS,
  emptyReportValues,
  buildReportData,
  fmtInt,
  fmtMoney,
} from '../lib/adminReportMetrics'

export { METHOD_KEYS, METHOD_NAMES }

export { fmtInt, fmtMoney }

// Supabase devuelve como máximo 1000 filas por consulta; se pagina hasta agotar.
const PAGE_SIZE = 1000

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addOneDay(dateString) {
  if (!dateString) return undefined
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return formatDate(date)
}

function getStartOfWeek() {
  const date = new Date()
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return formatDate(date)
}

// Ejecuta una consulta por páginas hasta que no queden filas.
// `buildQuery` debe devolver una consulta NUEVA en cada llamada.
async function fetchAllRows(buildQuery) {
  const rows = []
  let offset = 0
  for (;;) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

function completedPaymentsQuery(startDate, endDate) {
  return () => {
    let query = supabase
      .from('payments')
      .select('monto, metodo_pago, created_at, transaction_id')
      .eq('estado_pago', 'completado')
      .order('id', { ascending: true })
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lt('created_at', endDate)
    return query
  }
}

function posSalesQuery(startDate, endDate) {
  return () => {
    let query = supabase
      .from('pos_sales')
      .select('total, metodo_pago, created_at, receipt_number')
      .order('id', { ascending: true })
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lt('created_at', endDate)
    return query
  }
}

export default function useAdminReports() {
  const [rangeType, setRangeType] = useState('mes')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState(null)
  const [reports, setReports] = useState(emptyReportValues)

  const today = formatDate(new Date())
  let periodStart
  let periodEnd
  let periodLabel
  if (rangeType === 'hoy') {
    periodStart = today
    periodEnd = addOneDay(today)
    periodLabel = today
  } else if (rangeType === 'semana') {
    periodStart = getStartOfWeek()
    periodEnd = addOneDay(today)
    periodLabel = `${periodStart} a ${today}`
  } else if (rangeType === 'mes') {
    periodStart = `${today.slice(0, 7)}-01`
    periodEnd = addOneDay(today)
    periodLabel = `${periodStart} a ${today}`
  } else if (rangeType === 'rango') {
    periodStart = from || undefined
    periodEnd = addOneDay(to)
    periodLabel = `${from || 'inicio'} a ${to || 'hoy'}`
  } else {
    periodLabel = today
  }

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)

    if (!isSupabaseConfigured || !supabase) {
      // Sin Supabase no hay datos: no se muestran ceros simulados.
      setReports(emptyReportValues())
      setHasLoaded(false)
      setUnavailable(true)
      setRefreshing(false)
      return
    }

    try {
      // Rol del usuario actual (para excluir su propia cuenta si es staff).
      let currentUser = null
      try {
        const { data } = await supabase.auth.getSession()
        currentUser = data?.session?.user || null
      } catch {
        currentUser = null
      }

      const [payments, posSales, memberships, profiles] = await Promise.all([
        fetchAllRows(completedPaymentsQuery(periodStart, periodEnd)),
        fetchAllRows(posSalesQuery(periodStart, periodEnd)),
        fetchAllRows(() =>
          supabase
            .from('memberships')
            .select('user_id, estado')
            .order('id', { ascending: true }),
        ),
        fetchAllRows(() =>
          supabase.from('profiles').select('id, email').order('id', { ascending: true }),
        ),
      ])

      // El personal se identifica con `staff_accounts` (recepción/entrenadores),
      // más la cuenta actual si su gym_role es staff, más los correos que
      // `current_gym_role()` clasifica como staff por compatibilidad.
      let staffAccounts = []
      let staffLookupFailed = false
      try {
        staffAccounts = await fetchAllRows(() =>
          supabase
            .from('staff_accounts')
            .select('user_id')
            .order('user_id', { ascending: true }),
        )
      } catch {
        // Si no se puede verificar el personal, el total de clientes queda
        // como "no disponible" en vez de mostrar un número engañoso.
        staffLookupFailed = true
      }

      const excludedUserIds = staffAccounts.map((staff) => staff.user_id).filter(Boolean)
      const currentRole = gymRoleOf(currentUser)
      if (currentUser && STAFF_ROLES.includes(currentRole)) {
        excludedUserIds.push(currentUser.id)
      }

      const data = buildReportData({
        payments,
        posSales,
        memberships,
        profiles,
        excludedUserIds,
        excludedEmails: STAFF_FALLBACK_EMAILS,
      })

      setReports({
        ...emptyReportValues(),
        payments,
        ...data,
        // Sin el listado de personal no se puede garantizar que los
        // indicadores de clientes excluyan a todo el staff: se marcan como
        // no disponibles en lugar de mostrar cifras posiblemente infladas.
        activas: staffLookupFailed ? null : data.activas,
        vencidas: staffLookupFailed ? null : data.vencidas,
        totalClientes: staffLookupFailed ? null : data.totalClientes,
      })
      setHasLoaded(true)
      setUnavailable(false)
    } catch (err) {
      // Un fallo de consulta no es un cero: se limpian los datos y se informa.
      setReports(emptyReportValues())
      setHasLoaded(false)
      setError(err?.message || 'Error al cargar reportes')
    } finally {
      setRefreshing(false)
    }
  }, [periodStart, periodEnd])

  return {
    rangeType,
    setRangeType,
    from,
    setFrom,
    to,
    setTo,
    periodLabel,
    refreshing,
    hasLoaded,
    unavailable,
    error,
    ...reports,
    fmtMoney,
    fmtInt,
    refresh,
  }
}
