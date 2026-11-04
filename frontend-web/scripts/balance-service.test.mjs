import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
let calls=[],logged=true,bad=false
globalThis.__balanceTest={auth:{getUser:async()=>({data:{user:logged?{id:'owner'}:null}})},rpc:async(name,args)=>{calls.push({name,args});return {data:bad?{}:{meals:[],weights:[],sessions:[],statuses:[],estimates:[],annotations:[]},error:null}}}
let source=await readFile(new URL('../src/services/balanceService.js',import.meta.url),'utf8')
source=source.replace("import { supabase } from '../lib/supabase.js'",'const supabase=globalThis.__balanceTest').replace("'../lib/balanceData.js'",JSON.stringify(new URL('../src/lib/balanceData.js',import.meta.url).href))
source=source.replace("'../lib/weightTrendData.js'",JSON.stringify(new URL('../src/lib/weightTrendData.js',import.meta.url).href))
const service=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const result=await service.getPeriodBalance('2020-01-02','2020-01-03','UTC')
assert.equal(result.comparison.message,'Datos insuficientes');assert.equal(result.accumulated,null);assert.equal(result.covered,0)
assert.deepEqual(calls[0],{name:'get_balance_data',args:{p_start:'2020-01-02',p_end:'2020-01-03',p_timezone:'UTC'}},'El propietario lo obtiene el servidor, no se acepta un id ajeno')
bad=true;await assert.rejects(service.getPeriodBalance('2020-01-02','2020-01-03','UTC'),/no está completa/)
logged=false;const count=calls.length;await assert.rejects(service.getPeriodBalance('2020-01-02','2020-01-03','UTC'),/Inicia sesión/);assert.equal(calls.length,count)
await assert.rejects(service.getPeriodBalance('2020-01-01','2020-03-01','UTC'),/31 días/)
console.log('OK: consulta de solo lectura sin propietario arbitrario, sesión requerida, límites y respuesta íntegra (doble de Supabase).')
