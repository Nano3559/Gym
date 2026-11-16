// Acceso restringido al Panel Administrativo y Dashboard de Métricas (Módulo 7).
// Solo la cuenta de administrador autorizada puede abrir el panel de admin.
//
// La fuente principal de rol es app_metadata.gym_role, que se asigna al crear
// usuarios vía Edge Function manage-staff o manualmente en Supabase Auth.
// El rol JWT genérico (user.role, normalmente 'authenticated') NUNCA debe
// usarse como sustituto del rol funcional del gimnasio.

export const ADMIN_ROLE = 'admin'

// Determina si un usuario autenticado es la cuenta de Administración.
// Prioriza app_metadata.gym_role; el rol JWT general 'authenticated' se ignora.
// Un rol explícito de 'member' prevalece sobre el fallback por correo.
export function isAdminUser(user) {
  // Fuente principal: rol explícito en app_metadata
  const gymRole = user?.app_metadata?.gym_role || user?.app_metadata?.role
  if (gymRole === ADMIN_ROLE) return true

  // Si existe un rol explícito pero no es 'admin', no usar fallback por correo
  // Esto previene que un miembro con email de staff tenga acceso administrativo
  if (gymRole) return false

  // Fuente secundaria: correos históricos (solo si no tienen rol explícito)
  // Se mantiene para compatibilidad hasta migración completa.
  const email = user?.email || user?.correo || user?.user_metadata?.email
  if (email) {
    const normalizedEmail = String(email).toLowerCase().trim()
    return normalizedEmail === ADMIN_ROLE + '@ironforge.com'
  }

  return false
}