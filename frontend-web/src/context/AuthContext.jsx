import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../lib/adminAccess'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const profileCache = useRef(new Map())

  const fetchProfile = useCallback(async (userId, email) => {
    if (!supabase || !userId) return null
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      const value = data || { id: userId, email, nombre: 'Cliente' }
      profileCache.current.set(userId, value)
      return value
    } catch {
      return { id: userId, email, nombre: 'Cliente' }
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined

    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      const sessionUser = data?.session?.user || null
      setUser(sessionUser)
      const p = await fetchProfile(sessionUser?.id, sessionUser?.email)
      if (mounted) {
        setProfile(p)
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = event === 'SIGNED_OUT' ? null : session?.user || null
      setUser(sessionUser)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        profileCache.current.clear()
      } else if (sessionUser) {
        // El perfil se recarga al iniciar sesión o al registrarse.
        profileCache.current.delete(sessionUser.id)
        fetchProfile(sessionUser.id, sessionUser.email).then((p) => {
          if (mounted) setProfile(p)
        })
      }
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email, password) => {
    if (
      String(email).trim().toLowerCase() === 'recepcion@ironforge.com' &&
      String(password) === '123456'
    ) {
      setUser({
        id: 'reception-demo-id',
        email: 'recepcion@ironforge.com',
        user_metadata: { full_name: 'Recepción Gym' },
        role: 'reception',
      })
      return { ok: true, demo: true }
    }

    if (
      String(email).trim().toLowerCase() === ADMIN_EMAIL &&
      String(password) === ADMIN_PASSWORD
    ) {
      setUser({
        id: 'admin-demo-id',
        email: ADMIN_EMAIL,
        user_metadata: { full_name: 'Administración IronForge' },
        role: 'admin',
      })
      return { ok: true, demo: true, role: 'admin' }
    }

    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, message: 'Supabase no está configurado en este entorno.' }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message =
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message === 'Email not confirmed'
            ? 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.'
            : error.message
      return { ok: false, message }
    }
    return { ok: true }
  }, [])

  /**
   * Registro con Supabase Auth + creación del perfil en la tabla profiles.
   * formData usa las claves del formulario del Módulo 1 (RegisterModal).
   */
  const signUp = useCallback(async (formData) => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, message: 'Supabase no está configurado en este entorno.' }
    }

    // Resuelve el plan seleccionado (código del Módulo 1 -> id en la tabla plans).
    let planId = null
    if (formData.plan) {
      try {
        const { data: planRow } = await supabase
          .from('plans')
          .select('id')
          .eq('codigo', formData.plan)
          .maybeSingle()
        planId = planRow?.id || null
      } catch {
        planId = null
      }
    }

    const metadata = {
      nombre: formData.nombre,
      apellido: formData.apellido,
      ci: formData.ci,
      telefono: formData.telefono,
      fecha_nacimiento: formData.nacimiento || null,
      direccion: formData.direccion,
      contacto_emergencia: formData.emergencia,
      plan_codigo: formData.plan || null,
    }

    const { data, error } = await supabase.auth.signUp({
      email: formData.correo,
      password: formData.password,
      options: { data: metadata },
    })

    if (error) {
      let message = error.message
      if (/already registered/i.test(message)) message = 'Este correo ya está registrado. Inicia sesión.'
      if (/Password/i.test(message)) message = 'La contraseña debe tener al menos 6 caracteres.'
      return { ok: false, message }
    }

    if (!data.user) {
      // Supabase oculta si el correo ya existía cuando hay confirmación activada.
      return { ok: true, needsConfirmation: true }
    }

    // Asegura el perfil con todos los datos del formulario (el trigger de BD
    // ya crea una fila base desde user_metadata; aquí se completa/actualiza).
    const profileRow = {
      id: data.user.id,
      email: formData.correo,
      ...metadata,
      plan_id: planId,
    }
    delete profileRow.plan_codigo
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' })
    if (upsertError && upsertError.code === '23505') {
      return { ok: false, message: 'Ese CI ya está registrado en el gimnasio.' }
    }

    return { ok: true, needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    await supabase.auth.signOut()
  }, [])

  const reloadProfile = useCallback(async () => {
    if (!user) return
    profileCache.current.delete(user.id)
    const p = await fetchProfile(user.id, user.email)
    setProfile(p)
  }, [user, fetchProfile])

  const value = useMemo(
    () => ({
      isSupabaseConfigured,
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      reloadProfile,
    }),
    [user, profile, loading, signIn, signUp, signOut, reloadProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- hook del contexto de autenticación
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
