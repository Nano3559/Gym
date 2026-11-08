import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXERCISE_REGISTRY, createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'
import { CoordRepAnalyzer } from '../src/lib/CoordRepAnalyzer.js'
import { SequenceAnalyzer } from '../src/lib/SequenceAnalyzer.js'
import { AlternatingAnalyzer } from '../src/lib/AlternatingAnalyzer.js'
import { IsometricAnalyzer } from '../src/lib/IsometricAnalyzer.js'

const point = (value, visible = true) => [{ x: value, y: 0.2, visibility: visible ? 1 : 0.1 }]
const config = { requiredIndices: [0], metric: p => p[0].x, smootherWindow: 1, threshold: 0.5, resetOffset: 0.2, direction: 'increase', minRepMs: 400 }
const coord = () => {
  const a = new CoordRepAnalyzer(config)
  return { a, feed: (value,time,visible=true) => a.processFrame(point(value,visible),0,time) }
}

test('coordenadas: pérdida breve conserva el ciclo y no suma mientras falta el punto', () => {
  const { feed } = coord()
  feed(0,0);feed(1,100);feed(1,600)
  const missing=feed(1,700,false)
  assert.equal(missing.postureState,'DOWN');assert.equal(missing.trackingLost,true)
  assert.equal(missing.repCount,0);assert.equal(missing.isRepetition,false)
  assert.equal(feed(0,900).repCount,1)
})

test('coordenadas: la pérdida larga descarta el ciclo, sin borrar repeticiones previas', () => {
  const { feed } = coord()
  feed(0,0);feed(1,100);feed(1,600);assert.equal(feed(0,700).repCount,1)
  feed(1,800);feed(1,1300)
  const lost=feed(1,2301,false)
  assert.equal(lost.postureState,'IDLE');assert.equal(lost.repCount,1)
  assert.equal(feed(0,2400).repCount,1)
  feed(1,2500);feed(1,3000);assert.equal(feed(0,3100).repCount,2)
})

test('recuperación después del plazo también invalida el ciclo aunque no lleguen más frames inválidos', () => {
  const { feed } = coord()
  feed(0,0);feed(1,100);feed(1,600);feed(1,700,false)
  assert.equal(feed(0,1700).repCount,0)
})

test('el tiempo ciego no convierte un movimiento rápido en repetición válida', () => {
  const { feed } = coord()
  feed(0,0);feed(1,100);feed(1,150);feed(1,200,false)
  assert.equal(feed(0,800).repCount,0)
})

test('no inventa un extremo que ocurrió fuera de cámara', () => {
  const { feed } = coord()
  feed(0,0);feed(0,100,false);assert.equal(feed(0,500).repCount,0)
})

test('el límite de 900 ms conserva la fase y 901 ms la descarta', () => {
  for (const [gap,expected] of [[900,1],[901,0]]) {
    const { feed }=coord()
    feed(0,0);feed(1,100);feed(1,600);feed(1,700,false)
    assert.equal(feed(0,600+gap).repCount,expected)
  }
})

test('isometría: pausa inmediatamente, conserva segundos y no cobra tiempo sin detección', () => {
  const a=new IsometricAnalyzer({...config,validMin:1,validMax:1})
  const feed=(value,t,visible=true)=>a.processFrame(point(value,visible),0,0,0,t)
  feed(1,0);feed(1,100);const before=feed(1,200).holdSeconds
  for(const t of [300,500]) {
    const state=feed(1,t,false)
    assert.equal(state.holdSeconds,before);assert.equal(state.isTimerRunning,false)
  }
  assert.equal(feed(1,600).holdSeconds,before)
  assert.ok(Math.abs(feed(1,700).holdSeconds-(before+0.1))<1e-9)
  const expired=feed(1,1800,false)
  assert.equal(expired.postureState,'IDLE');assert.equal(expired.isTimerRunning,false)
  assert.equal(feed(1,1900).holdSeconds,expired.holdSeconds)
})

test('coordenada inválida sin pérdida de visibility también pausa el cronómetro', () => {
  const a=new IsometricAnalyzer({...config,validMin:1,validMax:1})
  a.processFrame(point(1),0,0,0,0);a.processFrame(point(1),0,0,0,100)
  const invalid=a.processFrame(point(NaN),0,0,0,200)
  assert.equal(invalid.isTimerRunning,false);assert.equal(invalid.trackingLost,true)
  assert.equal(a.processFrame(point(1),0,0,0,400).holdSeconds,invalid.holdSeconds)
})

test('secuencia: conserva pasos, pero no acredita permanencia durante el hueco', () => {
  const a=new SequenceAnalyzer({...config,sequence:[0,1,0],minPhaseMs:90,phase:p=>p[0].x})
  const feed=(phase,time,visible=true)=>a.processFrame(point(phase,visible),time)
  feed(0,0);feed(0,100);feed(1,200)
  assert.equal(a.step,1)
  feed(1,210,false);feed(1,500)
  assert.equal(a.step,1,'La fase debe permanecer visible antes de aceptarla')
  feed(1,600);assert.equal(a.step,2)
  feed(0,700);assert.equal(feed(0,800).repCount,1)
  feed(1,900);feed(1,1000);feed(1,2001,false)
  assert.equal(a.step,0)
})

test('alternancia: conserva el extremo en pérdida breve, no acredita tiempo ciego y descarta en pérdida larga', () => {
  const a=new AlternatingAnalyzer(config)
  const feed=(value,time,visible=true)=>a.processFrame(point(value,visible),0,time)
  feed(1,0);feed(1,100);feed(1,200,false)
  assert.equal(feed(-1,800).repCount,0)
  assert.equal(feed(-1,1200).repCount,1)
  feed(1,1300,false);feed(1,2201,false)
  assert.equal(a.lastExtreme,null)
  assert.equal(feed(1,2300).repCount,1)
})

function anglePose(angle,indices) {
  const points=Array.from({length:33},()=>({x:0.2,y:0.5,visibility:1}))
  for(const side of [0,1]) {
    const radians=(180-angle)*Math.PI/180
    points[indices[0]+side]={x:0.1,y:0.5,visibility:1}
    points[indices[1]+side]={x:0.2,y:0.5,visibility:1}
    points[indices[2]+side]={x:0.2+0.1*Math.cos(radians),y:0.5+0.1*Math.sin(radians),visibility:1}
  }
  return points
}
for(const [id,initial,extreme,indices] of [
  ['bench_press',175,70,[11,13,15]],['punch_cross',85,175,[11,13,15]],
  ['squat',175,75,[23,25,27]],['curl_biceps',175,20,[11,13,15]],['lateral_raise',5,85,[23,11,13]],
]) {
  test(`${id}: conserva una repetición real ya iniciada ante un punto perdido brevemente`, () => {
    const a=createAnalyzerForExercise(id)
    let t=0,state
    const feed=(angle,frames=18)=>{for(let i=0;i<frames;i++)state=a.processFrame(anglePose(angle,indices),t+=33);return state}
    feed(initial);feed(extreme)
    const lost=anglePose(extreme,indices)
    // Remove one critical point on each side, so the other arm/leg cannot
    // substitute for the occluded joint.
    lost[indices[1]].visibility=0.1;lost[indices[1]+1].visibility=0.1
    const missing=a.processFrame(lost,t+=100)
    assert.equal(missing.trackingLost,true);assert.equal(missing.isRepetition,false)
    feed(extreme,6);assert.equal(feed(initial).repCount,1)
    a.reset();assert.equal(feed(initial).repCount,0)
  })
}

test('adaptador específico: el hueco no satisface la duración mínima del pico del curl', () => {
  const a=createAnalyzerForExercise('curl_biceps',{minPeakFrames:1})
  let t=0,state
  for(let i=0;i<12;i++)a.processFrame(anglePose(175,[11,13,15]),t+=33)
  for(let i=0;i<20;i++) {
    state=a.processFrame(anglePose(20,[11,13,15]),t+=33)
    if(state.state==='FLEXED')break
  }
  assert.equal(state.state,'FLEXED')
  a.processFrame([],t+=100)
  state=a.processFrame(anglePose(175,[11,13,15]),t+=400)
  assert.equal(state.repCount,0)
})

test('adaptador específico: confianza inferior al mínimo del ejercicio activa la pausa', () => {
  const a=createAnalyzerForExercise('curl_biceps')
  let t=0
  for(const angle of [175,20])for(let i=0;i<18;i++)a.processFrame(anglePose(angle,[11,13,15]),t+=33)
  const weak=anglePose(20,[11,13,15]).map(p=>({...p,visibility:0.52}))
  const lost=a.processFrame(weak,t+=100)
  assert.equal(lost.trackingLost,true)
  assert.equal(lost.repCount,0)
  let state
  for(let i=0;i<18;i++)state=a.processFrame(anglePose(175,[11,13,15]),t+=33)
  assert.equal(state.repCount,1)
})

for(const [id,initial,extreme,indices] of [
  ['squat',175,75,[23,25,27]],['curl_biceps',175,20,[11,13,15]],['lateral_raise',5,85,[23,11,13]],
]) {
  test(`${id}: al recuperar después de 900 ms descarta el ciclo pendiente`, () => {
    const a=createAnalyzerForExercise(id)
    let t=0,state
    const feed=(angle,frames=18)=>{for(let i=0;i<frames;i++)state=a.processFrame(anglePose(angle,indices),t+=33);return state}
    feed(initial);feed(extreme)
    a.processFrame([],t+=100)
    t+=901
    assert.equal(feed(initial).repCount,0)
    feed(extreme);assert.equal(feed(initial).repCount,1)
  })
}

// Every registered exercise must preserve totals and emit no repetitions
// during missing frames, including the bilateral wrappers and legacy adapters.
for(const exercise of EXERCISE_REGISTRY) {
  test(`seguridad de seguimiento: ${exercise.id}`, () => {
    const a=createAnalyzerForExercise(exercise.id)
    const points=Array.from({length:33},(_,i)=>({x:0.1+(i%5)*0.08,y:0.1+(i%7)*0.1,visibility:1}))
    let before
    for(let t=0;t<=1000;t+=100)before=a.processFrame(points,t)
    const missing=a.processFrame([],1100)
    assert.equal(missing.trackingLost,true);assert.equal(missing.isRepetition,false)
    assert.equal(missing.repCount,before.repCount)
    if('holdSeconds' in before) {
      assert.equal(missing.holdSeconds,before.holdSeconds)
      assert.equal(missing.isTimerRunning,false)
    }
    const resumed=a.processFrame(points,1200)
    if('holdSeconds' in before)assert.equal(resumed.holdSeconds,before.holdSeconds)
    const expired=a.processFrame([],2201)
    assert.equal(expired.postureState,'IDLE');assert.equal(expired.isRepetition,false)
    assert.equal(expired.repCount,resumed.repCount)
    if('holdSeconds' in resumed)assert.equal(expired.holdSeconds,resumed.holdSeconds)
    a.reset()
    assert.equal(a.processFrame([],2300).repCount,0)
  })
}
