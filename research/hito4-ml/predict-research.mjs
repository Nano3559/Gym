// Research only. This module is deliberately outside frontend-web and is never bundled.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
export function predictResearch(model,rows){
  if(model.deployable!==false||model.horizon_months!==3||model.version!=='dietfits-three-months-research-v1')throw new Error('Modelo de investigación incompatible.')
  const fields=['weight_start_kg','intake_start_kcal_day','expenditure_start_kcal_day']
  if(JSON.stringify(model.features)!==JSON.stringify(fields)||!Number.isFinite(model.intercept))throw new Error('Entradas no compatibles.')
  for(const name of ['imputation','mean','scale','coefficients'])if(!Array.isArray(model[name])||model[name].length!==3||!model[name].every(Number.isFinite))throw new Error('Transformación inválida.')
  if(model.scale.some(value=>value<=0))throw new Error('Escala inválida.')
  return rows.map(row=>{
    if(!Array.isArray(row)||row.length!==3||!Number.isFinite(row[0]))throw new Error('Falta el peso inicial o hay una entrada inválida.')
    const result=row.reduce((sum,value,index)=>{
      if(value!==null&&!Number.isFinite(value))throw new Error('Entrada no finita.')
      const present=value===null?model.imputation[index]:value
      return sum+(present-model.mean[index])/model.scale[index]*model.coefficients[index]
    },model.intercept)
    if(!Number.isFinite(result))throw new Error('Resultado no finito.')
    return result
  })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [modelPath,rowsPath]=process.argv.slice(2)
  const model=JSON.parse(await readFile(modelPath,'utf8')),rows=JSON.parse(await readFile(rowsPath,'utf8'))
  process.stdout.write(JSON.stringify(predictResearch(model,rows)))
}
