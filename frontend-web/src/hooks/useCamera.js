import { useCallback, useEffect, useRef, useState } from 'react'

// Hook responsable de todo el ciclo de vida de la cámara del navegador.
// Se reutiliza tanto en el escáner nutricional como en el entrenador de
// ejercicios, de modo que la lógica de getUserMedia queda en un solo lugar.

const CAMERA_ERRORS = {
  NotAllowedError: 'Permiso de cámara denegado. Habilítalo en el candado de la barra de direcciones y reintenta.',
  PermissionDeniedError: 'Permiso de cámara denegado. Habilítalo en los ajustes del navegador y reintenta.',
  NotFoundError: 'No se encontró ninguna cámara conectada.',
  DevicesNotFoundError: 'No se encontró ninguna cámara conectada.',
  NotReadableError: 'La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.',
  TrackStartError: 'No se pudo iniciar la cámara. Ciérrala en otra aplicación e inténtalo de nuevo.',
  OverconstrainedError: 'La cámara no admite la resolución solicitada. Se usará la disponible.',
  SecurityError: 'La cámara está bloqueada por la política de seguridad del navegador (sirve la app en HTTPS).',
  AbortError: 'La cámara se detuvo antes de terminar de iniciarse.',
}

const DEFAULT_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
}

export default function useCamera({ facingMode = 'user', active = false, constraints = DEFAULT_CONSTRAINTS } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const stop = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setStatus('idle')
    return stream
  }, [])

  const start = useCallback(async () => {
    if (streamRef.current) return streamRef.current
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Este navegador no permite abrir la cámara. Usa Chrome, Edge o Safari actualizado.')
      return null
    }

    setError('')
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...constraints, facingMode: { ideal: facingMode } },
        audio: false,
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return null
      }

      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        try {
          await video.play()
        } catch {
          // Algunos navegadores necesitan un play() explicito tras el gesto del usuario.
        }
      }
      setStatus('ready')
      return stream
    } catch (cameraError) {
      const message =
        CAMERA_ERRORS[cameraError?.name] ||
        (cameraError?.name === 'NotAllowedError' && window.isSecureContext === false
          ? 'La cámara requiere una conexión segura (HTTPS o localhost).'
          : 'No se pudo abrir la cámara. Inténtalo de nuevo o sube una foto manualmente.')
      setStatus('error')
      setError(message)
      return null
    }
  }, [constraints, facingMode])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (active) {
      start()
      return
    }
    // Solo se actualiza el estado si había un stream activo.
    if (streamRef.current) stop()
  }, [active, start, stop])

  // Libera la cámara si la pestaña queda en segundo plano.
  useEffect(() => {
    if (!active) return undefined
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [active, start])

  return { videoRef, streamRef, status, error, setError, start, stop }
}

export { CAMERA_ERRORS }
