// Prueba end-to-end del análisis nutricional en navegador real:
// sube una foto de comida por el input de archivos y espera el resultado.
//   node scripts/food-analysis-smoke.mjs <imagen> [url]
//
// Requiere VITE_GEMINI_API_KEY configurada en frontend-web/.env.local y el
// servidor de desarrollo corriendo.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawn } from 'node:child_process'

const APP_URL = process.env.APP_URL || 'http://localhost:5199/'
const BROWSER = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const IMAGE = process.argv[2]
const PORT = 9335

if (!IMAGE || !existsSync(IMAGE)) {
  console.error('Uso: node scripts/food-analysis-smoke.mjs <ruta-imagen>')
  process.exit(1)
}

const profile = mkdtempSync(join(tmpdir(), 'gym-food-'))
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-gpu',
  '--enable-unsafe-swiftshader',
  'about:blank',
])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function targetUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = targets.find((item) => item.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* aún no escucha */
    }
    await sleep(250)
  }
  throw new Error('no se pudo conectar con el navegador')
}

const sock = new WebSocket(await targetUrl())
let nextId = 1
const pending = new Map()
await new Promise((resolve, reject) => {
  sock.addEventListener('open', resolve)
  sock.addEventListener('error', reject)
})
sock.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data)
  if (payload.id && pending.has(payload.id)) {
    pending.get(payload.id)(payload)
    pending.delete(payload.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId += 1
    pending.set(id, resolve)
    sock.send(JSON.stringify({ id, method, params }))
  })

await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url: APP_URL })
await sleep(3500)

const imageDataUrl = `data:image/jpeg;base64,${readFileSync(IMAGE).toString('base64')}`
const expression = `(async () => {
  const find = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent));
  find(/Analizar mi comida/i).click();
  await new Promise((r) => setTimeout(r, 600));

  const input = document.querySelector('[role="dialog"] input[type="file"]');
  const blob = await (await fetch(${JSON.stringify(imageDataUrl)})).blob();
  const file = new File([blob], 'comida.jpg', { type: 'image/jpeg' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));

  const dialog = document.querySelector('[role="dialog"]');
  const before = dialog.innerText;
  const started = performance.now();
  find(/Analizar plato/i).click();
  await new Promise((r) => setTimeout(r, 400));
  const loadingVisible = /Analizando comida/i.test(dialog.innerText);

  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    const text = dialog.innerText;
    if (/Análisis completado/i.test(text) || /No se pudo|Falta configurar|Falta configurar/i.test(text)) break;
  }
  const elapsed = Math.round(performance.now() - started);
  const after = dialog.innerText;
  return {
    loadingVisible,
    elapsed,
    done: /Análisis completado/i.test(after),
    before: before.replace(/\\s+/g, ' ').slice(0, 120),
    after: after.replace(/\\s+/g, ' ').slice(0, 420),
  };
})()`

const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
const value = result.result?.result?.value

console.log(`imagen: ${basename(IMAGE)} (${Math.round(readFileSync(IMAGE).length / 1024)} KB)`)
if (!value) {
  console.error('sin resultado', JSON.stringify(result).slice(0, 600))
} else {
  console.log(`cargando visible: ${value.loadingVisible}`)
  console.log(`tiempo total: ${value.elapsed} ms`)
  console.log(`análisis completado: ${value.done}`)
  console.log(`pantalla: ${value.after}`)
}

sock.close()
browser.kill()
await sleep(300)
rmSync(profile, { recursive: true, force: true })
process.exit(value?.done ? 0 : 1)
