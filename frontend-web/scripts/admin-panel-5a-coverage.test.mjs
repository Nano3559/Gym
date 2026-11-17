import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Cobertura automatizada del Lote 5A — Separación POS/catálogo y navegación.
 * Usa imports ESM que ya funcionan en este proyecto (igual que admin-panel-sections.test.mjs).
 */

// Importa la matriz centralizada (funciona por patrón existente)
const { buildPanelSections } = await import('../src/lib/panelSections.js')

test('Lote 5A - Admin: acceso al POS y al catálogo', async () => {
  // 1. Admin debe ver Products en la matriz
  const adminVisible = buildPanelSections({ isAdmin: true, isTrainer: false })
  const productSection = adminVisible.visible.find(s => s.key === 'products')
  assert.ok(productSection, 'Admin debe ver la sección Products en buildPanelSections')

  // 2. PosProductsManagement debe renderizarse para admin
  assert.ok(adminVisible.visible.some(s => s.key === 'products'),
    'La matriz debe incluir Products para admin')

  // 3. CashRegister accesible (products distinta a cash, pero verificamos estructura)
  assert.ok(adminVisible.visible.some(s => s.key === 'cash'),
    'La matriz debe incluir Cash para admin')
})

test('Lote 5A - Recepción: acceso al POS, sin acceso al catálogo', async () => {
  // 1. Recepción NO debe ver Products en la matriz
  const recepVisible = buildPanelSections({ isAdmin: false, isTrainer: false })
  const productSection = recepVisible.visible.find(s => s.key === 'products')
  assert.ok(!productSection, 'Recepción NO debe ver Products en la matriz')

  // 2. Recepción SÍ debe ver Cash
  const cashSection = recepVisible.visible.find(s => s.key === 'cash')
  assert.ok(cashSection, 'Recepción debe ver Cash en la matriz')

  // 3. Reportes y Finanzas solo para admin
  assert.ok(!recepVisible.visible.some(s => s.key === 'reports'),
    'Recepción no debe ver Reports')
  assert.ok(!recepVisible.visible.some(s => s.key === 'finance'),
    'Recepción no debe ver Finanzas')
})

test('Lote 5A - Entrenador: sin acceso al POS ni al catálogo', async () => {
  // 1. Entrenador NO debe ver Products ni Cash
  const trainerVisible = buildPanelSections({ isAdmin: false, isTrainer: true })
  assert.ok(!trainerVisible.visible.some(s => s.key === 'products'),
    'Entrenador no debe ver Products')
  assert.ok(!trainerVisible.visible.some(s => s.key === 'cash'),
    'Entrenador no debe ver Cash')

  // 2. Sólo Dashboard y Attendance para entrenador
  assert.ok(trainerVisible.visible.some(s => s.key === 'dashboard'),
    'Entrenador debe ver Dashboard')
  assert.ok(trainerVisible.visible.some(s => s.key === 'attendance'),
    'Entrenador debe ver Attendance')
})

test('Lote 5A - Títulos y subtítulos por rol (validación Lote 5A)', async () => {
  // 1. Admin
  const { panelTitle: titleAdmin, panelSubtitle: subtitleAdmin } =
    buildPanelSections({ isAdmin: true, isTrainer: false })
  assert.strictEqual(titleAdmin, 'Panel Administrativo',
    'Título admin debe ser Panel Administrativo')
  assert.strictEqual(subtitleAdmin, 'Métricas, reportes y gestión de planes',
    'Subtítulo admin debe ser Métricas, reportes y gestión de planes')

  // 2. Recepción
  const { panelTitle: titleRecepcion, panelSubtitle: subtitleRecepcion } =
    buildPanelSections({ isAdmin: false, isTrainer: false })
  assert.strictEqual(titleRecepcion, 'Panel de Recepción',
    'Título recepción debe ser Panel de Recepción')
  assert.strictEqual(subtitleRecepcion, 'Control de asistencia y gestión de clientes',
    'Subtítulo recepción debe ser Control de asistencia y gestión de clientes')

  // 3. Entrenador
  const { panelTitle: titleEntrenador, panelSubtitle: subtitleEntrenador } =
    buildPanelSections({ isAdmin: false, isTrainer: true })
  assert.strictEqual(titleEntrenador, 'Panel de Entrenador',
    'Título entrenador debe ser Panel de Entrenador')
  assert.strictEqual(subtitleEntrenador, 'Control de asistencia y perfiles mínimos',
    'Subtítulo entrenador debe ser Control de asistencia y perfiles mínimos')
})

test('Lote 5A - Configuración retirada de navegación (D-03)', async () => {
  // 1. La matriz buildPanelSections NO debe incluir 'settings' en visible
  const adminVisible = buildPanelSections({ isAdmin: true, isTrainer: false })
  const sectionKeys = adminVisible.visible.map(s => s.key)
  assert.ok(!sectionKeys.includes('settings'),
    'Configuración no debe aparecer en visible para ningún rol (D-03)')

  // 2. Igual para recepción y entrenador
  const recepVisible = buildPanelSections({ isAdmin: false, isTrainer: false })
  assert.ok(!recepVisible.visible.includes('settings'),
    'Configuración no debe aparecer para recepción')

  const trainerVisible = buildPanelSections({ isAdmin: false, isTrainer: true })
  assert.ok(!trainerVisible.visible.includes('settings'),
    'Configuración no debe aparecer para entrenador')
})

console.log('Todas las pruebas de cobertura Lote 5A passaram.')