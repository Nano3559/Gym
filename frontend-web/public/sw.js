// Service worker mínimo de la PWA.
//
// Estrategia:
//   * navegaciones -> red primero, con el index cacheado como respaldo, para
//     que una app instalada abra aunque el móvil esté sin datos;
//   * recursos con hash de /assets -> caché primero (son inmutables);
//   * /mediapipe/ y las peticiones a Supabase NUNCA se cachean: son binarios
//     grandes y datos que deben llegar frescos.
//
// El archivo se versiona a mano en CACHE_VERSION para invalidar todo al
// desplegar una versión nueva.

const CACHE_VERSION = 'ironforge-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const PAGES_CACHE = `${CACHE_VERSION}-pages`

const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // addAll es atómico: si un recurso falla no se instala nada, y es lo
      // correcto para no dejar una app medio cacheada.
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('ironforge-') && !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

// Permite que la página pida activar la versión nueva sin recargar.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function shouldBypass(request) {
  if (request.method !== 'GET') return true
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return true // fuentes de Google, Supabase, etc.
  if (url.pathname.startsWith('/mediapipe/')) return true
  if (url.pathname.startsWith('/@vite/')) return true // solo en desarrollo
  return false
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = (await cache.match(request)) || (await caches.match('/index.html'))
    if (cached) return cached
    return new Response('Sin conexión y sin copia guardada.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // Solo se guardan respuestas completas ySuccessful: un 206 o una respuesta
  // opaca no sirve para servir más tarde.
  if (response.ok && response.status === 200) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (shouldBypass(request)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(cacheFirst(request).catch(() => new Response('Sin conexión.', { status: 503 })))
})
