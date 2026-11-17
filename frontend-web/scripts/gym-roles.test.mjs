import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCurrentUser, gymRoleOf, staffRoleOf, DEFAULT_STAFF_ROLE } from '../src/lib/gymRole.js'
import { isAdminUser } from '../src/lib/adminAccess.js'
import { isReceptionUser } from '../src/lib/receptionAccess.js'

// Reproduce la forma de un User real de Supabase: el claim JWT genérico es
// 'authenticated' y el rol funcional vive en app_metadata.gym_role.
const sessionUser = (email, gymRole) => ({
  id: 'user-1',
  email,
  role: 'authenticated',
  app_metadata: gymRole ? { gym_role: gymRole } : {},
})

const profileFor = (email, extra = {}) => ({ id: 'user-1', email, nombre: 'Cuenta', ...extra })

function resolveAccess(authUser, extraProfile = {}) {
  const currentUser = buildCurrentUser(authUser, profileFor(authUser.email, extraProfile))
  const staffRole = staffRoleOf(currentUser)
  const isAdmin = isAdminUser(currentUser)
  return {
    currentUser,
    staffRole,
    isAdmin,
    isReception: isReceptionUser(currentUser),
    // Misma fórmula que AdminPanel.jsx: isTrainer = staffRole === 'trainer' && !isAdmin.
    isTrainer: staffRole === 'trainer' && !isAdmin,
  }
}

test('admin: authenticated no sustituye a gym_role admin', () => {
  const authUser = sessionUser('admin@ironforge.com', 'admin')
  const access = resolveAccess(authUser)

  assert.equal(gymRoleOf(authUser), 'admin')
  assert.equal(access.currentUser.role, 'admin')
  assert.notEqual(access.currentUser.role, 'authenticated')
  assert.equal(access.staffRole, 'admin')
  assert.equal(access.isAdmin, true)
  assert.equal(access.isReception, false)
  assert.equal(access.isTrainer, false)
})

test('recepción: authenticated no sustituye a gym_role reception', () => {
  const access = resolveAccess(sessionUser('recepcion@ironforge.com', 'reception'))

  assert.equal(access.currentUser.role, 'reception')
  assert.equal(access.staffRole, 'reception')
  assert.equal(access.isAdmin, false)
  assert.equal(access.isReception, true)
  assert.equal(access.isTrainer, false)
})

test('entrenador: se identifica como trainer y conserva acceso de staff', () => {
  const access = resolveAccess(sessionUser('entrenador@ironforge.com', 'trainer'))

  assert.equal(access.currentUser.role, 'trainer')
  assert.equal(access.staffRole, 'trainer')
  assert.equal(access.isAdmin, false)
  assert.equal(access.isReception, true)
  assert.equal(access.isTrainer, true)
})

test('socio: gym_role member no obtiene permisos administrativos', () => {
  const access = resolveAccess(sessionUser('socio@example.com', 'member'))

  assert.equal(access.currentUser.role, 'member')
  assert.equal(access.staffRole, 'member')
  assert.equal(access.isAdmin, false)
  assert.equal(access.isReception, false)
  assert.equal(access.isTrainer, false)
})

test('usuario sin gym_role: authenticated no se interpreta como rol del gimnasio', () => {
  const access = resolveAccess(sessionUser('socio@example.com', null))

  assert.equal(access.currentUser.role, undefined)
  assert.notEqual(access.currentUser.role, 'authenticated')
  assert.equal(access.staffRole, DEFAULT_STAFF_ROLE)
  assert.equal(access.staffRole, 'member')
  assert.equal(access.isAdmin, false)
  assert.equal(access.isReception, false)
})

test('usuario desactivado: no obtiene acceso y conserva el rol disabled', () => {
  const access = resolveAccess(sessionUser('recepcion@ironforge.com', 'disabled'))

  assert.equal(access.currentUser.role, 'disabled')
  assert.equal(access.staffRole, 'disabled')
  assert.equal(access.isAdmin, false)
  assert.equal(access.isReception, false)
  assert.equal(access.isTrainer, false)
})

test('un rol explícito distinto no otorga admin por coincidir con el correo de staff', () => {
  const adminEmailWithMember = resolveAccess(sessionUser('admin@ironforge.com', 'member'))
  const receptionEmailWithMember = resolveAccess(sessionUser('recepcion@ironforge.com', 'member'))

  assert.equal(adminEmailWithMember.isAdmin, false)
  assert.equal(adminEmailWithMember.isReception, false)
  assert.equal(receptionEmailWithMember.isAdmin, false)
  assert.equal(receptionEmailWithMember.isReception, false)
})

test('el correo histórico solo se usa cuando no existe rol explícito', () => {
  const adminByEmail = resolveAccess(sessionUser('admin@ironforge.com', null))
  const receptionByEmail = resolveAccess(sessionUser('recepcion@ironforge.com', null))

  assert.equal(adminByEmail.isAdmin, true)
  assert.equal(adminByEmail.staffRole, 'member')
  assert.equal(receptionByEmail.isReception, true)
  assert.equal(receptionByEmail.staffRole, 'member')
})

test('el claim JWT por sí solo nunca concede acceso', () => {
  const access = resolveAccess({
    id: 'user-1',
    email: 'socio@example.com',
    role: 'admin',
    app_metadata: {},
  })

  assert.equal(access.currentUser.role, undefined)
  assert.equal(access.isAdmin, false)
  assert.equal(access.isReception, false)
})

test('sin sesión no se construye usuario ni se concede acceso', () => {
  assert.equal(buildCurrentUser(null, profileFor('socio@example.com')), null)
  assert.equal(staffRoleOf(null), 'member')
  assert.equal(isAdminUser(null), false)
  assert.equal(isReceptionUser(null), false)
})
