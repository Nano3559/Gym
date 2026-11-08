import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'
import { angleAt } from '../src/lib/geometry.js'
import { toAnalysisLandmarks } from '../src/lib/poseCoordinates.js'

// Upper arms open symmetrically away from the shoulder axis. Wrists can
// independently flex the elbows, so the test does not confuse these motions.
function pose({ left = 0, right = left, elbow = 180 } = {}) {
  const p=Array.from({length:33},()=>({x:0.25,y:0.8,visibility:1}))
  for (const [side,opening,sign,x] of [[0,left,-1,0.18],[1,right,1,0.35]]) {
    const radians=opening*Math.PI/180
    const arm={x:sign*0.09*Math.sin(radians),y:-0.09*Math.cos(radians)}
    p[11+side]={x,y:0.5,visibility:1}
    p[13+side]={x:x+arm.x,y:0.5+arm.y,visibility:1}
    const flex=(180-elbow)*Math.PI/180
    p[15+side]={x:p[13+side].x+arm.x*Math.cos(flex)-arm.y*Math.sin(flex),
      y:p[13+side].y+arm.x*Math.sin(flex)+arm.y*Math.cos(flex),visibility:1}
  }
  return p
}
function rig(width=640,height=480,transform=p=>p) {
  const analyzer=createAnalyzerForExercise('dumbbell_fly')
  let time=0
  const frame=(points,interval=33)=>{
    const normalized=transform(points).map(p=>({...p,x:p.x*height/width}))
    return analyzer.processFrame(toAnalysisLandmarks(normalized,width,height),time+=interval)
  }
  const feed=(options={},frames=18,interval=33)=>{
    let state
    for(let i=0;i<frames;i++)state=frame(pose(options),interval)
    return state
  }
  return {analyzer,frame,feed}
}

test('aperturas: cuenta brazos juntos → abiertos → juntos sin flexionar los codos',()=>{
  const {feed}=rig()
  for(const opening of [0,80]) {
    const p=pose({left:opening})
    assert.ok(Math.abs(angleAt(p[11],p[13],p[15])-180)<1e-5)
  }
  assert.equal(feed().repCount,0)
  const opened=feed({left:80})
  assert.equal(opened.repCount,0)
  assert.ok(Math.abs(opened.angle-160)<1e-5)
  assert.equal(feed().repCount,1)
})

test('flexionar solo los codos no cuenta una apertura',()=>{
  const {feed}=rig()
  for(const elbow of [180,90,40,90,180,40,180])assert.equal(feed({elbow}).repCount,0)
})

test('apertura parcial no suma',()=>{
  const {feed}=rig();feed();feed({left:45});assert.equal(feed().repCount,0)
})

test('un solo brazo no completa el ejercicio, incluso si el ángulo entre brazos supera el umbral',()=>{
  for(const [left,right] of [[90,0],[0,90],[150,0],[0,150]]) {
    const {feed}=rig();feed();feed({left,right});assert.equal(feed().repCount,0)
  }
})

test('brazos paralelos hacia el mismo lado no equivalen a brazos juntos sobre el pecho',()=>{
  const {feed}=rig();feed({left:90,right:-90});feed({left:80});assert.equal(feed().repCount,0)
})

test('no cuenta al mantener los brazos abiertos ni duplica al mantenerlos juntos',()=>{
  const {feed}=rig();feed();assert.equal(feed({left:80},60).repCount,0)
  assert.equal(feed().repCount,1);assert.equal(feed({},60).repCount,1)
})

test('empezar abierto exige volver primero a la posición inicial',()=>{
  const {feed}=rig();feed({left:80});assert.equal(feed().repCount,0)
  feed({left:80});assert.equal(feed().repCount,1)
})

test('rechaza ciclos demasiado rápidos',()=>{
  const {feed}=rig();feed({},4,1);feed({left:80},4,1);assert.equal(feed({},4,1).repCount,0)
})

test('una pérdida breve de un codo conserva el ciclo sin sumar durante el hueco',()=>{
  const {feed,frame}=rig();feed();feed({left:80})
  const missing=pose({left:80});missing[14].visibility=0.1
  const state=frame(missing,100)
  assert.equal(state.trackingLost,true);assert.equal(state.isRepetition,false);assert.equal(state.repCount,0)
  assert.equal(feed().repCount,1)
})

test('una pérdida larga descarta el ciclo pendiente y conserva los totales',()=>{
  const {feed,frame}=rig();feed();feed({left:80});assert.equal(feed().repCount,1)
  feed({left:80})
  const missing=pose({left:80});missing[13].visibility=0
  assert.equal(frame(missing,1000).postureState,'IDLE')
  assert.equal(feed().repCount,1)
  feed({left:80});assert.equal(feed().repCount,2)
})

test('no depende de muñecas o piernas para medir la apertura de los brazos',()=>{
  const {frame}=rig();let state
  for(const left of [0,80,0])for(let i=0;i<18;i++) {
    const p=pose({left});for(const idx of [15,16,23,24,25,26,27,28])p[idx].visibility=0
    state=frame(p)
  }
  assert.equal(state.repCount,1)
})

test('hombros o brazos degenerados no producen medidas inválidas ni repeticiones',()=>{
  for(const kind of ['shoulders','arm']) {
    const {frame}=rig();const p=pose()
    if(kind==='shoulders')p[12]={...p[11]};else p[13]={...p[11]}
    const state=frame(p)
    assert.equal(state.trackingLost,true);assert.equal(state.repCount,0)
    assert.ok(Number.isFinite(state.angle))
  }
})

for(const [width,height] of [[640,480],[1280,720],[1920,1080],[480,640],[720,1280],[640,640]]) {
  test(`tres ciclos completos y reinicio en ${width}×${height}`,()=>{
    const {analyzer,feed}=rig(width,height)
    feed()
    for(let count=1;count<=3;count++) {feed({left:80});assert.equal(feed().repCount,count)}
    analyzer.reset();assert.equal(feed().repCount,0)
  })
}

test('el conteo se conserva con imagen reflejada, rotación del encuadre y cambios de escala',()=>{
  for(const transform of [
    p=>p.map(v=>({...v,x:0.55-v.x})),
    p=>p.map(v=>({...v,x:0.6-v.y,y:v.x+0.1})),
    p=>p.map(v=>({...v,x:v.x*0.7+0.05,y:v.y*0.7+0.1})),
  ]) {
    const {feed}=rig(640,480,transform);feed();feed({left:80});assert.equal(feed().repCount,1)
  }
})
