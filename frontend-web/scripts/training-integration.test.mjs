import assert from 'node:assert/strict'
import { EXERCISE_REGISTRY,createAnalyzerForExercise } from '../src/lib/exerciseRegistry.js'
import { createBenchPressAnalyzer } from '../src/lib/benchPressAnalyzer.js'
import { createPlankAnalyzer } from '../src/lib/plankAnalyzer.js'
import { createPecDeckAnalyzer } from '../src/lib/pecDeckAnalyzer.js'
import { createWuInchwormAnalyzer } from '../src/lib/wuInchwormAnalyzer.js'
import { routineReducer,initialState } from '../src/lib/routineState.js'
import { normalizeRoutineExercises } from '../src/lib/routineData.js'
const points=()=>Array.from({length:33},()=>({x:0.5,y:0.5,visibility:1}))
const pose=points()
Object.assign(pose[11],{x:0.2,y:0.3});Object.assign(pose[23],{x:0.5,y:0.3});Object.assign(pose[27],{x:0.8,y:0.3})
for(const ex of EXERCISE_REGISTRY){
  const a=createAnalyzerForExercise(ex.id)
  for(const frame of [[], points(), pose, points().map(p=>({...p,visibility:0})),[]]) {
    const s=a.processFrame(frame,1000)
    for(const key of ['isRepetition','repCount','feedback','angle','postureState']) assert.ok(key in s,ex.id+': '+key)
    assert.ok(Number.isFinite(s.angle),ex.id+': finite angle')
    if(!frame.length || frame[0].visibility===0) { assert.equal(s.trackingLost,true,ex.id);assert.equal(s.isRepetition,false,ex.id) }
    if(ex.tipo==='tiempo') for(const key of ['holdSeconds','targetSeconds','isTimerRunning']) assert.ok(key in s,ex.id+': '+key)
  }
  a.reset();assert.equal(a.processFrame([],2000).repCount,0,ex.id)
}
console.log('ok: 131 analyzers expose the contract, handle missing/invisible poses and reset')
const a=createBenchPressAnalyzer({smootherWindow:1})
function elbow(angle){const p=points(); p[11]={x:0.2,y:0.5,visibility:1};p[13]={x:0.5,y:0.5,visibility:1};p[15]={x:0.5+0.3*Math.cos((180-angle)*Math.PI/180),y:0.5+0.3*Math.sin((180-angle)*Math.PI/180),visibility:1};return p}
a.processFrame(elbow(180),0);a.processFrame(elbow(110),100);a.processFrame(elbow(70),300)
assert.equal(a.processFrame(elbow(180),700).repCount,1)
assert.equal(a.processFrame(elbow(180),800).isRepetition,false)
a.reset();a.processFrame(elbow(180),0);a.processFrame(elbow(110),10);a.processFrame(elbow(70),20);assert.equal(a.processFrame(elbow(180),30).repCount,0)
a.reset();a.processFrame(elbow(180),0);a.processFrame(elbow(70),200);a.processFrame(elbow(70),300);a.processFrame(elbow(70),600);a.processFrame([],700);assert.equal(a.processFrame(elbow(180),900).repCount,1)
a.reset();a.processFrame(elbow(180),0);a.processFrame(elbow(70),200);a.processFrame(elbow(70),300);a.processFrame([],400);assert.equal(a.processFrame(elbow(180),1400).repCount,0)
console.log('ok: complete angle cycle, single-frame repetition flag, speed guard and tracking loss')
const hold=createPlankAnalyzer();hold.processFrame(pose,0);assert.ok(hold.processFrame(pose,100).holdSeconds>0)
const before=hold.processFrame(pose,200).holdSeconds;hold.processFrame([],300);assert.equal(hold.processFrame(pose,1500).holdSeconds,before)
const standing=points();standing[11]={x:0.5,y:0.2,visibility:1};standing[23]={x:0.5,y:0.5,visibility:1};standing[27]={x:0.5,y:0.8,visibility:1};assert.equal(hold.processFrame(standing,1600).isTimerRunning,false)
console.log('ok: plank timer pauses on loss and rejects a standing straight body')
const pec=createPecDeckAnalyzer({smootherWindow:1});function wrists(width){const p=structuredClone(standing);p[15].x=0.5-width/2;p[16].x=0.5+width/2;return p}
pec.processFrame(wrists(0.6),0);pec.processFrame(wrists(0.1),200);assert.equal(pec.processFrame(wrists(0.6),800).repCount,1)
console.log('ok: coordinate cycle uses body-normalized wrist distance')
const worm=createWuInchwormAnalyzer();standing[25]={x:0.5,y:0.65,visibility:1};pose[25]={x:0.65,y:0.3,visibility:1}
for(const [p,t] of [[standing,0],[standing,100],[pose,200],[pose,300],[standing,700],[standing,800]])worm.processFrame(p,t)
assert.equal(worm.snapshot().repCount,1)
console.log('ok: inchworm requires standing, plank, standing')
let s=routineReducer(initialState,{type:'START_ROUTINE',routine:[{exerciseId:'squat',sets:2,targetReps:5,restDuration:10},{exerciseId:'plank',sets:1,targetDuration:20,restDuration:0}]})
const send=type=>s=routineReducer(s,{type});send('PAUSE');send('TICK_PREPARING');assert.equal(s.preparingCountdown,3);send('RESUME');for(let i=0;i<3;i++)send('TICK_PREPARING');assert.equal(s.status,'EXERCISING')
s=routineReducer(s,{type:'EXERCISE_COMPLETE',reps:5});assert.equal(s.status,'RESTING');send('EXTEND_REST');assert.equal(s.restCountdown,20);send('PAUSE');send('TICK_RESTING');assert.equal(s.restCountdown,20);send('RESUME');send('SKIP_REST');assert.equal(s.currentSet,2)
for(let i=0;i<3;i++)send('TICK_PREPARING');s=routineReducer(s,{type:'EXERCISE_COMPLETE',reps:5});send('SKIP_REST');assert.equal(s.currentIndex,1);for(let i=0;i<3;i++)send('TICK_PREPARING');s=routineReducer(s,{type:'EXERCISE_COMPLETE',durationSec:20});assert.equal(s.status,'COMPLETED');assert.equal(s.completedExercises.length,3);assert.equal(s.completedExercises[2].durationSec,20);send('EXERCISE_COMPLETE');assert.equal(s.completedExercises.length,3)
assert.deepEqual(normalizeRoutineExercises({routine_exercises:[{exercise_id:'plank',sets:2,target_duration_sec:45,rest_duration_sec:0}]}),[{exerciseId:'plank',sets:2,targetReps:0,targetDuration:45,restDuration:0}])
console.log('ok: routine lifecycle, pause, extend/skip rest, per-set history, duplicate completion and database mapping')
const balance=createAnalyzerForExercise('bal_single_leg')
const bp=points();Object.assign(bp[11],{x:0.4,y:0.2});Object.assign(bp[12],{x:0.6,y:0.2});Object.assign(bp[23],{x:0.45,y:0.5});Object.assign(bp[24],{x:0.55,y:0.5});Object.assign(bp[27],{x:0.45,y:0.7});Object.assign(bp[28],{x:0.55,y:0.9});
balance.processFrame(bp,0);let bs=balance.processFrame(bp,100);assert.ok(bs.holdSecondsLeft>0);assert.equal(bs.holdSecondsRight,0);assert.equal(bs.holdSeconds,0)
bp[27].y=0.9;bp[28].y=0.7;balance.processFrame(bp,200);bs=balance.processFrame(bp,300);assert.ok(bs.holdSecondsRight>0)
console.log('ok: unilateral balance requires each leg independently')
