import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toAnalysisLandmarks } from '../src/lib/poseCoordinates.js'
import { angleAt, distance, midPoint } from '../src/lib/geometry.js'
import { EXERCISE_REGISTRY, createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'

const sizes = [[640,480],[1280,720],[1920,1080],[480,640],[720,1280],[640,640]]
// Input pose is Cartesian, expressed in image-height units. Simulate the
// normalized MediaPipe output at each capture aspect ratio.
const encode = (pose, width, height) => pose.map(point => ({ ...point, x: point.x * height / width }))
const decode = (pose, width, height) => toAnalysisLandmarks(encode(pose,width,height),width,height)
const close = (actual, expected, label = '') => assert.ok(Math.abs(actual-expected) < 1e-5, `${label}: ${actual} != ${expected}`)

for (const [width,height] of sizes) {
  test(`geometría ${width}×${height}: ángulos físicos conocidos y distancias`, () => {
    for (const angle of [30,60,90,120,160,175]) {
      const radians = angle*Math.PI/180
      const physical = [{x:0.3,y:0.3},{x:0.2,y:0.3},{x:0.2+0.1*Math.cos(radians),y:0.3+0.1*Math.sin(radians)}]
      const corrected = decode(physical,width,height)
      close(angleAt(...corrected), angle)
      close(distance(corrected[0],corrected[1]),0.1)
      close(distance(midPoint(corrected[0],corrected[1]),corrected[1]),0.05)
    }
  })
}

test('regresión del defecto: 90° físicos se distorsionaban sin corregir y ahora se conservan', () => {
  const physical = [{x:0.1,y:0.1},{x:0.2,y:0.2},{x:0.3,y:0.1}]
  const normalized = encode(physical,640,480)
  assert.ok(Math.abs(angleAt(...normalized)-90)>10)
  close(angleAt(...toAnalysisLandmarks(normalized,640,480)),90)
})

test('el análisis no muta los puntos que utiliza el dibujo del esqueleto', () => {
  const points = Object.freeze([Object.freeze({x:0.4,y:0.2,z:-0.3,visibility:0.8,presence:0.9})])
  const corrected = toAnalysisLandmarks(points,1280,720)
  assert.notEqual(corrected,points)
  assert.notEqual(corrected[0],points[0])
  assert.equal(points[0].x,0.4)
  assert.equal(corrected[0].y,0.2)
  assert.equal(corrected[0].visibility,0.8)
  assert.equal(corrected[0].presence,0.9)
  assert.equal(corrected[0].z,-0.3,'La corrección solo cambia geometría 2D')
})

test('pose ausente, dimensiones inválidas y puntos incompletos se manejan sin inventar postura', () => {
  for (const [width,height] of [[0,480],[640,0],[-1,480],[NaN,480],[640,Infinity]]) assert.deepEqual(toAnalysisLandmarks([],width,height),[])
  assert.deepEqual(toAnalysisLandmarks(null,640,480),[])
  assert.deepEqual(toAnalysisLandmarks([null,undefined],640,480),[null,undefined])
  assert.equal(angleAt({x:0,y:0},{x:0,y:0},{x:1,y:1}),null)
})

// Compare complete analyzer output across aspect ratios, not just angleAt.
// The random poses test robustness/invariance, not physical exercise accuracy.
function equivalent(actual, expected, path = '') {
  if (typeof expected === 'number' && Number.isFinite(expected)) close(actual,expected,path)
  else if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort())
    for (const key of Object.keys(expected)) equivalent(actual[key],expected[key],`${path}.${key}`)
  } else assert.equal(actual,expected,path)
}
let seed = 12345
const random = () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
const sequence = Array.from({length:60},(_,i)=>Array.from({length:33},()=>({x:0.05+random()*0.35,y:0.1+random()*0.8,visibility:i===25?0:1})))
for (const exercise of EXERCISE_REGISTRY) {
  test(`invariancia del analizador: ${exercise.id}`, () => {
    const reference = createAnalyzerForExercise(exercise.id)
    const expected = sequence.map((pose,i)=>reference.processFrame(pose,i*100))
    for (const [width,height] of sizes) {
      const analyzer = createAnalyzerForExercise(exercise.id)
      sequence.forEach((pose,i)=>equivalent(analyzer.processFrame(decode(pose,width,height),i*100),expected[i],`${exercise.id} ${width}×${height} frame ${i}`))
    }
  })
}

function elbowPose(angle) {
  const pose = Array.from({length:33},()=>({x:0.2,y:0.5,visibility:1}))
  for (const side of [0,1]) {
    const radians=(180-angle)*Math.PI/180
    pose[11+side]={x:0.1,y:0.5,visibility:1}
    pose[13+side]={x:0.2,y:0.5,visibility:1}
    pose[15+side]={x:0.2+0.1*Math.cos(radians),y:0.5+0.1*Math.sin(radians),visibility:1}
  }
  return pose
}
for (const [width,height] of sizes) {
  test(`ciclos de press y boxeo conservan su conteo en ${width}×${height}`, () => {
    for (const [id,initial,extreme] of [['bench_press',175,70],['punch_cross',85,175]]) {
      const analyzer=createAnalyzerForExercise(id)
      let time=0,state
      for (let rep=0;rep<3;rep++) {
        for (const angle of [initial,extreme,initial]) for(let frame=0;frame<15;frame++) {
          state=analyzer.processFrame(decode(elbowPose(angle),width,height),time+=33)
        }
        assert.equal(state.repCount,rep+1,id)
      }
    }
  })
}

for (const [width,height] of sizes) {
  test(`regresión de sentadilla, curl y elevaciones laterales en ${width}×${height}`, () => {
    for (const [id,initial,extreme,indices] of [
      ['squat',175,75,[23,25,27]],
      ['curl_biceps',175,20,[11,13,15]],
      ['lateral_raise',5,85,[23,11,13]],
    ]) {
      const analyzer=createAnalyzerForExercise(id)
      let time=0,state
      const feed = angle => {
        const template=elbowPose(angle)
        const pose=Array.from({length:33},()=>({x:0.2,y:0.5,visibility:1}))
        for (const side of [0,1]) indices.forEach((index,i)=>{pose[index+side]={...template[[11,13,15][i]+side]}})
        for(let frame=0;frame<18;frame++) state=analyzer.processFrame(decode(pose,width,height),time+=33)
      }
      for(let rep=1;rep<=3;rep++) {
        feed(initial);feed(extreme);feed(initial)
        assert.equal(state.repCount,rep,id)
      }
      analyzer.reset()
      feed(initial)
      assert.equal(state.repCount,0,id)
    }
  })
}
