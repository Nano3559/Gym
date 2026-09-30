import { useEffect, useRef, useState } from 'react'
import { angleAt, createSmoother } from '../lib/geometry'
import { SQUAT_LANDMARKS, createSquatAnalyzer } from '../lib/squatAnalyzer'

// Detección de pose 100% local con MediaPipe Tasks Vision.
// No se envía ningún frame a ninguna API de IA: el modelo se descarga una vez
// desde /mediapipe y se reutiliza mientras la pantalla esté montada.

const MODEL_URL = '/mediapipe/pose_landmarker_lite.task'
const WASM_PATH = '/mediapipe/wasm'
const DETECTION_INTERVAL_MS = 1000 / 30
const UI_UPDATE_INTERVAL_MS = 90

const IDLE_STATE = {
  repCount: 0,
  state: 'IDLE',
  stateLabel: 'Sin persona',
  feedback: 'Colócate de lado, de cuerpo entero',
  kneeAngle: null,
}

let visionModulePromise = null

async function loadVisionModule() {
  if (!visionModulePromise) {
    visionModulePromise = import('@mediapipe/tasks-vision').then(
      (module) => module,
      (error) => {
        visionModulePromise = null
        throw error
      },
    )
  }
  return visionModulePromise
}

function pickSide(landmarks) {
  // Elige el lado (izquierdo o derecho) con mayor confianza de cadera/rodilla/tobillo.
  const sides = [
    [SQUAT_LANDMARKS.leftHip, SQUAT_LANDMARKS.leftKnee, SQUAT_LANDMARKS.leftAnkle],
    [SQUAT_LANDMARKS.rightHip, SQUAT_LANDMARKS.rightKnee, SQUAT_LANDMARKS.rightAnkle],
  ]
  let best = null
  for (const indices of sides) {
    const [hip, knee, ankle] = indices.map((index) => landmarks[index])
    const score = (hip?.visibility ?? 0) + (knee?.visibility ?? 0) + (ankle?.visibility ?? 0)
    if (!best || score > best.score) best = { score, hip, knee, ankle }
  }
  return best
}

export default function usePoseDetection({ enabled = true, videoRef, onFrame }) {
  const landmarkerRef = useRef(null)
  const analyzerRef = useRef(null)
  const smootherRef = useRef(null)
  const lastDetectRef = useRef(0)
  const rafRef = useRef(0)
  const onFrameRef = useRef(onFrame)
  const landmarksRef = useRef(null)
  const lastPushRef = useRef(0)

  const [modelStatus, setModelStatus] = useState('idle')
  const [poseState, setPoseState] = useState(IDLE_STATE)

  // Espejo del estado para comparar dentro del bucle sin provocar renders.
  const poseStateRef = useRef(IDLE_STATE)

  useEffect(() => {
    onFrameRef.current = onFrame
    if (!analyzerRef.current) analyzerRef.current = createSquatAnalyzer()
    if (!smootherRef.current) smootherRef.current = createSmoother(5)
  }, [onFrame])

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false

    const setup = async () => {
      try {
        setModelStatus('loading')
        const { FilesetResolver, PoseLandmarker } = await loadVisionModule()
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
        if (cancelled) return
        const options = {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
        // GPU es más rápido, pero no todos los equipos lo soportan.
        landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'GPU' },
        }).catch(() => PoseLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } }))
        if (cancelled) {
          landmarkerRef.current?.close?.()
          landmarkerRef.current = null
          return
        }
        setModelStatus('ready')
        loop()
      } catch {
        if (!cancelled) setModelStatus('error')
      }
    }

    const loop = () => {
      if (cancelled) return
      rafRef.current = requestAnimationFrame(loop)
      const now = performance.now()
      if (now - lastDetectRef.current < DETECTION_INTERVAL_MS) return

      const video = videoRef?.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || video.readyState < 2 || !video.videoWidth) return
      if (video.currentTime === lastDetectRef.current) return

      lastDetectRef.current = now
      let result = null
      try {
        result = landmarker.detectForVideo(video, now)
      } catch {
        return
      }

      const landmarks = result?.landmarks?.[0]
      const handle = landmarks ? pickSide(landmarks) : null
      const smoother = smootherRef.current

      // El overlay se actualiza por referencia (fuera de React) para no
      // disparar renders en cada frame.
      landmarksRef.current = landmarks ?? null

      if (!landmarks || !handle?.hip || !handle?.knee || !handle?.ankle) {
        smoother.reset()
pushState(
        {
          ...analyzerRef.current.update({
            kneeAngle: null,
            hip: null,
            knee: null,
            ankle: null,
            visibility: 0,
            timestamp: now,
          }),
          kneeAngle: null,
        },
        null,
        now,
      )
      return
    }

      const visibility = Math.min(handle.hip.visibility ?? 1, handle.knee.visibility ?? 1, handle.ankle.visibility ?? 1)
      const kneeAngle = smoother.push(angleAt(handle.hip, handle.knee, handle.ankle))

      pushState(
        {
          ...analyzerRef.current.update({
            kneeAngle,
            hip: handle.hip,
            knee: handle.knee,
            ankle: handle.ankle,
            visibility,
            timestamp: now,
          }),
          kneeAngle,
        },
        landmarks,
        now,
      )
    }

    // React solo se actualiza cuando cambia algo visible (repeticiones, estado,
    // mensaje) o pasado un intervalo mínimo para refrescar el ángulo.
    const pushState = (next, landmarks, now) => {
      const prev = poseStateRef.current
      const changed =
        prev.repCount !== next.repCount ||
        prev.state !== next.state ||
        prev.feedback !== next.feedback ||
        Math.abs((prev.kneeAngle ?? -1) - (next.kneeAngle ?? -1)) >= 2
      const shouldPush = changed || now - lastPushRef.current >= UI_UPDATE_INTERVAL_MS
      if (!shouldPush) {
        onFrameRef.current?.(next, landmarks)
        return
      }
      lastPushRef.current = now
      poseStateRef.current = next
      setPoseState(next)
      onFrameRef.current?.(next, landmarks)
    }

    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close?.()
      landmarkerRef.current = null
      analyzerRef.current?.reset()
      smootherRef.current?.reset()
      landmarksRef.current = null
      poseStateRef.current = IDLE_STATE
      setPoseState(IDLE_STATE)
      setModelStatus('idle')
    }
  }, [enabled, videoRef])

  const resetReps = () => {
    analyzerRef.current?.resetReps()
    const next = { ...poseStateRef.current, repCount: 0 }
    poseStateRef.current = next
    setPoseState(next)
  }

  return { poseState, modelStatus, landmarksRef, resetReps }
}
