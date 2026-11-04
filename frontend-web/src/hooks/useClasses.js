import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { weeklyClasses } from '../data/gymData'

const DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Datos locales del Módulo 1 con la misma forma que devuelve el modo Supabase.
const localClassesByDay = Object.fromEntries(
  Object.entries(weeklyClasses).map(([day, list]) => [
    day,
    list.map((cls) => ({ ...cls, date: null })),
  ])
)

/**
 * Devuelve las clases agrupadas por día.
 * - Con Supabase configurado: sesiones reales de la tabla `classes` con cupos
 *   calculados desde las reservas (columna reservas_count mantenida por triggers)
 *   y actualización en vivo vía Realtime.
 * - Sin Supabase: usa los datos estáticos del Módulo 1 (gymData.weeklyClasses).
 */
export default function useClasses() {
  const [dbClasses, setDbClasses] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const fetchClasses = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nombre, descripcion, fecha, hora_inicio, hora_fin, capacidad, entrenador, reservas_count')
        .eq('activo', true)
        .gte('fecha', todayStr())
        .order('fecha')
        .order('hora_inicio')
      if (error) throw error
      setDbClasses(data || [])
    } catch {
      setDbClasses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined
    // Carga inicial de clases desde Supabase (sincronización con sistema externo).
    // oxlint-disable-next-line react/set-state-in-effect
    fetchClasses()

    // Realtime: cuando cualquier usuario reserva o cancela, el trigger actualiza
    // `reservas_count` en la fila de la clase y todos los clientes lo reciben.
    const channel = supabase
      .channel('clases-cupos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => {
        fetchClasses()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchClasses])

  const classesByDay = useMemo(() => {
    if (!dbClasses) return localClassesByDay
    const result = { dom: [], lun: [], mar: [], mie: [], jue: [], vie: [], sab: [] }
    for (const row of dbClasses) {
      const [y, m, d] = row.fecha.split('-').map(Number)
      const dayKey = DAY_KEYS[new Date(y, m - 1, d).getDay()]
      result[dayKey].push({
        id: row.id,
        name: row.nombre,
        trainer: row.entrenador,
        time: String(row.hora_inicio).slice(0, 5),
        capacity: row.capacidad,
        booked: row.reservas_count,
        date: row.fecha,
        description: row.descripcion,
      })
    }
    return result
  }, [dbClasses])

  // Lista plana (modo Supabase) para buscar sesiones de la misma plantilla de clase.
  const allSessions = useMemo(() => Object.values(classesByDay).flat(), [classesByDay])

  return { classesByDay, allSessions, loading, usingDatabase: Boolean(dbClasses), refresh: fetchClasses }
}
