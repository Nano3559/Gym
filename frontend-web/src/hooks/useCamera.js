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

const FRAME_RATE = { ideal: 30, max: 30 }

const DESKTOP_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: FRAME_RATE,
}

// En móviles el detector baja a 640×480 (30 FPS) y la resolución se invierte
// con la orientación: pedir siempre 1280×720 en vertical hace que el navegador
// entregue un frame apaisado que luego el contenedor recorta.
const MOBILE_PORTRAIT_CONSTRAINTS = {
  width: { ideal: 480 },
  height: { ideal: 640 },
  frameRate: FRAME_RATE,
}

const MOBILE_LANDSCAPE_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: FRAME_RATE,
}

// Se resuelve al abrir la cámara, no en cada render: si dependiera del estado
// de orientación, girar el teléfono reiniciaría el stream a mitad de serie.
export function resolveConstraints() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_CONSTRAINTS
  }
  if (!window.matchMedia('(max-width: 767px)').matches) return DESKTOP_CONSTRAINTS
  return window.matchMedia('(orientation: portrait)').matches
    ? MOBILE_PORTRAIT_CONSTRAINTS
    : MOBILE_LANDSCAPE_CONSTRAINTS
}

// Códigos con los que la interfaz distingue "no diste permiso" (que se puede
// reintentar con instrucciones) de otros fallos.
export const PERMISSION_ERRORS = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError']

export default function useCamera({ facingMode = 'user', active = false, constraints } = {}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')

  const stop = useCallback(() => {
    requestIdRef.current += 1
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
    if (streamRef.current) {
      const video = videoRef.current
      if (video) {
        video.srcObject = streamRef.current
        try { await video.play(); setError(''); setErrorCode('') } catch { setError('No se pudo reproducir la cámara. Vuelve a intentarlo.') }
      }
      return streamRef.current
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorCode('unsupported')
      setError('Este navegador no permite abrir la cámara. Usa Chrome, Edge o Safari actualizado.')
      return null
    }

    const requestId = ++requestIdRef.current
    setError('')
    setErrorCode('')
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...(constraints ?? resolveConstraints()), facingMode: { ideal: facingMode } },
        audio: false,
      })

      if (!mountedRef.current || requestId !== requestIdRef.current) {
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
          if (requestId === requestIdRef.current) {
            setErrorCode('PlaybackError')
            setError('No se pudo reproducir la cámara. Toca Reintentar para abrirla de nuevo.')
          }
        }
      }
      if (!mountedRef.current || requestId !== requestIdRef.current) return null
      setStatus('ready')
      return stream
    } catch (cameraError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return null
      const message =
        CAMERA_ERRORS[cameraError?.name] ||
        (cameraError?.name === 'NotAllowedError' && window.isSecureContext === false
          ? 'La cámara requiere una conexión segura (HTTPS o localhost).'
          : 'No se pudo abrir la cámara. Inténtalo de nuevo o sube una foto manualmente.')
      setStatus('error')
      setErrorCode(cameraError?.name ?? 'unknown')
      setError(message)
      return null
    }
  }, [constraints, facingMode])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      requestIdRef.current += 1
      mountedRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (active) {
      start()
      return () => {
        requestIdRef.current += 1
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
    // Solo se actualiza el estado si había un stream activo.
    stop()
  }, [active, start, stop])

  // The stream can resolve before React mounts a conditional video element.
  // Attach it after commit as well as in start(), so the preview cannot stay black.
  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (status !== 'ready' || !video || !stream || video.srcObject === stream) return
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {
      setErrorCode('PlaybackError')
      setError('No se pudo reproducir la cámara. Toca Reintentar para abrirla de nuevo.')
    })
  }, [status])

  // Libera la cámara si la pestaña queda en segundo plano.
  useEffect(() => {
    if (!active) return undefined
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [active, start, stop])

  // `setError('')` desde fuera (SquatCoachModal lo usa al abrir la cámara)
  // también debe limpiar el código para no dejar un aviso de permiso obsoleto.
  const clearError = useCallback(() => {
    setError('')
    setErrorCode('')
  }, [])

  return {
    videoRef,
    streamRef,
    status,
    error,
    errorCode,
    isPermissionDenied: PERMISSION_ERRORS.includes(errorCode),
    setError: clearError,
    start,
    stop,
  }
}

export { CAMERA_ERRORS }

export { useCamera }
