import WeightTrendPanel from './WeightTrendPanel.jsx'
import BalanceSummary from './BalanceSummary.jsx'
import { useEffect, useState } from 'react'
import { localDay } from '../lib/progressData.js'
import { getPeriodBalance } from '../services/balanceService.js'
const control='min-h-12 rounded-xl border border-line bg-card px-3 disabled:opacity-50'
export default function BalancePanel({timezone,refreshToken,onSelectDay}){
  const [dates,setDates]=useState(()=>{const date=new Date(`${localDay(Date.now(),timezone)}T12:00Z`);date.setUTCDate(date.getUTCDate()-1);const end=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()-27);return{start:date.toISOString().slice(0,10),end}})
  const [range,setRange]=useState(dates),[result,setResult]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{
    let live=true
    getPeriodBalance(range.start,range.end,timezone).then(balance=>{if(live){setResult({balance,range,timezone,refreshToken,retry});setError('')}})
      .catch(failure=>{if(live)setError(failure.code==='PGRST202'?'Aplica la migración 18 para consultar el balance.':failure.message||'No se pudo consultar el balance.')})
    return()=>{live=false}
  },[range,timezone,refreshToken,retry])
  const balance=result?.range===range&&result?.timezone===timezone&&result?.refreshToken===refreshToken&&result?.retry===retry?result.balance:null
  return <section className="space-y-4 rounded-xl border border-accent/40 p-4">
    <h4 className="text-lg font-bold">Balance diario y acumulado</h4>
    <p className="text-sm text-muted">Balance = calorías ingeridas − gasto estimado. Un valor negativo indica déficit; uno positivo, superávit. Solo se suman días terminados con alimentación y actividad completas y un gasto evaluable.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();setError('');setRange({...dates})}}>
      <label>Desde<input className={`${control} block w-full`} type="date" required value={dates.start} onChange={e=>setDates({...dates,start:e.target.value})}/></label>
      <label>Hasta<input className={`${control} block w-full`} type="date" required value={dates.end} onChange={e=>setDates({...dates,end:e.target.value})}/></label>
      <button className={control}>Consultar periodo</button>
    </form>
    <p className="text-xs text-muted">Hasta 31 días por consulta · Zona {timezone}. Cambiar el diario recalcula el resultado; las cifras anteriores guardadas no se sobrescriben.</p>
    <p className="text-sm text-muted">Periodo consultado: {range.start} a {range.end}.</p>
    {error?<p role="alert" className="text-red-300">{error}<button className={control} onClick={()=>{setError('');setRetry(value=>value+1)}}>Reintentar</button></p>:!balance?<p role="status">Calculando balance con los registros actuales...</p>:<>
      <BalanceSummary balance={balance}/>
      <WeightTrendPanel comparison={balance.comparison} timezone={timezone}/>
      <ul className="max-h-[32rem] space-y-3 overflow-y-auto">{balance.rows.map(row=><li key={row.day} className="rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{row.day} · {row.label||'No evaluable'}</strong><button type="button" className={control} onClick={()=>onSelectDay?.(row.day)}>Ver día</button></div>
        <p className="text-sm">{row.intake==null?'Ingesta no disponible':`Ingesta confirmada ${row.intake} kcal`} · {row.expenditure==null?'Gasto no disponible':`Gasto de día entero ${row.expenditure} kcal`}</p>
        <p className="font-semibold">Balance: {row.balance==null?'No evaluable':`${row.balance>0?'+':''}${row.balance} kcal`}</p>
        {row.recalculated&&<p className="text-xs text-amber-300">Los datos cambiaron desde la estimación guardada. Se revisó el gasto con los registros vigentes; la estimación anterior se conserva como historial.</p>}
        {row.issues?.length>0&&<ul className="list-disc pl-5 text-xs text-muted">{[...new Set(row.issues)].map(issue=><li key={issue}>{issue}</li>)}</ul>}
      </li>)}</ul>
      {balance.readAt&&<p className="text-xs text-muted">Consulta: {new Date(balance.readAt).toLocaleString('es',{timeZone:timezone})}. Usa Actualizar diario para incorporar cambios de otra sesión.</p>}
      <p className="text-xs text-muted">Son estimaciones energéticas. No se convierten automáticamente en kilos de grasa ni en una fecha para alcanzar la meta.</p>
    </>}
  </section>
}
