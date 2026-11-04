export default function BalanceSummary({ balance }) {
  return <div className="space-y-3" aria-label="Resumen del balance y cobertura">
    <p className="font-bold">Cobertura: {balance.covered} de {balance.days} días evaluables ({balance.coveragePercent}%).</p>
    <p className="text-lg">{balance.complete?'Balance del periodo completo':'Suma únicamente de los días evaluables'}: <strong>{balance.accumulated==null?'No disponible':`${balance.accumulated>0?'+':''}${balance.accumulated.toLocaleString('es')} kcal`}</strong></p>
    {!balance.complete&&<p className="text-sm text-amber-300">{balance.excluded} días excluidos. La suma no representa todo el periodo: los días incompletos no cuentan como cero.</p>}
    {balance.covered>0&&<p className="text-sm text-muted">En los días evaluables: ingesta {balance.intake.toLocaleString('es')} kcal · gasto estimado {balance.expenditure.toLocaleString('es')} kcal.</p>}
    {balance.excludedReasons.length>0&&<details><summary className="min-h-12 cursor-pointer py-3">Por qué se excluyen días</summary><p className="text-xs text-muted">Un mismo día puede tener varios motivos; estos conteos no se suman como días distintos.</p><ul className="list-disc pl-5 text-sm">{balance.excludedReasons.map(item=><li key={item.reason}>{item.reason} · {item.days} {item.days===1?'día':'días'}</li>)}</ul></details>}
  </div>
}
