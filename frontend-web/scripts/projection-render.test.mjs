import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { makeProjection,shiftDay,summarizeEvaluation } from '../src/lib/projectionData.js'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
  const {ProjectionDetails}=await server.ssrLoadModule('/src/components/ProjectionPanel.jsx')
  const asOf='2020-02-28',weights=Array.from({length:28},(_,i)=>({id:i,measured_at:`${shiftDay(asOf,i-27)}T12:00Z`,weight_kg:80-i*0.04})),balance={rows:weights.map(w=>({day:w.measured_at.slice(0,10),eligible:true,balance:-400}))}
  const summary=summarizeEvaluation([])
  for(const ws of [weights,[]]){
    const snapshot=makeProjection({weights:ws,balance,asOf,timezone:'UTC',now:Date.parse('2020-02-29T12:00Z')})
    const data={snapshot,summary,history:[],evaluation:[],backtest:{summary},canSave:snapshot.ready}
    const html=renderToString(React.createElement(ProjectionDetails,{data}))
    assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'))
    assert.ok(html.includes(ws.length?'Emitir y guardar':'Datos insuficientes'))
    assert.ok(html.includes('referencia de peso constante'))
    if(ws.length){assert.ok(html.includes('kcal/día'));assert.ok(html.includes('kg'));assert.ok(html.includes('intervalo de confianza'));assert.ok(html.includes('Comparación de anclajes'));assert.ok(html.includes('mediana de la última semana'))}
  }
  console.log('OK: renderizado de proyección y ausencia de datos; referencias, unidades y escenarios visibles.')
}finally{await server.close()}
