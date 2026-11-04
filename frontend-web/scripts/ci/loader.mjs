// Load production JSX under its real file URL so V8/c8 can map coverage.
// This loader is used exclusively by tests, never by the application build.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { transformWithOxc } from 'vite'
const stub = new URL('./supabase-double.mjs', import.meta.url).href
export async function resolve(specifier, context, next) {
  if (/\/lib\/supabase(?:\.js)?$/.test(specifier)) return { url: stub, shortCircuit: true }
  try { return await next(specifier, context) }
  catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      for (const ext of ['.js', '.jsx']) {
        try { return await next(specifier + ext, context) } catch { /* Try next extension. */ }
      }
    }
    throw error
  }
}
export async function load(url, context, next) {
  if (url.endsWith('.jsx')) {
    const filename = fileURLToPath(url)
    const source = await readFile(filename, 'utf8')
    const result = await transformWithOxc(source, filename, { sourcemap: true, jsx: { runtime: 'automatic' } })
    const map = Buffer.from(JSON.stringify(result.map)).toString('base64')
    return { format: 'module', shortCircuit: true, source: result.code + '\n//# sourceMappingURL=data:application/json;base64,' + map }
  }
  return next(url, context)
}
