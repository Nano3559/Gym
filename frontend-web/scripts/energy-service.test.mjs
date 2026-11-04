import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { estimateEnergy } from '../src/lib/energyData.js'
const calls=[];let logged=true
globalThis.__energyTest={auth:{getUser:async()=>({data:{user:logged?{id:'owner'}:null}})},from(table){const call={table,methods:[]};calls.push(call);const chain=new Proxy({},{get:(_,name)=>name==='then'?(yes,no)=>{
  let data=null
  const range=call.methods.find(m=>m[0]==='range')
  if(range)data=range[1]===0?Array.from({length:500},(_,i)=>({id:i,session_id:i})):[{id:500,session_id:500}]
  else if(table==='profiles')data={fecha_nacimiento:'1990-01-01'}
  else if(table==='progress_profiles')data={height_cm:180,formula_sex:'male'}
  else if(table==='weight_logs')data={weight_kg:80,measured_at:'2020-01-01'}
  else if(table==='daily_energy_estimates')data=[]
  return Promise.resolve({data,error:null}).then(yes,no)
}:(...args)=>{call.methods.push([name,...args]);return chain}});return chain}}
let text=await readFile(new URL('../src/services/energyService.js',import.meta.url),'utf8')
text=text.replace("import { supabase } from '../lib/supabase.js'",'const supabase=globalThis.__energyTest').replace("'../lib/trackingData.js'",JSON.stringify(new URL('../src/lib/trackingData.js',import.meta.url).href))
text=text.replace("'../lib/energyData.js'",JSON.stringify(new URL('../src/lib/energyData.js',import.meta.url).href))
const service=await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const inputs=await service.getEnergyInputs('2020-01-02','UTC')
assert.equal(inputs.sessions.length,501);assert.equal(inputs.annotations.length,501)
assert.equal(inputs.birthDate,'1990-01-01')
assert.ok(calls.filter(c=>c.table==='routine_sessions').every(c=>c.methods.some(m=>m[0]==='gt'&&m[1]==='completed_at')),'Incluye sesiones iniciadas antes del día, pero no las terminadas exactamente al comenzar')
assert.ok(calls.find(c=>c.table==='weight_logs').methods.some(m=>m[0]==='lt'&&m[1]==='measured_at'&&m[2]==='2020-01-03T00:00:00.000Z'))
for(const call of calls)assert.ok(call.methods.some(m=>m[0]==='eq'&&m[1]===(call.table==='profiles'?'id':'user_id')&&m[2]==='owner'))
await service.classifyActivity('session','02054');assert.equal(calls.at(-1).methods.find(m=>m[0]==='upsert')[1].user_id,'owner')
await service.classifyActivity('session','');assert.ok(calls.at(-1).methods.some(m=>m[0]==='delete'))
await assert.rejects(service.classifyActivity('session','unknown'),/Categoría/)
await assert.rejects(service.saveEnergySnapshot({total:null},'op'),/Completa/)
const snapshot=estimateEnergy({day:'2020-01-02',timezone:'UTC',profile:{height_cm:180,formula_sex:'male',updated_at:'2020-01-01'},birthDate:'1990-01-01',weight:{weight_kg:80,measured_at:'2020-01-01'},factor:'1.4',activityComplete:true})
await assert.rejects(service.saveEnergySnapshot({...snapshot,total:1},'invalid'),/no coincide/)
await assert.rejects(service.saveEnergySnapshot(snapshot),/identificador/)
await service.saveEnergySnapshot(snapshot,'stable-op')
const insert=calls.at(-1).methods.find(m=>m[0]==='upsert');assert.equal(insert[1].operation_id,'stable-op');assert.equal(insert[2].ignoreDuplicates,true)
logged=false;const before=calls.length;await assert.rejects(service.getEnergyInputs('2020-01-02','UTC'),/Inicia sesión/);assert.equal(calls.length,before)
console.log('OK: aislamiento en consultas, paginación, peso sin datos futuros, sesiones entre días, categorías revisables e instantáneas idempotentes (doble de Supabase).')
