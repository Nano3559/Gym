import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const listeners = new Map()
globalThis.document = {
  body: { style: { overflow: '' } },
  addEventListener(type, listener) { listeners.set(type, listener) },
  removeEventListener(type) { listeners.delete(type) },
}

const server = await createServer({
  configFile: 'vite.config.js',
  server: { middlewareMode: true },
  appType: 'custom',
})
let renderer

try {
  const { default: Modal } = await server.ssrLoadModule('/src/components/ui/Modal.jsx')
  let closeCount = 0
  await act(async () => {
    renderer = create(React.createElement(Modal, {
      open: true,
      onClose: () => { closeCount += 1 },
      title: 'Formulario',
      closeOnBackdrop: false,
      closeOnEscape: false,
    }, 'Contenido'))
  })

  const backdrop = renderer.root.findByProps({
    className: 'absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in',
  })
  assert.equal(backdrop.props.onClick, undefined)
  await act(async () => listeners.get('keydown')({ key: 'Escape' }))
  assert.equal(closeCount, 0)

  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Cerrar' }).props.onClick()
  })
  assert.equal(closeCount, 1)

  await act(async () => renderer.unmount())
  renderer = null

  await act(async () => {
    renderer = create(React.createElement(Modal, {
      open: true,
      onClose: () => { closeCount += 1 },
      title: 'Otro diálogo',
    }, 'Contenido'))
  })
  const defaultBackdrop = renderer.root.findByProps({
    className: 'absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in',
  })
  assert.equal(typeof defaultBackdrop.props.onClick, 'function')
  await act(async () => defaultBackdrop.props.onClick())
  assert.equal(closeCount, 2)

  console.log('OK: auth-style dialogs stay open on backdrop/Escape; default dialogs preserve dismissal.')
} finally {
  if (renderer) await act(async () => renderer.unmount())
  await server.close()
  delete globalThis.document
}
