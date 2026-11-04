import { useCallback, useEffect, useRef, useState } from 'react'
import { createSmoother } from '../lib/geometry'
import { createAnalyzerForExercise } from '../lib/exerciseRegistry.js'
import { createFpsMonitor, DEFAULT_PERF_CONFIG } from '../lib/fpsMonitor.js'

const MODEL_URL = '/mediapipe/pose_landmarker_lite.task'
const WASM_PATH = '/mediapipe/wasm'
const UI_UPDATE_INTERVAL_MS = 90
const PERF_PUSH_INTERVAL_MS = 1000

const IDLE_STATE = {
  repCount: 0,
  state: 'IDLE',
  stateLabel: 'Sin persona',
  feedback: 'Colócate de lado, de cuerpo entero',
  angle: null,
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

// Dibuja el frame del video en un canvas más pequeño para que MediaPipe
// inferya sobre menos píxeles. Es la vía para bajar la resolución sin tocar el
// stream de la cámara, que reiniciarlo a mitad de serie se nota.
function prepareInferenceSource(video, scale, canvasRef) {
  if (scale >= 1) return video
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  let canvas = canvasRef.current
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvasRef.current = canvas
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return video
  context.drawImage(video, 0, 0, width, height)
  return canvas
}

// `perfConfig` debe ser una referencia estable (el valor por defecto lo es):
// forma parte de las dependencias del efecto que carga el modelo, así que un
// objeto literal en cada render recargaría MediaPipe continuamente.
export default function usePoseDetection({
  enabled = true,
  videoRef,
  onFrame,
  exercise = 'squat',
  targetSeconds = 30,
  adaptiveQuality = true,
  perfConfig = DEFAULT_PERF_CONFIG,
}) {
  const landmarkerRef = useRef(null)
  const analyzerRef = useRef(null)
  const smootherRef = useRef(null)
  const exerciseRef = useRef(exercise)
  const lastDetectRef = useRef(0)
  const rafRef = useRef(0)
  const onFrameRef = useRef(onFrame)
  const landmarksRef = useRef(null)
  const lastPushRef = useRef(0)
  const inferenceCanvasRef = useRef(null)
  const monitorRef = useRef(null)
  const lastPerfPushRef = useRef(0)

  const [modelStatus, setModelStatus] = useState('idle')
  const [poseState, setPoseState] = useState(IDLE_STATE)
  // No se llama "performance" a propósito: esa variable taparía el global
  // window.performance, que es justo el reloj que usa el bucle.
  const [detectionPerformance, setDetectionPerformance] = useState(null)

  const poseStateRef = useRef(IDLE_STATE)

  useEffect(() => {
    exerciseRef.current = exercise
    analyzerRef.current = createAnalyzerForExercise(exercise, { targetSeconds })
    smootherRef.current?.reset()
    poseStateRef.current = IDLE_STATE
  }, [exercise, targetSeconds])

  useEffect(() => {
    onFrameRef.current = onFrame
    if (!analyzerRef.current) {
      analyzerRef.current = createAnalyzerForExercise(exerciseRef.current, { targetSeconds })
    }
    if (!smootherRef.current) smootherRef.current = createSmoother(5)
  }, [onFrame, targetSeconds])

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false

    const setup = async () => {
      try {
        setModelStatus('loading')
        if (monitorRef.current === null) {
          monitorRef.current = createFpsMonitor(perfConfig)
        }
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
      const interval = adaptiveQuality ? monitorRef.current.getState(false).intervalMs : 1000 / 30
      if (now - lastDetectRef.current < interval) return

      const video = videoRef?.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || video.readyState < 2 || !video.videoWidth) return
      if (video.currentTime === lastDetectRef.current) return

      lastDetectRef.current = now
      let result = null
      const detectStart = performance.now()
      try {
        const scale = adaptiveQuality ? monitorRef.current.getState(false).scale : 1
        const source = prepareInferenceSource(video, scale, inferenceCanvasRef)
        result = landmarker.detectForVideo(source, now)
      } catch {
        return
      }

      // El coste de esta inferencia, no solo su resultado, es lo que revela si
      // el móvil tiene margen: el FPS alcançado está topado por la frecuencia
      // que pide el nivel actual.
      if (adaptiveQuality) {
        const state = monitorRef.current.tick(now, performance.now() - detectStart)
        if (state.changed || now - lastPerfPushRef.current >= PERF_PUSH_INTERVAL_MS) {
          lastPerfPushRef.current = now
          setDetectionPerformance(state)
        }
      }

      const landmarks = result?.landmarks?.[0]
      landmarksRef.current = landmarks ?? null
      const analyzer = analyzerRef.current
      if (analyzer) pushState(analyzer.processFrame(landmarks ?? [], now), landmarks, now)
    }

    const pushState = (next, landmarks, now) => {
      const prev = poseStateRef.current
      const changed =
        prev.repCount !== next.repCount ||
        prev.postureState !== next.postureState ||
        prev.feedback !== next.feedback ||
        Math.abs((prev.angle ?? -1) - (next.angle ?? -1)) >= 2
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
      inferenceCanvasRef.current = null
      // Cada sesión arranca en calidad alta: el equipo puede haber rendido mal
      // en la rutina anterior por calor o por poca batería.
      monitorRef.current?.reset()
      lastPerfPushRef.current = 0
      poseStateRef.current = IDLE_STATE
      setPoseState(IDLE_STATE)
      setDetectionPerformance(null)
      setModelStatus('idle')
    }
  }, [enabled, videoRef, adaptiveQuality, perfConfig])

  const resetReps = useCallback(() => {
    analyzerRef.current?.reset()
    const next = { ...IDLE_STATE, holdSeconds: 0 }
    poseStateRef.current = next
    setPoseState(next)
  }, [])

  return { poseState, modelStatus, landmarksRef, resetReps, performance: detectionPerformance }
}

export { usePoseDetection }
