import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const calls=[];let logged=true;let response
globalThis.__trackingTest={auth:{getUser:async()=>({data:{user:logged?{id:'owner-a'}:null}})},from(table){const call={table,methods:[]};calls.push(call);const chain=new Proxy({},{get:(_,name)=>name==='then'?(yes,no)=>Promise.resolve(response?.(call)??{data:[],error:null}).then(yes,no):(...args)=>{call.methods.push([name,...args]);return chain}});return chain},rpc:async(name,args)=>{calls.push({rpc:name,args});return{data:null,error:null}}}
async function load(path){let text=await readFile(new URL(path,import.meta.url),'utf8');text=text.replace("import { supabase } from '../lib/supabase.js'",'const supabase=globalThis.__trackingTest');for(const name of ['trackingData','progressData'])text=text.replace(`'../lib/${name}.js'`,JSON.stringify(new URL(`../src/lib/${name}.js`,import.meta.url).href));return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)}
const service=await load('../src/services/trackingService.js')
response=call=>({data:call.table==='daily_tracking_status'?null:call.methods.find(m=>m[0]==='range')[1]===0?Array.from({length:500},(_,i)=>({id:i})):[{id:500}],error:null})
const day=await service.getTrackingDay('2020-01-01','UTC');assert.equal(day.meals.length,501);assert.equal(day.sessions.length,501)
for(const call of calls)assert.ok(call.methods.some(m=>m[0]==='eq'&&m[1]==='user_id'&&m[2]==='owner-a'))
response=()=>({data:null,error:null})
const meal={alimento:'Pan',portion:'Una rebanada',portions:2,calorias:100,proteinas_g:2,carbohidratos_g:20,grasas_g:1,consumed_at:'2020-01-01T12:00Z',timezone:'UTC'}
await service.saveConsumedMeal(meal,{operationId:'stable'})
let insert=calls.at(-1).methods.find(m=>m[0]==='upsert');assert.equal(insert[1].calorias,200);assert.equal(insert[1].user_id,'owner-a');assert.equal(insert[1].operation_id,'stable');assert.equal(insert[2].ignoreDuplicates,true)
await assert.rejects(service.saveConsumedMeal({...meal,consumed_at:'2099-01-01'},{operationId:'x'}),/fecha/)
await assert.rejects(service.saveConsumedMeal(meal,{id:'old',updatedAt:'stale'}),/cambió/)
assert.equal('source' in calls.at(-1).methods.find(m=>m[0]==='update')[1],false,'Corregir no cambia procedencia')
await assert.rejects(service.saveConsumedMeal(meal,{operationId:'x',source:'invented'}),/Origen/)
await assert.rejects(service.voidMeal({id:'old',updated_at:'stale'}),/cambió/)
await assert.rejects(service.voidActivity({id:'old',updated_at:'stale'}),/cambió/)
await service.saveDayStatus('2020-01-01','UTC',{meals_complete:true});assert.equal(calls.at(-1).args.p_activity,null,'No sobrescribir la otra confirmación del día')
await service.saveManualActivity({title:'Caminar',minutes:30,intensity:'light',started_at:'2020-01-01T12:00Z',timezone:'UTC'},'activity-id')
insert=calls.at(-1).methods.find(m=>m[0]==='upsert');assert.equal(insert[1].active_sec,1800);assert.equal(insert[1].rest_sec,0);assert.equal(insert[1].operation_id,'activity-id')
await assert.rejects(service.saveManualActivity({title:'Caminar',minutes:0,intensity:'light',started_at:'2020-01-01T12:00Z',timezone:'UTC'},'bad'))
await assert.rejects(service.saveManualActivity({title:'Caminar',minutes:30,intensity:'light',started_at:'2020-01-01T12:00Z',timezone:'UTC'}),/identificador/)
await assert.rejects(service.saveManualActivity({title:'Caminar',minutes:30,intensity:'light',started_at:'2020-01-01T23:45Z',timezone:'UTC'},'cross-day'),/cruza de día/)
await service.saveManualActivity({title:'Caminar',minutes:15,intensity:'light',started_at:'2020-01-01T23:45Z',timezone:'UTC'},'midnight')
assert.equal(calls.at(-1).methods.find(m=>m[0]==='upsert')[1].active_sec,900,'Terminar a medianoche permite cerrar el día anterior')
await assert.rejects(service.saveManualActivity({title:'Caminar',minutes:0.001,intensity:'light',started_at:'2020-01-01T12:00Z',timezone:'UTC'},'tiny'),/segundo/)
const routine=await load('../src/services/routineService.js')
await routine.saveRoutineSession({expectedUserId:'owner-a',routineTitle:'Parcial',exercises:[],durationSec:10,tracking:{operation_id:'session-id',session_status:'partial'}})
insert=calls.at(-1).methods.find(m=>m[0]==='upsert');assert.equal(insert[1].operation_id,'session-id');assert.equal(insert[2].ignoreDuplicates,true)
await assert.rejects(routine.saveRoutineSession({expectedUserId:'other-account'}),/cuenta cambió/)
logged=false;const before=calls.length;await assert.rejects(service.getTrackingZone(),/Inicia sesión/);assert.equal(calls.length,before)
console.log('OK: diario paginado, propietario, confirmación explícita, porciones, conflictos, anulaciones, estado independiente, actividad manual y sesiones idempotentes (doble de Supabase).')
