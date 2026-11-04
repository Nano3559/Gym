import { useSyncExternalStore } from 'react'

// Detecta la orientación de la pantalla para adaptar el encuadre de la cámara.
// Se usa matchMedia y no screen.orientation porque en iOS Safari latter no
// dispara cambios de forma fiable.
//
// La orientación es un estado externo (el del navegador), así que se lee con
// useSyncExternalStore en vez de setState dentro de un efecto: no provoca un
// render en cascada al montar.

const PORTRAIT_QUERY = '(orientation: portrait)'

function subscribe(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(PORTRAIT_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(PORTRAIT_QUERY).matches
}

export default function useOrientation() {
  const isPortrait = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return {
    orientation: isPortrait ? 'portrait' : 'landscape',
    isPortrait,
    isLandscape: !isPortrait,
  }
}

export { useOrientation }
