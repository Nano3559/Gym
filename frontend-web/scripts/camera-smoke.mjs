// Verificación de la cámara en navegador real (Chrome/Edge headless con
// dispositivo de video falso). No forma parte de la app: es una herramienta
// de comprobación local.
//
//   node scripts/camera-smoke.mjs
//
// Comprueba: permiso aceptado, stream activo, modelo de pose cargado, cámara
// liberada al cerrar el modal y ausencia de errores en consola.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const APP_URL = process.env.APP_URL || 'http://localhost:5199/'
// Fotografías de personas usadas solo para comprobar la detección de pose.
// Se leen de una carpeta externa (fuera del repo) definida por SAMPLE_DIR y
// se inyectan como data URL para no depender del servidor de desarrollo.
const SAMPLE_DIR = process.env.SAMPLE_DIR || join(process.cwd(), '..', 'tmp-samples')
const SAMPLE_IMAGES = existsSync(SAMPLE_DIR)
  ? readdirSync(SAMPLE_DIR)
      .filter((name) => /\.(jpe?g|png)$/i.test(name))
      .map((name) => [name, `data:image/jpeg;base64,${readFileSync(join(SAMPLE_DIR, name)).toString('base64')}`])
  : []
const BROWSER = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9333

const profile = mkdtempSync(join(tmpdir(), 'gym-camera-smoke-'))
const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  'about:blank',
])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
    const events = []

    socket.addEventListener('open', () =>
      resolve({
        events,
        send(method, params = {}) {
          const id = nextId += 1
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
      if (payload.method?.startsWith('Runtime.')) events.push(payload)
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

const checks = []
function report(name, ok, extra = '') {
  checks.push({ name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` -> ${extra}` : ''}`)
}

let client
try {
  client = await connect(await targetUrl())
  await client.send('Runtime.enable')
  await client.send('Page.enable')
  await client.send('Browser.grantPermissions', {
    permissions: ['videoCapture', 'audioCapture'],
  })
  await client.send('Page.navigate', { url: APP_URL })
  await sleep(3500)

  const supported = await evaluate(
    client,
    'Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)',
  )
  report('navigator.mediaDevices.getUserMedia disponible', supported === true)

  // Escáner nutricional: el botón abre el modal y la cámara arranca.
  const flow = await evaluate(
    client,
    `(async () => {
      const button = [...document.querySelectorAll('button')].find((b) => /Analizar mi comida/i.test(b.textContent));
      if (!button) return { error: 'boton no encontrado' };
      button.click();
      await new Promise((r) => setTimeout(r, 600));
      const takePhoto = [...document.querySelectorAll('button')].find((b) => /Tomar foto/i.test(b.textContent));
      if (!takePhoto) return { error: 'boton Tomar foto no encontrado' };
      takePhoto.click();
      await new Promise((r) => setTimeout(r, 2500));
      const video = document.querySelector('video');
      return {
        hasVideo: Boolean(video),
        ready: Boolean(video && video.videoWidth > 0),
        label: video ? video.getAttribute('aria-label') : null,
      };
    })()`,
  )
  report('escáner: cámara en vivo activa', flow?.hasVideo && flow?.ready === true, JSON.stringify(flow))

  // Captura: una sola foto, optimizada, y la cámara se detiene.
  const capture = await evaluate(
    client,
    `(async () => {
      const shot = [...document.querySelectorAll('button')].find((b) => /Capturar foto/i.test(b.textContent));
      if (!shot) return { error: 'boton Capturar foto no encontrado' };
      const before = performance.getEntriesByType('resource').filter((e) => /generativelanguage/.test(e.name)).length;
      shot.click();
      await new Promise((r) => setTimeout(r, 1500));
      const dialog = document.querySelector('[role="dialog"]');
      const text = dialog ? dialog.innerText : '';
      const img = dialog?.querySelector('img');
      await new Promise((r) => setTimeout(r, 2500));
      const after = performance.getEntriesByType('resource').filter((e) => /generativelanguage/.test(e.name)).length;
      return {
        hasPreview: Boolean(img),
        previewWidth: img ? img.naturalWidth : 0,
        videoClosed: document.querySelectorAll('[role="dialog"] video').length === 0,
        geminiCalls: after - before,
        showsLoading: /Analizando comida|Falta configurar/i.test(text),
      };
    })()`,
  )
  report('escáner: captura una sola foto y cierra la cámara', capture?.hasPreview && capture?.videoClosed === true, JSON.stringify(capture))
  report(
    'escáner: la imagen se reduce antes de analizarse',
    capture?.previewWidth > 0 && capture?.previewWidth <= 640,
    `ancho=${capture?.previewWidth}`,
  )
  report('escáner: no hay ráfaga de peticiones a la IA', capture?.geminiCalls <= 1, `llamadas=${capture?.geminiCalls}`)

  // Cierre del modal y liberación del stream.
  const released = await evaluate(
    client,
    `(async () => {
      const close = document.querySelector('[role="dialog"] button[aria-label="Cerrar"]');
      if (!close) return { error: 'boton cerrar no encontrado' };
      close.click();
      await new Promise((r) => setTimeout(r, 800));
      return {
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        videos: document.querySelectorAll('video').length,
        tracks: (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').length,
      };
    })()`,
  )
  report('cámara liberada al cerrar', released?.dialogs === 0 && released?.videos === 0, JSON.stringify(released))

  // Permiso denegado: debe mostrarse un mensaje comprensible, no una pantalla rota.
  const denied = await evaluate(
    client,
    `(async () => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = () => {
        const error = new Error('Permission denied');
        error.name = 'NotAllowedError';
        return Promise.reject(error);
      };
      [...document.querySelectorAll('button')].find((b) => /Analizar mi comida/i.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 500));
      [...document.querySelectorAll('button')].find((b) => /Tomar foto/i.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 800));
      const text = document.querySelector('[role="dialog"]').innerText;
      document.querySelector('[role="dialog"] button[aria-label="Cerrar"]').click();
      await new Promise((r) => setTimeout(r, 400));
      navigator.mediaDevices.getUserMedia = original;
      return { text: text.replace(/\\s+/g, ' ').slice(0, 260) };
    })()`,
  )
  report(
    'permiso denegado muestra un mensaje comprensible',
    /Permiso de cámara denegado/i.test(denied?.text ?? ''),
    denied?.text,
  )

  // Entrenador de ejercicios: abre cámara y carga el modelo de pose.
  const trainer = await evaluate(
    client,
    `(async () => {
      const button = [...document.querySelectorAll('button')].find((b) => /Entrenar con cámara/i.test(b.textContent));
      if (!button) return { error: 'boton entrenador no encontrado' };
      button.click();
      await new Promise((r) => setTimeout(r, 600));
      const open = [...document.querySelectorAll('button')].find((b) => /Abrir cámara/i.test(b.textContent));
      if (!open) return { error: 'boton Abrir camara no encontrado' };
      open.click();
      await new Promise((r) => setTimeout(r, 12000));
      const video = document.querySelector('[role="dialog"] video');
      const text = document.querySelector('[role="dialog"]').innerText;
      return {
        hasVideo: Boolean(video),
        ready: Boolean(video && video.videoWidth > 0),
        showsReps: /Repeticiones válidas/i.test(text),
        showsAngle: /Rodilla/i.test(text),
        modelLoaded: !/Cargando modelo de pose/i.test(text),
        modelFailed: /No se pudo cargar el detector/i.test(text),
        snippet: text.replace(/\\s+/g, ' ').slice(0, 220),
      };
    })()`,
  )
  report('entrenador: cámara en vivo activa', trainer?.hasVideo && trainer?.ready === true, JSON.stringify(trainer))
  report('entrenador: contador visible', trainer?.showsReps === true)
  report('entrenador: ángulo de rodilla visible', trainer?.showsAngle === true)
  report('entrenador: modelo de pose cargado', trainer?.modelLoaded === true && trainer?.modelFailed !== true)

  // El catálogo permite elegir flexiones y la métrica mostrada cambia a codo.
  const flex = await evaluate(
    client,
    `(async () => {
      const pill = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^Flexiones$/i.test(b.textContent.trim()));
      if (!pill) return { error: 'pestana Flexiones no encontrada' };
      pill.click();
      await new Promise((r) => setTimeout(r, 600));
      const text = document.querySelector('[role="dialog"]').innerText;
      return {
        pillFound: true,
        showsCodo: /Codo/i.test(text),
        showsCuerpo: /Cuerpo/i.test(text),
        showsFlexiones: /Flexiones/i.test(text),
        snippet: text.replace(/\\s+/g, ' ').slice(0, 180),
      };
    })()`,
  )
  report(
    'entrenador: flexiones seleccionables y métrica de codo',
    flex?.pillFound && flex?.showsCodo === true && flex?.showsCuerpo === true,
    JSON.stringify(flex),
  )

  await evaluate(
    client,
    `(async () => {
      document.querySelector('[role="dialog"] button[aria-label="Cerrar"]')?.click();
      await new Promise((r) => setTimeout(r, 800));
      return document.querySelectorAll('[role="dialog"] video').length;
    })()`,
  )

  // Detección de pose real: se ejecuta el mismo modelo y el mismo analizador
  // que usa la app sobre una fotografía de persona y se verifica un ciclo.
  const sampleImages = SAMPLE_IMAGES
  const pose = await evaluate(
    client,
    `(async () => {
      const { FilesetResolver, PoseLandmarker } = await import('/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
      const { angleAt } = await import('/src/lib/geometry.js');
      const { createSquatAnalyzer, SQUAT_LANDMARKS } = await import('/src/lib/squatAnalyzer.js');

      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
      });

      let lm = null;
      for (const [name, dataUrl] of ${JSON.stringify(sampleImages)}) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const bitmap = await createImageBitmap(blob);
          const probe = landmarker.detect(bitmap);
          bitmap.close();
          if (probe.landmarks?.[0]) {
            lm = probe.landmarks[0];
            break;
          }
        } catch {
          // Se prueba la siguiente imagen.
        }
      }
      landmarker.close();
      if (!lm) return { error: 'sin pose en ninguna imagen de prueba' };

      const measured = angleAt(lm[SQUAT_LANDMARKS.leftHip], lm[SQUAT_LANDMARKS.leftKnee], lm[SQUAT_LANDMARKS.leftAnkle]);
      const measuredRight = angleAt(lm[SQUAT_LANDMARKS.rightHip], lm[SQUAT_LANDMARKS.rightKnee], lm[SQUAT_LANDMARKS.rightAnkle]);
      const angle = Math.max(measured || 0, measuredRight || 0);

      const analyzer = createSquatAnalyzer();
      let t = 0;
      const feed = (value, frames = 1) => {
        let snap;
        for (let i = 0; i < frames; i += 1) {
          t += 33;
          snap = analyzer.update({ kneeAngle: value, hip: { x: 0.5, y: 0.6 }, knee: { x: 0.5, y: 0.5 }, visibility: 1, timestamp: t });
        }
        return snap;
      };
      feed(170, 10);
      feed(140, 5);
      feed(95, 8);
      feed(135, 6);
      const final = feed(Math.max(160, angle), 8);
      return { landmarks: lm.length, angle: Number(angle.toFixed(1)), reps: final.repCount, state: final.state };
    })()`,
  )
  report(
    'pose: modelo detecta persona y el ciclo válido suma 1',
    pose?.landmarks > 0 && pose?.reps === 1,
    JSON.stringify(pose),
  )

  const consoleErrors = client.events
    .filter((event) => event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error')
    .filter((event) => !/XNNPACK|INFO:/i.test(event.params.args.map((arg) => arg.value ?? arg.description).join(' ')))
    .map((event) => event.params.args.map((arg) => arg.value ?? arg.description).join(' '))
  const exceptions = client.events
    .filter((event) => event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text)

  report('sin errores de consola', consoleErrors.length === 0, consoleErrors.join(' | '))
  report('sin excepciones sin capturar', exceptions.length === 0, exceptions.join(' | '))
} catch (error) {
  report('ejecución del smoke test', false, error.message)
} finally {
  client?.close()
  browser.kill()
  await sleep(500)
  rmSync(profile, { recursive: true, force: true })
}

const failed = checks.filter((check) => !check.ok).length
console.log(`\n${checks.length - failed}/${checks.length} comprobaciones correctas`)
process.exit(failed === 0 ? 0 : 1)
