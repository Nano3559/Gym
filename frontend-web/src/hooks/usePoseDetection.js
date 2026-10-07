import { useEffect, useRef, useState } from 'react'
import { angleAt, createSmoother } from '../lib/geometry'
import { SQUAT_LANDMARKS, createSquatAnalyzer } from '../lib/squatAnalyzer'
import { PUSHUP_LANDMARKS, createPushupAnalyzer } from '../lib/pushupAnalyzer'

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
  elbowAngle: null,
  bodyAngle: null,
}

// Configuración por ejercicio: qué analizador usar, qué articulaciones medir y
// cómo construir la entrada de cada analizador. Cada analizador tiene su propia
// máquina de estados y sus umbrales.
const EXERCISE_SETUP = {
  squat: {
    createAnalyzer: createSquatAnalyzer,
    metricKey: 'kneeAngle',
    sides: [
      [SQUAT_LANDMARKS.leftHip, SQUAT_LANDMARKS.leftKnee, SQUAT_LANDMARKS.leftAnkle],
      [SQUAT_LANDMARKS.rightHip, SQUAT_LANDMARKS.rightKnee, SQUAT_LANDMARKS.rightAnkle],
    ],
    measure(points, smoother) {
      const [hip, knee, ankle] = points
      const kneeAngle = smoother.push(angleAt(hip, knee, ankle))
      const visibility = Math.min(hip.visibility ?? 1, knee.visibility ?? 1, ankle.visibility ?? 1)
      return { input: { kneeAngle, hip, knee, ankle, visibility }, state: { kneeAngle } }
    },
    lostInput(timestamp) {
      return { kneeAngle: null, hip: null, knee: null, ankle: null, visibility: 0, timestamp }
    },
  },
  pushup: {
    createAnalyzer: createPushupAnalyzer,
    metricKey: 'elbowAngle',
    sides: [
      [
        PUSHUP_LANDMARKS.leftShoulder,
        PUSHUP_LANDMARKS.leftElbow,
        PUSHUP_LANDMARKS.leftWrist,
        PUSHUP_LANDMARKS.leftHip,
        PUSHUP_LANDMARKS.leftAnkle,
      ],
      [
        PUSHUP_LANDMARKS.rightShoulder,
        PUSHUP_LANDMARKS.rightElbow,
        PUSHUP_LANDMARKS.rightWrist,
        PUSHUP_LANDMARKS.rightHip,
        PUSHUP_LANDMARKS.rightAnkle,
      ],
    ],
    measure(points, smoother) {
      const [shoulder, elbow, wrist, hip, ankle] = points
      const elbowAngle = smoother.push(angleAt(shoulder, elbow, wrist))
      const bodyAngle = angleAt(shoulder, hip, ankle)
      const visibility = Math.min(shoulder.visibility ?? 1, elbow.visibility ?? 1, wrist.visibility ?? 1)
      return {
        input: { elbowAngle, bodyAngle, shoulder, elbow, wrist, hip, ankle, visibility },
        state: { elbowAngle, bodyAngle },
      }
    },
    lostInput(timestamp) {
      return {
        elbowAngle: null,
        bodyAngle: null,
        shoulder: null,
        elbow: null,
        wrist: null,
        hip: null,
        ankle: null,
        visibility: 0,
        timestamp,
      }
    },
  },
}

function getSetup(exercise) {
  return EXERCISE_SETUP[exercise] ?? EXERCISE_SETUP.squat
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

function pickSide(landmarks, sides) {
  // Elige el lado (izquierdo o derecho) con mayor confianza de sus articulaciones.
  // sides es un arreglo con los índices de los landmarks que usa cada ejercicio.
  let best = null
  for (const indices of sides) {
    const points = indices.map((index) => landmarks[index])
    const score = points.reduce((sum, point) => sum + (point?.visibility ?? 0), 0) / points.length
    if (!best || score > best.score) best = { score, points }
  }
  return best
}

export default function usePoseDetection({ enabled = true, videoRef, onFrame, exercise = 'squat' }) {
  const landmarkerRef = useRef(null)
  const analyzerRef = useRef(null)
  const smootherRef = useRef(null)
  const exerciseRef = useRef(exercise)
  const lastDetectRef = useRef(0)
  const rafRef = useRef(0)
  const onFrameRef = useRef(onFrame)
  const landmarksRef = useRef(null)
  const lastPushRef = useRef(0)

  const [modelStatus, setModelStatus] = useState('idle')
  const [poseState, setPoseState] = useState(IDLE_STATE)

  // Espejo del estado para comparar dentro del bucle sin provocar renders.
  const poseStateRef = useRef(IDLE_STATE)

  // Al cambiar de ejercicio se recrea el analizador y se limpia lo visible.
  // No se vuelve a descargar el modelo: el bucle de detección lo reutiliza.
  useEffect(() => {
    exerciseRef.current = exercise
    const setup = getSetup(exercise)
    analyzerRef.current = setup.createAnalyzer()
    smootherRef.current?.reset()
    poseStateRef.current = IDLE_STATE
  }, [exercise])

  useEffect(() => {
    onFrameRef.current = onFrame
    if (!analyzerRef.current) analyzerRef.current = getSetup(exerciseRef.current).createAnalyzer()
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
      const setup = getSetup(exerciseRef.current)
      const handle = landmarks ? pickSide(landmarks, setup.sides) : null
      const smoother = smootherRef.current

      // El overlay se actualiza por referencia (fuera de React) para no
      // disparar renders en cada frame.
      landmarksRef.current = landmarks ?? null

      if (!landmarks || !handle?.points || !smoother) {
        smoother?.reset()
        pushState(
          {
            ...analyzerRef.current.update(setup.lostInput(now)),
            [setup.metricKey]: null,
          },
          null,
          now,
        )
        return
      }

      const { input, state } = setup.measure(handle.points, smoother)
      input.timestamp = now

      pushState({ ...analyzerRef.current.update(input), ...state }, landmarks, now)
    }

    // React solo se actualiza cuando cambia algo visible (repeticiones, estado,
    // mensaje) o pasado un intervalo mínimo para refrescar el ángulo.
    const pushState = (next, landmarks, now) => {
      const prev = poseStateRef.current
      const setup = getSetup(exerciseRef.current)
      const changed =
        prev.repCount !== next.repCount ||
        prev.state !== next.state ||
        prev.feedback !== next.feedback ||
        Math.abs((prev[setup.metricKey] ?? -1) - (next[setup.metricKey] ?? -1)) >= 2
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
