import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: MealEntry } = await server.ssrLoadModule('/src/components/MealEntry.jsx')
  for (const source of ['manual', 'scan']) {
    const html = renderToStaticMarkup(React.createElement(MealEntry, {
      timezone: 'America/La_Paz', source,
      analysis: { alimento: 'Pan', calorias: 100, proteinas_g: 2, carbohidratos_g: 20, grasas_g: 1 },
    }))
    for (const label of ['Porción de referencia', 'Porciones consumidas', 'Calorías (kcal)', 'Confirmar consumo y guardar', 'Solo se suma al diario al confirmar']) assert.ok(html.includes(label), label)
    assert.ok(!html.includes('Comida guardada en tu diario.'), 'Una estimación presentada no está guardada')
  }
  const html = renderToStaticMarkup(React.createElement(MealEntry, { timezone: 'UTC', row: {
    id: 'meal', alimento: 'Pan', portion: 'Una rebanada', portions: 2,
    calorias: 200, nutrition_per_portion: { calorias: 100, proteinas_g: 2, carbohidratos_g: 20, grasas_g: 1 },
    consumed_at: '2020-01-01T12:00:00Z', timezone: 'UTC',
  } }))
  assert.ok(html.includes('Guardar corrección'))
  assert.match(html, /value="100"/, 'Al corregir muestra kcal por porción, no el total multiplicado')
  console.log('OK: confirmación explícita manual/escáner, unidades y edición de nutrientes por porción.')
} finally { await server.close() }
