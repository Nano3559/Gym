import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
  const {default:Demo}=await server.ssrLoadModule('/src/demo/DemoProgressApp.jsx')
  const html=renderToStaticMarkup(React.createElement(Demo))
  for(const text of ['Lucía','Datos ficticios','Sin inicio de sesión','solo en memoria','Mi progreso','Mi diario','Balance de los últimos 28 días','Peso observado y tendencia','Proyección experimental','Restablecer datos de prueba'])assert.ok(html.includes(text),text)
  assert.ok(html.includes('<table'));assert.ok(html.includes('<svg'))
  assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'))
  console.log('OK: demostración con aviso explícito, perfil, diario, balance, tabla, gráfica y proyección.')
}finally{await server.close()}
