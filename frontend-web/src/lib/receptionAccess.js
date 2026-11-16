// Acceso restringido al Panel de Recepción (Módulo 6).
// Solo la cuenta de recepción autorizada puede abrir el panel de administración.
//
// La fuente principal de rol es app_metadata.gym_role, que se asigna al crear
// usuarios vía Edge Function manage-staff o manualmente en Supabase Auth.
// El rol JWT genérico (user.role, normalmente 'authenticated') NUNCA debe
// usarse como sustituto del rol funcional del gimnasio.

export const RECEPTION_EMAIL = 'recepcion@ironforge.com'
export const RECEPTION_ROLES = ['reception', 'trainer']

// Determina si un usuario autenticado es la cuenta de Recepción o Trainer.
// Prioriza app_metadata.gym_role; el rol JWT general 'authenticated' se ignora.
// Un rol explícito de 'member' prevalece sobre el fallback por correo.
export function isReceptionUser(user) {
  // Fuente principal: rol explícito en app_metadata
  const gymRole = user?.app_metadata?.gym_role || user?.app_metadata?.role
  if (gymRole && RECEPTION_ROLES.includes(gymRole)) return true

  // Si existe un rol explícito pero no es reception/trainer, no usar fallback por correo
  // Esto previene que un miembro con email de recepción tenga acceso de staff
  if (gymRole) return false

  // Fuente secundaria: correos históricos (solo si no tienen rol explícito)
  // Se mantiene para compatibilidad hasta migración completa.
  const email = user?.email || user?.correo || user?.user_metadata?.email
  if (email) {
    const normalizedEmail = String(email).toLowerCase().trim()
    return normalizedEmail === RECEPTION_EMAIL
  }

  return false
}