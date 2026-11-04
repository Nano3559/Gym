import { dayRange } from '../lib/trackingData.js'

export default function WeightTrendPanel({comparison,timezone='UTC'}){
  const {observed,trend,daily,blocks,message,issues,warnings=[]}=comparison
  const values=[...observed.map(p=>p.kg),...trend.filter(p=>p.kg!=null).map(p=>p.kg)]
  const min=values.length?values.reduce((a,b)=>Math.min(a,b),Infinity)-0.3:0,max=values.length?values.reduce((a,b)=>Math.max(a,b),-Infinity)+0.3:1
  let from=observed[0]?.time??0,to=observed.at(-1)?.time??from+1
  try { from=Date.parse(dayRange(comparison.start,timezone)[0]);to=Date.parse(dayRange(comparison.end,timezone)[1]) } catch { /* Un día local inexistente no tiene frontera representable. */ }
  const x=time=>50+(time-from)/Math.max(1,to-from)*500,y=kg=>160-(kg-min)/(max-min)*130
  return <section className="space-y-3 rounded-xl border border-line p-3">
    <h5 className="text-lg font-bold">Peso observado y tendencia</h5>
    <p className="text-sm text-muted">Puntos claros: pesajes reales (kg). Puntos naranja: mediana móvil de 7 días, con al menos 3 días de pesaje. Cada día cuenta una vez; los días sin pesajes no se rellenan.</p>
    <p className="text-sm text-muted">Periodo: {comparison.start} a {comparison.end} · {daily.length} días con pesajes válidos · {trend.filter(p=>p.kg!=null).length} días con tendencia calculable.</p>
    {warnings.length>0&&<ul className="list-disc pl-5 text-sm text-amber-300">{warnings.map(warning=><li key={warning}>{warning}</li>)}</ul>}
    {observed.length>0?<>
      <svg viewBox="0 0 600 205" className="w-full" role="img" aria-label="Pesajes reales y tendencia en kilogramos; detalle accesible en la tabla siguiente">
        <text x="0" y="25" fill="currentColor" fontSize="12">{max.toFixed(1)} kg</text><text x="0" y="165" fill="currentColor" fontSize="12">{min.toFixed(1)} kg</text>
        {observed.map((p,i)=><circle key={`${p.id}-${i}`} cx={x(p.time)} cy={y(p.kg)} r="3" fill="#cbd5e1"><title>{`${p.day}: ${p.kg} kg observado`}</title></circle>)}
        {trend.filter(p=>p.kg!=null).map(p=>{const point=observed.filter(o=>o.day===p.day).at(-1);return <circle key={p.day} cx={x(point.time)} cy={y(p.kg)} r="4" fill="#ff5500"><title>{`${p.day}: ${p.kg.toFixed(2)} kg tendencia`}</title></circle>})}
        <text x="50" y="195" fill="currentColor" fontSize="12">{comparison.start}</text><text x="550" y="195" textAnchor="end" fill="currentColor" fontSize="12">{comparison.end}</text>
      </svg>
      <details><summary className="min-h-12 cursor-pointer py-3">Ver pesajes individuales y tendencia</summary><div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><caption>Pesajes del periodo en {timezone}; medianas y tendencia en kg, independientes del balance en kcal</caption><thead><tr><th scope="col">Fecha y hora</th><th scope="col">Peso observado</th><th scope="col">Mediana del día</th><th scope="col">Tendencia de 7 días</th></tr></thead><tbody>{observed.map((p,i)=>{const smoothed=trend.find(t=>t.day===p.day);return <tr key={`${p.id}-${i}`}><td>{new Date(p.time).toLocaleString('es',{timeZone:timezone})}</td><td>{p.kg} kg</td><td>{daily.find(d=>d.day===p.day)?.kg.toFixed(2)} kg</td><td>{smoothed?.kg==null?'Sin datos suficientes':`${smoothed.kg.toFixed(2)} kg (${smoothed.count} días)`}</td></tr>})}</tbody></table></div></details>
    </>:<p>No hay pesajes en este periodo.</p>}
    <p role="status" className="font-semibold">{message}</p>
    {issues.length>0&&<ul className="list-disc pl-5 text-sm text-muted">{issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
    {blocks.map(block=><p key={block.start} className="text-sm">{block.start} a {block.end}: {block.covered}/14 días energéticos completos · balance medio {block.mean==null?'no disponible':`${Math.round(block.mean)} kcal/día`} · cambio entre medianas semanales {block.change==null?'no disponible':`${block.change>0?'+':''}${block.change.toFixed(2)} kg`}{!block.usable?' · Comparación insuficiente':''}.</p>)}
    <p className="text-xs text-muted">La comparación usa los últimos 28 días del periodo: dos intervalos de 14 días completos y al menos 3 días de pesaje por semana. Señala discrepancia solo si persiste en ambos: balance medio de al menos 100 kcal/día y peso sin cambio en la dirección esperada más allá de 0,2 kg. Son criterios de producto sin validación clínica.</p>
    <p className="text-sm text-muted">El agua corporal y otras fluctuaciones pueden influir. Una discrepancia no identifica su causa ni demuestra un error de registro. No se ajusta el gasto ni se proyecta una meta a partir de esta comparación.</p>
  </section>
}
