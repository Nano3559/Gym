import { localDay } from './progressData.js'
import { periodDays } from './balanceData.js'
import { dayRange } from './trackingData.js'
export const TREND_CONFIG=Object.freeze({version:'daily-median-7d-v1',window:7,minDays:3,comparisonDays:28,energyThreshold:100,weightThreshold:0.2})
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2}
// Each local day has equal influence, even when several measurements were entered.
export function compareWeightTrend(weights,balance,start,end,timezone,now=Date.now()){
  if(!Number.isFinite(now))throw new Error('No se pudo verificar la fecha de comparación.')
  const days=periodDays(start,end),groups=new Map(),observed=[]
  const seen=new Map(),conflicts=new Set(),candidates=[]
  let discarded=0,duplicates=0
  for(const weight of weights){
    if(!weight||typeof weight!=='object'){discarded++;continue}
    const time=Date.parse(weight.measured_at),kg=Number(weight.weight_kg)
    if(!Number.isFinite(time)||time>now||!['number','string'].includes(typeof weight.weight_kg)||String(weight.weight_kg).trim()===''||!Number.isFinite(kg)||kg<20||kg>500){discarded++;continue}
    const day=localDay(time,timezone)
    if(day<start||day>end)continue
    if(weight.id!=null){
      const signature=JSON.stringify([time,kg])
      if(seen.has(weight.id)){
        if(seen.get(weight.id)!==signature)conflicts.add(weight.id)
        else duplicates++
        continue
      }
      seen.set(weight.id,signature)
    }
    candidates.push({id:weight.id,time,day,kg})
  }
  for(const point of candidates){
    if(conflicts.has(point.id))continue
    observed.push(point)
    groups.set(point.day,[...(groups.get(point.day)||[]),point.kg])
  }
  observed.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)))
  const daily=days.filter(day=>groups.has(day)).map(day=>({day,kg:median(groups.get(day))}))
  const trend=daily.map(point=>{
    const index=days.indexOf(point.day),window=days.slice(Math.max(0,index-TREND_CONFIG.window+1),index+1)
    const samples=daily.filter(p=>window.includes(p.day))
    return {...point,kg:samples.length>=TREND_CONFIG.minDays?median(samples.map(p=>p.kg)):null,count:samples.length}
  })
  const issues=[],blocks=[],warnings=[]
  if(discarded)warnings.push(`${discarded} registros descartados por fecha futura, fecha inválida o peso fuera del rango de 20 a 500 kg. Revisa el historial; no se modificaron los originales.`)
  if(duplicates)warnings.push(`${duplicates} copias repetidas del mismo pesaje no se contaron como mediciones nuevas.`)
  if(conflicts.size)issues.push('Hay versiones contradictorias de un pesaje. Actualiza el historial antes de interpretar la comparación.')
  if(days.length<TREND_CONFIG.comparisonDays)issues.push('Selecciona al menos 28 días para comparar dos intervalos consecutivos de 14 días.')
  else{
    const selected=days.slice(-TREND_CONFIG.comparisonDays)
    for(let i=0;i<2;i++){
      const block=selected.slice(i*14,i*14+14),first=daily.filter(p=>block.slice(0,7).includes(p.day)),last=daily.filter(p=>block.slice(7).includes(p.day))
      const rows=(balance?.rows||[]).filter(row=>block.includes(row.day)),unique=new Map(),badDays=new Set()
      for(const row of rows){
        if(unique.has(row.day)){
          const previous=unique.get(row.day)
          if(previous.eligible!==row.eligible||previous.balance!==row.balance)badDays.add(row.day)
        }else unique.set(row.day,row)
      }
      const covered=[...unique.values()].filter(row=>!badDays.has(row.day)&&row.eligible===true&&typeof row.balance==='number'&&Number.isFinite(row.balance))
      let closed=false,validCalendar=true
      try{
        for(const day of block)dayRange(day,timezone)
        closed=Date.parse(dayRange(block[13],timezone)[1])<=now
      }catch{
        validCalendar=false
        issues.push(`El intervalo ${block[0]} a ${block[13]} incluye un día inexistente en esta zona; no puede compararse como 14 días completos.`)
      }
      const usable=closed&&!conflicts.size&&first.length>=TREND_CONFIG.minDays&&last.length>=TREND_CONFIG.minDays&&covered.length===14
      const change=first.length>=TREND_CONFIG.minDays&&last.length>=TREND_CONFIG.minDays?median(last.map(p=>p.kg))-median(first.map(p=>p.kg)):null
      const mean=covered.length===14?covered.reduce((sum,row)=>sum+row.balance,0)/14:null
      const discrepancy=usable?(mean<=-TREND_CONFIG.energyThreshold&&change>=-TREND_CONFIG.weightThreshold?'deficit':mean>=TREND_CONFIG.energyThreshold&&change<=TREND_CONFIG.weightThreshold?'surplus':null):null
      blocks.push({start:block[0],end:block[13],covered:covered.length,firstCount:first.length,lastCount:last.length,change,mean,usable,discrepancy})
      if(badDays.size)issues.push(`En ${block[0]} a ${block[13]} hay días energéticos con versiones contradictorias. Actualiza el diario.`)
      if(!closed&&validCalendar)issues.push(`El intervalo ${block[0]} a ${block[13]} todavía no terminó.`)
      if(first.length<TREND_CONFIG.minDays||last.length<TREND_CONFIG.minDays)issues.push(`En ${block[0]} a ${block[13]} faltan pesajes: se requieren 3 días distintos en cada mitad de 7 días (hay ${first.length} y ${last.length}).`)
      if(covered.length<14)issues.push(`En ${block[0]} a ${block[13]} hay ${covered.length} de 14 días energéticos evaluables.`)
    }
  }
  const sufficient=blocks.length===2&&blocks.every(b=>b.usable)
  const persistent=sufficient&&blocks[0].discrepancy&&blocks[0].discrepancy===blocks[1].discrepancy?blocks[0].discrepancy:null
  return {version:TREND_CONFIG.version,validationVersion:'trend-inputs-v2',start,end,observed,daily,trend,blocks,sufficient,persistent,issues,warnings,discarded,duplicates,
    message:!sufficient?'Datos insuficientes':persistent==='deficit'?'Discrepancia persistente: déficit registrado con tendencia estable o creciente.':persistent==='surplus'?'Discrepancia persistente: superávit registrado con tendencia estable o descendente.':'No se detecta una discrepancia persistente con este criterio.'}
}
