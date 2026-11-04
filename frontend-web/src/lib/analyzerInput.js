import { angleAt, createSmoother, midPoint } from './geometry.js'
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

function pickSide(landmarks, sides) {
  let best = null
  for (const indices of sides) {
    const points = indices.map((index) => landmarks[index])
    const score = points.reduce((sum, point) => sum + (point?.visibility ?? 0), 0) / points.length
    if (!best || score > best.score) best = { score, points }
  }
  return best
}


export function adaptLegacyAnalyzer(analyzer, exercise) {
  const setup = getSetup(exercise), smoother = createSmoother(5)
  return { ...analyzer,
    processFrame(landmarks, timestamp=0) {
      const handle = pickSide(landmarks ?? [],setup.sides)
      const visible=handle?.points?.every(p => p && (p.visibility ?? 0)>=0.5)
      let result
      if (!visible) {
        smoother.reset()
        result = analyzer.update(setup.lostInput(timestamp + (analyzer.config?.trackingTimeoutMs ?? 900) + 1))
        return { ...result, angle: 0, isRepetition: false, postureState:'IDLE', feedback:'No te veo completo' }
      }
      const { input,state } = setup.measure(handle.points,smoother)
      result = analyzer.update({ ...input,timestamp })
      return { ...result,...state, angle: Number.isFinite(result.angle) ? result.angle : (state[setup.metricKey] ?? 0) }
    },
    reset() { analyzer.reset(); smoother.reset() },
    resetReps() { this.reset() },
  }
}
