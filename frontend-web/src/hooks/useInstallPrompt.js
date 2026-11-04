import { useCallback, useEffect, useState } from 'react'

// Expone el evento beforeinstallprompt para poder ofrecer el botón
// "Añadir a pantalla de inicio". Ese evento solo existe en Chromium; en iOS
// Safari no hay API, así que se indica el compartir -> "Añadir a pantalla de
// inicio", que es el camino que iOS sí soporta.

const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  typeof window !== 'undefined' &&
  'standalone' in navigator

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      // Sin preventDefault el navegador muestra su propio mini-infobar y este
      // evento se consume sin dejar controllable la instalación.
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unsupported'
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // El evento solo sirve una vez.
    setDeferredPrompt(null)
    return outcome
  }, [deferredPrompt])

  const canInstall = Boolean(deferredPrompt)
  // En iOS nunca hay beforeinstallprompt, pero el usuario sí puede instalarla.
  const needsIosHint = !canInstall && isIos() && !installed

  return { canInstall, needsIosHint, installed, promptInstall, isIos: isIos() }
}
