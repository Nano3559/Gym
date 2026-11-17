import { useEffect } from 'react'
import {
  Banknote,
  CalendarRange,
  Download,
  FileBarChart,
  Printer,
  Users,
  Activity,
} from 'lucide-react'
import useAdminReports, {
  METHOD_KEYS,
  METHOD_NAMES,
} from '../../hooks/useAdminReports'
import { downloadCsv } from '../../lib/csv'
import { buildReportCsvRows, buildReportHtml } from '../../lib/reportExport'

const RANGE_OPTIONS = [
  { value: 'hoy', label: 'Hoy (Día)' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes', label: 'Este Mes' },
  { value: 'rango', label: 'Rango personalizado' },
]

function Bar({ value, max, tone = 'accent' }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  if (tone === 'volt') return (
    <div className="h-full rounded-full bg-volt" style={{ width: `${width}%` }} />
  )
  if (tone === 'amber') return (
    <div className="h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} />
  )
  return (
    <div
      className="h-full rounded-full bg-gradient-to-r from-accent to-volt"
      style={{ width: `${width}%` }}
    />
  )
}

export default function AdminReports() {
  const {
    rangeType,
    setRangeType,
    from,
    setFrom,
    to,
    setTo,
    periodLabel,
    refreshing,
    hasLoaded,
    unavailable,
    error,
    payments,
    ingresosPorMembresias,
    ingresosPOS,
    ingresosTotal,
    methodCountsMembresias,
    methodCountsPOS,
    methodTotalsMembresias,
    methodTotalsPOS,
    activas,
    vencidas,
    totalClientes,
    fmtMoney,
    fmtInt,
    refresh,
  } = useAdminReports()

  // Auto-refresh on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  // "ready" = hay datos reales cargados. Distingue de cargando / error / cero.
  const ready = hasLoaded && !error
  const showInt = (value) => (ready && value != null ? fmtInt(value) : '—')
  const showMoney = (value) => (ready && value != null ? fmtMoney(value) : '—')

  const maxMethodCount = Math.max(
    1,
    ...METHOD_KEYS.map((key) => (methodCountsMembresias[key] || 0) + (methodCountsPOS[key] || 0)),
  )
  const activeShare = ready && activas != null && vencidas != null && activas + vencidas > 0
    ? Math.round((activas / (activas + vencidas)) * 100)
    : null

  const reportForExport = {
    ingresosPorMembresias,
    ingresosPOS,
    ingresosTotal,
    methodCountsMembresias,
    methodCountsPOS,
    methodTotalsMembresias,
    methodTotalsPOS,
    activas,
    vencidas,
    totalClientes,
  }

  const exportMeta = () => ({
    gymName: 'IronForge Gym',
    title: 'Reporte detallado',
    periodLabel,
    generatedAt: new Date().toLocaleString('es-BO'),
  })

  const handleExportCsv = () => {
    if (!ready) return
    downloadCsv('reporte-ironforge.csv', buildReportCsvRows(reportForExport, exportMeta()))
  }

  const handlePrint = () => {
    if (!ready || typeof window === 'undefined') return
    const html = buildReportHtml(reportForExport, exportMeta())
    const win = window.open('', '_blank', 'width=900,height=760')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    win.setTimeout(() => win.print(), 250)
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          No se pudieron cargar los reportes: {error}
        </p>
      )}
      {!error && unavailable && (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          Supabase no está configurado en este entorno: los datos del reporte no están disponibles.
        </p>
      )}
      {!error && !unavailable && !ready && (
        <p className="text-sm text-muted">Cargando reportes…</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white">
            <FileBarChart className="h-5 w-5 text-accent" />
            Reportes detallados
          </h2>
          <p className="mt-1 text-xs text-muted">
            Análisis por período · Ingresos, reservas y estado de clientes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!ready}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-white disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!ready}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir PDF
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-white disabled:opacity-50"
          >
            <Activity className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          <CalendarRange className="h-4 w-4 text-accent" /> Filtrar por período
        </h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRangeType(opt.value)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${rangeType === opt.value ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
          {rangeType === 'rango' && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Desde
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="field"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Hasta
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="field"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Reporte de ingresos y pagos por método */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
          <Banknote className="h-4 w-4 text-accent" /> Ingresos y Pagos
        </h3>
        <p className="mt-1 text-xs text-muted">
          {ready ? `${payments.length} pagos · Total ` : 'Total '}
          <span className="font-semibold text-volt">{showMoney(ingresosTotal)}</span>
        </p>
        <ul className="mt-5 space-y-4">
          {METHOD_KEYS.map((key) => {
            const mbCount = methodCountsMembresias[key] || 0
            const posCount = methodCountsPOS[key] || 0
            const mp = METHOD_NAMES[key]
            return (
              <li key={key} className="flex items-center gap-4">
                <span className="w-28 shrink-0 text-sm font-semibold text-white">{mp}</span>
                <Bar value={mbCount + posCount} max={maxMethodCount} tone={key === 'tarjeta' ? 'amber' : 'accent'} />
                <div className="w-40 shrink-0 text-right">
                  <span className="text-sm font-bold text-white">
                    {showMoney((methodTotalsMembresias[key] || 0) + (methodTotalsPOS[key] || 0))}
                  </span>
                  <span className="ml-2 text-xs text-muted">{ready ? `${mbCount + posCount} pagos` : '—'}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Ingresos desglosados */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="font-semibold text-muted mb-2">Ingresos por Membresías</h4>
          <p className="text-2xl font-bold text-volt">{showMoney(ingresosPorMembresias)}</p>
          <p className="text-xs text-muted">Pagos completados de membresías</p>
        </div>
        <div>
          <h4 className="font-semibold text-muted mb-2">Ingresos POS</h4>
          <p className="text-2xl font-bold text-muted">{showMoney(ingresosPOS)}</p>
          <p className="text-xs text-muted">Ventas de productos</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="font-semibold text-muted mb-2">Tendencia de ingresos</h4>
          <p className="mt-1 text-xs text-muted">
            El comparativo mensual está disponible en el apartado Finanzas.
          </p>
        </div>

        {/* Resumen comercial: solo ingresos reales. Los egresos no se
            consultan en Reportes y no deben mostrarse como cero ficticio. */}
        <div>
          <h4 className="font-display text-base font-semibold uppercase tracking-wide text-white">
            Resumen comercial
          </h4>
          <p className="mt-1 text-xs text-muted">
            Ingresos del período. Los egresos operativos se gestionan en Finanzas.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-volt/25 bg-volt/5 p-4">
              <p className="text-xs uppercase text-muted">Membresías</p>
              <p className="mt-1 font-display text-xl font-bold text-volt">{showMoney(ingresosPorMembresias)}</p>
            </div>
            <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
              <p className="text-xs uppercase text-muted">POS</p>
              <p className="mt-1 font-display text-xl font-bold text-accent">{showMoney(ingresosPOS)}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-volt/25 bg-volt/5 p-4">
              <p className="text-xs uppercase text-muted">Ingresos comerciales totales</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">{showMoney(ingresosTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reservas de clases: no son asistencias efectivas. Las reservas
          individuales están protegidas por RLS (cada cliente solo ve las
          suyas), por lo que el panel no puede agregarlas sin fabricar datos. */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
          <Users className="h-4 w-4 text-accent" /> Reservas de clases
        </h3>
        <p className="mt-1 text-xs text-muted">
          No disponible en Reportes. Las reservas no son asistencias efectivas y la
          base de datos solo permite a cada cliente leer las suyas, así que no se
          muestra un total agregado que podría ser parcial.
        </p>
      </div>

      {/* Estado de Clientes / Membresías */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-white">
          <Users className="h-4 w-4 text-accent" /> Estado de Clientes / Membresías
        </h3>
        <p className="mt-1 text-xs text-muted">Clientes únicos: activos con membresía vigente vs. vencidos.</p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-gradient-to-r from-volt to-accent" style={{ width: `${activeShare ?? 0}%` }} />
          </div>
          <span className="text-sm font-bold text-volt">{activeShare == null ? '—' : `${activeShare}%`}</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-volt/30 bg-volt/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Activas</p>
            <p className="mt-1 font-display text-3xl font-bold text-volt">{showInt(activas)}</p>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Vencidas</p>
            <p className="mt-1 font-display text-3xl font-bold text-red-400">{showInt(vencidas)}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          Total de clientes registrados: <span className="font-semibold text-white">{showInt(totalClientes)}</span>
        </p>
        {ready && totalClientes == null && (
          <p className="mt-2 text-xs text-amber-300">
            No se pudo verificar el listado de personal; el total de clientes no está disponible.
          </p>
        )}
      </div>
    </div>
  )
}
