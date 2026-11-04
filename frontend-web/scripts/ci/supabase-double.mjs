export const isSupabaseConfigured = true
export const supabase = new Proxy({}, { get(_, name) {
  if (!globalThis.__gymSupabaseDouble) throw new Error('Falta un doble explícito de Supabase')
  return globalThis.__gymSupabaseDouble[name]
} })
