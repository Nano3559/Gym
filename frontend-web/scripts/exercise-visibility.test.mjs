import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { EXERCISE_REGISTRY, createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'

const before=JSON.parse(readFileSync(new URL('./fixtures/visibility-before.json',import.meta.url),'utf8'))
const byId=new Map(EXERCISE_REGISTRY.map(e=>[e.id,e]))
let seed=61234
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
const poses=Array.from({length:500},()=>Array.from({length:33},()=>({x:0.1+random()*0.7,y:0.1+random()*0.7,visibility:1})))
const requirements=(a,p)=>a.config.requiredSideIndices?a.requiredLandmarks(p):a.config.requiredIndices

test('se revisan exactamente los 62 ejercicios originales; no se eliminan requisitos bilaterales necesarios',()=>{
  assert.equal(before.length,62)
  assert.equal(new Set(before.map(r=>r.id)).size,62)
  const unchanged=[]
  for(const row of before) {
    const a=byId.get(row.id).analyzerFactory({side:'left'})
    const count=requirements(a,poses[0]).length
    assert.ok(count<=row.previousRequired.length,row.id)
    if(count===row.previousRequired.length)unchanged.push(row.id)
  }
  assert.deepEqual(unchanged.sort(),['seal_jack','st_butterfly'])
})

for(const row of before) {
  const exercise=byId.get(row.id)
  test(`${row.id}: todos los puntos declarados participan en la fórmula y no falta ningún punto leído`,()=>{
    for(const side of ['left','right']) {
      const a=exercise.analyzerFactory({side})
      const declared=new Set(requirements(a,poses[0]))
      const used=new Set()
      for(const points of poses) {
        const proxy=new Proxy(points,{get(target,key){
          if(typeof key==='string'&&/^\d+$/.test(key))used.add(Number(key))
          return Reflect.get(target,key)
        }})
        // Observe actual measurement/validation reads independently of the
        // visibility checker. Branches are exercised with seeded poses.
        if(a.config.validate)a.config.validate(proxy,a)
        if(a.config.metric)a.config.metric(proxy,a)
        else if(a.config.phase)a.config.phase(proxy,a)
        else {
          const match=a.processFrame.toString().match(/super\.processFrame\(landmarks,\s*(\d+),\s*(\d+),\s*(\d+),/)
          assert.ok(match,exercise.id)
          const indices=match.slice(1).map(Number).map(i=>side==='right'?i+1:i)
          a.computeAngle(proxy,...indices)
        }
      }
      assert.deepEqual([...declared].sort((a,b)=>a-b),[...used].sort((a,b)=>a-b),`${row.id} ${side}`)
    }
  })

  test(`${row.id}: ocultar puntos ajenos no cambia la medición ni el resultado`,()=>{
    for(const side of ['left','right']) {
      const full=exercise.analyzerFactory({side})
      const minimal=exercise.analyzerFactory({side})
      const required=new Set(requirements(minimal,poses[0]))
      for(let frame=0;frame<60;frame++) {
        const points=poses[frame]
        const sparse=points.map((p,i)=>required.has(i)?p:null)
        assert.deepEqual(minimal.processFrame(sparse,frame*100),full.processFrame(points,frame*100),`${row.id} ${side} frame ${frame}`)
      }
    }
  })

  test(`${row.id}: cada punto imprescindible sigue bloqueando una medición incompleta`,()=>{
    for(const side of ['left','right']) {
      const a=exercise.analyzerFactory({side})
      const indices=requirements(a,poses[0])
      for(const index of indices) {
        const instance=exercise.analyzerFactory({side})
        const missing=poses[0].map((p,i)=>i===index?null:p)
        const state=instance.processFrame(missing,0)
        assert.equal(state.trackingLost,true,`${row.id} ${side} missing ${index}`)
        assert.equal(state.repCount,0)
        assert.equal(state.isRepetition,false)
        if('isTimerRunning' in state)assert.equal(state.isTimerRunning,false)
      }
    }
  })
}

test('flexiones con rodillas: cuenta sin nariz, tobillos ni lado contrario visibles',()=>{
  const a=createAnalyzerForExercise('pushup_knees')
  let t=0,state
  for(const angle of [175,65,175])for(let i=0;i<18;i++) {
    const p=Array(33).fill(null),r=(180-angle)*Math.PI/180
    p[11]={x:0.1,y:0.5,visibility:1};p[13]={x:0.2,y:0.5,visibility:1}
    p[15]={x:0.2+0.1*Math.cos(r),y:0.5+0.1*Math.sin(r),visibility:1}
    p[23]={x:0.4,y:0.5,visibility:1};p[25]={x:0.5,y:0.5,visibility:1}
    state=a.processFrame(p,t+=33)
  }
  assert.equal(state.repCount,1)
})

test('dominada: cuenta con hombro, codo y muñeca del mismo lado',()=>{
  const a=createAnalyzerForExercise('pullup')
  let t=0,state
  for(const angle of [175,40,175])for(let i=0;i<18;i++) {
    const p=Array(33).fill(null),r=angle*Math.PI/180
    p[11]={x:0.25,y:0.6,visibility:1};p[13]={x:0.25,y:0.4,visibility:1}
    p[15]={x:0.25+0.2*Math.sin(r),y:0.4+0.2*Math.cos(r),visibility:1}
    state=a.processFrame(p,t+=33)
  }
  assert.equal(state.repCount,1)
})

for(const offset of [0,1]) {
  test(`plancha: acumula tiempo viendo solo ${offset?'el lado derecho':'el lado izquierdo'}`,()=>{
    const a=createAnalyzerForExercise('plank'),p=Array(33).fill(null)
    p[11+offset]={x:0.1,y:0.4,visibility:1};p[23+offset]={x:0.3,y:0.4,visibility:1};p[27+offset]={x:0.5,y:0.4,visibility:1}
    let state
    for(let t=0;t<=1200;t+=100)state=a.processFrame(p,t)
    assert.ok(state.holdSeconds>=1)
    assert.equal(state.isTimerRunning,true)
  })
}

test('estiramiento unilateral de tríceps: un brazo visible no acredita segundos al contrario',()=>{
  const a=createAnalyzerForExercise('st_triceps'),p=Array(33).fill(null)
  p[11]={x:0.3,y:0.5,visibility:1};p[13]={x:0.3,y:0.2,visibility:1};p[15]={x:0.35,y:0.4,visibility:1}
  let state
  for(let t=0;t<=1200;t+=100)state=a.processFrame(p,t)
  assert.ok(state.holdSecondsLeft>=1)
  assert.equal(state.holdSecondsRight,0)
  assert.equal(state.holdSeconds,0,'El objetivo combinado sigue requiriendo ambos lados')
})

test('el lado se mantiene durante el movimiento y se cambia solo después de perderlo prolongadamente',()=>{
  const a=byId.get('plank').analyzerFactory()
  const p=Array(33).fill(null)
  for(const [index,x] of [[11,0.1],[23,0.3],[27,0.5]])p[index]={x,y:0.4,visibility:1}
  a.processFrame(p,0);a.processFrame(p,100)
  assert.equal(a.activeSide,'left')
  const right=p.map((v,i)=>i%2===1&&v?null:v)
  for(const [index,x] of [[12,0.1],[24,0.3],[28,0.5]])right[index]={x,y:0.4,visibility:1}
  assert.equal(a.processFrame(right,200).trackingLost,true)
  assert.equal(a.activeSide,'left')
  a.processFrame(right,1101)
  const resumed=a.processFrame(right,1200)
  assert.equal(a.activeSide,'right')
  assert.equal(resumed.isTimerRunning,true)
})
