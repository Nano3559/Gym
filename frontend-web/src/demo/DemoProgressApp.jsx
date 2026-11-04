import { useMemo, useState } from 'react'
import BalanceSummary from '../components/BalanceSummary.jsx'
import WeightTrendPanel from '../components/WeightTrendPanel.jsx'
import { validateWeight } from '../lib/progressData.js'
import { createDemoProgress, demoView, changeDemoWeight, changeDemoMeal, setDemoComplete } from './progressDemoData.js'

const control='min-h-12 rounded-xl border border-line bg-card px-3 text-white disabled:opacity-50'
const card='space-y-3 rounded-2xl border border-line bg-card p-5'
const kg=value=>Number.isFinite(value)?`${value.toFixed(2)} kg`:'No disponible'

export default function DemoProgressApp(){
  const [data,setData]=useState(()=>createDemoProgress())
  const [weight,setWeight]=useState(''),[meal,setMeal]=useState(''),[goal,setGoal]=useState(''),[error,setError]=useState('')
  const view=useMemo(()=>demoView(data),[data])
  const status=data.statuses.at(-1),last=data.weights.at(-1),projection=view.projection
  function run(task){try{setData(task(data));setError('')}catch(e){setError(e.message)}}
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-white">
    <header className="space-y-3"><p className="font-bold text-accent">IRONFORGE · DEMOSTRACIÓN DEL HITO 4</p><h1 className="text-3xl font-bold">Perfil de prueba de Lucía</h1><p className="rounded-xl border border-amber-500/50 p-4 text-amber-200">Datos ficticios para presentación. Sin inicio de sesión ni conexión a Supabase. Los cambios se guardan solo en memoria y se pierden al recargar. No es una cuenta real ni una validación del modelo.</p><div className="flex flex-wrap gap-3"><a className={`${control} inline-flex items-center`} href="/">Volver a la aplicación</a><button className={control} onClick={()=>{setData(createDemoProgress());setWeight('');setMeal('');setGoal('');setError('')}}>Restablecer datos de prueba</button></div></header>
    {error&&<p role="alert" className="text-red-300">{error}</p>}
    <section className={card}><h2 className="text-xl font-bold">Mi progreso</h2><p>Lucía Demo · nacimiento 01/01/1995 · estatura 165 cm · parámetro femenino para la fórmula · zona {data.timezone}.</p><p>84 días ficticios de pesajes, alimentación y actividad. Último día cerrado: {data.asOf}. Estos valores ilustran el programa; no constituyen un plan de alimentación o ejercicio.</p><div className="grid gap-3 sm:grid-cols-3"><p>Peso inicial: <strong>{kg(data.weights[0].weight_kg)}</strong></p><p>Último peso: <strong>{kg(last.weight_kg)}</strong></p><p>Meta: <strong>{kg(data.goal.target_weight_kg)}</strong></p></div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();run(d=>changeDemoWeight(d,weight))}}><label>Corregir último pesaje (kg)<input className={`${control} block w-full`} type="number" required min="20" max="500" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></label><button className={control}>Aplicar pesaje de prueba</button></form>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();run(d=>({...d,goal:{target_weight_kg:validateWeight(goal)}}))}}><label>Cambiar meta (kg)<input className={`${control} block w-full`} required type="number" min="20" max="500" step="0.01" value={goal} onChange={e=>setGoal(e.target.value)}/></label><button className={control}>Aplicar meta de prueba</button></form>
    </section>
    <section className={card}><h2 className="text-xl font-bold">Mi diario del {data.asOf}</h2><ul>{data.meals.filter(m=>m.consumed_at.startsWith(data.asOf)).map(m=><li key={m.id}>{m.alimento}: {m.calorias} kcal · confirmado · origen manual ficticio</li>)}</ul><p>{data.sessions.filter(s=>s.started_at.startsWith(data.asOf)).length?'Caminata ficticia: 20 min activos, sin descanso ni pausa.':'Día ficticio sin entrenamiento, confirmado como registrado.'}</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();run(d=>changeDemoMeal(d,meal))}}><label>Calorías de la última comida (kcal)<input className={`${control} block w-full`} required type="number" min="0" max="50000" step="1" value={meal} onChange={e=>setMeal(e.target.value)}/></label><button className={control}>Corregir comida de prueba</button></form>
      <p className="text-sm text-muted">Corregir una comida vuelve a marcar el día incompleto. Confírmalo nuevamente para incluirlo en el balance.</p>
      {[['meals_complete','Toda la alimentación está registrada'],['activity_complete','Toda la actividad está registrada']].map(([field,label])=><label key={field} className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={status[field]} onChange={e=>run(d=>setDemoComplete(d,field,e.target.checked))}/>{label}</label>)}
    </section>
    <section className={card}><h2 className="text-xl font-bold">Balance de los últimos 28 días</h2><p>Ingesta confirmada − gasto estimado por Mifflin–St Jeor y MET. Usa las mismas funciones de cálculo que la aplicación.</p><BalanceSummary balance={view.balance}/><details><summary className="min-h-12 cursor-pointer py-3">Ver balance diario y gasto</summary><div className="overflow-auto"><table className="w-full text-left text-sm"><caption>Datos ficticios; todas las cifras energéticas en kcal</caption><thead><tr><th scope="col">Día</th><th scope="col">Ingesta</th><th scope="col">Gasto</th><th scope="col">Balance</th></tr></thead><tbody>{view.balance.rows.map(r=><tr key={r.day}><td>{r.day}</td><td>{r.intake??'No disponible'}</td><td>{r.expenditure??'No disponible'}</td><td>{r.balance??'No evaluable'}</td></tr>)}</tbody></table></div></details></section>
    <WeightTrendPanel comparison={view.comparison} timezone={data.timezone}/>
    <section className={card}><h2 className="text-xl font-bold">Proyección experimental a siete días</h2>{projection.ready?<><p>Referencia semanal suavizada: {kg(projection.anchor)}. Para {projection.targetDay}: <strong>{kg(projection.projected)}</strong>.</p><p>Escenarios: {kg(projection.scenarios.low)} a {kg(projection.scenarios.high)}. No son intervalos de confianza.</p><p>{projection.goalEstimate?`Acercamiento a la meta: ${projection.goalEstimate.earliest} a ${projection.goalEstimate.latest}. `:''}{projection.goalReason}</p><p className="text-sm text-muted">Método {projection.version}. Sin IA entrenada. Resultado ilustrativo generado a partir de registros ficticios.</p></>:<><p>Datos insuficientes para emitir</p><ul className="list-disc pl-5">{projection.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></>}</section>
  </main>
}
