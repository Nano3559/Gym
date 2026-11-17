// Exportación del reporte: filas CSV y documento imprimible (HTML).
// Todo es puro (devuelve arrays/strings) para poder probarlo sin DOM.

import { METHOD_KEYS, METHOD_NAMES, fmtInt } from './adminReportMetrics.js'

function money(value) {
  if (value == null) return 'No disponible'
  return `${fmtInt(value)} Bs.`
}

function count(value) {
  if (value == null) return 'No disponible'
  return fmtInt(value)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildReportCsvRows(report = {}, meta = {}) {
  const periodLabel = meta.periodLabel || 'No definido'
  const generatedAt = meta.generatedAt || ''
  const incomesAvailable = report.ingresosTotal != null
  const rows = [
    ['IronForge Gym - Reporte detallado'],
    ['Período', periodLabel],
    ['Generado', generatedAt],
    [],
    ['Ingresos', 'Monto (Bs.)'],
    ['Ingresos por membresías', money(report.ingresosPorMembresias)],
    ['Ingresos POS', money(report.ingresosPOS)],
    ['Ingresos comerciales totales', money(report.ingresosTotal)],
    [],
    ['Método de pago', 'Pagos membresías', 'Monto membresías', 'Pagos POS', 'Monto POS', 'Total'],
  ]

  for (const key of METHOD_KEYS) {
    const mbCount = report.methodCountsMembresias?.[key] ?? 0
    const posCount = report.methodCountsPOS?.[key] ?? 0
    const mbTotal = report.methodTotalsMembresias?.[key] ?? 0
    const posTotal = report.methodTotalsPOS?.[key] ?? 0
    rows.push([
      METHOD_NAMES[key],
      incomesAvailable ? mbCount : 'No disponible',
      incomesAvailable ? money(mbTotal) : 'No disponible',
      incomesAvailable ? posCount : 'No disponible',
      incomesAvailable ? money(posTotal) : 'No disponible',
      incomesAvailable ? money(mbTotal + posTotal) : 'No disponible',
    ])
  }

  rows.push([])
  rows.push(['Clientes', 'Cantidad'])
  rows.push(['Clientes activos', count(report.activas)])
  rows.push(['Clientes vencidos', count(report.vencidas)])
  rows.push(['Total de clientes', count(report.totalClientes)])

  return rows
}

export function buildReportHtml(report = {}, meta = {}) {
  const gymName = meta.gymName || 'IronForge Gym'
  const title = meta.title || 'Reporte detallado'
  const periodLabel = meta.periodLabel || 'No definido'
  const generatedAt = meta.generatedAt || ''
  const incomesAvailable = report.ingresosTotal != null

  const methodRows = METHOD_KEYS.map((key) => {
    const mbCount = report.methodCountsMembresias?.[key] ?? 0
    const posCount = report.methodCountsPOS?.[key] ?? 0
    const mbTotal = report.methodTotalsMembresias?.[key] ?? 0
    const posTotal = report.methodTotalsPOS?.[key] ?? 0
    return `<tr>
      <td>${escapeHtml(METHOD_NAMES[key])}</td>
      <td class="num">${escapeHtml(incomesAvailable ? mbCount : 'No disponible')}</td>
      <td class="num">${escapeHtml(incomesAvailable ? money(mbTotal) : 'No disponible')}</td>
      <td class="num">${escapeHtml(incomesAvailable ? posCount : 'No disponible')}</td>
      <td class="num">${escapeHtml(incomesAvailable ? money(posTotal) : 'No disponible')}</td>
      <td class="num">${escapeHtml(incomesAvailable ? money(mbTotal + posTotal) : 'No disponible')}</td>
    </tr>`
  }).join('')

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(gymName)} - ${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 32px;
      font-size: 13px;
    }
    h1 { margin: 0; font-size: 24px; letter-spacing: .04em; text-transform: uppercase; }
    h2 { margin: 4px 0 0; font-size: 15px; font-weight: 500; color: #4b5563; }
    .meta { margin-top: 6px; color: #6b7280; font-size: 12px; }
    section { margin-top: 24px; }
    h3 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    td.num, th.num { text-align: right; }
    .cards { display: flex; gap: 12px; flex-wrap: wrap; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; min-width: 170px; }
    .card span { display: block; font-size: 11px; text-transform: uppercase; color: #6b7280; }
    .card strong { display: block; margin-top: 4px; font-size: 20px; }
    .footer { margin-top: 28px; font-size: 11px; color: #9ca3af; }
    @media print { body { padding: 0; } section { break-inside: avoid; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(gymName)}</h1>
    <h2>${escapeHtml(title)}</h2>
    <p class="meta">Período: ${escapeHtml(periodLabel)}${generatedAt ? ` · Generado el ${escapeHtml(generatedAt)}` : ''}</p>
  </header>

  <section>
    <h3>Resumen de ingresos</h3>
    <div class="cards">
      <div class="card"><span>Ingresos por membresías</span><strong>${escapeHtml(money(report.ingresosPorMembresias))}</strong></div>
      <div class="card"><span>Ingresos POS</span><strong>${escapeHtml(money(report.ingresosPOS))}</strong></div>
      <div class="card"><span>Ingresos comerciales totales</span><strong>${escapeHtml(money(report.ingresosTotal))}</strong></div>
    </div>
  </section>

  <section>
    <h3>Desglose por método de pago</h3>
    <table>
      <thead>
        <tr>
          <th>Método</th>
          <th class="num">Pagos membresías</th>
          <th class="num">Monto membresías</th>
          <th class="num">Pagos POS</th>
          <th class="num">Monto POS</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${methodRows}</tbody>
    </table>
  </section>

  <section>
    <h3>Estado de clientes</h3>
    <div class="cards">
      <div class="card"><span>Clientes activos</span><strong>${escapeHtml(count(report.activas))}</strong></div>
      <div class="card"><span>Clientes vencidos</span><strong>${escapeHtml(count(report.vencidas))}</strong></div>
      <div class="card"><span>Total de clientes</span><strong>${escapeHtml(count(report.totalClientes))}</strong></div>
    </div>
  </section>

  <p class="footer">Los egresos operativos no forman parte de este reporte; se gestionan en el apartado Finanzas.</p>
</body>
</html>`
}
