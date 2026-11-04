import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const calls = []
let response = null
let signedIn = true
globalThis.__progressTestSupabase = {
  auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'user-a' } : null } }) },
  from(table) {
    const call = { table, methods: [] }; calls.push(call)
    const chain = new Proxy({}, { get: (_, method) => method === 'then'
      ? (resolve, reject) => Promise.resolve(response?.(call) ?? { data: [], error: null }).then(resolve, reject)
      : (...args) => { call.methods.push([method, ...args]); return chain } })
    return chain
  },
  rpc: async (name, args) => { calls.push({ rpc: name, args }); return { data: 'goal-id', error: null } },
}
let source = await readFile(new URL('../src/services/progressService.js', import.meta.url), 'utf8')
source = source.replace("import { supabase } from '../lib/supabase.js'", 'const supabase = globalThis.__progressTestSupabase')
source = source.replace("'../lib/progressData.js'", JSON.stringify(pathToFileURL(new URL('../src/lib/progressData.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')).href))
const service = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
response = call => ({ data: call.table === 'weight_logs'
  ? (call.methods.find(m => m[0] === 'range')[1] === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: i })) : [{ id: 500 }])
  : call.table === 'progress_profiles' ? { timezone: 'UTC' } : [], error: null })
assert.equal((await service.getProgress()).logs.length, 501)
for (const call of calls) assert.ok(call.methods.some(m => m[0] === 'eq' && m[1] === 'user_id' && m[2] === 'user-a'))
response = null
await service.saveWeightLog({ weight: 80, measuredAt: '2020-01-01T12:00Z', timezone: 'UTC', operationId: 'stable-operation' })
const insert = calls.at(-1).methods.find(m => m[0] === 'upsert')
assert.equal(insert[1].operation_id, 'stable-operation')
assert.equal(insert[2].ignoreDuplicates, true)
await assert.rejects(service.saveWeightLog({ weight: 80, measuredAt: '2099-01-01', timezone: 'UTC' }), /Fecha/)
response = () => ({ data: null, error: null })
const profileInput = { height_cm: 175, activity_level: 'light', timezone: 'UTC', estimates_paused: true }
await assert.rejects(service.saveProgressProfile({ ...profileInput, updated_at: 'old' }), /perfil cambió/)
assert.ok(calls.at(-1).methods.some(m => m[0] === 'eq' && m[1] === 'updated_at' && m[2] === 'old'))
response = () => ({ data: { ...profileInput, updated_at: 'new' }, error: null })
assert.equal((await service.saveProgressProfile({ ...profileInput, updated_at: 'old' })).updated_at, 'new')
assert.equal(calls.at(-1).methods.find(m => m[0] === 'update')[1].estimates_paused, true)
assert.equal(calls.at(-1).methods.find(m => m[0] === 'update')[1].user_id, 'user-a')
response = () => ({ data: null, error: { code: '23505' } })
await assert.rejects(service.saveProgressProfile(profileInput), /ya se creó/)
assert.ok(calls.at(-1).methods.some(m => m[0] === 'insert'))
response = () => ({ data: null, error: null })
await assert.rejects(service.saveWeightLog({ id: 'log', updatedAt: 'old', weight: 80, measuredAt: '2020-01-01', timezone: 'UTC' }), /cambió/)
await assert.rejects(service.deleteWeightLog('log', 'old'), /cambió/)
response = () => ({ data: null, error: { message: 'server-error' } })
await assert.rejects(service.saveProgressProfile({ height_cm: 175, activity_level: 'light', timezone: 'UTC' }))
signedIn = false
const previous = calls.length
await assert.rejects(service.getProgress(), /Inicia sesión/)
assert.equal(calls.length, previous)
console.log('OK: paginación, propietario autenticado, reintentos, conflictos, errores y sesión requerida (doble de Supabase).')
