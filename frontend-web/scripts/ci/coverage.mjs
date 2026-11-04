import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
rmSync('reports/coverage', {recursive:true, force:true})
if (!existsSync('reports/v8') || !readdirSync('reports/v8').some(name => name.endsWith('.json'))) {
  throw new Error('Faltan mediciones V8 de esta ejecución. Ejecuta npm run test:ci primero.')
}
const result = spawnSync(process.execPath, ['node_modules/c8/bin/c8.js', 'report'], { stdio: 'inherit' })
if (result.status !== 0) process.exit(1)
const summary = JSON.parse(readFileSync('reports/coverage/coverage-summary.json', 'utf8'))
if (!existsSync('reports/coverage/index.html') || !(summary.total.lines.covered > 0)) {
  throw new Error('No se produjo un HTML con líneas de código realmente ejecutadas.')
}
