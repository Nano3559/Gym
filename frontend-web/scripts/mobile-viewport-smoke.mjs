// Comprobación de layout y rendimiento en viewports de móvil, en un navegador
// real con el Protocolo de DevTools.
//
//   npm run dev            (en otra terminal, o APP_URL=...)
//   node scripts/mobile-viewport-smoke.mjs
//
// Qué cubre y qué NO:
//   * Cubre el desbordamiento horizontal, el alto real de los controles
//     táctiles y el coste de un ciclo de render, con las medidas de pantalla de
//     un iPhone SE y un Pixel 5.
//   * NO cubre iOS Safari: no se puede lanzar en headless desde Windows. La
//     emulación de dispositivo de Chromium no reproduce ni WebKit ni el
//     comportamiento real de Safari en iOS. Eso hay que probarlo a mano.
//
// No forma parte de `npm test` porque necesita el servidor de desarrollo en
// marcha; si no está, avisa y termina sin fallo para no romper la cadena.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const APP_URL = process.env.APP_URL || 'http://localhost:5173/'
const BROWSER =
  process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9334

// Medidas de los dispositivos que se comprueban, con su relación de píxeles.
const DEVICES = [
  {
    name: 'iPhone SE (2ª gen) — 375×667, dpr 2',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true,
    // El más pequeño de los que se venden: aquí es donde más se rompe.
    expectTouchMin: 48,
  },
  {
    name: 'Pixel 5 — 393×851, dpr 2.75',
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true,
    expectTouchMin: 48,
  },
  {
    name: 'iPhone 15 Pro Max en horizontal — 932×430, dpr 3',
    width: 932,
    height: 430,
    deviceScaleFactor: 3,
    mobile: true,
    // En horizontal queda mucho menos alto: exigir 48 px verticales dejaría
    // fuera controles que sí son comfortablemente pulsables en ese tamaño.
    expectTouchMin: 44,
  },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function serverIsUp() {
  try {
    const response = await fetch(APP_URL, { signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch {
    return false
  }
}

async function targetUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await response.json()
      const page = targets.find((item) => item.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // El navegador aún no escucha.
    }
    await sleep(250)
  }
  throw new Error('No se pudo conectar con el navegador')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    let nextId = 1
    const pending = new Map()
    const consoleErrors = []

    socket.addEventListener('open', () =>
      resolve({
        consoleErrors,
        send(method, params = {}) {
          const id = (nextId += 1)
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((res, rej) => pending.set(id, { res, rej }))
        },
        close: () => socket.close(),
      }),
    )
    socket.addEventListener('error', reject)
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data)
      if (payload.id && pending.has(payload.id)) {
        const { res, rej } = pending.get(payload.id)
        pending.delete(payload.id)
        if (payload.error) rej(new Error(payload.error.message))
        else res(payload.result)
        return
      }
      // Lo que se ve en la consola del navegador es lo primero que hay que
      // mirar cuando la pantalla sale en negro.
      if (payload.method === 'Runtime.exceptionThrown') {
        const d = payload.params.exceptionDetails
        consoleErrors.push(`exception: ${d.exception?.description || d.text}`)
      }
      if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
        consoleErrors.push(
          `console.error: ${payload.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`,
        )
      }
      if (payload.method === 'Log.entryAdded' && payload.params.entry.level === 'error') {
        consoleErrors.push(`log: ${payload.params.entry.text} ${payload.params.entry.url ?? ''}`)
      }
    })
  })
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Error al evaluar')
  }
  return result.result.value
}

// Mide en la página: desbordamiento horizontal, controles táctiles más pequeños
// que el mínimo, coste de un ciclo de render y si el manifest se descargó.
const PROBE = `(() => {
  const doc = document.documentElement
  const overflow = doc.scrollWidth - doc.clientWidth

  const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"]'
  const tooSmall = []
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (getComputedStyle(el).visibility === 'hidden') continue
    tooSmall.push({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 24),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    })
  }

  const started = performance.now()
  for (let i = 0; i < 40; i += 1) {
    document.body.offsetHeight
  }
  const frameCostMs = performance.now() - started

  return {
    overflow,
    clientWidth: doc.clientWidth,
    touchTargets: tooSmall,
    frameCostMs: Math.round(frameCostMs * 100) / 100,
    manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || null,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || null,
    viewportFit: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
    rootChildren: document.getElementById('root')?.childElementCount ?? -1,
    rootHtmlLength: document.getElementById('root')?.innerHTML.length ?? -1,
    bodyText: (document.body.innerText || '').trim().length,
  }
})()`

let browser
let profile
let client

const failures = []

function report(name, ok, extra = '') {
  if (!ok) failures.push(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` -> ${extra}` : ''}`)
}

try {
  if (!existsSync(BROWSER)) {
    console.log(`No se encontró el navegador en ${BROWSER}. Se omite la comprobación.`)
    console.log('Define BROWSER_PATH para ejecutarla.')
    process.exit(0)
  }
  if (!(await serverIsUp())) {
    console.log(`No hay servidor en ${APP_URL}. Arranca "npm run dev" o define APP_URL.`)
    console.log('Se omite la comprobación.')
    process.exit(0)
  }

  profile = mkdtempSync(join(tmpdir(), 'gym-mobile-viewport-'))
  browser = spawn(BROWSER, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--hide-scrollbars',
  ])
  browser.on('error', () => {})

  client = await connect(await targetUrl())
  await client.send('Runtime.enable')
  await client.send('Page.enable')
  await client.send('Log.enable')
  await client.send('Network.enable')

  for (const device of DEVICES) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.deviceScaleFactor,
      mobile: device.mobile,
    })
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await client.send('Page.navigate', { url: APP_URL })
    await sleep(2500)

    const probe = await evaluate(client, PROBE)

    // Lo primero: si React llegó a montar. Una pantalla en negro casi siempre
    // es un fallo al renderizar, y el body queda con el color de fondo.
    report(
      `${device.name}: React monta contenido en #root`,
      probe.rootChildren > 0 && probe.rootHtmlLength > 100,
      `hijos=${probe.rootChildren} html=${probe.rootHtmlLength} texto=${probe.bodyText}`,
    )

    if (client.consoleErrors.length > 0) {
      report(`${device.name}: sin errores en consola`, false, client.consoleErrors.slice(0, 3).join(' || '))
      client.consoleErrors.length = 0
    }

    report(
      `${device.name}: sin desbordamiento horizontal`,
      probe.overflow <= 1,
      `scrollWidth-clientWidth = ${probe.overflow}`,
    )

    const small = probe.touchTargets.filter((t) => t.h < device.expectTouchMin || t.w < device.expectTouchMin)
    report(
      `${device.name}: objetivos táctiles >= ${device.expectTouchMin}px`,
      small.length === 0,
      small.length ? small.map((t) => `${t.tag}"${t.text}" ${t.w}x${t.h}`).join(' | ') : '',
    )

    report(
      `${device.name}: coste de layout bajo (${probe.frameCostMs} ms / 40 lecturas)`,
      probe.frameCostMs < 400,
    )

    report(`${device.name}: manifest enlazado`, probe.manifestHref === '/manifest.webmanifest')
    report(`${device.name}: theme-color declarado`, Boolean(probe.themeColor))
    report(
      `${device.name}: viewport-fit=cover presente`,
      probe.viewportFit.includes('viewport-fit=cover'),
      probe.viewportFit,
    )
  }

  // Aviso honesto: lo anterior es Chromium emulado, no Safari en iOS.
  console.log('\nNota: esto NO sustituye a una prueba en iOS Safari.')
  console.log('La emulación de Chromium no reproduce WebKit. Prueba a mano en un iPhone')
  console.log('y en un Android real antes de dar por cerrada la tarea.')
} catch (error) {
  console.error('Error en la comprobación:', error.message)
  process.exitCode = 1
} finally {
  client?.close()
  browser?.kill()
  if (profile) rmSync(profile, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} comprobaciones fallidas`)
  process.exitCode = 1
}
