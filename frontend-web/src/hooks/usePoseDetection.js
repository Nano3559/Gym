import { useEffect, useRef, useState } from 'react'
import { angleAt, createSmoother, midPoint } from '../lib/geometry'
import { createAnalyzerForExercise } from '../lib/exerciseRegistry.js'

const MODEL_URL = '/mediapipe/pose_landmarker_lite.task'
const WASM_PATH = '/mediapipe/wasm'
const DETECTION_INTERVAL_MS = 1000 / 30
const UI_UPDATE_INTERVAL_MS = 90

const IDLE_STATE = {
  repCount: 0,
  state: 'IDLE',
  stateLabel: 'Sin persona',
  feedback: 'Colócate de lado, de cuerpo entero',
  angle: null,
}

const EXERCISE_SETUP = {
  squat: {
    metricKey: 'kneeAngle',
    sides: [[23, 25, 27], [24, 26, 28]],
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
    metricKey: 'elbowAngle',
    sides: [[11, 13, 15, 23, 27], [12, 14, 16, 24, 28]],
    measure(points, smoother) {
      const [shoulder, elbow, wrist, hip, ankle] = points
      const elbowAngle = smoother.push(angleAt(shoulder, elbow, wrist))
      const bodyAngle = angleAt(shoulder, hip, ankle)
      const visibility = Math.min(shoulder.visibility ?? 1, elbow.visibility ?? 1, wrist.visibility ?? 1)
      return { input: { elbowAngle, bodyAngle, shoulder, elbow, wrist, hip, ankle, visibility }, state: { elbowAngle, bodyAngle } }
    },
    lostInput(timestamp) {
      return { elbowAngle: null, bodyAngle: null, shoulder: null, elbow: null, wrist: null, hip: null, ankle: null, visibility: 0, timestamp }
    },
  },
  curl_biceps: {
    metricKey: 'elbowAngle',
    sides: [[11, 13, 15], [12, 14, 16]],
    measure(points, smoother) {
      const [shoulder, elbow, wrist] = points
      const elbowAngle = smoother.push(angleAt(shoulder, elbow, wrist))
      const visibility = Math.min(shoulder.visibility ?? 1, elbow.visibility ?? 1, wrist.visibility ?? 1)
      return { input: { elbowAngle, shoulder, elbow, wrist, visibility }, state: { elbowAngle } }
    },
    lostInput(timestamp) {
      return { elbowAngle: null, shoulder: null, elbow: null, wrist: null, visibility: 0, timestamp }
    },
  },
  lateral_raise: {
    metricKey: 'shoulderAngle',
    sides: [[23, 11, 13], [24, 12, 14]],
    measure(points, smoother) {
      const [hip, shoulder, elbow] = points
      const shoulderAngle = smoother.push(angleAt(hip, shoulder, elbow))
      const visibility = Math.min(hip.visibility ?? 1, shoulder.visibility ?? 1, elbow.visibility ?? 1)
      return { input: { shoulderAngle, hip, shoulder, elbow, visibility }, state: { shoulderAngle } }
    },
    lostInput(timestamp) {
      return { shoulderAngle: null, hip: null, shoulder: null, elbow: null, visibility: 0, timestamp }
    },
  },
  lunge: {
    metricKey: 'frontKneeAngle',
    sides: [[23, 25, 27, 24, 26, 28]],
    measure(points, smoother) {
      const [leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle] = points
      const leftAngle = angleAt(leftHip, leftKnee, leftAnkle)
      const rightAngle = angleAt(rightHip, rightKnee, rightAnkle)
      const visibility = Math.min(leftHip.visibility ?? 1, leftKnee.visibility ?? 1, leftAnkle.visibility ?? 1, rightHip.visibility ?? 1, rightKnee.visibility ?? 1, rightAnkle.visibility ?? 1)
      if (leftAngle === null || rightAngle === null) {
        const present = [leftAngle ?? rightAngle].filter((value) => value !== null)
        const frontKneeAngle = present.length ? smoother.push(present[0]) : null
        return { input: { frontKneeAngle, backKneeAngle: null, frontKneeY: null, backKneeY: null, visibility }, state: { frontKneeAngle, backKneeAngle: null } }
      }
      const leftSpan = Math.abs(leftHip.x - leftAnkle.x)
      const rightSpan = Math.abs(rightHip.x - rightAnkle.x)
      const frontLeft = leftSpan <= rightSpan
      const front = frontLeft ? leftAngle : rightAngle
      const back = frontLeft ? rightAngle : leftAngle
      const frontKneeY = frontLeft ? leftKnee.y : rightKnee.y
      const backKneeY = frontLeft ? rightKnee.y : leftKnee.y
      const frontKneeAngle = smoother.push(front)
      return { input: { frontKneeAngle, backKneeAngle: back, frontKneeY, backKneeY, visibility }, state: { frontKneeAngle, backKneeAngle: back } }
    },
    lostInput(timestamp) {
      return { frontKneeAngle: null, backKneeAngle: null, frontKneeY: null, backKneeY: null, visibility: 0, timestamp }
    },
  },
  calf_raise: {
    metricKey: 'ankleAngle',
    sides: [[11, 12, 23, 24, 25, 26, 27, 28, 31, 32]],
    measure(points, smoother) {
      const [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftFoot, rightFoot] = points
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2
      const hipY = (leftHip.y + rightHip.y) / 2
      const ankleY = (leftAnkle.y + rightAnkle.y) / 2
      const heightRef = Math.abs(hipY - ankleY)
      const visibility = Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1, leftHip.visibility ?? 1, rightHip.visibility ?? 1, leftAnkle.visibility ?? 1, rightAnkle.visibility ?? 1)
      const leftAngle = leftFoot ? angleAt(leftKnee, leftAnkle, leftFoot) : null
      const rightAngle = rightFoot ? angleAt(rightKnee, rightAnkle, rightFoot) : null
      const leftVis = leftFoot ? (leftKnee.visibility ?? 1) + (leftAnkle.visibility ?? 1) + (leftFoot.visibility ?? 1) : 0
      const rightVis = rightFoot ? (rightKnee.visibility ?? 1) + (rightAnkle.visibility ?? 1) + (rightFoot.visibility ?? 1) : 0
      const angle = leftAngle === null ? rightAngle : rightAngle === null ? leftAngle : leftVis >= rightVis ? leftAngle : rightAngle
      const ankleAngle = angle === null ? null : smoother.push(angle)
      return { input: { shoulderY, heightRef, visibility }, state: { ankleAngle } }
    },
    lostInput(timestamp) {
      return { shoulderY: null, heightRef: null, visibility: 0, timestamp }
    },
  },
  jumping_jack: {
    metricKey: 'spreadAngle',
    sides: [[0, 7, 8, 15, 16, 23, 24, 27, 28]],
    measure(points, smoother) {
      const [nose, leftEar, rightEar, leftWrist, rightWrist, leftHip, rightHip, leftAnkle, rightAnkle] = points
      const headY = Math.min(nose.y, leftEar.y, rightEar.y)
      const hipMid = midPoint(leftHip, rightHip)
      const spreadAngle = hipMid ? smoother.push(angleAt(leftAnkle, hipMid, rightAnkle)) : null
      const visibility = Math.min(nose.visibility ?? 1, leftEar.visibility ?? 1, rightEar.visibility ?? 1, leftWrist.visibility ?? 1, rightWrist.visibility ?? 1, leftHip.visibility ?? 1, rightHip.visibility ?? 1, leftAnkle.visibility ?? 1, rightAnkle.visibility ?? 1)
      return { input: { spreadAngle, headY, wristLeftY: leftWrist.y, wristRightY: rightWrist.y, visibility }, state: { spreadAngle } }
    },
    lostInput(timestamp) {
      return { spreadAngle: null, headY: null, wristLeftY: null, wristRightY: null, visibility: 0, timestamp }
    },
  },
  high_knees: {
    metricKey: 'hipAngle',
    sides: [[23, 25, 11, 24, 26, 12]],
    measure(points, smoother) {
      const [leftHip, leftKnee, leftShoulder, rightHip, rightKnee, rightShoulder] = points
      const leftAngle = angleAt(leftKnee, leftHip, leftShoulder)
      const rightAngle = angleAt(rightKnee, rightHip, rightShoulder)
      const angles = [leftAngle, rightAngle].filter((value) => value !== null)
      const hipAngle = angles.length ? smoother.push(Math.min(...angles)) : null
      const visibility = Math.min(leftHip.visibility ?? 1, leftKnee.visibility ?? 1, leftShoulder.visibility ?? 1, rightHip.visibility ?? 1, rightKnee.visibility ?? 1, rightShoulder.visibility ?? 1)
      return { input: { leftKneeY: leftKnee.y, rightKneeY: rightKnee.y, leftHipY: leftHip.y, rightHipY: rightHip.y, visibility }, state: { hipAngle } }
    },
    lostInput(timestamp) {
      return { leftKneeY: null, rightKneeY: null, leftHipY: null, rightHipY: null, visibility: 0, timestamp }
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

  const poseStateRef = useRef(IDLE_STATE)

  useEffect(() => {
    exerciseRef.current = exercise
    const factory = createAnalyzerForExercise(exercise)
    analyzerRef.current = factory ? factory() : null
    smootherRef.current?.reset()
    poseStateRef.current = IDLE_STATE
  }, [exercise])

  useEffect(() => {
    onFrameRef.current = onFrame
    if (!analyzerRef.current) {
      const factory = createAnalyzerForExercise(exerciseRef.current)
      analyzerRef.current = factory ? factory() : null
    }
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

      landmarksRef.current = landmarks ?? null

      if (!landmarks || !handle?.points || !smoother || !analyzerRef.current) {
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
