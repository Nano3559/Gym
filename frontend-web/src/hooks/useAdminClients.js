import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { seedClients, seedAttendance, todayISO, PLAN_NAMES } from '../data/adminData'
import { getRegisteredClients, toClientShape } from '../lib/registeredClients'

function fmtHora(d = new Date()) {
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Datos del Módulo 6 (recepción / administración): clientes y asistencias del día.
 * Si Supabase está configurado, los errores de lectura se propagan a la UI.
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
    setLoading(true)
    try {
      let reales = []
      let hasRemoteSession = false
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (sessionData?.session) {
          hasRemoteSession = true
          // Perfiles, planes y membresías para el panel de recepción.
          const [perfilesRes, planesRes, membresiasRes, paymentsRes, attendanceRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, nombre, apellido, ci, telefono, fecha_nacimiento, foto_url, plan_id'),
            supabase.from('plans').select('id, codigo, nombre'),
            supabase.from('memberships').select('id, user_id, plan_id, fecha_inicio, fecha_vencimiento, estado, congelada_desde, congelada_hasta'),
            supabase.from('payments').select('user_id, monto, estado_pago'),
            supabase
              .from('gym_attendance')
              .select('id, user_id, fecha, estado, motivo')
              .gte('fecha', `${todayISO()}T00:00:00`)
              .order('fecha', { ascending: false }),
          ])
          if (perfilesRes.error) throw perfilesRes.error
          if (planesRes.error) throw planesRes.error
          if (membresiasRes.error) throw membresiasRes.error
          if (paymentsRes.error) throw paymentsRes.error
          if (attendanceRes.error) throw attendanceRes.error

          const deudaPorUsuario = new Map()
          for (const payment of paymentsRes.data || []) {
            if (payment.estado_pago === 'pendiente') {
              deudaPorUsuario.set(
                payment.user_id,
                (deudaPorUsuario.get(payment.user_id) || 0) + Number(payment.monto || 0)
              )
            }
          }

          const planesById = new Map((planesRes.data || []).map((p) => [p.id, p]))
          const planInfo = (planId) => {
            const p = planesById.get(planId)
            return { plan: p?.codigo || '', planNombre: p?.nombre || '' }
          }

          const membresiaPorUsuario = new Map()
          for (const m of membresiasRes.data || []) {
            const vencimiento = m.fecha_vencimiento ? m.fecha_vencimiento.slice(0, 10) : ''
            const prev = membresiaPorUsuario.get(m.user_id)
            if (!prev || vencimiento > prev.fechaVencimiento) {
              membresiaPorUsuario.set(m.user_id, {
                id: m.id,
                plan_id: m.plan_id,
                fechaInicio: m.fecha_inicio ? m.fecha_inicio.slice(0, 10) : '',
                fechaVencimiento: vencimiento,
                congelada_desde: m.congelada_desde,
                congelada_hasta: m.congelada_hasta,
                estado: m.estado,
              })
            }
          }

          reales = await Promise.all((perfilesRes.data || []).map(async (p) => {
            const mem = membresiaPorUsuario.get(p.id) || {}
            const plan = planInfo(mem.plan_id || p.plan_id)
            let photo = p.foto_url || null
            if (photo && !/^(https?:|data:)/i.test(photo)) {
              const { data, error } = await supabase.storage
                .from('member-photos')
                .createSignedUrl(photo, 3600)
              if (error) throw error
              photo = data.signedUrl
            }
            return {
              id: p.id,
              nombre: p.nombre || '',
              apellido: p.apellido || '',
              ci: p.ci || '',
              telefono: p.telefono || '',
              fechaNacimiento: p.fecha_nacimiento || '',
              photo,
              deuda: deudaPorUsuario.get(p.id) || 0,
              membershipId: mem.id || null,
              congeladaDesde: membresiaPorUsuario.get(p.id)?.congelada_desde || null,
              congeladaHasta: mem.congelada_hasta || null,
              plan: plan.plan,
              planNombre: plan.planNombre,
              fechaInicio: mem.fechaInicio || '',
              fechaVencimiento: mem.fechaVencimiento || '',
            }
          }))
          const profilesById = new Map((perfilesRes.data || []).map((profile) => [profile.id, profile]))
          setAttendance((attendanceRes.data || []).map((item) => {
            const profile = profilesById.get(item.user_id)
            return {
              id: item.id,
              fecha: item.fecha,
              hora: new Date(item.fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
              estado: item.estado,
              plan: '',
              client: {
                id: item.user_id,
                nombre: profile?.nombre || '',
                apellido: profile?.apellido || '',
                ci: profile?.ci || '',
              },
            }
          }))
        }
      }

      // 3) Lectura híbrida: combina 3 fuentes sin duplicar por email o CI.
      //    - Clientes registrados localmente (localStorage)
      //    - Usuarios reales de Supabase (profiles + memberships)
      //    - Semilla de clientes de prueba (seedClients)
      //    Los clientes de localStorage y Supabase se colocan al inicio.
      const locales = getRegisteredClients().map(toClientShape)
      const unificados = [...locales, ...reales, ...(hasRemoteSession ? [] : seedClients)]
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
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  const registerAttendance = useCallback(async (client, estado = 'permitido', reason = '') => {
    const now = new Date()
    const fecha = todayISO()
    const record = {
      id: `att-${Date.now()}`,
      fecha,
      hora: fmtHora(now),
      plan: client.planNombre || client.plan || '',
      estado,
      motivo: estado === 'denegado' ? reason || 'Ingreso denegado por validación del sistema' : null,
      client: {
        id: client.id,
        nombre: client.nombre,
        apellido: client.apellido,
        ci: client.ci,
      },
    }

    if (isSupabaseConfigured && supabase && client.id && !String(client.id).startsWith('cli-')) {
      const { error } = await supabase.from('gym_attendance').insert({
        user_id: client.id,
        estado,
        motivo: record.motivo,
      })
      if (error) throw error
    }

    setAttendance((prev) => [record, ...prev])
    return record
  }, [])

  const getClientHistory = useCallback(async (clientId) => {
    if (!isSupabaseConfigured || !supabase || String(clientId).startsWith('cli-')) {
      return { payments: [], attendance: [] }
    }
    const [paymentsRes, attendanceRes] = await Promise.all([
      supabase
        .from('payments')
        .select('id, monto, metodo_pago, estado_pago, transaction_id, created_at')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('gym_attendance')
        .select('id, fecha, estado, motivo')
        .eq('user_id', clientId)
        .order('fecha', { ascending: false }),
    ])
    if (paymentsRes.error) throw paymentsRes.error
    if (attendanceRes.error) throw attendanceRes.error
    return { payments: paymentsRes.data || [], attendance: attendanceRes.data || [] }
  }, [])

  const updateClient = useCallback(async (client) => {
    let newPhotoPath = null
    if (isSupabaseConfigured && supabase && client.id && !String(client.id).startsWith('cli-')) {
      const profileUpdate = {
        nombre: client.nombre,
        apellido: client.apellido,
        telefono: client.telefono,
      }
      if (client.photo?.startsWith('data:image/')) {
        const photoBlob = await (await fetch(client.photo)).blob()
        const upload = await supabase.storage
          .from('member-photos')
          .upload(`${client.id}/profile.jpg`, photoBlob, {
            upsert: true,
            contentType: 'image/jpeg',
          })
        if (upload.error) throw upload.error
        newPhotoPath = upload.data.path
        profileUpdate.foto_url = newPhotoPath
      }
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', client.id)
      if (error) throw error
    } else {
      const all = getRegisteredClients()
      const old = all.find((item) => item.id === client.id)
      if (old) {
        const updated = {
          ...old,
          name: `${client.nombre} ${client.apellido}`.trim(),
          phone: client.telefono,
          photo: client.photo,
        }
        window.localStorage.setItem(
          'gym_registered_clients',
          JSON.stringify(all.map((item) => item.id === client.id ? updated : item))
        )
      }
    }
    let saved = client
    if (isSupabaseConfigured && supabase && newPhotoPath) {
      const { data, error } = await supabase.storage
        .from('member-photos')
        .createSignedUrl(newPhotoPath, 3600)
      if (error) throw error
      saved = { ...client, photo: data.signedUrl }
    }
    setClients((prev) => prev.map((item) => item.id === client.id ? saved : item))
    return saved
  }, [])

  const freezeMembership = useCallback(async (membershipId, days) => {
    if (!membershipId) throw new Error('No se encontró una membresía vigente.')
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData?.session) {
        const { error } = await supabase.rpc('freeze_membership', {
          p_membership_id: membershipId,
          p_days: days,
        })
        if (error) throw error
      }
    }
    setClients((prev) => prev.map((client) =>
      client.membershipId === membershipId
        ? {
            ...client,
            congeladaDesde: new Date().toISOString(),
            congeladaHasta: new Date(Date.now() + days * 86400000).toISOString(),
            fechaVencimiento: new Date(
              new Date(`${client.fechaVencimiento}T00:00:00`).getTime() + days * 86400000
            ).toISOString().slice(0, 10),
          }
        : client
    ))
  }, [])

  const renewMembership = useCallback(
    async (clientId, planCode, metodoPago) => {
      const client = clients.find((c) => c.id === clientId)
      if (!client) return null

      let durationDays = 30
      let price = 0
      let planId = planCode
      if (isSupabaseConfigured && supabase && !String(client.id).startsWith('cli-')) {
        const { data: plan, error: planError } = await supabase
          .from('plans')
          .select('id, precio, duracion_dias')
          .eq('codigo', planCode)
          .maybeSingle()
        if (planError) throw planError
        if (!plan) throw new Error('El plan seleccionado ya no está disponible.')
        durationDays = Number(plan.duracion_dias)
        price = Number(plan.precio)
        planId = plan.id
      }

      const base = new Date()
      const current = new Date(client.fechaVencimiento)
      if (!Number.isNaN(current.getTime()) && current.getTime() > Date.now()) base.setTime(current.getTime())
      base.setDate(base.getDate() + durationDays)

      const updated = {
        ...client,
        plan: planCode,
        planNombre: PLAN_NAMES[planCode] || client.planNombre,
        fechaInicio: todayISO(),
        fechaVencimiento: base.toISOString().slice(0, 10),
      }

      if (isSupabaseConfigured && supabase && !String(client.id).startsWith('cli-')) {
        const { error } = await supabase.rpc('procesar_pago_exitoso', {
          p_transaction_id: `renov-${globalThis.crypto.randomUUID()}`,
          p_user_id: client.id,
          p_plan_id: planId,
          p_monto: price,
          p_metodo_pago: metodoPago,
        })
        if (error) throw error
      }

      setClients((prev) => prev.map((c) => (c.id === clientId ? updated : c)))
      return updated
    },
    [clients]
  )

  return {
    clients,
    attendance,
    loading,
    refresh,
    registerAttendance,
    renewMembership,
    getClientHistory,
    updateClient,
    freezeMembership,
  }
}