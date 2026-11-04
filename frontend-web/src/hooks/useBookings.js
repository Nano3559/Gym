import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const STATUS_UI = {
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
}

function mapBooking(row) {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.classes?.nombre || 'Clase',
    trainer: row.classes?.entrenador || 'Equipo IronForge',
    time: String(row.classes?.hora_inicio || '').slice(0, 5),
    date: row.classes?.fecha || null,
    status: STATUS_UI[row.estado] || row.estado,
    createdAt: row.created_at,
  }
}

/**
 * Reservas reales del usuario autenticado (tabla bookings).
 * Solo debe usarse con sesión iniciada; si no hay usuario devuelve lista vacía.
 */
export default function useBookings(userId) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchBookings = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setBookings([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, user_id, class_id, estado, created_at, cancelled_at, classes(nombre, entrenador, hora_inicio, fecha)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setBookings((data || []).map(mapBooking))
    } catch {
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // Carga inicial de reservas del usuario (sincronización con sistema externo).
    // oxlint-disable-next-line react/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  /**
   * Crea la reserva vía RPC `reservar_clase` (valida cupos y duplicados en la
   * base de datos). Devuelve { ok, message }.
   */
  const createBooking = useCallback(
    async (classId) => {
      if (!isSupabaseConfigured || !supabase || !userId) {
        return { ok: false, message: 'Debes iniciar sesión para reservar.' }
      }
      const { data, error } = await supabase.rpc('reservar_clase', { p_class_id: classId })
      if (error) {
        await fetchBookings()
        return { ok: false, message: error.message }
      }
      await fetchBookings()
      return { ok: true, booking: data }
    },
    [userId, fetchBookings]
  )

  /** Cancela la reserva (UPDATE con RLS: solo las propias y activas). */
  const cancelBooking = useCallback(
    async (bookingId) => {
      if (!isSupabaseConfigured || !supabase || !userId) {
        return { ok: false, message: 'Debes iniciar sesión.' }
      }
      const { error } = await supabase
        .from('bookings')
        .update({ estado: 'cancelada', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('user_id', userId)
        .eq('estado', 'confirmada')
      if (error) return { ok: false, message: error.message }
      await fetchBookings()
      return { ok: true }
    },
    [userId, fetchBookings]
  )

  return { bookings, loading, createBooking, cancelBooking, refresh: fetchBookings }
}
