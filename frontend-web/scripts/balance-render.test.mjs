import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { calculatePeriodBalance } from '../src/lib/balanceData.js'

const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
  const {default:Summary}=await server.ssrLoadModule('/src/components/BalanceSummary.jsx')
  const missing=calculatePeriodBalance({},'2020-01-01','2020-01-02','UTC')
  const html=renderToStaticMarkup(React.createElement(Summary,{balance:missing}))
  for(const text of ['0 de 2','0%','No disponible','2 días excluidos','no cuentan como cero','Por qué se excluyen días','varios motivos'])assert.ok(html.includes(text),text)
  const complete={...missing,covered:2,days:2,complete:true,excluded:0,coveragePercent:100,excludedReasons:[],accumulated:0,intake:4000,expenditure:4000}
  const zero=renderToStaticMarkup(React.createElement(Summary,{balance:complete}))
  assert.ok(zero.includes('100%'));assert.ok(zero.includes('0 kcal'));assert.ok(!zero.includes('No disponible'));assert.ok(!zero.includes('días excluidos'))
  const partial=renderToStaticMarkup(React.createElement(Summary,{balance:{...missing,covered:1,excluded:1,coveragePercent:50,accumulated:-400,intake:1600,expenditure:2000}}))
  assert.ok(partial.includes('50%'));assert.ok(partial.includes('-400 kcal'));assert.ok(partial.includes('únicamente de los días evaluables'))
  console.log('OK: resumen de cobertura nula, parcial y completa; cero real, exclusiones y motivos.')
}finally{await server.close()}
