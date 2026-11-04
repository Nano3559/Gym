import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase function configuration' })
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) return json(401, { error: 'Invalid session' })
  const callerEmail = String(callerData.user.email || '').toLowerCase()
  const callerRole = callerData.user.app_metadata?.gym_role
  if (callerEmail !== 'admin@ironforge.com' && callerRole !== 'admin') {
    return json(403, { error: 'Only administrators can manage staff' })
  }

  let body: {
    action?: string
    userId?: string
    email?: string
    password?: string
    nombre?: string
    rol?: 'reception' | 'trainer'
    activo?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  if (!['create', 'update', 'deactivate'].includes(body.action || '')) {
    return json(400, { error: 'Invalid action' })
  }
  if (body.action !== 'deactivate' &&
    (!body.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ||
      !body.nombre?.trim() ||
      !['reception', 'trainer'].includes(body.rol || ''))) {
    return json(400, { error: 'A valid name, email and staff role are required' })
  }
  if (body.action === 'create' && (body.password || '').length < 8) {
    return json(400, { error: 'Password must contain at least 8 characters' })
  }
  if (body.action !== 'create' && !body.userId) {
    return json(400, { error: 'A staff user id is required' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let userId = body.userId
  let error: { message: string } | null = null

  if (body.action === 'create') {
    const created = await adminClient.auth.admin.createUser({
      email: body.email!.trim().toLowerCase(),
      password: body.password!,
      email_confirm: true,
      app_metadata: { gym_role: body.rol },
      user_metadata: { nombre: body.nombre!.trim() },
    })
    userId = created.data.user?.id
    error = created.error
  } else {
    const updated = await adminClient.auth.admin.updateUserById(body.userId!, {
      app_metadata: { gym_role: body.action === 'deactivate' ? 'disabled' : body.rol },
      ...(body.action === 'update'
        ? {
            email: body.email!.trim().toLowerCase(),
            user_metadata: { nombre: body.nombre!.trim() },
          }
        : {}),
    })
    error = updated.error
  }
  if (error || !userId) return json(400, { error: error?.message || 'Could not update staff account' })

  if (body.action === 'deactivate') {
    const result = await adminClient
      .from('staff_accounts')
      .update({ activo: false })
      .eq('user_id', userId)
    if (result.error) return json(500, { error: result.error.message })
    return json(200, { userId, activo: false })
  }

  const staff = await adminClient.from('staff_accounts').upsert(
    {
      user_id: userId,
      nombre: body.nombre!.trim(),
      email: body.email!.trim().toLowerCase(),
      rol: body.rol!,
      activo: true,
    },
    { onConflict: 'user_id' },
  ).select().single()
  if (staff.error) return json(500, { error: staff.error.message })
  return json(200, { staff: staff.data })
})
