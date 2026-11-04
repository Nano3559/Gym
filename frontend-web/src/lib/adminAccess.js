// Acceso restringido al Panel Administrativo y Dashboard de Métricas (Módulo 7).
// Solo la cuenta de administrador autorizada puede abrir el panel de admin.

export const ADMIN_EMAIL = 'admin@ironforge.com'
export const ADMIN_PASSWORD = '123456'

// Determina si un usuario autenticado es la cuenta de Administración.
// Devuelve true solo si el correo coincide con el de la cuenta autorizada.
export function isAdminUser(user) {
  const email = user?.email || user?.correo || user?.user_metadata?.email
  const role = user?.role || user?.app_metadata?.gym_role || user?.app_metadata?.role
  if (role) return role === 'admin'
  return Boolean(email && String(email).toLowerCase() === ADMIN_EMAIL)
}