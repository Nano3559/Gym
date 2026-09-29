import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, seedAttendance, todayISO, PLAN_NAMES } from '../data/adminData'
import { getRegisteredClients, toClientShape } from '../lib/registeredClients'

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
        supabase.from('profiles').select('id, nombre, apellido, ci, telefono, fecha_nacimiento, plan_id'),
        supabase.from('plans').select('id, codigo, nombre'),
        supabase.from('memberships').select('user_id, plan_id, fecha_inicio, fecha_vencimiento, estado'),
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
            membresiaEstado: m.estado || 'activa',
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
          fechaNacimiento: p.fecha_nacimiento ? p.fecha_nacimiento.slice(0, 10) : '',
          plan: plan.plan,
          planNombre: plan.planNombre,
          fechaInicio: mem.fechaInicio || '',
          fechaVencimiento: mem.fechaVencimiento || '',
          membresiaEstado: mem.membresiaEstado || '',
          photo: null,
        }
      })

      // 3) Lectura híbrida: combina 3 fuentes sin duplicar por email o CI.
      //    - Clientes registrados localmente (localStorage)
      //    - Usuarios reales de Supabase (profiles + memberships)
      //    - Semilla de clientes de prueba (seedClients)
      //    Los clientes de localStorage y Supabase se colocan al inicio.
      const locales = getRegisteredClients().map(toClientShape)
      const unificados = [...locales, ...reales, ...seedClients]
      const vistos = new Set()
      const sinDuplicar = []
      for (const c of unificados) {
        const email = String(c.email || c.correo || '').trim().toLowerCase()
        const ci = String(c.ci || '').trim()
        const clave = email || ci || c.id
        if (!clave || vistos.has(clave)) continue
        vistos.add(clave)
        sinDuplicar.push(c)
      }
      setClients(sinDuplicar)
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

  const updateClient = useCallback(async (clientId, changes) => {
    const client = clients.find((item) => item.id === clientId)
    if (!client) return { ok: false, message: 'No se encontró el socio.' }

    const updated = { ...client, ...changes }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)
    if (isSupabaseConfigured && supabase && isUuid) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: changes.nombre,
          apellido: changes.apellido,
          ci: changes.ci,
          telefono: changes.telefono,
        })
        .eq('id', clientId)
      if (error) return { ok: false, message: error.message }
    }

    setClients((prev) => prev.map((item) => item.id === clientId ? updated : item))
    try {
      const saved = JSON.parse(localStorage.getItem('gym_registered_clients') || '[]')
      const next = saved.map((item) => item.id === clientId
        ? { ...item, name: `${changes.nombre} ${changes.apellido}`.trim(), ci: changes.ci, phone: changes.telefono }
        : item)
      localStorage.setItem('gym_registered_clients', JSON.stringify(next))
    } catch {
      // Los datos en memoria siguen actualizados aunque el almacenamiento local falle.
    }
    return { ok: true, client: updated }
  }, [clients])

  const setMembershipFrozen = useCallback(async (clientId, frozen) => {
    const client = clients.find((item) => item.id === clientId)
    if (!client) return { ok: false, message: 'No se encontró el socio.' }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)

    if (isSupabaseConfigured && supabase && isUuid) {
      const { data, error } = await supabase
        .from('memberships')
        .update({ estado: frozen ? 'congelada' : 'activa' })
        .eq('user_id', clientId)
        .eq('estado', frozen ? 'activa' : 'congelada')
        .select('id')
      if (error) return { ok: false, message: error.message }
      if (!data?.length) {
        return {
          ok: false,
          message: frozen
            ? 'No se encontró una membresía activa para congelar.'
            : 'No se encontró una membresía congelada para reactivar.',
        }
      }
    }

    setClients((prev) => prev.map((item) => item.id === clientId
      ? { ...item, membresiaEstado: frozen ? 'congelada' : 'activa' }
      : item))
    return { ok: true }
  }, [clients])

  const getClientPayments = useCallback(async (clientId) => {
    if (!isSupabaseConfigured || !supabase) return { ok: true, payments: [] }
    const { data, error } = await supabase
      .from('payments')
      .select('id, monto, metodo_pago, estado_pago, created_at, plans(nombre)')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
    if (error) return { ok: false, message: error.message, payments: [] }
    return { ok: true, payments: data || [] }
  }, [])

  return {
    clients,
    attendance,
    loading,
    refresh,
    registerAttendance,
    renewMembership,
    updateClient,
    setMembershipFrozen,
    getClientPayments,
  }
}