// Rol funcional del gimnasio.
//
// La fuente principal es app_metadata.gym_role. El claim JWT genérico
// (user.role, normalmente 'authenticated') no representa un rol del gimnasio
// y no debe usarse como sustituto.

export const DEFAULT_STAFF_ROLE = 'member'

export function gymRoleOf(user) {
  return user?.app_metadata?.gym_role || user?.app_metadata?.role
}

// Construye el usuario que consume el panel. Conserva la forma histórica
// { nombre, ... } y no deja que el claim JWT sustituya al rol del gimnasio.
export function buildCurrentUser(authUser, profile) {
  if (!authUser) return null
  const role = gymRoleOf(authUser)
  return {
    id: authUser.id,
    email: authUser.email,
    role: role || undefined,
    app_metadata: authUser.app_metadata,
    ...(profile || {}),
    nombre: profile?.nombre || 'Cliente',
  }
}

// Fallback del panel: sin rol explícito, la cuenta es 'member', nunca staff.
export function staffRoleOf(user) {
  return user?.role || DEFAULT_STAFF_ROLE
}
