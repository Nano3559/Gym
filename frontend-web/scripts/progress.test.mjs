import assert from 'node:assert/strict'
import { validateWeight, validateProfile, localDay, zonedDateTimeToISO, datetimeInput, weightSummary } from '../src/lib/progressData.js'

for (const weight of ['', ' ', 'abc', -1, 0, 19.99, 500.01, Infinity, NaN]) assert.throws(() => validateWeight(weight))
assert.equal(validateWeight('81.126'), 81.13)
assert.equal(validateWeight(20), 20)
assert.equal(validateWeight(500), 500)
const profile = { height_cm: '175.5', activity_level: 'light', formula_sex: '', timezone: 'America/La_Paz' }
assert.deepEqual(validateProfile(profile), { height_cm: 175.5, activity_level: 'light', formula_sex: null, timezone: 'America/La_Paz', estimates_paused: false })
assert.equal(validateProfile({ ...profile, estimates_paused: true }).estimates_paused, true)
assert.throws(() => validateProfile({ ...profile, estimates_paused: 'false' }), /suspender/)
for (const changes of [{ height_cm: '' }, { height_cm: 99 }, { height_cm: 251 }, { timezone: 'fake/zone' }, { timezone: '' }, { activity_level: 'none' }, { formula_sex: 'invalid' }]) {
  assert.throws(() => validateProfile({ ...profile, ...changes }))
}
assert.equal(localDay('2026-10-22T01:30:00Z', 'America/La_Paz'), '2026-10-21')
assert.equal(datetimeInput('2026-10-22T01:30:00Z', 'America/La_Paz'), '2026-10-21T21:30')
assert.equal(zonedDateTimeToISO('2026-10-21T21:30', 'America/La_Paz', Date.parse('2026-10-23')), '2026-10-22T01:30:00.000Z')
assert.equal(zonedDateTimeToISO('2026-01-01T08:15', 'Asia/Kathmandu', Date.parse('2026-02-01')), '2026-01-01T02:30:00.000Z')
assert.throws(() => zonedDateTimeToISO('2026-02-30T12:00', 'UTC'))
assert.throws(() => zonedDateTimeToISO('2099-01-01T12:00', 'UTC'))
assert.throws(() => zonedDateTimeToISO('2026-03-08T02:30', 'America/New_York', Date.parse('2026-12-01')), /inexistente/)
assert.throws(() => zonedDateTimeToISO('2026-11-01T01:30', 'America/New_York', Date.parse('2026-12-01')), /ambigua/)
assert.deepEqual(weightSummary([]), { first: null, latest: null, change: null })
const logs = [{ weight_kg: 78.5, measured_at: '2026-10-20', created_at: '2026-10-21' }, { weight_kg: 80, measured_at: '2026-10-01', created_at: '2026-10-22' }]
assert.deepEqual(weightSummary(logs), { first: 80, latest: 78.5, change: -1.5 })
assert.equal(logs[0].weight_kg, 78.5)
console.log('OK: pesos, perfil, unidades, fechas locales, futuro, horario de verano e historial sin mutación.')
