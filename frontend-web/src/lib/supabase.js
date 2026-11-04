import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// true solo cuando existen VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
// Permite que la landing del Módulo 1 siga funcionando (datos locales) sin credenciales.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'ironforge-auth',
      },
    })
  : null
