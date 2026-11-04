import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Membresía activa del usuario autenticado (tabla memberships).
 * Devuelve la membresía con estado 'activa' más los datos del plan asociado.
 * Si no hay usuario o no está configurado Supabase devuelve null.
 */
export default function useMembership(userId) {
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchMembership = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setMembership(null)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, plan_id, fecha_inicio, fecha_vencimiento, estado, plans(codigo, nombre, precio)')
        .eq('user_id', userId)
        .eq('estado', 'activa')
        .maybeSingle()
      if (error) throw error
      setMembership(data || null)
    } catch {
      setMembership(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchMembership()
  }, [fetchMembership])

  return { membership, loading, refresh: fetchMembership }
}