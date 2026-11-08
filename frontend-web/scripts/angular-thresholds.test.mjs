import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { EXERCISE_REGISTRY, createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'
import { AngleRepAnalyzer } from '../src/lib/AngleRepAnalyzer.js'

const review=JSON.parse(readFileSync(new URL('./fixtures/angular-thresholds-before.json',import.meta.url),'utf8'))
const byId=new Map(EXERCISE_REGISTRY.map(e=>[e.id,e]))
const changed=r=>r.before.upThreshold!==r.after.upThreshold||r.before.downThreshold!==r.after.downThreshold
const bounded=angle=>Math.max(0,Math.min(180,angle))
const initial=c=>bounded(c.upThreshold+(c.direction==='decrease'?5:-5))
const extreme=c=>bounded(c.downThreshold+(c.direction==='decrease'?-5:5))
const pointsFor=angle=>{
  const radians=(180-angle)*Math.PI/180
  return [{x:0.2,y:0.5,visibility:1},{x:0.3,y:0.5,visibility:1},
    {x:0.3+0.1*Math.cos(radians),y:0.5+0.1*Math.sin(radians),visibility:1}]
}
function scalarRig(config) {
  // Isolate angular thresholds/state machine from posture validators. Real
  // exercise paths and their guards are checked separately below and in CI.
  const a=new AngleRepAnalyzer({...config,validate:undefined,requiredIndices:[],requiredSideIndices:undefined})
  let t=0
  const feed=(angle,frames=20,interval=33)=>{
    let state
    for(let i=0;i<frames;i++)state=a.processFrame(pointsFor(angle),0,1,2,t+=interval)
    return state
  }
  return {a,feed}
}

test('auditoría: 55 analizadores, 40 ajustes limitados y 15 conservados',()=>{
  assert.equal(review.length,55)
  assert.equal(new Set(review.map(r=>r.id)).size,55)
  assert.equal(review.filter(changed).length,40)
  assert.equal(review.filter(r=>!changed(r)).length,15)
  assert.equal(EXERCISE_REGISTRY.filter(e=>e.analyzerFactory() instanceof AngleRepAnalyzer).length,55)
})

for(const row of review) {
  const cfg=()=>byId.get(row.id).analyzerFactory().config
  test(`${row.id}: rangos separados y solo cambian los límites revisados`,()=>{
    const actual=Object.fromEntries(Object.entries(cfg()).map(([key,value])=>[key,typeof value==='function'?value.toString():value]))
    assert.deepEqual(actual,{...row.before,...row.after})
    const span=Math.abs(actual.upThreshold-actual.downThreshold)
    assert.ok(span>=35)
    if(actual.direction==='increase')assert.ok(actual.upThreshold<actual.downThreshold)
    else assert.ok(actual.upThreshold>actual.downThreshold)
    assert.ok(actual.upThreshold>=0&&actual.upThreshold<=180)
    assert.ok(actual.downThreshold>=0&&actual.downThreshold<=180)
  })

  test(`${row.id}: conserva tres ciclos que ya cumplían los límites anteriores`,()=>{
    const {feed}=scalarRig(cfg())
    feed(initial(row.before))
    for(let rep=1;rep<=3;rep++) {
      feed(extreme(row.before))
      assert.equal(feed(initial(row.before)).repCount,rep)
    }
    assert.equal(feed(initial(row.before),60).repCount,3)
  })

  test(`${row.id}: sigue rechazando un recorrido parcial, rebotes y movimientos demasiado rápidos`,()=>{
    const config=cfg(),start=initial(config),end=extreme(config)
    let r=scalarRig(config)
    r.feed(start);r.feed(start+(end-start)*0.6)
    assert.equal(r.feed(start).repCount,0)
    r=scalarRig(config)
    for(const delta of [0,1,-1,2,-2,0])assert.equal(r.feed(bounded(config.upThreshold+delta)).repCount,0)
    r=scalarRig(config)
    r.feed(start,6,1);r.feed(end,6,1);assert.equal(r.feed(start,6,1).repCount,0)
  })

  test(`${row.id}: comenzar a mitad del recorrido no arma un ciclo falso`,()=>{
    const config=cfg(),{feed}=scalarRig(config)
    feed((config.upThreshold+config.downThreshold)/2)
    feed(extreme(config))
    assert.equal(feed(initial(config)).repCount,0)
  })

  if(changed(row))test(`${row.id}: acepta el margen nuevo que antes bloqueaba la repetición`,()=>{
    const newConfig=cfg()
    const start=row.before.upThreshold===row.after.upThreshold?initial(newConfig):(row.before.upThreshold+row.after.upThreshold)/2
    const end=row.before.downThreshold===row.after.downThreshold?extreme(newConfig):(row.before.downThreshold+row.after.downThreshold)/2
    const old=scalarRig(row.before),updated=scalarRig(newConfig)
    for(const angle of [start,end,start]) {old.feed(angle);updated.feed(angle)}
    assert.equal(old.a.repCount,0,'Reproducción del bloqueo anterior')
    assert.equal(updated.a.repCount,1,'El margen moderado permite terminar el ciclo')
  })
}

// Real registry/analyzer path: no overrides of measurements, validators,
// visibility, smoothing or tracking grace.
for(const [id,start,end,indices] of [
  ['leg_raise',170,85,[11,23,27]],
  ['deadlift',170,90,[11,23,25]],
  ['squat_goblet',167,85,[23,25,27]],
  ['bench_press',162,75,[11,13,15]],
  ['triceps_pushdown',40,162,[11,13,15]],
  ['curl_hammer',165,40,[11,13,15]],
  ['front_raise',20,95,[23,11,13]],
]) {
  test(`ciclo real del analizador ${id} con margen de detección`,()=>{
    const a=createAnalyzerForExercise(id)
    let t=0,state
    for(let rep=1;rep<=2;rep++) {
      for(const angle of [start,end,start])for(let frame=0;frame<20;frame++) {
        const template=pointsFor(angle)
        const points=Array.from({length:33},()=>({x:0.5,y:0.6,visibility:1}))
        for(const side of [0,1])indices.forEach((index,i)=>{points[index+side]={...template[i]}})
        state=a.processFrame(points,t+=33)
      }
      assert.equal(state.repCount,rep)
    }
  })
}
