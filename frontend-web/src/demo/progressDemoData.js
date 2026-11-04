// Synthetic presentation data only. No authentication, storage or network access.
import { localDay, validateWeight } from '../lib/progressData.js'
import { mealPayload } from '../lib/trackingData.js'
import { estimateEnergy } from '../lib/energyData.js'
import { calculatePeriodBalance } from '../lib/balanceData.js'
import { compareWeightTrend } from '../lib/weightTrendData.js'
import { makeProjection, shiftDay } from '../lib/projectionData.js'

export function createDemoProgress(now=Date.now()) {
  const timezone='America/La_Paz',asOf=shiftDay(localDay(now,timezone),-1),start=shiftDay(asOf,-83)
  const profile={user_id:'hito4-local-demo',nombre:'Lucía Demo',height_cm:165,formula_sex:'female',activity_level:'light',timezone,estimates_paused:false,updated_at:`${shiftDay(start,-1)}T00:00:00Z`}
  const weights=[],meals=[],sessions=[],annotations=[],statuses=[],estimates=[]
  const birthDate='1995-01-01'
  for(let i=0;i<84;i++){
    const day=shiftDay(start,i),weight={id:`demo-weight-${i}`,weight_kg:Math.round((82-i*.03)*100)/100,measured_at:`${day}T12:00:00Z`,created_at:`${day}T12:00:00Z`}
    weights.push(weight)
    for(const [n,kcal] of [[0,750],[1,1050]])meals.push({id:`demo-meal-${i}-${n}`,consumed_at:`${day}T${n?'22':'13'}:00:00Z`,source:'manual',
      ...mealPayload({alimento:n?'Comida ficticia':'Desayuno ficticio',portion:'Una porción de ejemplo',portions:1,calorias:kcal,proteinas_g:25,carbohidratos_g:80,grasas_g:20})})
    const dailySessions=i%2===0?[{id:`demo-session-${i}`,routine_title:'Caminata ficticia',session_status:'manual',intensity:'light',occurred_at:`${day}T18:00:00Z`,started_at:`${day}T18:00:00Z`,completed_at:`${day}T18:20:00Z`,duration_sec:1200,active_sec:1200,rest_sec:0,paused_sec:0,preparation_sec:0,exercises:[]}]:[]
    const dailyAnnotations=dailySessions.map(s=>({session_id:s.id,activity_code:'17190'}))
    sessions.push(...dailySessions);annotations.push(...dailyAnnotations)
    statuses.push({local_date:day,timezone,meals_complete:true,activity_complete:true})
    const snapshot=estimateEnergy({day,timezone,profile,birthDate,weight,sessions:dailySessions,annotations:dailyAnnotations,factor:1.4,activityComplete:true,now})
    estimates.push({id:`demo-estimate-${i}`,local_date:day,timezone,method_version:snapshot.version,snapshot,created_at:new Date(now).toISOString()})
  }
  return {now,asOf,timezone,profile,birthDate,goal:{target_weight_kg:79},weights,meals,sessions,annotations,statuses,estimates}
}

export function demoView(data){
  const start=shiftDay(data.asOf,-27)
  const balance=calculatePeriodBalance(data,start,data.asOf,data.timezone,data.now)
  return {balance,comparison:compareWeightTrend(data.weights,balance,start,data.asOf,data.timezone,data.now),
    projection:makeProjection({weights:data.weights,balance,asOf:data.asOf,timezone:data.timezone,goal:data.goal,now:data.now})}
}

export function changeDemoWeight(data,value){
  const kg=validateWeight(value),last=data.weights.at(-1)
  return {...data,weights:data.weights.map(w=>w.id===last.id?{...w,weight_kg:kg}:w)}
}

export function changeDemoMeal(data,value){
  const last=data.meals.at(-1),payload=mealPayload({...last,...last.nutrition_per_portion,calorias:value})
  return {...data,meals:data.meals.map(m=>m.id===last.id?{...m,...payload}:m),statuses:data.statuses.map(s=>s.local_date===data.asOf?{...s,meals_complete:false}:s)}
}

export function setDemoComplete(data,field,value){
  if(!['meals_complete','activity_complete'].includes(field)||typeof value!=='boolean')throw new Error('Estado del diario no válido.')
  return {...data,statuses:data.statuses.map(s=>s.local_date===data.asOf?{...s,[field]:value}:s)}
}
