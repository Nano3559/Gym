import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, seedAttendance, todayISO, PLAN_NAMES } from '../data/adminData'

function fmtHora(d = new Date()) {
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Datos del Módulo 6 (recepción / administración): clientes y asistencias del día.
 * Si Supabase está configurado intenta leer datos reales; ante cualquier error
 * (RLS, tablas ausentes, sin red) usa la semilla local para no romper la UI.
 */
export default function useAdminClients() {
  const [clients, setClients] = useState(seedClients)
  const [attendance, setAttendance] = useState(seedAttendance)
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select(
          'user_id, fecha_inicio, fecha_vencimiento, plans(codigo, nombre), profiles(nombre, apellido, ci, telefono)'
        )
      if (error) throw error
      if (data?.length) {
        const map = new Map()
        for (const m of data) {
          const uid = m.user_id
          const vencimiento = m.fecha_vencimiento ? m.fecha_vencimiento.slice(0, 10) : ''
          const prev = map.get(uid)
          if (!prev || vencimiento > prev.fechaVencimiento) {
            map.set(uid, {
              id: uid,
              nombre: m.profiles?.nombre || '',
              apellido: m.profiles?.apellido || '',
              ci: m.profiles?.ci || '',
              telefono: m.profiles?.telefono || '',
              plan: m.plans?.codigo || '',
              planNombre: m.plans?.nombre || '',
              fechaInicio: m.fecha_inicio ? m.fecha_inicio.slice(0, 10) : '',
              fechaVencimiento: vencimiento,
              photo: null,
            })
          }
        }
        if (map.size) setClients([...map.values()])
      }
    } catch {
      // Fallback: se conservan los datos de la semilla local.
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  const registerAttendance = useCallback(async (client) => {
    const now = new Date()
    const fecha = todayISO()
    const record = {
      id: `att-${Date.now()}`,
      fecha,
      hora: fmtHora(now),
      plan: client.planNombre || client.plan || '',
      client: {
        id: client.id,
        nombre: client.nombre,
        apellido: client.apellido,
        ci: client.ci,
      },
    }

    if (isSupabaseConfigured && supabase && client.id) {
      try {
        await supabase.from('asistencia').insert({
          user_id: client.id,
          fecha,
          hora: fmtHora(now),
          plan: record.plan,
        })
      } catch {
        // El registro local se mantiene aunque falle la escritura en BD.
      }
    }

    setAttendance((prev) => [record, ...prev])
    return record
  }, [])

  const renewMembership = useCallback(
    async (clientId, planCode, metodoPago) => {
      const client = clients.find((c) => c.id === clientId)
      if (!client) return null

      const base = new Date()
      const current = new Date(client.fechaVencimiento)
      if (!Number.isNaN(current.getTime()) && current.getTime() > Date.now()) {
        base.setTime(current.getTime())
      }
      base.setDate(base.getDate() + 30)

      const updated = {
        ...client,
        plan: planCode,
        planNombre: PLAN_NAMES[planCode] || client.planNombre,
        fechaInicio: todayISO(),
        fechaVencimiento: base.toISOString().slice(0, 10),
      }

      setClients((prev) => prev.map((c) => (c.id === clientId ? updated : c)))

      if (isSupabaseConfigured && supabase && client.id) {
        try {
          await supabase.rpc('procesar_pago_exitoso', {
            p_transaction_id: `renov-${Date.now()}`,
            p_user_id: client.id,
            p_plan_id: planCode,
            p_monto: 0,
            p_metodo_pago: metodoPago,
          })
        } catch {
          // Renovación local; el despliegue real aplica la RPC con la BD.
        }
      }

      return updated
    },
    [clients]
  )

  return { clients, attendance, loading, refresh, registerAttendance, renewMembership }
}