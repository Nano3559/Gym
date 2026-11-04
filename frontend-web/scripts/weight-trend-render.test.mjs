import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { compareWeightTrend } from '../src/lib/weightTrendData.js'
import { periodDays } from '../src/lib/balanceData.js'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
 const {default:Panel}=await server.ssrLoadModule('/src/components/WeightTrendPanel.jsx')
 const days=periodDays('2020-01-01','2020-01-28'),balance={rows:days.map(day=>({day,eligible:true,balance:-400}))}
 for(const weights of [[],days.map((day,i)=>({id:i,measured_at:`${day}T12:00Z`,weight_kg:80}))]){
  const comparison=compareWeightTrend(weights,balance,days[0],days.at(-1),'UTC')
  const html=renderToString(React.createElement(Panel,{comparison})).replace(/<!--[\s\S]*?-->/g,'')
  assert.ok(html.includes(weights.length?'Discrepancia persistente':'Datos insuficientes'))
  assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'))
  if(weights.length){assert.ok(html.includes('<svg'));assert.ok(html.includes('<table'));assert.ok(html.includes('kcal/día'));assert.ok(html.includes('kg'))}
  if(weights.length){assert.ok(html.includes('Mediana del día'));assert.ok(html.includes('scope="col"'));assert.ok(html.includes('28 días con pesajes válidos'))}
 }
 const comparison=compareWeightTrend([{id:'single',measured_at:'2020-01-15T12:00Z',weight_kg:80}],balance,days[0],days.at(-1),'UTC')
 const single=renderToString(React.createElement(Panel,{comparison}))
 assert.ok(single.includes('2020-01-01'));assert.ok(single.includes('2020-01-28'))
 const point=Number(single.match(/<circle[^>]+cx="([^"]+)"/)[1])
 assert.ok(point>250&&point<350,'Un pesaje intermedio no se dibuja como inicio del periodo')
 assert.ok(single.includes('Sin datos suficientes'))
 assert.ok(!single.includes('Sin datos suficientes kg'))
 const invalid=compareWeightTrend([{id:'invalid',measured_at:'bad',weight_kg:80}],balance,days[0],days.at(-1),'UTC')
 const warning=renderToString(React.createElement(Panel,{comparison:invalid}))
 assert.ok(warning.includes('registros descartados'));assert.ok(!warning.includes('<svg'))
 console.log('OK: renderizado de tendencia con datos y sin ellos; tabla accesible y unidades separadas.')
}finally{await server.close()}
