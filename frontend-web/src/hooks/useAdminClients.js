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
      // 1) Todos los usuarios registrados (profiles), el catálogo de planes y las
      //    membresías para calcular fechas de inicio/vencimiento.
      const [perfilesRes, planesRes, membresiasRes] = await Promise.all([
        supabase.from('profiles').select('id, nombre, apellido, ci, telefono, plan_id'),
        supabase.from('plans').select('id, codigo, nombre'),
        supabase.from('memberships').select('user_id, plan_id, fecha_inicio, fecha_vencimiento'),
      ])
      if (perfilesRes.error) throw perfilesRes.error

      const planesById = new Map((planesRes.data || []).map((p) => [p.id, p]))
      const planInfo = (planId) => {
        const p = planesById.get(planId)
        return { plan: p?.codigo || '', planNombre: p?.nombre || '' }
      }

      // Última (más reciente) membresía por usuario.
      const membresiaPorUsuario = new Map()
      for (const m of membresiasRes.data || []) {
        const vencimiento = m.fecha_vencimiento ? m.fecha_vencimiento.slice(0, 10) : ''
        const prev = membresiaPorUsuario.get(m.user_id)
        if (!prev || vencimiento > prev.fechaVencimiento) {
          membresiaPorUsuario.set(m.user_id, {
            plan_id: m.plan_id,
            fechaInicio: m.fecha_inicio ? m.fecha_inicio.slice(0, 10) : '',
            fechaVencimiento: vencimiento,
          })
        }
      }

      // 2) Mapea cada usuario real al formato de la tabla de clientes.
      const reales = (perfilesRes.data || []).map((p) => {
        const mem = membresiaPorUsuario.get(p.id) || {}
        const plan = planInfo(mem.plan_id || p.plan_id)
        return {
          id: p.id,
          nombre: p.nombre || '',
          apellido: p.apellido || '',
          ci: p.ci || '',
          telefono: p.telefono || '',
          plan: plan.plan,
          planNombre: plan.planNombre,
          fechaInicio: mem.fechaInicio || '',
          fechaVencimiento: mem.fechaVencimiento || '',
          photo: null,
        }
      })

      // 3) Fusiona los usuarios reales al inicio, combinándolos con los datos
      //    estáticos de prueba (sin duplicar).
      if (reales.length) {
        const realIds = new Set(reales.map((c) => c.id))
        const restantes = seedClients.filter((c) => !realIds.has(c.id))
        setClients([...reales, ...restantes])
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