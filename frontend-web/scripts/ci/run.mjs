import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
process.chdir(fileURLToPath(new URL('../../', import.meta.url)))
const reports = new URL('../../reports/', import.meta.url)
rmSync(reports, { recursive: true, force: true })
mkdirSync(new URL('v8/', reports), { recursive: true })
const selected = process.argv.slice(2)
const files = selected.length ? selected : readdirSync('scripts').filter(name => name.endsWith('.test.mjs')).sort().map(name => `scripts/${name}`)
if (!files.length) throw new Error('No se encontraron pruebas; CI no puede aprobar una suite vacía.')
writeFileSync(new URL('selection.json', reports), JSON.stringify({ runner: 'node:test', files, excluded: ['camera-smoke.mjs', 'food-analysis-smoke.mjs', 'mobile-viewport-smoke.mjs'] }, null, 2))
const args = ['--import', './scripts/ci/offline.mjs', '--import', './scripts/ci/register.mjs', '--test', '--test-concurrency=1', '--test-timeout=90000', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=junit', '--test-reporter-destination=reports/junit.xml', ...files]
console.log(`CI: ${files.length} archivos; pruebas sin navegador ni servicios reales.`)
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit', env: { ...process.env, CI: 'true', TZ: 'UTC', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_GEMINI_API_KEY: '', VITE_OPENAI_API_KEY: '', NODE_V8_COVERAGE: fileURLToPath(new URL('v8/', reports)) },
})
if (result.error) console.error(result.error)
process.exitCode = result.status === 0 && existsSync(new URL('junit.xml', reports)) ? 0 : 1
