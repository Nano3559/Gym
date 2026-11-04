// Registro del service worker. Solo en producción: en desarrollo el SW
// cachearía los módulos de Vite y los cambios no se verían hasta recargar
// dos veces.

export function registerServiceWorker() {
  if (import.meta.env.PROD !== true) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando, solo pierde el modo
      // offline y la instalación: no interrumpe al usuario con un error.
    })
  })
}

// Avisa al service worker de que hay una versión nueva waiting, para que
// aplique el skipWaiting en el siguiente cambio de estado.
export function notifyUpdateReady(registration) {
  registration?.waiting?.postMessage('SKIP_WAITING')
}
