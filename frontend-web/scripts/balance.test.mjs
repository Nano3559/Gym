import assert from 'node:assert/strict'
import { calculatePeriodBalance,periodDays } from '../src/lib/balanceData.js'
import { estimateEnergy,ENERGY_VERSION } from '../src/lib/energyData.js'
const profile={height_cm:180,formula_sex:'male',updated_at:'2020-01-01T00:00Z'}
const weight={id:'w',weight_kg:80,measured_at:'2020-01-01T08:00Z',updated_at:'2020-01-01T08:00Z',created_at:'2020-01-01T08:00Z'}
const base={profile,birthDate:'1990-01-02',weights:[weight],meals:[],sessions:[],annotations:[],statuses:[],estimates:[],read_at:'2020-01-05T00:00Z'}
function fixture(day,intake=2000){
  const snapshot=estimateEnergy({day,timezone:'UTC',profile,birthDate:base.birthDate,weight,sessions:[],annotations:[],factor:1.4,activityComplete:true})
  return {...base,meals:[{id:'meal',consumed_at:`${day}T12:00Z`,confirmation:'confirmed',es_comida:true,calorias:intake}],
    statuses:[{local_date:day,timezone:'UTC',meals_complete:true,activity_complete:true}],
    estimates:[{id:'e',local_date:day,timezone:'UTC',created_at:`${day}T20:00Z`,method_version:ENERGY_VERSION,snapshot}]}
}
let data=fixture('2020-01-02'),result=calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC')
assert.equal(result.accumulated,-492);assert.equal(result.covered,1);assert.equal(result.rows[0].label,'Déficit');assert.equal(result.rows[0].recalculated,false)
data=fixture('2020-01-02',3000);assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,508)
data=fixture('2020-01-02',2492);assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').rows[0].label,'Equilibrio')
data=fixture('2020-01-02');data.estimates[0].snapshot.total=12345
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,-492,'Ignora el total antiguo y recomputa')
data.meals[0].calorias=2100
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,-392,'Una corrección de comida reemplaza la ingesta')
data=fixture('2020-01-02');data.weights=[{...weight,weight_kg:79,updated_at:'2020-01-03T00:00Z'}]
result=calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC');assert.equal(result.rows[0].recalculated,true);assert.equal(result.accumulated,-478,'Corrección histórica de peso recalcula gasto')
data=fixture('2020-01-02');data.sessions=[{id:'new',routine_title:'Sin clasificar',session_status:'manual',active_sec:600,occurred_at:'2020-01-02T12:00Z',started_at:'2020-01-02T12:00Z',completed_at:'2020-01-02T12:10Z'}]
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,null)
for(const patch of [{statuses:[]},{estimates:[]},{profile:{...profile,updated_at:'2020-01-05'}},{estimates:[{...fixture('2020-01-02').estimates[0],method_version:'future'}]}])assert.equal(calculatePeriodBalance({...fixture('2020-01-02'),...patch},'2020-01-02','2020-01-02','UTC').covered,0)
data=fixture('2020-01-02');data.meals.push({id:'legacy',consumed_at:'2020-01-02T14:00Z',confirmation:'legacy',calorias:400})
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').covered,0)
data=fixture('2020-01-02');data.meals=[]
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').rows[0].intake,0,'Cero explícito con día confirmado completo es distinto de faltar datos')
data=fixture('2020-01-02');result=calculatePeriodBalance(data,'2020-01-02','2020-01-04','UTC')
assert.equal(result.covered,1);assert.equal(result.days,3);assert.equal(result.accumulated,-492);assert.equal(result.complete,false);assert.equal(result.rows[1].balance,null)
assert.equal(result.excluded,2);assert.equal(result.coveragePercent,33)
assert.equal(result.excludedReasons.find(item=>item.reason==='Alimentación incompleta.').days,2)
for(const value of [null,'',true,NaN,Infinity,-1,100000,'unknown']){
  data=fixture('2020-01-02');data.meals[0].calorias=value
  const invalid=calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC')
  assert.equal(invalid.accumulated,null,`No suma calorías inválidas: ${value}`)
  assert.equal(invalid.rows[0].intake,null)
  assert.ok(invalid.excludedReasons.some(item=>item.reason.includes('inválidos')))
}
data=fixture('2020-01-02');data.meals.push({...data.meals[0]})
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,-492,'Una copia del mismo ID no duplica ingesta')
data.meals[1].calorias=3000
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').covered,0,'Versiones contradictorias no se resuelven por orden')
data=fixture('2020-01-02');data.meals.push({...data.meals[0],id:'another'})
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,1508,'Dos consumos reales iguales sí se suman')
data=fixture('2020-01-02');data.meals[0].confirmation='pending'
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').covered,0)
data=fixture('2020-01-02');data.meals[0].confirmation='void';data.meals[0].calorias=-1
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').accumulated,-2492,'Un registro anulado no se suma')
data=fixture('2020-01-02');data.statuses[0].meals_complete='false'
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').covered,0,'Exige confirmación booleana real')
data=fixture('2020-01-02');data.meals=Array.from({length:1501},(_,index)=>({...data.meals[0],id:`meal-${index}`,calorias:1}))
assert.equal(calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC').rows[0].intake,1501)
const original=JSON.stringify(data)
calculatePeriodBalance(data,'2020-01-02','2020-01-02','UTC')
assert.equal(JSON.stringify(data),original,'Recalcular no altera registros ni instantáneas guardadas')
const zero=calculatePeriodBalance(fixture('2020-01-02',2492),'2020-01-02','2020-01-02','UTC')
assert.equal(zero.accumulated,0);assert.equal(zero.coveragePercent,100)
assert.deepEqual(zero.excludedReasons,[])
for(const [day,hours] of [['2020-03-08',23],['2020-11-01',25]]){
  const timezone='America/New_York'
  data=fixture(day)
  data.weights=[{...weight,measured_at:`${day}T08:00Z`,created_at:`${day}T08:00Z`}]
  data.statuses[0].timezone=timezone
  data.estimates[0].timezone=timezone
  data.estimates[0].snapshot=estimateEnergy({day,timezone,profile,birthDate:base.birthDate,weight:data.weights[0],factor:1.4,activityComplete:true})
  const dst=calculatePeriodBalance(data,day,day,timezone)
  assert.equal(dst.covered,1)
  assert.equal(dst.expenditure,Math.round(2492*hours/24),'Respeta duración real del día local')
}
const future=calculatePeriodBalance(fixture('2020-01-03'),'2020-01-03','2020-01-03','UTC',Date.parse('2020-01-02T18:00Z'))
assert.equal(future.covered,0)
assert.ok(future.rows[0].issues.some(issue=>issue.startsWith('Día futuro')))
const skipped=calculatePeriodBalance({},'2011-12-30','2011-12-30','Pacific/Apia')
assert.equal(skipped.excluded,1);assert.equal(skipped.accumulated,null)
assert.ok(skipped.excludedReasons.some(item=>item.reason.includes('no existió')))
result=calculatePeriodBalance(fixture('2020-01-02'),'2020-01-02','2020-01-02','UTC',Date.parse('2020-01-02T18:00Z'))
assert.equal(result.accumulated,null,'No compara consumo parcial contra gasto del día entero')
assert.equal(periodDays('2020-01-01','2020-01-31').length,31)
for(const dates of [['2020-01-01','2020-02-01'],['2020-02-30','2020-03-01'],['2020-01-02','2020-01-01']])assert.throws(()=>periodDays(...dates))
console.log('OK: déficit/superávit, cobertura, días incompletos, correcciones, gastos antiguos, pesos, actividades desconocidas y periodos de 31 días.')
