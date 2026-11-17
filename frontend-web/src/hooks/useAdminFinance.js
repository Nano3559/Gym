import { useCallback, useRef, useState } from 'react'
import {
  currentMonthBounds,
  periodQueryBounds,
} from '../lib/financeMetrics'
import {
  buildDashboardFinanceSnapshot,
  previousMonthBounds,
  summarizeFinancePeriod,
} from '../lib/dashboardFinanceMetrics'
import { fetchAllRows } from '../lib/financePagination'
import {
  defaultFinanceSource,
  fetchFinanceRows,
  hasFinanceSession,
} from '../services/financeService'

// Estado inicial honesto: ningún importe ficticio. Mientras `loading` sea
// verdadero o los indicadores no estén disponibles, los valores permanecen en
// `null` para que el Dashboard muestre «—» en lugar de un cero engañoso.
const UNAVAILABLE = {
  currentIncome: null,
  previousIncome: null,
  currentExpenses: null,
  previousExpenses: null,
  currentNet: null,
  previousNet: null,
  newMembers: null,
  churned: null,
  available: false,
  financeAvailable: false,
  peopleAvailable: false,
  authRequired: false,
  error: '',
  peopleError: '',
}

function errorMessage(error) {
  if (!error) return 'error desconocido'
  return error.message || String(error)
}

/**
 * Indicadores financieros del Dashboard.
 *
 * Reutiliza el servicio y la lógica ya probados de Finanzas:
 * - `fetchFinanceRows` consulta las tres fuentes con paginación y rango.
 * - `fetchAllRows` pagina `profiles`, `memberships` y los pagos necesarios
 *   para conservar la fórmula actual de altas/bajas.
 *
 * Los importes financieros y los indicadores de personas se resuelven por
 * separado: un fallo de personas no oculta los importes, y un fallo
 * financiero invalida todos los importes.
 */
export default function useAdminFinance({ financeSource = defaultFinanceSource } = {}) {
  const { configured, client } = financeSource || {}
  const [state, setState] = useState({ ...UNAVAILABLE, loading: true })
  const requestRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    // Invalida de inmediato: ninguna cifra anterior puede presentarse como
    // actual mientras se consulta la nueva información.
    setState((current) => ({ ...current, ...UNAVAILABLE, loading: true }))

    const stillCurrent = () => requestId === requestRef.current
    const finish = (patch) => {
      if (!stillCurrent()) return
      setState((current) => ({ ...current, ...patch, loading: false }))
    }

    if (!configured || !client) {
      finish({
        error: 'Supabase no está configurado: no hay datos financieros disponibles.',
      })
      return
    }

    try {
      const hasSession = await hasFinanceSession(client)
      if (!stillCurrent()) return
      if (!hasSession) {
        finish({ authRequired: true })
        return
      }

      const now = new Date()
      const currentBounds = currentMonthBounds(now)
      const previousBounds = previousMonthBounds(now)
      const currentQuery = periodQueryBounds(currentBounds.from, currentBounds.to)
      const previousQuery = periodQueryBounds(previousBounds.from, previousBounds.to)
      if (!currentQuery || !previousQuery) {
        throw new Error('No se pudo calcular el período financiero.')
      }

      // --- Fuentes financieras: actual y anterior ---
      let snapshot = null
      let financeAvailable = false
      let financeError = ''
      try {
        const [currentRows, previousRows] = await Promise.all([
          fetchFinanceRows({ client, from: currentBounds.from, to: currentBounds.to }),
          fetchFinanceRows({ client, from: previousBounds.from, to: previousBounds.to }),
        ])
        if (!stillCurrent()) return
        snapshot = buildDashboardFinanceSnapshot({
          current: summarizeFinancePeriod({ ...currentRows, ...currentBounds }),
          previous: summarizeFinancePeriod({ ...previousRows, ...previousBounds }),
        })
        financeAvailable = true
      } catch (financeFailure) {
        if (!stillCurrent()) return
        financeError = `No se pudieron cargar los indicadores financieros: ${errorMessage(financeFailure)}`
      }

      // --- Indicadores de personas: independientes de los importes ---
      let people = null
      let peopleAvailable = false
      let peopleError = ''
      try {
        const [profiles, memberships, renewals] = await Promise.all([
          fetchAllRows(() => client
            .from('profiles')
            .select('id, created_at')
            .gte('created_at', currentQuery.start)
            .lt('created_at', currentQuery.end)
            .order('id', { ascending: true })),
          fetchAllRows(() => client
            .from('memberships')
            .select('user_id, fecha_vencimiento')
            .gte('fecha_vencimiento', currentQuery.start)
            .lt('fecha_vencimiento', currentQuery.end)
            .order('user_id', { ascending: true })),
          // Pagos necesarios para conservar la fórmula actual de `churned`:
          // una membresía vencida cuenta como renovada si el usuario tiene
          // algún pago completado entre el mes anterior y el actual.
          fetchAllRows(() => client
            .from('payments')
            .select('id, user_id, created_at')
            .eq('estado_pago', 'completado')
            .gte('created_at', previousQuery.start)
            .lt('created_at', currentQuery.end)
            .order('id', { ascending: true })),
        ])
        if (!stillCurrent()) return
        const renewed = new Set((renewals || []).map((payment) => payment.user_id))
        const expiredUsers = new Set((memberships || []).map((membership) => membership.user_id))
        people = {
          newMembers: (profiles || []).length,
          churned: [...expiredUsers].filter((userId) => !renewed.has(userId)).length,
        }
        peopleAvailable = true
      } catch (peopleFailure) {
        if (!stillCurrent()) return
        peopleError = financeAvailable
          ? `No se pudieron cargar las altas y bajas de socios: ${errorMessage(peopleFailure)}. Los importes financieros sí están disponibles.`
          : 'No se pudieron cargar los indicadores de personas.'
      }

      finish({
        ...(snapshot || {}),
        ...(people || {}),
        financeAvailable,
        peopleAvailable,
        available: financeAvailable && peopleAvailable,
        error: financeError,
        peopleError,
      })
    } catch (failure) {
      finish({
        error: `No se pudieron cargar los indicadores financieros: ${errorMessage(failure)}`,
      })
    }
  }, [client, configured])

  return { ...state, refresh }
}
