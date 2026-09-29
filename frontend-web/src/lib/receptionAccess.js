// Acceso restringido al Panel de Recepción (Módulo 6).
// Solo la cuenta de recepción autorizada puede abrir el panel de administración.

export const RECEPTION_EMAIL = 'recepcion@ironforge.com'

// Determina si un usuario autenticado es la cuenta de Recepción.
// Devuelve true solo si el correo coincide con el de la cuenta autorizada.
export function isReceptionUser(user) {
  const email = user?.email || user?.correo || user?.user_metadata?.email
  const appMetadata = user?.app_metadata || {}
  const hasStaffPanel = Array.isArray(appMetadata.staff_permissions) && appMetadata.staff_permissions.includes('dashboard')
  const activeStaff = appMetadata.staff_active !== false
  return Boolean(activeStaff && (
    (email && String(email).toLowerCase() === RECEPTION_EMAIL) ||
    ['reception', 'trainer'].includes(appMetadata.staff_role) && hasStaffPanel
  ))
}