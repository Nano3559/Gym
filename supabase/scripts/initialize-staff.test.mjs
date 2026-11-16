#!/usr/bin/env node

/**
 * Pruebas de initialize-staff.mjs.
 *
 * La suite importa la lógica real del script y la ejerce con un cliente de
 * Supabase simulado. No se crea ningún cliente real ni se realiza ninguna
 * petición de red.
 *
 * Ejecutar con: node supabase/scripts/initialize-staff.test.mjs
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PassThrough, Writable } from 'node:stream'

import {
  ACCOUNTS,
  MIN_PASSWORD_LENGTH,
  NON_ATOMIC_ACKNOWLEDGEMENT_ENV,
  NON_ATOMIC_ACKNOWLEDGEMENT_VALUE,
  ConfigurationError,
  PasswordValidationError,
  createHiddenPasswordReader,
  deleteAndVerifyAuthUser,
  findStaffRecord,
  findUserByEmail,
  normalizeEmail,
  promptPasswordWithConfirmation,
  runCli,
  runInitialization,
  validateConfiguration,
} from './initialize-staff.mjs'

const ADMIN_ACCOUNT = ACCOUNTS.find(account => account.role === 'admin')
const RECEPTION_ACCOUNT = ACCOUNTS.find(account => account.role === 'reception')
const VALID_ENV = Object.freeze({
  SUPABASE_URL: 'https://proyecto-prueba.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba-no-secreta',
  SUPABASE_PROJECT_REF: 'proyecto-prueba',
})

const VALID_ENV_WITH_ACK = Object.freeze({
  ...VALID_ENV,
  [NON_ATOMIC_ACKNOWLEDGEMENT_ENV]: NON_ATOMIC_ACKNOWLEDGEMENT_VALUE,
})

/**
 * La ejecución real exige reconocer explícitamente que la operación no es
 * atómica. Las pruebas de flujo lo confirman aquí; la condición de seguridad
 * se verifica en su propio caso.
 */
function runGuarded(options) {
  return runInitialization({ acknowledgeNonAtomic: true, ...options })
}

function mockKey(value) {
  return String(value || '').trim().toLowerCase()
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ilikeMatches(value, pattern) {
  let expression = '^'

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '\\' && index + 1 < pattern.length) {
      expression += escapeRegex(pattern[index + 1])
      index += 1
    } else if (character === '%') {
      expression += '.*'
    } else if (character === '_') {
      expression += '.'
    } else {
      expression += escapeRegex(character)
    }
  }

  return new RegExp(`${expression}$`, 'i').test(String(value))
}

function copyUser(user) {
  return {
    ...user,
    app_metadata: { ...user.app_metadata },
    user_metadata: { ...user.user_metadata },
  }
}

function copyStaffRecord(record) {
  return { ...record }
}

/**
 * Doble de la superficie de Supabase utilizada por el script. Las funciones
 * de negocio (búsqueda, preflight, creación y compensación) no se duplican:
 * todas se importan desde initialize-staff.mjs.
 */
function createMockSupabaseClient({
  authUsers = [],
  staffRecords = [],
  onListUsers,
  onCreateUser,
  onDeleteUser,
  onGetUserById,
  onInsertStaff,
  onStaffQuery,
} = {}) {
  const users = new Map(
    authUsers.map(user => [mockKey(user.email), copyUser(user)]),
  )
  const staffRecordsById = new Map(
    staffRecords.map(record => [record.user_id, copyStaffRecord(record)]),
  )
  const calls = {
    listUsers: [],
    createUser: [],
    deleteUser: [],
    getUserById: [],
    staffQueries: [],
    staffInserts: [],
    updateUserById: [],
  }
  let nextUserId = 1

  const context = {
    users,
    staffRecords: staffRecordsById,
    calls,
  }

  const client = {
    auth: {
      admin: {
        listUsers: async params => {
          calls.listUsers.push({ ...params })

          if (onListUsers) {
            const response = await onListUsers(params, context)
            if (response !== undefined) return response
          }

          const allUsers = [...users.values()]
          const start = (params.page - 1) * params.perPage
          return {
            data: {
              users: allUsers.slice(start, start + params.perPage),
              total: allUsers.length,
            },
            error: null,
          }
        },

        createUser: async attributes => {
          calls.createUser.push({
            email: attributes.email,
            email_confirm: attributes.email_confirm,
            app_metadata: { ...attributes.app_metadata },
            user_metadata: { ...attributes.user_metadata },
            passwordWasProvided: typeof attributes.password === 'string',
          })

          if (onCreateUser) {
            const response = await onCreateUser(attributes, context)
            if (response !== undefined) return response
          }

          const email = mockKey(attributes.email)
          if (users.has(email)) {
            return {
              data: { user: null },
              error: { message: 'User already exists' },
            }
          }

          const user = {
            id: `mock-user-${nextUserId++}`,
            email: attributes.email,
            app_metadata: { ...attributes.app_metadata },
            user_metadata: { ...attributes.user_metadata },
          }
          users.set(email, user)
          return { data: { user }, error: null }
        },

        deleteUser: async userId => {
          calls.deleteUser.push(userId)

          if (onDeleteUser) {
            const response = await onDeleteUser(userId, context)
            if (response !== undefined) return response
          }

          const entry = [...users.entries()].find(([, user]) => user.id === userId)
          if (!entry) {
            return {
              data: { user: null },
              error: { status: 404, message: 'User not found' },
            }
          }

          users.delete(entry[0])
          return { data: { user: entry[1] }, error: null }
        },

        getUserById: async userId => {
          calls.getUserById.push(userId)

          if (onGetUserById) {
            const response = await onGetUserById(userId, context)
            if (response !== undefined) return response
          }

          const user = [...users.values()].find(candidate => candidate.id === userId)
          if (!user) {
            return {
              data: { user: null },
              error: { status: 404, message: 'User not found' },
            }
          }
          return { data: { user }, error: null }
        },

        updateUserById: async (userId, attributes) => {
          calls.updateUserById.push({ userId, attributes })
          throw new Error('El script no debe modificar usuarios existentes.')
        },
      },
    },

    from: table => {
      if (table !== 'staff_accounts') {
        throw new Error(`Tabla inesperada en la prueba: ${table}`)
      }

      return {
        select: () => {
          const filters = {}
          const builder = {
            eq(column, value) {
              filters[column] = { matcher: 'eq', value }
              return builder
            },
            ilike(column, value) {
              filters[column] = { matcher: 'ilike', value }
              return builder
            },
            async maybeSingle() {
              calls.staffQueries.push({ ...filters })

              if (onStaffQuery) {
                const response = await onStaffQuery(filters, context)
                if (response !== undefined) return response
              }

              const matches = [...staffRecordsById.values()].filter(candidate =>
                Object.entries(filters).every(([column, filter]) => {
                  if (filter.matcher === 'ilike') {
                    return ilikeMatches(candidate[column], filter.value)
                  }
                  return candidate[column] === filter.value
                }),
              )

              if (matches.length > 1) {
                return {
                  data: null,
                  error: { message: 'JSON object requested, multiple rows returned' },
                }
              }

              return { data: matches[0] || null, error: null }
            },
          }
          return builder
        },

        insert: record => {
          calls.staffInserts.push({ ...record })
          return {
            select: () => ({
              async single() {
                if (onInsertStaff) {
                  const response = await onInsertStaff(record, context)
                  if (response !== undefined) return response
                }

                if (staffRecordsById.has(record.user_id)) {
                  return {
                    data: null,
                    error: { message: 'Duplicate staff account' },
                  }
                }

                const stored = copyStaffRecord(record)
                staffRecordsById.set(stored.user_id, stored)
                return { data: stored, error: null }
              },
            }),
          }
        },
      }
    },
  }

  return { client, context }
}

function validPasswordPrompt(account) {
  return Promise.resolve(`Contraseña-valida-${account.role}-123`)
}

function createTtyInput() {
  const input = new PassThrough()
  input.isTTY = true
  input.rawModeCalls = []
  input.setRawMode = function setRawMode(enabled) {
    this.rawModeCalls.push(enabled)
    this.raw = enabled
    return this
  }
  return input
}

function createCaptureOutput() {
  let text = ''
  const output = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString()
      callback()
    },
  })
  output.getText = () => text
  return output
}

describe('validateConfiguration', () => {
  it('exige URL, service role key y project ref', () => {
    for (const missingName of Object.keys(VALID_ENV)) {
      const env = { ...VALID_ENV }
      delete env[missingName]

      const result = validateConfiguration(env)

      assert.equal(result.ok, false)
      assert.match(result.error, new RegExp(missingName))
    }
  })

  it('compara obligatoriamente el proyecto de la URL con SUPABASE_PROJECT_REF', () => {
    const result = validateConfiguration({
      ...VALID_ENV,
      SUPABASE_URL: 'https://otro-proyecto.supabase.co',
    })

    assert.equal(result.ok, false)
    assert.match(result.error, /no corresponde/i)
  })

  it('acepta una URL y un project ref coincidentes', () => {
    const result = validateConfiguration(VALID_ENV)

    assert.equal(result.ok, true)
    assert.equal(result.config.projectRef, VALID_ENV.SUPABASE_PROJECT_REF)
    assert.equal(result.config.supabaseUrl, VALID_ENV.SUPABASE_URL)
  })

  it('acepta una barra final en el origen del proyecto', () => {
    const result = validateConfiguration({
      ...VALID_ENV,
      SUPABASE_URL: 'https://proyecto-prueba.supabase.co/',
    })

    assert.equal(result.ok, true)
    assert.equal(result.config.supabaseUrl, 'https://proyecto-prueba.supabase.co')
  })

  it('rechaza credenciales embebidas sin exponerlas', () => {
    const result = validateConfiguration({
      ...VALID_ENV,
      SUPABASE_URL: 'https://usuario:secreto@proyecto-prueba.supabase.co',
    })

    assert.equal(result.ok, false)
    assert.match(result.error, /credenciales embebidas/i)
    assert.doesNotMatch(result.error, /usuario|secreto/)
  })

  it('rechaza puertos no autorizados', () => {
    const result = validateConfiguration({
      ...VALID_ENV,
      SUPABASE_URL: 'https://proyecto-prueba.supabase.co:8443',
    })

    assert.equal(result.ok, false)
    assert.match(result.error, /puerto/i)
  })

  it('rechaza rutas inesperadas', () => {
    for (const path of ['/rest/v1', '/auth/v1', '/dashboard']) {
      const result = validateConfiguration({
        ...VALID_ENV,
        SUPABASE_URL: `https://proyecto-prueba.supabase.co${path}`,
      })

      assert.equal(result.ok, false)
      assert.match(result.error, /ruta/i)
    }
  })

  it('rechaza parámetros y fragmentos en la URL', () => {
    for (const suffix of ['?apikey=otra', '#fragmento']) {
      const result = validateConfiguration({
        ...VALID_ENV,
        SUPABASE_URL: `https://proyecto-prueba.supabase.co${suffix}`,
      })

      assert.equal(result.ok, false)
      assert.match(result.error, /parámetros ni fragmentos/i)
    }
  })

  it('no incluye la clave de servicio en los mensajes de error', () => {
    const secret = 'clave-de-prueba-no-secreta'
    const result = validateConfiguration({
      ...VALID_ENV,
      SUPABASE_URL: 'https://otro-proyecto.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: secret,
    })

    assert.equal(result.ok, false)
    assert.equal(result.error.includes(secret), false)
  })
})

describe('findUserByEmail', () => {
  it('pagina realmente y normaliza el correo', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [
        { id: 'user-1', email: 'uno@example.com', app_metadata: {} },
        { id: 'user-2', email: 'dos@example.com', app_metadata: {} },
        { id: 'user-3', email: 'DESTINO@EXAMPLE.COM', app_metadata: {} },
      ],
    })

    const result = await findUserByEmail(
      client,
      '  destino@example.com  ',
      { perPage: 2 },
    )

    assert.equal(result.status, 'found')
    assert.equal(result.user.id, 'user-3')
    assert.deepEqual(
      context.calls.listUsers.map(call => call.page),
      [1, 2],
    )
  })

  it('distingue un usuario inexistente', async () => {
    const { client } = createMockSupabaseClient()

    const result = await findUserByEmail(client, 'ausente@example.com')

    assert.deepEqual(result, { status: 'not_found' })
  })

  it('distingue un error de consulta y no lo interpreta como ausencia', async () => {
    const { client } = createMockSupabaseClient({
      onListUsers: async () => ({
        data: { users: [] },
        error: { message: 'Permiso denegado' },
      }),
    })

    const result = await findUserByEmail(client, 'ausente@example.com')

    assert.equal(result.status, 'error')
    assert.match(result.message, /Permiso denegado/)
  })

  it('detecta paginación incompleta usando el total informado', async () => {
    const { client } = createMockSupabaseClient({
      onListUsers: async ({ page }) => ({
        data: {
          users: page === 1
            ? [{ id: 'user-1', email: 'uno@example.com' }]
            : [],
          total: 2,
        },
        error: null,
      }),
    })

    const result = await findUserByEmail(
      client,
      'ausente@example.com',
      { perPage: 1 },
    )

    assert.equal(result.status, 'error')
    assert.match(result.message, /paginación.*incompleta/i)
  })

  it('rechaza un total de usuarios que cambia entre páginas', async () => {
    const { client } = createMockSupabaseClient({
      onListUsers: async ({ page }) => ({
        data: {
          users: [{
            id: `user-${page}`,
            email: page === 2
              ? 'destino@example.com'
              : `usuario-${page}@example.com`,
          }],
          total: page === 1 ? 2 : 3,
        },
        error: null,
      }),
    })

    const result = await findUserByEmail(
      client,
      'destino@example.com',
      { perPage: 1 },
    )

    assert.equal(result.status, 'error')
    assert.match(result.message, /total.*cambió/i)
  })

  it('rechaza páginas superpuestas aunque no sean idénticas', async () => {
    const { client } = createMockSupabaseClient({
      onListUsers: async ({ page }) => ({
        data: {
          users: page === 1
            ? [
                { id: 'user-1', email: 'uno@example.com' },
                { id: 'user-2', email: 'dos@example.com' },
              ]
            : [
                { id: 'user-2', email: 'dos@example.com' },
                { id: 'user-3', email: 'tres@example.com' },
              ],
          total: 3,
        },
        error: null,
      }),
    })

    const result = await findUserByEmail(
      client,
      'ausente@example.com',
      { perPage: 2 },
    )

    assert.equal(result.status, 'error')
    assert.match(result.message, /solapó/i)
  })

  it('no declara inexistente una página corta que anuncia otra página', async () => {
    const { client } = createMockSupabaseClient({
      onListUsers: async () => ({
        data: {
          users: [{ id: 'user-1', email: 'uno@example.com' }],
          nextPage: 2,
        },
        error: null,
      }),
    })

    const result = await findUserByEmail(
      client,
      'ausente@example.com',
      { perPage: 2 },
    )

    assert.equal(result.status, 'error')
    assert.match(result.message, /paginación.*incompleta/i)
  })

  it('recorre más de nueve páginas hasta encontrar el usuario', async () => {
    const authUsers = Array.from({ length: 25 }, (_, index) => ({
      id: `user-${index + 1}`,
      email: index === 24
        ? 'DESTINO@EXAMPLE.COM'
        : `usuario-${index + 1}@example.com`,
      app_metadata: {},
    }))
    const { client, context } = createMockSupabaseClient({ authUsers })

    const result = await findUserByEmail(
      client,
      'destino@example.com',
      { perPage: 2 },
    )

    assert.equal(result.status, 'found')
    assert.equal(result.user.id, 'user-25')
    assert.deepEqual(
      context.calls.listUsers.map(call => call.page),
      Array.from({ length: 13 }, (_, index) => index + 1),
    )
  })

  it('concluye not_found solo después de agotar más de nueve páginas', async () => {
    const authUsers = Array.from({ length: 25 }, (_, index) => ({
      id: `user-${index + 1}`,
      email: `usuario-${index + 1}@example.com`,
      app_metadata: {},
    }))
    const { client, context } = createMockSupabaseClient({ authUsers })

    const result = await findUserByEmail(
      client,
      'ausente@example.com',
      { perPage: 2 },
    )

    assert.deepEqual(result, { status: 'not_found' })
    assert.equal(context.calls.listUsers.length, 13)
  })

  it('aborta si falla una página intermedia', async () => {
    const authUsers = Array.from({ length: 25 }, (_, index) => ({
      id: `user-${index + 1}`,
      email: `usuario-${index + 1}@example.com`,
      app_metadata: {},
    }))
    const { client, context } = createMockSupabaseClient({
      authUsers,
      onListUsers: async ({ page }) => {
        if (page === 10) {
          return {
            data: { users: [] },
            error: { message: 'Fallo simulado en la página 10' },
          }
        }
        return undefined
      },
    })

    const result = await findUserByEmail(
      client,
      'destino@example.com',
      { perPage: 2 },
    )

    assert.equal(result.status, 'error')
    assert.match(result.message, /página 10/i)
    assert.equal(context.calls.listUsers.length, 10)
  })

  it('aborta si una página intermedia lanza una excepción', async () => {
    const authUsers = Array.from({ length: 25 }, (_, index) => ({
      id: `user-${index + 1}`,
      email: `usuario-${index + 1}@example.com`,
      app_metadata: {},
    }))
    const { client, context } = createMockSupabaseClient({
      authUsers,
      onListUsers: async ({ page }) => {
        if (page === 4) throw new Error('Conexión interrumpida')
        return undefined
      },
    })

    const result = await findUserByEmail(
      client,
      'destino@example.com',
      { perPage: 2 },
    )

    assert.equal(result.status, 'error')
    assert.match(result.message, /Conexión interrumpida/)
    assert.equal(context.calls.listUsers.length, 4)
  })

  it('avanza secuencialmente aunque nextPage sea mayor de nueve', async () => {
    const authUsers = Array.from({ length: 6 }, (_, index) => ({
      id: `user-${index + 1}`,
      email: index === 5
        ? 'destino@example.com'
        : `usuario-${index + 1}@example.com`,
      app_metadata: {},
    }))
    const { client, context } = createMockSupabaseClient({
      authUsers,
      onListUsers: async ({ page }) => {
        if (page !== 1) return undefined
        return {
          data: {
            users: [
              { id: 'user-1', email: 'usuario-1@example.com' },
              { id: 'user-2', email: 'usuario-2@example.com' },
            ],
            total: 6,
            nextPage: 10,
          },
          error: null,
        }
      },
    })

    const result = await findUserByEmail(
      client,
      'destino@example.com',
      { perPage: 2 },
    )

    assert.equal(result.status, 'found')
    assert.equal(result.user.id, 'user-6')
    assert.deepEqual(
      context.calls.listUsers.map(call => call.page),
      [1, 2, 3],
    )
  })
})

describe('runInitialization: preflight y cuentas existentes', () => {
  it('rechaza una ejecución sin cuentas', async () => {
    const { client, context } = createMockSupabaseClient()

    await assert.rejects(
      runGuarded({
        client,
        accounts: [],
        passwordPrompt: validPasswordPrompt,
      }),
      ConfigurationError,
    )

    assert.equal(context.calls.createUser.length, 0)
  })

  it('aborta sin escrituras si la consulta de usuarios falla', async () => {
    const { client, context } = createMockSupabaseClient({
      onListUsers: async () => ({
        data: { users: [] },
        error: { message: 'Error de listado' },
      }),
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'error')
    assert.match(summary.results[0].message, /Error consultando usuarios/i)
    assert.equal(prompts, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
    assert.equal(context.calls.deleteUser.length, 0)
  })

  it('aborta sin escrituras si la paginación está incompleta', async () => {
    const { client, context } = createMockSupabaseClient({
      onListUsers: async ({ page }) => ({
        data: {
          users: page === 1
            ? [{ id: 'user-1', email: 'otro@example.com' }]
            : [],
          total: 2,
        },
        error: null,
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'error')
    assert.match(summary.results[0].message, /paginación.*incompleta/i)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('registra error y not_processed para cada cuenta si falla el preflight', async () => {
    let listCalls = 0
    const { client, context } = createMockSupabaseClient({
      onListUsers: async () => {
        listCalls += 1
        if (listCalls === 2) {
          return {
            data: { users: [] },
            error: { message: 'Error en segunda consulta' },
          }
        }
        return undefined
      },
    })

    const summary = await runGuarded({
      client,
      accounts: ACCOUNTS,
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.deepEqual(
      summary.results.map(result => result.status),
      ['not_processed', 'error'],
    )
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('detecta una cuenta existente y no solicita contraseña', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'admin-existing',
        email: ADMIN_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'admin' },
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, true)
    assert.equal(summary.successful, 1)
    assert.equal(summary.results[0].status, 'existing_valid')
    assert.equal(prompts, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
    assert.equal(context.calls.updateUserById.length, 0)
  })

  it('rechaza un rol diferente sin modificar la cuenta', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'admin-existing',
        email: ADMIN_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'member' },
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_role_mismatch')
    assert.equal(prompts, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
    assert.equal(context.calls.updateUserById.length, 0)
    assert.equal(
      context.users.get(mockKey(ADMIN_ACCOUNT.email)).app_metadata.gym_role,
      'member',
    )
  })

  it('rechaza disabled sin reactivarlo', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'admin-disabled',
        email: ADMIN_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'disabled' },
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_disabled')
    assert.equal(prompts, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.updateUserById.length, 0)
    assert.equal(
      context.users.get(mockKey(ADMIN_ACCOUNT.email)).app_metadata.gym_role,
      'disabled',
    )
  })
})

describe('runInitialization: consistencia con staff_accounts', () => {
  it('mantiene al administrador exclusivamente en Auth', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'admin-existing',
        email: ADMIN_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'admin' },
      }],
    })

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.results[0].status, 'existing_valid')
    assert.equal(context.calls.staffInserts.length, 0)
    assert.equal(context.staffRecords.size, 0)
  })

  it('acepta recepción con registro existente coherente', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'reception-existing',
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'reception' },
      }],
      staffRecords: [{
        user_id: 'reception-existing',
        nombre: RECEPTION_ACCOUNT.displayName,
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        rol: 'reception',
        activo: true,
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, true)
    assert.equal(summary.results[0].status, 'existing_valid')
    assert.equal(prompts, 0)
    assert.equal(context.calls.staffInserts.length, 0)
    assert.equal(context.calls.updateUserById.length, 0)
  })

  it('crea el registro faltante de recepción cuando su Auth es válido', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'reception-existing',
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'reception' },
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, true)
    assert.equal(summary.results[0].status, 'existing_staff_created')
    assert.equal(prompts, 0)
    assert.equal(context.calls.staffInserts.length, 1)
    assert.deepEqual(context.calls.staffInserts[0], {
      user_id: 'reception-existing',
      nombre: RECEPTION_ACCOUNT.displayName,
      email: RECEPTION_ACCOUNT.email,
      rol: 'reception',
      activo: true,
    })
  })

  it('conserva activo=false y bloquea la cuenta', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'reception-existing',
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'reception' },
      }],
      staffRecords: [{
        user_id: 'reception-existing',
        nombre: RECEPTION_ACCOUNT.displayName,
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        rol: 'reception',
        activo: false,
      }],
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_staff_inactive')
    assert.equal(context.calls.staffInserts.length, 0)
    assert.equal(
      context.staffRecords.get('reception-existing').activo,
      false,
    )
  })

  it('bloquea un rol o correo distinto en staff_accounts', async () => {
    const variants = [
      {
        nombre: RECEPTION_ACCOUNT.displayName,
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        rol: 'trainer',
        activo: true,
      },
      {
        nombre: RECEPTION_ACCOUNT.displayName,
        email: 'otro-correo@example.com',
        rol: 'reception',
        activo: true,
      },
    ]

    for (const record of variants) {
      const { client, context } = createMockSupabaseClient({
        authUsers: [{
          id: 'reception-existing',
          email: RECEPTION_ACCOUNT.email.toUpperCase(),
          app_metadata: { gym_role: 'reception' },
        }],
        staffRecords: [{
          user_id: 'reception-existing',
          ...record,
        }],
      })

      const summary = await runGuarded({
        client,
        accounts: [RECEPTION_ACCOUNT],
        passwordPrompt: validPasswordPrompt,
      })

      assert.equal(summary.ok, false)
      assert.equal(summary.results[0].status, 'blocked_staff_mismatch')
      assert.equal(context.calls.staffInserts.length, 0)
      assert.equal(context.calls.updateUserById.length, 0)
    }
  })

  it('aborta antes de escribir si falla la consulta de staff_accounts', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'reception-existing',
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'reception' },
      }],
      onStaffQuery: async () => ({
        data: null,
        error: { message: 'Error de personal' },
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'error')
    assert.match(summary.results[0].message, /Error consultando staff_accounts/i)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('consulta staff_accounts en el preflight aunque la cuenta Auth no exista', async () => {
    const { client, context } = createMockSupabaseClient({
      onStaffQuery: async () => ({
        data: null,
        error: { message: 'Error de personal' },
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'error')
    assert.match(summary.results[0].message, /Error consultando staff_accounts/i)
    assert.ok(context.calls.staffQueries.length > 0)
    assert.equal(context.calls.createUser.length, 0)
  })

  it('bloquea un registro huérfano antes de crear la cuenta Auth', async () => {
    const { client, context } = createMockSupabaseClient({
      staffRecords: [{
        user_id: 'otro-usuario',
        nombre: RECEPTION_ACCOUNT.displayName,
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        rol: 'reception',
        activo: true,
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_staff_conflict')
    assert.equal(prompts, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('bloquea una fila de personal que usa el correo del administrador', async () => {
    const { client, context } = createMockSupabaseClient({
      staffRecords: [{
        user_id: 'otro-usuario',
        nombre: 'Recepción conflicting',
        email: ADMIN_ACCOUNT.email.toUpperCase(),
        rol: 'reception',
        activo: true,
      }],
    })
    let prompts = 0

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => {
        prompts += 1
        return 'Contraseña-valida-123'
      },
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_staff_conflict')
    assert.equal(prompts, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('aborta si dos filas comparten el correo con distinta capitalización', async () => {
    const { client, context } = createMockSupabaseClient({
      staffRecords: [
        {
          user_id: 'staff-a',
          nombre: 'Personal A',
          email: RECEPTION_ACCOUNT.email.toUpperCase(),
          rol: 'reception',
          activo: true,
        },
        {
          user_id: 'staff-b',
          nombre: 'Personal B',
          email: RECEPTION_ACCOUNT.email,
          rol: 'reception',
          activo: true,
        },
      ],
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'error')
    assert.match(summary.results[0].message, /Error consultando staff_accounts/i)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('detecta un conflicto entre la fila del user_id y otra fila con el mismo correo', async () => {
    const { client } = createMockSupabaseClient({
      staffRecords: [
        {
          user_id: 'staff-a',
          nombre: 'Personal A',
          email: 'otro-correo@example.com',
          rol: 'reception',
          activo: true,
        },
        {
          user_id: 'staff-b',
          nombre: 'Personal B',
          email: RECEPTION_ACCOUNT.email.toUpperCase(),
          rol: 'reception',
          activo: true,
        },
      ],
    })

    const result = await findStaffRecord(client, {
      userId: 'staff-a',
      email: RECEPTION_ACCOUNT.email,
    })

    assert.equal(result.status, 'error')
    assert.match(result.message, /conflicto/i)
  })
})

describe('runInitialization: creación, resultados y compensación', () => {
  it('registra un resultado individual por cuenta', async () => {
    const { client, context } = createMockSupabaseClient()

    const summary = await runGuarded({
      client,
      accounts: ACCOUNTS,
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, true)
    assert.equal(summary.total, 2)
    assert.equal(summary.successful, 2)
    assert.equal(summary.unsuccessful, 0)
    assert.deepEqual(
      summary.results.map(result => [result.email, result.status]),
      [
        [ADMIN_ACCOUNT.email, 'created'],
        [RECEPTION_ACCOUNT.email, 'created_with_staff'],
      ],
    )

    assert.deepEqual(
      context.calls.createUser.map(call => call.app_metadata.gym_role),
      ['admin', 'reception'],
    )
    assert.equal(context.calls.staffInserts.length, 1)
    assert.equal(context.calls.staffInserts[0].rol, 'reception')
  })

  it('elimina y verifica únicamente el usuario creado cuando falla staff_accounts', async () => {
    const { client, context } = createMockSupabaseClient({
      onInsertStaff: async () => ({
        data: null,
        error: { message: 'Fallo de inserción simulada' },
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'failed_rolled_back')
    assert.equal(summary.results[0].rollback.ok, true)
    assert.equal(summary.results[0].rollback.verified, true)
    assert.equal(context.calls.deleteUser.length, 1)
    assert.equal(context.calls.getUserById.length, 1)
    assert.equal(
      context.calls.deleteUser[0],
      context.calls.getUserById[0],
    )
    assert.equal(context.users.size, 0)
  })

  it('nunca elimina una cuenta preexistente como compensación', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'reception-preexistente',
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'reception' },
      }],
      onInsertStaff: async () => ({
        data: null,
        error: { message: 'Fallo de inserción simulada' },
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'failed')
    assert.equal(context.calls.deleteUser.length, 0)
    assert.equal(context.calls.getUserById.length, 0)
    assert.equal(context.users.size, 1)
    assert.equal(
      context.users.get(mockKey(RECEPTION_ACCOUNT.email)).id,
      'reception-preexistente',
    )
  })

  it('rechaza una eliminación que no pertenezca a la ejecución actual', async () => {
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'usuario-preexistente',
        email: 'preexistente@example.com',
        app_metadata: {},
      }],
    })

    const rollback = await deleteAndVerifyAuthUser(
      client,
      'usuario-preexistente',
      new Set(),
    )

    assert.equal(rollback.ok, false)
    assert.equal(rollback.verified, false)
    assert.equal(context.calls.deleteUser.length, 0)
    assert.equal(context.users.size, 1)
  })

  it('informa estado parcial si no puede verificar el rollback', async () => {
    const { client, context } = createMockSupabaseClient({
      onInsertStaff: async () => ({
        data: null,
        error: { message: 'Fallo de inserción simulada' },
      }),
      onDeleteUser: async () => ({
        data: { user: null },
        error: { message: 'Fallo de eliminación simulada' },
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'failed_partial')
    assert.equal(summary.results[0].rollback.ok, false)
    assert.equal(summary.results[0].rollback.verified, false)
    assert.equal(context.users.size, 1)
  })

  it('no escribe ninguna cuenta si falla la validación de contraseña', async () => {
    const { client, context } = createMockSupabaseClient()

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => 'corta',
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'failed')
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('redacta la contraseña si un error remoto la incluye en el mensaje', async () => {
    const secret = 'Contraseña-secreta-123'
    const { client } = createMockSupabaseClient({
      onCreateUser: async attributes => ({
        data: { user: null },
        error: { message: `Error simulado con ${attributes.password}` },
      }),
    })

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: async () => secret,
    })

    assert.equal(summary.ok, false)
    assert.doesNotMatch(summary.results[0].message, new RegExp(secret))
    assert.match(summary.results[0].message, /\[REDACTED\]/)
  })
})

describe('runInitialization: concurrencia y condiciones de seguridad', () => {
  it('exige reconocimiento explícito de que la operación no es atómica', async () => {
    const { client, context } = createMockSupabaseClient()

    await assert.rejects(
      runInitialization({
        client,
        accounts: [ADMIN_ACCOUNT],
        passwordPrompt: validPasswordPrompt,
      }),
      /no es atómica/i,
    )

    assert.equal(context.calls.listUsers.length, 0)
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(context.calls.staffInserts.length, 0)
  })

  it('bloquea la cuenta si su estado cambia entre el preflight y la segunda lectura', async () => {
    let listCalls = 0
    const { client, context } = createMockSupabaseClient({
      onListUsers: async (_params, mockContext) => {
        listCalls += 1
        if (listCalls === 2) {
          mockContext.users.set(mockKey(ADMIN_ACCOUNT.email), {
            id: 'admin-aparece',
            email: ADMIN_ACCOUNT.email,
            app_metadata: { gym_role: 'admin' },
          })
        }
        return undefined
      },
    })

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_state_changed')
    assert.equal(context.calls.createUser.length, 0)
  })

  it('detecta un cambio justo antes de crear el usuario Auth', async () => {
    let listCalls = 0
    const { client, context } = createMockSupabaseClient({
      onListUsers: async (_params, mockContext) => {
        listCalls += 1
        if (listCalls === 3) {
          mockContext.users.set(mockKey(ADMIN_ACCOUNT.email), {
            id: 'admin-concurrente',
            email: ADMIN_ACCOUNT.email,
            app_metadata: { gym_role: 'admin' },
          })
        }
        return undefined
      },
    })

    const summary = await runGuarded({
      client,
      accounts: [ADMIN_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_concurrent_change')
    assert.equal(context.calls.createUser.length, 0)
    assert.equal(listCalls, 3)
  })

  it('no inserta la fila de personal si otra fila aparece antes de la escritura', async () => {
    let staffQueries = 0
    const { client, context } = createMockSupabaseClient({
      authUsers: [{
        id: 'reception-existing',
        email: RECEPTION_ACCOUNT.email.toUpperCase(),
        app_metadata: { gym_role: 'reception' },
      }],
      onStaffQuery: async (_filters, mockContext) => {
        staffQueries += 1
        if (staffQueries === 5) {
          mockContext.staffRecords.set('reception-existing', {
            user_id: 'reception-existing',
            nombre: RECEPTION_ACCOUNT.displayName,
            email: RECEPTION_ACCOUNT.email,
            rol: 'reception',
            activo: true,
          })
        }
        return undefined
      },
    })

    const summary = await runGuarded({
      client,
      accounts: [RECEPTION_ACCOUNT],
      passwordPrompt: validPasswordPrompt,
    })

    assert.equal(summary.ok, false)
    assert.equal(summary.results[0].status, 'blocked_concurrent_change')
    assert.equal(context.calls.staffInserts.length, 0)
  })
})

describe('protección de contraseñas y terminal', () => {
  it('oculta la entrada, confirma y restaura el modo de terminal', async () => {
    const input = createTtyInput()
    const output = createCaptureOutput()
    const reader = createHiddenPasswordReader({ input, output })
    const secret = 'Secreto-visible-123'

    const readPromise = reader.read('Contraseña de prueba')
    input.write(`${secret}\r`)
    const entered = await readPromise

    assert.equal(entered, secret)
    assert.doesNotMatch(output.getText(), new RegExp(secret))
    assert.match(output.getText(), /Contraseña de prueba/)

    reader.close()
    reader.close()

    assert.equal(reader.isClosed, true)
    assert.ok(input.rawModeCalls.includes(true))
    assert.ok(input.rawModeCalls.includes(false))
    await assert.rejects(reader.read('Otra'), ConfigurationError)
  })

  it('rechaza una entrada que termina antes de completar la contraseña', async () => {
    const input = createTtyInput()
    const output = createCaptureOutput()
    const reader = createHiddenPasswordReader({ input, output })

    const readPromise = reader.read('Contraseña interrumpida')
    input.end()

    await assert.rejects(readPromise, /se cerró antes/i)
    assert.equal(reader.isClosed, true)
    reader.close()
  })

  it('cierra una lectura pendiente sin dejarla colgada', async () => {
    const input = createTtyInput()
    const output = createCaptureOutput()
    const reader = createHiddenPasswordReader({ input, output })

    const readPromise = reader.read('Contraseña pendiente')
    reader.close()

    await assert.rejects(readPromise, ConfigurationError)
    assert.equal(reader.isClosed, true)
    assert.ok(input.rawModeCalls.includes(false))
    assert.doesNotMatch(output.getText(), /Contraseña pendiente: .+/)
  })

  it('se detiene si la entrada no es una terminal interactiva', () => {
    assert.throws(
      () => createHiddenPasswordReader({
        input: new PassThrough(),
        output: createCaptureOutput(),
      }),
      /terminal interactiva/i,
    )
  })

  it('solicita confirmación y exige al menos ocho caracteres', async () => {
    const account = ADMIN_ACCOUNT
    const matchingReader = {
      read: async () => 'Contraseña-valida-123',
    }
    const mismatchedReader = {
      read: async label => label.startsWith('Confirme')
        ? 'Otra-contraseña-123'
        : 'Contraseña-valida-123',
    }
    const shortReader = {
      read: async () => 'corta',
    }

    const password = await promptPasswordWithConfirmation(
      matchingReader,
      account,
    )
    assert.equal(password.length >= MIN_PASSWORD_LENGTH, true)

    const exactLengthReader = {
      read: async () => '12345678',
    }
    const spacedReader = {
      read: async () => ' clave con espacios ',
    }
    assert.equal(
      await promptPasswordWithConfirmation(exactLengthReader, account),
      '12345678',
    )
    assert.equal(
      await promptPasswordWithConfirmation(spacedReader, account),
      ' clave con espacios ',
    )

    await assert.rejects(
      promptPasswordWithConfirmation(mismatchedReader, account),
      PasswordValidationError,
    )
    await assert.rejects(
      promptPasswordWithConfirmation(shortReader, account),
      PasswordValidationError,
    )
  })
})

describe('runCli', () => {
  it('cierra el lector y no expone la contraseña en el resumen', async () => {
    const { client } = createMockSupabaseClient()
    const logs = []
    const errors = []
    const secret = 'Contraseña-secreta-123'
    let closeCalls = 0
    const reader = {
      read: async () => secret,
      close: () => {
        closeCalls += 1
      },
    }

    const exitCode = await runCli({
      env: VALID_ENV_WITH_ACK,
      clientFactory: () => client,
      readerFactory: () => reader,
      logger: {
        log: (...args) => logs.push(args.join(' ')),
        error: (...args) => errors.push(args.join(' ')),
      },
    })

    assert.equal(exitCode, 0)
    assert.equal(closeCalls, 1)
    assert.equal(errors.length, 0)
    assert.ok(logs.some(line => line.includes('created')))
    assert.ok(logs.some(line => line.includes('created_with_staff')))
    assert.doesNotMatch(logs.join('\n'), new RegExp(secret))
  })

  it('cierra el lector en finally aunque una cuenta falle', async () => {
    const { client } = createMockSupabaseClient({
      onCreateUser: async () => ({
        data: { user: null },
        error: { message: 'Fallo de creación simulado' },
      }),
    })
    const errors = []
    let closeCalls = 0
    const reader = {
      read: async () => 'Contraseña-valida-123',
      close: () => {
        closeCalls += 1
      },
    }

    const exitCode = await runCli({
      env: VALID_ENV_WITH_ACK,
      clientFactory: () => client,
      readerFactory: () => reader,
      logger: {
        log: () => {},
        error: (...args) => errors.push(args.join(' ')),
      },
    })

    assert.equal(exitCode, 1)
    assert.equal(closeCalls, 1)
  })

  it('no crea el cliente cuando falta configuración obligatoria', async () => {
    let clientFactoryCalls = 0
    const errors = []

    const exitCode = await runCli({
      env: {
        SUPABASE_URL: VALID_ENV.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: VALID_ENV.SUPABASE_SERVICE_ROLE_KEY,
      },
      clientFactory: () => {
        clientFactoryCalls += 1
        throw new Error('No debe crear cliente')
      },
      logger: {
        log: () => {},
        error: (...args) => errors.push(args.join(' ')),
      },
    })

    assert.equal(exitCode, 1)
    assert.equal(clientFactoryCalls, 0)
    assert.match(errors.join('\n'), /SUPABASE_PROJECT_REF/)
  })

  it('no crea el cliente si falta el reconocimiento de no atomicidad', async () => {
    let clientFactoryCalls = 0
    const errors = []

    const exitCode = await runCli({
      env: VALID_ENV,
      clientFactory: () => {
        clientFactoryCalls += 1
        throw new Error('No debe crear cliente')
      },
      logger: {
        log: () => {},
        error: (...args) => errors.push(args.join(' ')),
      },
    })

    assert.equal(exitCode, 1)
    assert.equal(clientFactoryCalls, 0)
    assert.match(errors.join('\n'), /no es atómica/i)
    assert.match(errors.join('\n'), new RegExp(NON_ATOMIC_ACKNOWLEDGEMENT_ENV))
  })

  it('rechaza un reconocimiento con un valor distinto', async () => {
    let clientFactoryCalls = 0
    const errors = []

    const exitCode = await runCli({
      env: {
        ...VALID_ENV,
        [NON_ATOMIC_ACKNOWLEDGEMENT_ENV]: 'true',
      },
      clientFactory: () => {
        clientFactoryCalls += 1
        throw new Error('No debe crear cliente')
      },
      logger: {
        log: () => {},
        error: (...args) => errors.push(args.join(' ')),
      },
    })

    assert.equal(exitCode, 1)
    assert.equal(clientFactoryCalls, 0)
    assert.match(errors.join('\n'), /no es atómica/i)
  })
})

describe('normalización de correo', () => {
  it('normaliza espacios y mayúsculas sin alterar otros caracteres', () => {
    assert.equal(normalizeEmail('  USUARIO@EXAMPLE.COM  '), 'usuario@example.com')
  })
})
