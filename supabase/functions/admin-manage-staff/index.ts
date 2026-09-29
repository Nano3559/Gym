import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const allowedPermissions = new Set(['dashboard', 'clients', 'attendance', 'pos', 'cash'])
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido.' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'Sesión requerida.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) return json(500, { error: 'Configura los secretos de la Edge Function.' })

  const accessToken = authorization.slice('Bearer '.length)
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const { data: caller, error: authError } = await callerClient.auth.getUser(accessToken)
  if (authError || caller.user?.email?.toLowerCase() !== 'admin@ironforge.com') {
    return json(403, { error: 'Solo el administrador puede gestionar cuentas de staff.' })
  }

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const body = await request.json()
    if (body.action === 'list') {
      const { data, error } = await adminClient.from('staff_members').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return json(200, { staff: data || [] })
    }

    if (!['create', 'update'].includes(body.action)) return json(400, { error: 'Acción no válida.' })
    const fullName = String(body.fullName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const role = body.role
    const permissions = Array.isArray(body.permissions)
      ? [...new Set(body.permissions.filter((permission: string) => allowedPermissions.has(permission)))]
      : []
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Nombre y correo válido son obligatorios.' })
    if (!['reception', 'trainer'].includes(role)) return json(400, { error: 'Rol de staff no válido.' })
    if (!permissions.includes('dashboard')) return json(400, { error: 'Todo miembro de staff debe tener acceso al dashboard.' })

    if (body.action === 'create') {
      const password = String(body.password || '')
      if (password.length < 10) return json(400, { error: 'La contraseña temporal debe tener al menos 10 caracteres.' })
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre: fullName.split(/\s+/)[0], apellido: fullName.split(/\s+/).slice(1).join(' ') },
        app_metadata: { staff_role: role, staff_permissions: permissions, staff_active: true },
      })
      if (createError) throw createError
      if (!created.user) throw new Error('Supabase no devolvió el usuario creado.')
      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: created.user.id,
        email,
        nombre: fullName.split(/\s+/)[0],
        apellido: fullName.split(/\s+/).slice(1).join(' ') || '-',
        telefono: '',
      })
      const { error: staffError } = await adminClient.from('staff_members').insert({
        user_id: created.user.id,
        email,
        full_name: fullName,
        role,
        permissions,
      })
      if (profileError || staffError) {
        await adminClient.auth.admin.deleteUser(created.user.id)
        throw profileError || staffError
      }
      return json(200, { staff: { user_id: created.user.id, email, full_name: fullName, role, permissions, active: true } })
    }

    const userId = String(body.userId || '')
    if (!userId) return json(400, { error: 'Falta el ID de usuario.' })
    const active = body.active !== false
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: { nombre: fullName.split(/\s+/)[0], apellido: fullName.split(/\s+/).slice(1).join(' ') },
      app_metadata: { staff_role: role, staff_permissions: permissions, staff_active: active },
      ban_duration: active ? 'none' : '876000h',
    })
    if (authUpdateError) throw authUpdateError
    const { error: profileError } = await adminClient.from('profiles').update({
      email,
      nombre: fullName.split(/\s+/)[0],
      apellido: fullName.split(/\s+/).slice(1).join(' ') || '-',
    }).eq('id', userId)
    if (profileError) throw profileError
    const { data, error } = await adminClient.from('staff_members')
      .update({ email, full_name: fullName, role, permissions, active })
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error) throw error
    return json(200, { staff: data })
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'No se pudo completar la acción.' })
  }
})
