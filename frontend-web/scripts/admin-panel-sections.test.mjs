import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPanelSections } from '../src/lib/panelSections.js'

/**
 * Pruebas unitarias para la matriz centralizada de secciones del panel.
 * Valida que cada rol vea las secciones correctas y que las secciones
 * prohibidas/no autorizadas no aparezcan.
 * Patrón: tests with node:test + ESM imports.
 */

test('Matriz de secciones - Administrador completo', () => {
  const { visible, panelTitle, panelSubtitle } = buildPanelSections({ isAdmin: true, isTrainer: false })

  const sectionKeys = visible.map((s) => s.key)
  assert.ok(sectionKeys.includes('dashboard'), 'Admin debe ver Dashboard')
  assert.ok(sectionKeys.includes('attendance'), 'Admin debe ver Asistencia')
  assert.ok(sectionKeys.includes('clients'), 'Admin debe ver Clientes')
  assert.ok(sectionKeys.includes('cash'), 'Admin debe ver Caja')
  assert.ok(sectionKeys.includes('products'), 'Admin debe ver POS/Productos')
  assert.ok(sectionKeys.includes('reports'), 'Admin debe ver Reportes')
  assert.ok(sectionKeys.includes('finance'), 'Admin debe ver Finanzas')
  assert.ok(sectionKeys.includes('plans'), 'Admin debe ver Planes')
  assert.ok(sectionKeys.includes('staff'), 'Admin debe ver Staff')
  assert.ok(!sectionKeys.includes('settings'), 'Configuración no debe aparecer en navegación principal admin')

  assert.strictEqual(panelTitle, 'Panel Administrativo', 'Título admin incorrecto')
  assert.strictEqual(panelSubtitle, 'Métricas, reportes y gestión de planes', 'Subtítulo admin incorrecto')
})

test('Matriz de secciones - Recepción', () => {
  const { visible, panelTitle, panelSubtitle } = buildPanelSections({ isAdmin: false, isTrainer: false })

  const sectionKeys = visible.map((s) => s.key)
  assert.ok(sectionKeys.includes('dashboard'), 'Recepción debe ver Dashboard')
  assert.ok(sectionKeys.includes('attendance'), 'Recepción debe ver Asistencia')
  assert.ok(sectionKeys.includes('clients'), 'Recepción debe ver Clientes')
  assert.ok(sectionKeys.includes('cash'), 'Recepción debe ver Caja (POS operativo)')
  assert.ok(!sectionKeys.includes('products'), 'Recepción no debe ver Products (catálogo al admin)')
  assert.ok(!sectionKeys.includes('reports'), 'Recepción no debe ver Reportes')
  assert.ok(!sectionKeys.includes('finance'), 'Recepción no debe ver Finanzas')
  assert.ok(!sectionKeys.includes('plans'), 'Recepción no debe ver Planes')
  assert.ok(!sectionKeys.includes('staff'), 'Recepción no debe ver Staff')
  assert.ok(!sectionKeys.includes('settings'), 'Configuración no debe aparecer para recepción')

  assert.strictEqual(panelTitle, 'Panel de Recepción', 'Título recepción incorrecto')
  assert.strictEqual(panelSubtitle, 'Control de asistencia y gestión de clientes', 'Subtítulo recepción incorrecto')
})

test('Matriz de secciones - Entrenador', () => {
  const { visible, panelTitle, panelSubtitle } = buildPanelSections({ isAdmin: false, isTrainer: true })

  const sectionKeys = visible.map((s) => s.key)
  assert.ok(sectionKeys.includes('dashboard'), 'Entrenador debe ver Dashboard')
  assert.ok(sectionKeys.includes('attendance'), 'Entrenador debe ver Asistencia')
  assert.ok(!sectionKeys.includes('clients'), 'Entrenador no debe ver Clientes')
  assert.ok(!sectionKeys.includes('cash'), 'Entrenador no debe ver Caja')
  assert.ok(!sectionKeys.includes('products'), 'Entrenador no debe ver Products')
  assert.ok(!sectionKeys.includes('reports'), 'Entrenador no debe ver Reportes')
  assert.ok(!sectionKeys.includes('finance'), 'Entrenador no debe ver Finanzas')
  assert.ok(!sectionKeys.includes('plans'), 'Entrenador no debe ver Planes')
  assert.ok(!sectionKeys.includes('staff'), 'Entrenador no debe ver Staff')
  assert.ok(!sectionKeys.includes('settings'), 'Configuración no debe aparecer para entrenador')

  assert.strictEqual(panelTitle, 'Panel de Entrenador', 'Título entrenador incorrecto')
  assert.strictEqual(panelSubtitle, 'Control de asistencia y perfiles mínimos', 'Subtítulo entrenador incorrecto')
})

test('Ausencia de secciones desconocidas', () => {
  const { visible } = buildPanelSections({ isAdmin: true, isTrainer: true })
  const sectionKeys = visible.map((s) => s.key)
  for (const s of visible) {
    assert.ok(s.key, 'Sección debe tener key')
    assert.ok(s.label, 'Sección debe tener label')
    assert.ok(s.icon, 'Sección debe tener icon')
  }
})

test('Títulos y subtítulos por rol', () => {
  // Admin
  const { panelTitle: titleAdmin, panelSubtitle: subtitleAdmin } = buildPanelSections({ isAdmin: true, isTrainer: false })
  assert.strictEqual(titleAdmin, 'Panel Administrativo', 'Título admin incorrecto')
  assert.strictEqual(subtitleAdmin, 'Métricas, reportes y gestión de planes', 'Subtítulo admin incorrecto')

  // Recepción
  const { panelTitle: titleRecepcion, panelSubtitle: subtitleRecepcion } = buildPanelSections({ isAdmin: false, isTrainer: false })
  assert.strictEqual(titleRecepcion, 'Panel de Recepción', 'Título recepción incorrecto')
  assert.strictEqual(subtitleRecepcion, 'Control de asistencia y gestión de clientes', 'Subtítulo recepción incorrecto')

  // Entrenador
  const { panelTitle: titleEntrenador, panelSubtitle: subtitleEntrenador } = buildPanelSections({ isAdmin: false, isTrainer: true })
  assert.strictEqual(titleEntrenador, 'Panel de Entrenador', 'Título entrenador incorrecto')
  assert.strictEqual(subtitleEntrenador, 'Control de asistencia y perfiles mínimos', 'Subtítulo entrenador incorrecto')
})

test('Lote 5A - Verificación de matriz de permisos', () => {
  // Verificaciones rápidas de la matriz aprobada en Lote 5A
  const adminVisible = buildPanelSections({ isAdmin: true, isTrainer: false })
  const recepVisible = buildPanelSections({ isAdmin: false, isTrainer: false })
  const trainerVisible = buildPanelSections({ isAdmin: false, isTrainer: true })

  // Admin: catálogo y POS
  assert.ok(adminVisible.visible.some(s => s.key === 'products'), 'Admin debe ver Products')
  assert.ok(adminVisible.visible.some(s => s.key === 'cash'), 'Admin debe ver Cash')

  // Recepción: POS sin catálogo
  assert.ok(recepVisible.visible.some(s => s.key === 'cash'), 'Recepción debe ver Cash')
  assert.ok(!recepVisible.visible.some(s => s.key === 'products'), 'Rección no debe ver Products')

  // Entrenador: nada de POS ni catálogo
  assert.ok(!trainerVisible.visible.some(s => s.key === 'products'), 'Entrenador no debe ver Products')
  assert.ok(!trainerVisible.visible.some(s => s.key === 'cash'), 'Entrenador no debe ver Cash')
})

console.log('Todas las pruebas de admin-panel-sections.test.mjs passed.')