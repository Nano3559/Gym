// Exercises the actual runner using a deliberately failing suite, then removes
// its reports. Run BEFORE the full suite so only real results are published.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
const dir = 'scripts/ci/.verification'
mkdirSync(dir, { recursive: true })
try {
  writeFileSync(`${dir}/fixture.mjs`, `import {test} from 'node:test'; import assert from 'node:assert/strict'; import {getMembershipStatus} from '../../../src/lib/membershipStatus.js';
    test('report-pass',()=>assert.equal(getMembershipStatus(null).key,'vencida'));
    test('report-fail',()=>assert.fail('deliberate-reporting-check'));
    test.skip('report-skip',()=>{});`)
  mkdirSync('reports/coverage', {recursive:true})
  writeFileSync('reports/coverage/stale-marker.html','old')
  const result = spawnSync(process.execPath, ['scripts/ci/run.mjs', `${dir}/fixture.mjs`], { encoding:'utf8' })
  assert.equal(result.status,1,result.stdout+result.stderr)
  const xml = readFileSync('reports/junit.xml','utf8')
  for(const text of ['report-pass','report-fail','report-skip','<failure','<skipped'])assert.ok(xml.includes(text),text)
  const {existsSync}=await import('node:fs')
  assert.equal(existsSync('reports/coverage/stale-marker.html'),false)
  const coverage=spawnSync(process.execPath,['scripts/ci/coverage.mjs'],{encoding:'utf8'})
  assert.equal(coverage.status,0,coverage.stdout+coverage.stderr)
  assert.ok(existsSync('reports/coverage/index.html'))
  console.log('OK: fallo devuelve 1, JUnit registra éxito/fallo/omisión, limpia resultados antiguos y genera cobertura tras el fallo.')
} finally {
  rmSync(dir,{recursive:true,force:true})
  rmSync('reports',{recursive:true,force:true})
}
