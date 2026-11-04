import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { makeProjection,shiftDay,PROJECTION_CONFIG } from '../src/lib/projectionData.js'
let logged=true,bad=false,calls=[],failure=null
let paused=false
globalThis.__projectionTest={auth:{getUser:async()=>({data:{user:logged?{id:'owner'}:null}})},rpc:async(name,args)=>{calls.push({name,args});return {data:bad?{}:name==='save_progress_projection'?'id':{asOf:new Date(Date.now()-86400000).toISOString().slice(0,10),windows:Array.from({length:3},()=>({weights:[],meals:[],sessions:[],annotations:[],statuses:[],estimates:[]})),history:[]},error:failure}}}
let source=await readFile(new URL('../src/services/projectionService.js',import.meta.url),'utf8')
globalThis.__projectionTest.from = table => {
  assert.equal(table, 'progress_profiles')
  return { select: () => ({ eq: (key, value) => {
    assert.equal(key, 'user_id'); assert.equal(value, 'owner')
    return { maybeSingle: async () => ({ data: { estimates_paused: paused }, error: null }) }
  } }) }
}
source=source.replace("import { supabase } from '../lib/supabase.js'",'const supabase=globalThis.__projectionTest')
for(const module of ['balanceData','projectionData'])source=source.replace(`'../lib/${module}.js'`,JSON.stringify(new URL(`../src/lib/${module}.js`,import.meta.url).href))
const service=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const data=await service.getProjection('UTC');assert.equal(data.canSave,false);assert.equal(data.summary.count,0)
paused=true
const beforePause=calls.length
await assert.rejects(service.getProjection('UTC'), /Suspendiste/)
assert.equal(calls.length,beforePause,'La pausa no consulta datos para emitir una proyección')
paused=false
assert.deepEqual(calls[0],{name:'get_projection_data',args:{p_timezone:'UTC'}})
await assert.rejects(service.saveProjection({ready:false},'op'),/Completa/)
const asOf=new Date(Date.now()-86400000).toISOString().slice(0,10)
const weights=Array.from({length:28},(_,i)=>({id:String(i),weight_kg:80,measured_at:`${shiftDay(asOf,i-27)}T12:00Z`}))
const snapshot=makeProjection({asOf,timezone:'UTC',weights,balance:{rows:weights.map(w=>({day:w.measured_at.slice(0,10),eligible:true,balance:-400}))},previous:{id:'prior',as_of:shiftDay(asOf,-7),timezone:'UTC',snapshot:{version:PROJECTION_CONFIG.version,slope:0,correction:0}}})
await assert.rejects(service.saveProjection({...snapshot,projected:1},'op'),/no coincide/)
await assert.rejects(service.saveProjection(snapshot),/identificador/)
assert.equal(await service.saveProjection(snapshot,'same-operation'),'id')
await service.saveProjection(snapshot,'same-operation')
assert.deepEqual(calls.at(-1),{name:'save_progress_projection',args:{p_snapshot:snapshot,p_operation:'same-operation',p_previous:'prior'}})
assert.deepEqual(calls.at(-1),calls.at(-2),'Reintento conserva operación e instantánea')
await service.restartProjectionPeriod()
assert.equal(calls.at(-1).name,'restart_progress_projection')
const originalRpc=globalThis.__projectionTest.rpc
globalThis.__projectionTest.rpc=async(name,args)=>{
  const response=await originalRpc(name,args)
  if(name==='get_projection_data')response.data={...response.data,restartOn:'2099-01-01',history:[{id:'old-period',as_of:'2020-01-01',timezone:'UTC',snapshot:{version:PROJECTION_CONFIG.version},created_at:'2020-01-02'}]}
  return response
}
const newPeriod=await service.getProjection('UTC')
assert.equal(newPeriod.history.length,1,'El reinicio conserva el historial')
assert.equal(newPeriod.canSave,false)
assert.ok(newPeriod.snapshot.issues.some(issue=>issue.includes('nuevo periodo')))
globalThis.__projectionTest.rpc=originalRpc
bad=true;await assert.rejects(service.getProjection('UTC'),/incompleta/);bad=false
failure={message:'historial cambió'};await assert.rejects(service.saveProjection(snapshot,'op'),e=>e.message==='historial cambió');failure=null
logged=false;const before=calls.length;await assert.rejects(service.getProjection('UTC'),/Inicia sesión/);await assert.rejects(service.saveProjection(snapshot,'op'),/Inicia sesión/);assert.equal(calls.length,before)
await assert.rejects(service.restartProjectionPeriod(),/Inicia sesión/)
console.log('OK: lectura coherente sin propietario arbitrario, autenticación, respuesta incompleta, RPC de escritura, errores y operación estable.')
