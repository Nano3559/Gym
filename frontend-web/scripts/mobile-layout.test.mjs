// Auditoría estática de layout móvil y PWA.
//
//   node scripts/mobile-layout.test.mjs
//
// No sustituye a probar en un móvil, pero atrapa en CI las regresiones que
// romperían esos dispositivos: objetivos táctiles por debajo de 48 px,
// encuadres que no siguen la orientación, iconos de PWA que no llegan a dist,
// o metaetiquetas de instalación que desaparecen del index.html.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const srcDir = join(root, 'src')
const publicDir = join(root, 'public')

const results = []

function test(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
    console.log(`ok   ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error })
    console.error(`FAIL ${name}`)
    console.error(error.message)
  }
}

function listFiles(dir, ext) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, ext))
    else if (entry.name.endsWith(ext)) out.push(full)
  }
  return out
}

const jsxFiles = listFiles(srcDir, '.jsx')
const read = (path) => readFileSync(path, 'utf8')
const relative = (path) => path.slice(root.length + 1)

// --- Objetivos táctiles ---------------------------------------------------
// La guía pide un mínimo de 48×48 px en todo control táctil. Tailwind lo
// escribe como utilidades de tamaño; h-11 son 44 px, justo por debajo.
//
// Limitación: solo se revisan los botones con una utilidad de altura
// explícita (h-* / min-h-*). Un botón que se dimensiona solo con padding queda
// fuera del análisis, así que esto no sustituye a medir los controles reales en
// el dispositivo.
const TOUCH_SIZE_UTILITIES = /(?:^|\s)(?:min-)?([hw])-(\d+(?:\.\d+)?)\b/g

function tailwindSizeToPx(token) {
  const numeric = Number(token)
  if (!Number.isFinite(numeric)) return null
  // Tailwind escala por debajo de 4 como 0.25 rem; el resto es 0.25 rem/px.
  return numeric * 4
}

test('ningún botón interactivo queda por debajo de 48 px', () => {
  const offenders = []
  for (const file of jsxFiles) {
    const source = read(file)
    // Cada etiqueta <button ...> hasta su cierre.
    for (const match of source.matchAll(/<button\b[\s\S]*?>/g)) {
      const tag = match[0]
      const hasExplicitHeight = /\b(?:min-)?h-/.test(tag)
      if (!hasExplicitHeight) continue
      let min = Infinity
      for (const size of tag.matchAll(TOUCH_SIZE_UTILITIES)) {
        const px = tailwindSizeToPx(size[2])
        if (px && px < 48) min = Math.min(min, px)
      }
      if (min < 48) {
        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${relative(file)}:${line} -> ${min}px`)
      }
    }
  }
  assert.deepEqual(offenders, [], `controles táctiles por debajo de 48px:\n${offenders.join('\n')}`)
})

// --- Encuadre por orientación --------------------------------------------
test('las vistas de cámara adapts el encuadre a la orientación', () => {
  const cameraViews = ['components/RoutineRunner.jsx', 'components/SquatCoachModal.jsx']
  for (const view of cameraViews) {
    const path = join(srcDir, view)
    assert.ok(existsSync(path), `falta ${view}`)
    const source = read(path)
    assert.match(source, /useOrientation/, `${view} debe usar useOrientation`)
    assert.match(source, /isPortrait\s*\?[^:]*:/, `${view} debe cambiar la proporción según la orientación`)
    assert.ok(
      !/className="[^"]*\baspect-video\b/.test(source),
      `${view} tiene aspect-video fijo: en vertical el cuerpo queda recortado`,
    )
  }
})

test('useCamera pide menos resolución en móvil que en escritorio', () => {
  const source = read(join(srcDir, 'hooks', 'useCamera.js'))
  assert.match(source, /MOBILE_PORTRAIT_CONSTRAINTS/, 'debe existir un perfil móvil')
  assert.match(source, /orientation: portrait/, 'debe considerar la orientación')
  assert.match(source, /max-width: 767px/, 'debe detectar viewport de móvil')
  // 480x640 en vertical: el límite de 640 px de la guía.
  assert.match(source, /ideal:\s*480/, 'debe bajar a 480 px de ancho en vertical')
  assert.match(source, /ideal:\s*640/, 'debe bajar a 640 px de ancho en horizontal')
})

// --- Barras fijas y safe area -------------------------------------------
test('las barras fijas respetan el safe area de iOS', () => {
  const offenders = []
  for (const file of jsxFiles) {
    const source = read(file)
    if (!/fixed\s+(?:inset-x-0\s+)?bottom-0/.test(source)) continue
    if (!/env\(safe-area-inset-bottom\)/.test(source)) {
      offenders.push(relative(file))
    }
  }
  assert.deepEqual(offenders, [], `barras fijas inferiores sin safe-area-inset: ${offenders.join(', ')}`)
})

// --- PWA: index.html ------------------------------------------------------
const indexHtml = read(join(root, 'index.html'))

test('index.html declara la PWA y el modo de instalación', () => {
  assert.match(indexHtml, /rel="manifest"/, 'falta el enlace al manifest')
  assert.match(indexHtml, /rel="apple-touch-icon"/, 'falta el icono para iOS')
  assert.match(indexHtml, /name="theme-color"/, 'falta theme-color')
  assert.match(indexHtml, /name="apple-mobile-web-app-capable"/, 'iOS no instalará la app')
  assert.match(indexHtml, /viewport-fit=cover/, 'sin viewport-fit=cover los safe-area no funcionan')
})

// --- PWA: manifest y recursos -------------------------------------------
const manifest = JSON.parse(read(join(publicDir, 'manifest.webmanifest')))

test('el manifest declara standalone y orientación libre', () => {
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.orientation, 'any', 'el entrenamiento se usa en vertical y en horizontal')
  assert.ok(manifest.name && manifest.short_name)
  assert.ok(manifest.start_url && manifest.scope)
})

test('el manifest apunta a iconos que existen con los tamaños exigidos', () => {
  const sizes = new Set()
  for (const icon of manifest.icons) {
    const file = join(publicDir, icon.src.replace(/^\//, ''))
    assert.ok(existsSync(file), `falta el icono ${icon.src}`)
    assert.ok(readFileSync(file).length > 200, `${icon.src} parece vacío`)
    if (icon.sizes && icon.sizes !== 'any') sizes.add(icon.sizes)
  }
  assert.ok(sizes.has('192x192'), 'Chrome exige un icono de 192x192 para instalar')
  assert.ok(sizes.has('512x512'), 'Chrome exige un icono de 512x512 para instalar')
  assert.ok(
    manifest.icons.some((icon) => (icon.purpose || '').includes('maskable')),
    'falta un icono maskable para el recorte circular de Android',
  )
})

test('el service worker se registra solo en producción', () => {
  const source = read(join(srcDir, 'lib', 'pwa.js'))
  assert.match(source, /import\.meta\.env\.PROD/, 'en desarrollo cachearía los módulos de Vite')
  assert.ok(existsSync(join(publicDir, 'sw.js')), 'falta public/sw.js')
})

test('el service worker no cachea MediaPipe ni Supabase', () => {
  const source = read(join(publicDir, 'sw.js'))
  assert.match(source, /\/mediapipe\//, 'debe excluir los binarios de MediaPipe')
  assert.match(source, /url\.origin !== self\.location\.origin/, 'debe dejar pasar lo cross-origin (Supabase, fuentes)')
})

// --- Avisos en español ---------------------------------------------------
test('los textos nuevos de la PWA están en español', () => {
  const source = read(join(srcDir, 'components', 'InstallPrompt.jsx'))
  assert.match(source, /Añade IronForge a tu pantalla de inicio/)
  assert.equal(manifest.lang, 'es')
  assert.match(manifest.shortcuts[0].name, /rutinas/i)
  assert.match(manifest.shortcuts[1].name, /nutricional/i)
})

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
if (failed.length > 0) process.exitCode = 1
