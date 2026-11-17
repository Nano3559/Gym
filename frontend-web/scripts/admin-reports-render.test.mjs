import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const server = await createServer({
  configFile: 'vite.config.js',
  server: { middlewareMode: true },
  appType: 'custom',
})
let renderer

try {
  const { default: AdminReports } = await server.ssrLoadModule('/src/components/admin/AdminReports.jsx')
  await act(async () => {
    renderer = create(React.createElement(AdminReports))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  assert.ok(
    renderer.root.findAllByType('h2')
      .some((node) => node.children.join('').includes('Reportes detallados')),
  )

  const todayFilter = renderer.root.findAllByType('button')
    .find((button) => button.children.join('') === 'Hoy (Día)')
  assert.ok(todayFilter)
  await act(async () => todayFilter.props.onClick())
  assert.match(todayFilter.props.className, /border-accent/)

  const exportButton = renderer.root.findAllByType('button')
    .find((button) => button.children.join('').includes('Exportar CSV'))
  assert.ok(exportButton, 'debe existir el botón Exportar CSV')

  const printButton = renderer.root.findAllByType('button')
    .find((button) => button.children.join('').includes('Imprimir PDF'))
  assert.ok(printButton, 'debe existir el botón Imprimir PDF')

  const refreshButton = renderer.root.findAllByType('button')
    .find((button) => button.children.join('').includes('Actualizar'))
  await act(async () => refreshButton.props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0)

  console.log('OK: AdminReports renders, changes period, exposes exports, and refreshes without runtime errors.')
} finally {
  if (renderer) await act(async () => renderer.unmount())
  await server.close()
}
