#!/usr/bin/env node

/**
 * Inicialización administrativa de cuentas internas de IronForge Gym.
 *
 * - No ejecuta migraciones ni modifica políticas RLS.
 * - Crea el administrador únicamente en Supabase Auth.
 * - Crea recepción en Supabase Auth y, cuando corresponda, en staff_accounts.
 * - No modifica roles ni contraseñas de cuentas preexistentes.
 * - Utiliza el SDK @supabase/supabase-js instalado y bloqueado en frontend-web.
 */

import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import process from 'node:process'

const frontendRequire = createRequire(
  new URL('../../frontend-web/package.json', import.meta.url),
)

export const MIN_PASSWORD_LENGTH = 8
export const DEFAULT_USERS_PER_PAGE = 100
export const DEFAULT_MAX_USER_PAGES = 1000

/**
 * La creación de usuarios en Supabase Auth y las filas de `staff_accounts` en
 * PostgreSQL no comparten transacción. El script no puede garantizar
 * atomicidad distribuida, por lo que exige una confirmación explícita antes de
 * ejecutar escrituras.
 */
export const NON_ATOMIC_ACKNOWLEDGEMENT_ENV = 'STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC'
export const NON_ATOMIC_ACKNOWLEDGEMENT_VALUE = 'yes'

export const ACCOUNTS = Object.freeze([
  Object.freeze({
    email: 'admin@ironforge.com',
    role: 'admin',
    displayName: 'Administrador',
    requiresStaffRecord: false,
  }),
  Object.freeze({
    email: 'recepcion@ironforge.com',
    role: 'reception',
    displayName: 'Recepción',
    requiresStaffRecord: true,
  }),
])

export const SUCCESS_STATUSES = Object.freeze([
  'created',
  'created_with_staff',
  'existing_valid',
  'existing_staff_created',
])

export class ConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export class PasswordValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PasswordValidationError'
  }
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function escapeIlikePattern(value) {
  return String(value).replace(/[\\%_]/g, '\\$&')
}

export function validateConfiguration(env = process.env) {
  const requiredNames = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PROJECT_REF',
  ]
  const missing = requiredNames.filter(name => !String(env[name] || '').trim())

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Faltan variables de entorno obligatorias: ${missing.join(', ')}.`,
    }
  }

  const supabaseUrl = String(env.SUPABASE_URL).trim()
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY).trim()
  const projectRef = String(env.SUPABASE_PROJECT_REF).trim().toLowerCase()

  if (!/^[a-z0-9][a-z0-9-]*$/.test(projectRef)) {
    return {
      ok: false,
      error: 'SUPABASE_PROJECT_REF no tiene un formato válido.',
    }
  }

  let parsedUrl
  try {
    parsedUrl = new URL(supabaseUrl)
  } catch {
    return {
      ok: false,
      error: 'SUPABASE_URL no es una URL válida.',
    }
  }

  if (parsedUrl.protocol !== 'https:') {
    return {
      ok: false,
      error: 'SUPABASE_URL debe usar HTTPS.',
    }
  }

  // La URL debe identificar únicamente al proyecto: sin credenciales propias,
  // puertos, rutas, parámetros ni fragmentos que puedan alterar el destino.
  if (parsedUrl.username || parsedUrl.password) {
    return {
      ok: false,
      error: 'SUPABASE_URL no debe incluir credenciales embebidas.',
    }
  }

  if (parsedUrl.port !== '') {
    return {
      ok: false,
      error: 'SUPABASE_URL no debe incluir un puerto explícito.',
    }
  }

  if (parsedUrl.search || parsedUrl.hash) {
    return {
      ok: false,
      error: 'SUPABASE_URL no debe incluir parámetros ni fragmentos.',
    }
  }

  if (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
    return {
      ok: false,
      error: 'SUPABASE_URL no debe incluir una ruta.',
    }
  }

  const expectedHostname = `${projectRef}.supabase.co`
  if (parsedUrl.hostname.toLowerCase() !== expectedHostname) {
    return {
      ok: false,
      error: 'SUPABASE_URL no corresponde al SUPABASE_PROJECT_REF esperado.',
    }
  }

  return {
    ok: true,
    config: {
      // Se normaliza sin barra final para que el SDK reciba siempre el origen.
      supabaseUrl: parsedUrl.origin,
      serviceRoleKey,
      projectRef,
    },
  }
}

export function createSupabaseAdminClient(config) {
  const { createClient } = frontendRequire('@supabase/supabase-js')
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function errorMessage(error, fallback = 'Error desconocido.') {
  return String(error?.message || error || fallback)
}

function redactSecret(message, secret) {
  if (!secret) return message
  return message.split(secret).join('[REDACTED]')
}

function paginationNumber(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null
}

/**
 * Busca un usuario por correo usando todas las páginas necesarias.
 *
 * Retorna un resultado discriminado. Un error de Supabase nunca se convierte
 * en "usuario inexistente".
 */
export async function findUserByEmail(
  client,
  email,
  {
    perPage = DEFAULT_USERS_PER_PAGE,
    maxPages = DEFAULT_MAX_USER_PAGES,
  } = {},
) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return { status: 'error', message: 'El correo de búsqueda está vacío.' }
  }

  const seenUsers = new Set()
  const seenUserIds = new Set()
  const seenEmails = new Set()
  const seenPageSignatures = new Set()
  let page = 1
  let expectedTotal = null

  while (page <= maxPages) {
    let response
    try {
      response = await client.auth.admin.listUsers({ page, perPage })
    } catch (error) {
      return {
        status: 'error',
        message: errorMessage(error, 'No se pudo consultar la lista de usuarios.'),
      }
    }

    if (response?.error) {
      return {
        status: 'error',
        message: errorMessage(response.error, 'No se pudo consultar la lista de usuarios.'),
      }
    }

    const users = response?.data?.users
    if (!Array.isArray(users)) {
      return {
        status: 'error',
        message: 'Supabase Auth devolvió una respuesta de usuarios inválida.',
      }
    }

    const pageSignature = users
      .map(user => user?.id || normalizeEmail(user?.email))
      .join('|')
    if (pageSignature && seenPageSignatures.has(pageSignature)) {
      return {
        status: 'error',
        message: 'La paginación de usuarios repitió una página; ejecución abortada.',
      }
    }
    if (pageSignature) seenPageSignatures.add(pageSignature)

    const rawTotal = response.data.total
    const total = paginationNumber(rawTotal)
    if (rawTotal !== undefined && rawTotal !== null && total === null) {
      return {
        status: 'error',
        message: 'Supabase Auth devolvió un total de usuarios inválido.',
      }
    }
    if (total !== null && total > 0) {
      if (expectedTotal !== null && expectedTotal !== total) {
        return {
          status: 'error',
          message: 'El total de usuarios cambió durante la paginación; ejecución abortada.',
        }
      }
      expectedTotal = total
    }

    const rawNextPage = response.data.nextPage
    let hasNextPage = false
    if (rawNextPage !== undefined && rawNextPage !== null) {
      const nextPage = paginationNumber(rawNextPage)
      if (nextPage === null || nextPage <= 0) {
        return {
          status: 'error',
          message: 'Supabase Auth devolvió una paginación de usuarios inválida.',
        }
      }
      hasNextPage = true
    }

    let foundUser = null
    for (const user of users) {
      const userId = String(user?.id || '').trim()
      const userEmail = normalizeEmail(user?.email)
      if (!userId && !userEmail) {
        return {
          status: 'error',
          message: 'Supabase Auth devolvió un usuario sin identificador ni correo.',
        }
      }

      if (userId && seenUserIds.has(userId)) {
        return {
          status: 'error',
          message: 'La paginación de usuarios se solapó; ejecución abortada.',
        }
      }
      if (userEmail && seenEmails.has(userEmail)) {
        return {
          status: 'error',
          message: 'La paginación de usuarios repitió un correo; ejecución abortada.',
        }
      }

      if (userId) seenUserIds.add(userId)
      if (userEmail) seenEmails.add(userEmail)
      seenUsers.add(userId || userEmail)

      if (userEmail === normalizedEmail && !foundUser) {
        foundUser = user
      }
    }

    if (expectedTotal !== null && seenUsers.size > expectedTotal) {
      return {
        status: 'error',
        message: 'Supabase Auth devolvió más usuarios que el total informado; ejecución abortada.',
      }
    }
    if (foundUser) {
      return { status: 'found', user: foundUser }
    }

    if (expectedTotal !== null && seenUsers.size >= expectedTotal) {
      if (hasNextPage) {
        return {
          status: 'error',
          message: 'La paginación de usuarios es contradictoria; ejecución abortada.',
        }
      }
      return { status: 'not_found' }
    }

    if (users.length < perPage) {
      if (
        hasNextPage ||
        (expectedTotal !== null && seenUsers.size < expectedTotal)
      ) {
        return {
          status: 'error',
          message: 'La paginación de usuarios está incompleta; ejecución abortada.',
        }
      }
      return { status: 'not_found' }
    }

    // Se avanza secuencialmente porque algunas versiones del SDK interpretan
    // de forma incompleta el encabezado `nextPage` para números mayores de 9.
    page += 1
  }

  return {
    status: 'error',
    message: `La paginación de usuarios excedió el límite de ${maxPages} páginas.`,
  }
}

/**
 * Consulta una única fila de personal por una columna y un matcher.
 */
async function queryStaffRecord(client, { column, matcher, value }) {
  let response
  try {
    const builder = client
      .from('staff_accounts')
      .select('user_id,nombre,email,rol,activo')
    const filtered = matcher === 'ilike'
      ? builder.ilike(column, value)
      : builder.eq(column, value)
    response = await filtered.maybeSingle()
  } catch (error) {
    return {
      status: 'error',
      message: errorMessage(error, 'No se pudo consultar staff_accounts.'),
    }
  }

  if (response?.error) {
    return {
      status: 'error',
      message: errorMessage(response.error, 'No se pudo consultar staff_accounts.'),
    }
  }
  if (response?.data) return { status: 'found', record: response.data }
  return { status: 'not_found' }
}

/**
 * Busca una fila de personal por user_id y también por correo, sin distinguir
 * mayúsculas. Se consultan ambas vías porque `staff_accounts.email` es
 * `text unique` sensible a mayúsculas en PostgreSQL: dos filas podrían
 * compartir el mismo correo con distinta capitalización y pasar inadvertidas
 * si solo se comprobara el `user_id`.
 *
 * Una consulta ambigua (más de una fila) o dos filas distintas con el mismo
 * correo se informan como error, nunca como ausencia.
 */
export async function findStaffRecord(client, { userId, email }) {
  const normalizedEmail = normalizeEmail(email)

  const byUserId = userId
    ? await queryStaffRecord(client, {
        column: 'user_id',
        matcher: 'eq',
        value: userId,
      })
    : { status: 'not_found' }
  if (byUserId.status === 'error') return byUserId

  const byEmail = normalizedEmail
    ? await queryStaffRecord(client, {
        column: 'email',
        matcher: 'ilike',
        value: escapeIlikePattern(normalizedEmail),
      })
    : { status: 'not_found' }
  if (byEmail.status === 'error') return byEmail

  if (byUserId.status === 'found' && byEmail.status === 'found') {
    if (byUserId.record.user_id !== byEmail.record.user_id) {
      return {
        status: 'error',
        message:
          'Existen filas de staff_accounts en conflicto para el mismo correo; ' +
          'ejecución abortada.',
      }
    }
    return byUserId
  }

  if (byUserId.status === 'found') return byUserId
  if (byEmail.status === 'found') return byEmail
  return { status: 'not_found' }
}

function staffIdentityMatches(record, account, authUser) {
  return Boolean(
    record &&
    record.user_id === authUser.id &&
    normalizeEmail(record.email) === normalizeEmail(account.email) &&
    record.rol === account.role,
  )
}

async function inspectAccountState(
  client,
  account,
  { perPage, maxPages },
) {
  const authLookup = await findUserByEmail(
    client,
    account.email,
    { perPage, maxPages },
  )
  if (authLookup.status === 'error') {
    return {
      status: 'error',
      message: `Error consultando usuarios: ${authLookup.message}`,
    }
  }

  const staffLookup = await findStaffRecord(client, {
    userId: authLookup.status === 'found' ? authLookup.user.id : undefined,
    email: account.email,
  })
  if (staffLookup.status === 'error') {
    return {
      status: 'error',
      message: `Error consultando staff_accounts: ${staffLookup.message}`,
    }
  }

  return {
    status: 'ok',
    authLookup,
    staffLookup,
  }
}

function authStateChanged(initialLookup, verifiedLookup) {
  if (initialLookup.status !== verifiedLookup.status) return true
  if (initialLookup.status !== 'found') return false

  return (
    initialLookup.user.id !== verifiedLookup.user.id ||
    initialLookup.user.app_metadata?.gym_role !==
      verifiedLookup.user.app_metadata?.gym_role
  )
}

function staffStateChanged(initialLookup, verifiedLookup) {
  if (initialLookup.status !== verifiedLookup.status) return true
  if (initialLookup.status !== 'found') return false

  const initial = initialLookup.record
  const verified = verifiedLookup.record
  return (
    initial.user_id !== verified.user_id ||
    normalizeEmail(initial.email) !== normalizeEmail(verified.email) ||
    initial.rol !== verified.rol ||
    initial.activo !== verified.activo
  )
}

/**
 * Compara el estado relevante de Auth y staff_accounts entre dos lecturas.
 */
export function accountStateChanged(initial, verified) {
  return (
    authStateChanged(initial.authLookup, verified.authLookup) ||
    staffStateChanged(initial.staffLookup, verified.staffLookup)
  )
}

/**
 * Relectura puntual inmediatamente antes de una escritura.
 *
 * Reduce la ventana de concurrencia, pero NO la elimina: entre esta lectura y
 * el `insert`/`createUser` sigue existiendo un intervalo en el que otro
 * proceso puede modificar Auth o staff_accounts. No sustituye una transacción
 * ni una restricción de base de datos.
 */
async function recheckBeforeWrite(client, account, expected, { perPage, maxPages }) {
  const inspection = await inspectAccountState(client, account, { perPage, maxPages })
  if (inspection.status === 'error') {
    return { ok: false, status: 'error', message: inspection.message }
  }
  if (accountStateChanged(expected, inspection)) {
    return {
      ok: false,
      status: 'blocked_concurrent_change',
      message:
        'El estado de la cuenta cambió justo antes de la escritura; no se ' +
        'modificó. Vuelva a ejecutar el script para revisar el estado actual.',
    }
  }
  return { ok: true }
}

export async function insertStaffRecord(client, record) {
  try {
    const response = await client
      .from('staff_accounts')
      .insert(record)
      .select('user_id,nombre,email,rol,activo')
      .single()

    if (response?.error) {
      return {
        ok: false,
        error: errorMessage(response.error, 'No se pudo crear el registro de personal.'),
      }
    }

    return { ok: true, data: response.data }
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, 'No se pudo crear el registro de personal.'),
    }
  }
}

export async function createAuthUser(client, { email, password, role, displayName }) {
  try {
    const response = await client.auth.admin.createUser({
      email: normalizeEmail(email),
      password,
      email_confirm: true,
      app_metadata: { gym_role: role },
      user_metadata: { nombre: displayName },
    })

    if (response?.error) {
      return {
        ok: false,
        error: redactSecret(
          errorMessage(response.error, 'No se pudo crear el usuario de Supabase Auth.'),
          password,
        ),
      }
    }
    if (!response?.data?.user?.id) {
      return {
        ok: false,
        error: 'Supabase Auth no devolvió el identificador del usuario creado.',
      }
    }

    return { ok: true, user: response.data.user }
  } catch (error) {
    return {
      ok: false,
      error: redactSecret(
        errorMessage(error, 'No se pudo crear el usuario de Supabase Auth.'),
        password,
      ),
    }
  }
}

/**
 * Elimina un usuario Auth y verifica su ausencia. Solo debe invocarse para
 * usuarios creados por la ejecución actual.
 */
export async function deleteAndVerifyAuthUser(client, userId, createdUserIds) {
  if (!(createdUserIds instanceof Set) || !createdUserIds.has(userId)) {
    return {
      ok: false,
      verified: false,
      message: 'La eliminación fue rechazada porque el usuario no fue creado en esta ejecución.',
    }
  }

  let deleteError = null
  try {
    const response = await client.auth.admin.deleteUser(userId)
    if (response?.error) deleteError = response.error
  } catch (error) {
    deleteError = error
  }

  const deleteFailure = deleteError
    ? `La eliminación devolvió un error: ${errorMessage(deleteError)}.`
    : null

  try {
    const response = await client.auth.admin.getUserById(userId)
    if (response?.error) {
      if (response.error.status === 404) {
        return {
          ok: true,
          verified: true,
          message: deleteFailure
            ? `Usuario ausente verificado. ${deleteFailure}`
            : 'Usuario eliminado y ausencia verificada.',
        }
      }
      return {
        ok: false,
        verified: false,
        message: [
          deleteFailure,
          errorMessage(response.error, 'No se pudo verificar la eliminación.'),
        ].filter(Boolean).join(' '),
      }
    }

    if (!response?.data?.user) {
      return {
        ok: false,
        verified: false,
        message: [
          deleteFailure,
          'Supabase Auth no confirmó la ausencia del usuario; la eliminación no pudo verificarse.',
        ].filter(Boolean).join(' '),
      }
    }

    return {
      ok: false,
      verified: false,
      message: [
        deleteFailure,
        'El usuario todavía existe después del intento de eliminación.',
      ].filter(Boolean).join(' '),
    }
  } catch (error) {
    return {
      ok: false,
      verified: false,
      message: [
        deleteFailure,
        errorMessage(error, 'No se pudo verificar la eliminación.'),
      ].filter(Boolean).join(' '),
    }
  }
}

/**
 * Lector de contraseña reutilizable. El readline recibe un output descartado,
 * mientras las indicaciones se escriben únicamente en la salida real. Así el
 * terminal queda en modo raw y no muestra los caracteres introducidos.
 */
export function createHiddenPasswordReader({
  input = process.stdin,
  output = process.stdout,
} = {}) {
  if (!input?.isTTY || typeof input.setRawMode !== 'function') {
    throw new ConfigurationError(
      'Se requiere una terminal interactiva con soporte de entrada oculta. ' +
      'La ejecución se detuvo para no exponer contraseñas.',
    )
  }
  if (typeof output?.write !== 'function') {
    throw new ConfigurationError('La salida de terminal no es válida.')
  }

  const hiddenOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  const readline = createInterface({
    input,
    output: hiddenOutput,
    terminal: true,
  })
  let closed = false
  let pendingRead = null

  const rejectPendingRead = error => {
    if (!pendingRead) return
    const { reject } = pendingRead
    pendingRead = null
    reject(error)
  }

  readline.once('close', () => {
    closed = true
    rejectPendingRead(
      new ConfigurationError(
        'La entrada de contraseña se cerró antes de completar la introducción.',
      ),
    )
  })

  return {
    async read(label) {
      if (closed) {
        throw new ConfigurationError('El lector de contraseña ya fue cerrado.')
      }
      if (pendingRead) {
        throw new ConfigurationError(
          'No se puede leer una contraseña mientras hay otra lectura pendiente.',
        )
      }

      output.write(`${label}: `)
      try {
        const value = await new Promise((resolve, reject) => {
          pendingRead = { resolve, reject }
          readline.question('').then(
            answer => {
              if (pendingRead?.resolve === resolve) pendingRead = null
              resolve(answer)
            },
            error => {
              if (pendingRead?.reject === reject) pendingRead = null
              reject(error)
            },
          )
        })
        output.write('\n')
        return value
      } catch (error) {
        output.write('\n')
        throw error
      }
    },
    close() {
      if (closed) return
      closed = true
      rejectPendingRead(
        new ConfigurationError('La lectura de contraseña fue cancelada.'),
      )
      readline.close()
    },
    get isClosed() {
      return closed
    },
  }
}

export async function promptPasswordWithConfirmation(reader, account) {
  const password = await reader.read(`Contraseña de ${account.displayName}`)
  const confirmation = await reader.read(`Confirme la contraseña de ${account.displayName}`)

  if (password !== confirmation) {
    throw new PasswordValidationError('Las contraseñas no coinciden.')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    )
  }

  return password
}

function buildSummary(results) {
  const counts = {}
  for (const result of results) {
    counts[result.status] = (counts[result.status] || 0) + 1
  }

  const successful = results.filter(result => SUCCESS_STATUSES.includes(result.status)).length
  return {
    ok: successful === results.length,
    total: results.length,
    successful,
    unsuccessful: results.length - successful,
    counts,
    results,
  }
}

function buildPreflightFailure(accounts, failedEmail, message) {
  return buildSummary(accounts.map(account => ({
    email: account.email,
    status: account.email === failedEmail ? 'error' : 'not_processed',
    message: account.email === failedEmail
      ? message
      : 'No se procesó porque el preflight falló antes de cualquier escritura.',
  })))
}

/**
 * Ejecuta la inicialización con un cliente inyectable. Toda la lógica usada
 * por el CLI se encuentra en esta función y es la que importan las pruebas.
 */
export async function runInitialization({
  client,
  accounts = ACCOUNTS,
  passwordPrompt,
  perPage = DEFAULT_USERS_PER_PAGE,
  maxPages = DEFAULT_MAX_USER_PAGES,
  acknowledgeNonAtomic = false,
} = {}) {
  // Condición de seguridad: sin confirmación explícita no se ejecuta ninguna
  // lectura ni escritura. La operación no es atómica entre Auth y PostgreSQL.
  if (acknowledgeNonAtomic !== true) {
    throw new ConfigurationError(
      'La inicialización no es atómica entre Supabase Auth y PostgreSQL. ' +
      'Confirme la ejecución con acknowledgeNonAtomic: true o con la variable ' +
      `${NON_ATOMIC_ACKNOWLEDGEMENT_ENV}=${NON_ATOMIC_ACKNOWLEDGEMENT_VALUE}.`,
    )
  }
  if (!client) throw new ConfigurationError('No se proporcionó el cliente de Supabase.')
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new ConfigurationError('No se proporcionaron cuentas para inicializar.')
  }
  if (typeof passwordPrompt !== 'function') {
    throw new ConfigurationError('No se proporcionó el lector de contraseñas.')
  }

  // Preflight: todas las lecturas de Auth y staff_accounts se realizan antes
  // de crear o modificar cualquier cuenta.
  const userLookups = new Map()
  const staffLookups = new Map()

  for (const account of accounts) {
    const inspection = await inspectAccountState(
      client,
      account,
      { perPage, maxPages },
    )
    if (inspection.status === 'error') {
      return buildPreflightFailure(
        accounts,
        account.email,
        inspection.message,
      )
    }
    userLookups.set(account.email, inspection.authLookup)
    staffLookups.set(account.email, inspection.staffLookup)
  }

  // Se solicitan todas las contraseñas necesarias antes de la primera
  // escritura. Un fallo de entrada no deja cuentas parcialmente creadas.
  const passwords = new Map()
  for (const account of accounts) {
    if (userLookups.get(account.email)?.status === 'found') continue
    if (staffLookups.get(account.email)?.status === 'found') continue

    try {
      const password = await passwordPrompt(account)
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        throw new PasswordValidationError(
          `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        )
      }
      passwords.set(account.email, password)
    } catch (error) {
      const results = accounts.map(candidate => ({
        email: candidate.email,
        status: candidate.email === account.email ? 'failed' : 'not_processed',
        message: candidate.email === account.email
          ? errorMessage(error, 'No se pudo obtener una contraseña válida.')
          : 'No se procesó porque otra cuenta no superó la validación de entrada.',
      }))
      passwords.clear()
      return buildSummary(results)
    }
  }

  // Segunda lectura completa, después de solicitar las contraseñas y justo
  // antes de escribir. Si el estado Auth o de personal cambió desde el
  // preflight inicial, la cuenta se bloquea para una nueva ejecución.
  const verifiedUserLookups = new Map()
  const verifiedStaffLookups = new Map()
  const changedAccounts = new Set()

  for (const account of accounts) {
    const inspection = await inspectAccountState(
      client,
      account,
      { perPage, maxPages },
    )
    if (inspection.status === 'error') {
      return buildPreflightFailure(
        accounts,
        account.email,
        inspection.message,
      )
    }

    const initialAuth = userLookups.get(account.email)
    const initialStaff = staffLookups.get(account.email)
    if (
      accountStateChanged(
        { authLookup: initialAuth, staffLookup: initialStaff },
        inspection,
      )
    ) {
      changedAccounts.add(account.email)
    }

    verifiedUserLookups.set(account.email, inspection.authLookup)
    verifiedStaffLookups.set(account.email, inspection.staffLookup)
  }

  const results = []
  const createdAuthUserIds = new Set()

  for (const account of accounts) {
    const lookup = verifiedUserLookups.get(account.email)

    if (changedAccounts.has(account.email)) {
      results.push({
        email: account.email,
        status: 'blocked_state_changed',
        message: 'El estado de la cuenta cambió durante la ejecución; no se modificó.',
      })
      continue
    }

    if (lookup.status === 'found') {
      const authUser = lookup.user
      const currentRole = authUser.app_metadata?.gym_role

      if (currentRole === 'disabled') {
        results.push({
          email: account.email,
          status: 'blocked_disabled',
          message: 'La cuenta está desactivada y no fue reactivada.',
        })
        continue
      }

      if (currentRole !== account.role) {
        results.push({
          email: account.email,
          status: 'blocked_role_mismatch',
          message: `El rol actual (${currentRole || 'sin rol'}) no coincide con ${account.role}; no se modificó.`,
        })
        continue
      }

      const staffLookup = verifiedStaffLookups.get(account.email)
      if (!account.requiresStaffRecord) {
        if (staffLookup?.status === 'found') {
          results.push({
            email: account.email,
            status: 'blocked_staff_conflict',
            message: 'La cuenta admin no debe tener una fila en staff_accounts; no se modificó.',
          })
          continue
        }
        results.push({
          email: account.email,
          status: 'existing_valid',
          message: 'La cuenta admin ya existe con el rol correcto.',
        })
        continue
      }

      if (staffLookup?.status === 'found') {
        const record = staffLookup.record
        const identityMatches = staffIdentityMatches(record, account, authUser)

        if (!identityMatches) {
          results.push({
            email: account.email,
            status: 'blocked_staff_mismatch',
            message: 'El registro de personal no coincide con la cuenta Auth; no se modificó.',
          })
          continue
        }
        if (record.activo !== true) {
          results.push({
            email: account.email,
            status: 'blocked_staff_inactive',
            message: 'El registro de personal está inactivo y no fue reactivado.',
          })
          continue
        }
        results.push({
          email: account.email,
          status: 'existing_valid',
          message: 'La cuenta de recepción y su registro de personal ya son coherentes.',
        })
        continue
      }

      const recheck = await recheckBeforeWrite(
        client,
        account,
        { authLookup: lookup, staffLookup },
        { perPage, maxPages },
      )
      if (!recheck.ok) {
        results.push({
          email: account.email,
          status: recheck.status,
          message: recheck.message,
        })
        continue
      }

      const insert = await insertStaffRecord(client, {
        user_id: authUser.id,
        nombre: account.displayName,
        email: normalizeEmail(account.email),
        rol: account.role,
        activo: true,
      })
      if (!insert.ok) {
        results.push({
          email: account.email,
          status: 'failed',
          message: insert.error,
        })
        continue
      }

      results.push({
        email: account.email,
        status: 'existing_staff_created',
        message: 'La cuenta Auth era válida y se creó el registro de personal faltante.',
      })
      continue
    }

    if (verifiedStaffLookups.get(account.email)?.status === 'found') {
      results.push({
        email: account.email,
        status: 'blocked_staff_conflict',
        message: 'Existe un registro de personal con este correo, pero no hay una cuenta Auth coherente; no se modificó.',
      })
      continue
    }

    const recheck = await recheckBeforeWrite(
      client,
      account,
      {
        authLookup: verifiedUserLookups.get(account.email),
        staffLookup: verifiedStaffLookups.get(account.email),
      },
      { perPage, maxPages },
    )
    if (!recheck.ok) {
      results.push({
        email: account.email,
        status: recheck.status,
        message: recheck.message,
      })
      continue
    }

    const password = passwords.get(account.email)
    const created = await createAuthUser(client, {
      email: account.email,
      password,
      role: account.role,
      displayName: account.displayName,
    })
    passwords.delete(account.email)

    if (!created.ok) {
      results.push({
        email: account.email,
        status: 'failed',
        message: created.error,
      })
      continue
    }

    createdAuthUserIds.add(created.user.id)

    if (!account.requiresStaffRecord) {
      results.push({
        email: account.email,
        status: 'created',
        message: 'Administrador creado en Supabase Auth; no se creó en staff_accounts.',
      })
      continue
    }

    const insert = await insertStaffRecord(client, {
      user_id: created.user.id,
      nombre: account.displayName,
      email: normalizeEmail(account.email),
      rol: account.role,
      activo: true,
    })

    if (!insert.ok) {
      const rollback = await deleteAndVerifyAuthUser(
        client,
        created.user.id,
        createdAuthUserIds,
      )
      createdAuthUserIds.delete(created.user.id)
      results.push({
        email: account.email,
        status: rollback.ok && rollback.verified ? 'failed_rolled_back' : 'failed_partial',
        message: `${insert.error} ${rollback.message}`,
        rollback,
      })
      continue
    }

    results.push({
      email: account.email,
      status: 'created_with_staff',
      message: 'Cuenta de recepción y registro de personal creados correctamente.',
    })
  }

  passwords.clear()
  return buildSummary(results)
}

function printSummary(summary, logger = console) {
  logger.log('\nResumen por cuenta:')
  for (const result of summary.results) {
    logger.log(`- ${result.email}: ${result.status} — ${result.message}`)
  }
  logger.log(
    `Total: ${summary.total}; correctas: ${summary.successful}; ` +
    `con incidencias: ${summary.unsuccessful}.`,
  )
}

/**
 * CLI separable para probar el cierre de recursos sin acceso remoto.
 */
export async function runCli({
  env = process.env,
  accounts = ACCOUNTS,
  clientFactory = createSupabaseAdminClient,
  readerFactory = createHiddenPasswordReader,
  logger = console,
} = {}) {
  let reader = null

  try {
    const validation = validateConfiguration(env)
    if (!validation.ok) {
      logger.error(`Error de configuración: ${validation.error}`)
      return 1
    }

    // Condición explícita para impedir una ejecución insegura: la operación
    // no es atómica y debe confirmarse de forma deliberada.
    const acknowledgement = String(
      env[NON_ATOMIC_ACKNOWLEDGEMENT_ENV] || '',
    ).trim().toLowerCase()
    if (acknowledgement !== NON_ATOMIC_ACKNOWLEDGEMENT_VALUE) {
      logger.error(
        'Error de configuración: la inicialización no es atómica entre ' +
        'Supabase Auth y PostgreSQL. Para continuar, defina ' +
        `${NON_ATOMIC_ACKNOWLEDGEMENT_ENV}=${NON_ATOMIC_ACKNOWLEDGEMENT_VALUE} ` +
        'tras confirmar que no hay procesos concurrentes sobre las cuentas.',
      )
      return 1
    }

    const client = clientFactory(validation.config)
    const summary = await runInitialization({
      client,
      accounts,
      acknowledgeNonAtomic: true,
      passwordPrompt: async account => {
        if (!reader) reader = readerFactory()
        return promptPasswordWithConfirmation(reader, account)
      },
    })

    printSummary(summary, logger)
    return summary.ok ? 0 : 1
  } catch (error) {
    logger.error(`Error crítico: ${errorMessage(error)}`)
    return 1
  } finally {
    reader?.close()
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
const isDirectInvocation = invokedPath && fileURLToPath(import.meta.url) === invokedPath

if (isDirectInvocation) {
  process.exitCode = await runCli()
}
