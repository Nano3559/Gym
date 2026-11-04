import { useState } from 'react'
import { assessDailyActivity } from '../lib/dailyActivityData.js'
const control='min-h-12 w-full rounded-xl border border-line bg-card px-3'
export default function DailyActivityQuestionnaire({onApply,disabled=false}){
  const [answers,setAnswers]=useState({posture:'',walking:''})
  let result=null
  try{result=assessDailyActivity(answers)}catch{/* Todavía falta responder. */}
  return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-line p-4">
    <legend className="px-2 font-bold">¿Cómo es tu actividad diaria normal?</legend>
    <p className="text-sm text-muted">Piensa en trabajo, estudio, tareas y desplazamientos. No incluyas gimnasio, deportes ni entrenamientos: se registran por separado.</p>
    <label className="block">¿Cómo pasas la mayor parte de tu jornada?<select className={`${control} mt-2`} value={answers.posture} onChange={e=>setAnswers({...answers,posture:e.target.value})}><option value="">Selecciona una respuesta</option><option value="seated">Principalmente sentado/a</option><option value="mixed">Alterno estar sentado/a, de pie y moverme</option><option value="physical">Realizo trabajo físico exigente con frecuencia</option></select></label>
    <label className="block">¿Cuánto caminas o te desplazas a pie fuera del ejercicio?<select className={`${control} mt-2`} value={answers.walking} onChange={e=>setAnswers({...answers,walking:e.target.value})}><option value="">Selecciona una respuesta</option><option value="under30">Menos de 30 minutos al día</option><option value="30to90">Entre 30 y 90 minutos al día</option><option value="over90">Más de 90 minutos al día</option></select></label>
    {result&&<p role="status">Clasificación orientativa: <strong>{result.label}</strong>. Revisa si describe tu día antes de usarla.</p>}
    <button type="button" disabled={!result||disabled} className="min-h-12 rounded-xl border border-accent px-4 font-semibold disabled:opacity-50" onClick={()=>onApply(result)}>Usar esta actividad cotidiana</button>
    <p className="text-xs text-muted">Es una regla inicial del programa basada en tus respuestas, no una medición ni un cuestionario clínicamente validado. Si tu jornada cambia, revisa la actividad de ese día.</p>
  </fieldset>
}
