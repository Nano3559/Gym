import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { RoutineProvider } = await server.ssrLoadModule('/src/context/RoutineContext.jsx')
  for (const [file,text,props] of [['TrainerRoutineBuilder','Crear rutina',{}],['ClientRoutines','Mis rutinas',{}],['NutritionalScanner','Escáner nutricional',{open:true}]]) {
    const { default: Component } = await server.ssrLoadModule('/src/components/'+file+'.jsx')
    const html=renderToString(React.createElement(RoutineProvider,null,React.createElement(Component,props)))
    assert.ok(html.includes(text),file)
  }
  const { validateNutritionData } = await server.ssrLoadModule('/src/services/nutritionService.js')
  const good={alimento:'Plato',descripcion:'Arroz',calorias:120,proteinas_g:3,carbohidratos_g:20,grasas_g:2,es_comida:true}
  assert.equal(validateNutritionData(good).calorias,120)
  for(const bad of [null,{}, {...good,calorias:-1},{...good,es_comida:'sí'},{...good,proteinas_g:Infinity}])assert.throws(()=>validateNutritionData(bad))
  console.log('ok: training panels render with their providers; nutrition accepts its schema and rejects invalid responses')
} finally { await server.close() }
