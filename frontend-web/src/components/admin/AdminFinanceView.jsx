// Vista presentacional de Finanzas.
//
// No realiza consultas ni escribe datos: recibe estado y callbacks para que
// pueda probarse en estados de carga, error, vacío y datos sin red.
//
// Estados de `status`: 'loading' | 'ready' | 'error' | 'auth-required'.
// Modos de `mode`: 'remote' | 'local' | 'auth-required'.

import { AlertTriangle, Download, LogIn, RefreshCw, Wallet } from 'lucide-react'
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  formatDateDisplay,
  formatMoney,
} from '../../lib/financeMetrics'

const COLUMNS = ['Fecha', 'Tipo', 'Concepto', 'Método', 'Monto', 'Identificador']

function StatusBanner({ status, mode, error, onRetry }) {
  if (status === 'loading') {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted">
        Cargando movimientos financieros…
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">No se pudieron cargar los movimientos financieros.</p>
          <p className="mt-1 text-red-200/80">{error || 'Intenta de nuevo en unos instantes.'}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-red-400/50 px-3 py-2 font-semibold text-red-100"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
        )}
      </div>
    )
  }
  if (status === 'auth-required') {
    return (
      <div role="alert" className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
        <LogIn className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Sesión no disponible.</p>
          <p className="mt-1 text-amber-100/80">
            Inicia sesión con una cuenta de administración para consultar y registrar movimientos reales.
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300/50 px-3 py-2 font-semibold text-amber-100"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
        )}
      </div>
    )
  }
  if (mode === 'local') {
    return (
      <div role="status" className="rounded-2xl border border-sky-400/40 bg-sky-400/10 px-5 py-4 text-sm text-sky-100">
        <p className="font-semibold">Modo local (sin conexión a la base de datos).</p>
        <p className="mt-1 text-sky-100/80">
          Estos datos se guardan solo en este navegador y no forman parte del registro financiero central.
        </p>
      </div>
    )
  }
  return null
}

function SummaryCard({ label, cents, ready, color, detail }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${color}`}>
        {ready ? formatMoney(cents) : '—'}
      </p>
      {ready && detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  )
}

function MovementTable({ title, rows, emptyLabel }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <h3 className="border-b border-line px-4 py-3 font-display font-semibold uppercase text-white">
        {title}
        <span className="ml-2 text-xs font-normal normal-case text-muted">({rows.length})</span>
      </h3>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-muted">
              {COLUMNS.map((column) => (
                <th key={column} className={`px-4 py-3 ${column === 'Monto' ? 'text-right' : ''}`}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((movement) => (
              <tr key={movement.id} className="border-t border-line/60">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateDisplay(movement.date)}</td>
                <td className="px-4 py-3 text-white">{movement.subtype}</td>
                <td className="px-4 py-3 font-medium text-white">{movement.concept}</td>
                <td className="px-4 py-3 text-muted">{movement.methodLabel}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-white">
                  {formatMoney(movement.amountCents)}
                </td>
                <td className="break-all px-4 py-3 text-xs text-muted">{movement.reference || '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function AdminFinanceView({
  status = 'loading',
  mode = 'remote',
  error = '',
  from = '',
  to = '',
  onFromChange,
  onToChange,
  summary = null,
  movements = [],
  form = { concepto: '', categoria: 'Servicios', monto: '', metodo_pago: 'efectivo' },
  onFormChange,
  onSubmit,
  saving = false,
  onExport,
  onRetry,
}) {
  const ready = status === 'ready'
  const incomeRows = ready ? movements.filter((movement) => movement.type === 'Ingreso') : []
  const expenseRows = ready ? movements.filter((movement) => movement.type === 'Egreso') : []
  const totals = summary || { membershipCents: 0, posCents: 0, incomeCents: 0, expenseCents: 0, netCents: 0 }
  const emptyLabel = status === 'ready' ? 'Sin movimientos para el período.' : 'No disponible.'

  const patch = (name, value) => onFormChange?.({ [name]: value })

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-semibold uppercase text-white">Finanzas · Estado de Resultados</h2>
        <p className="mt-1 text-sm text-muted">Ingresos, egresos y ganancia neta del período.</p>
      </header>

      <StatusBanner status={status} mode={mode} error={error} onRetry={onRetry} />

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold uppercase text-muted">
              Desde
              <input
                type="date"
                value={from}
                onChange={(event) => onFromChange?.(event.target.value)}
                className="field mt-1.5"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-muted">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(event) => onToChange?.(event.target.value)}
                className="field mt-1.5"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={!ready}
            title={ready ? 'Exportar el período seleccionado' : 'Disponible cuando los datos estén completos'}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Ingresos"
          cents={totals.incomeCents}
          ready={ready}
          color="text-volt"
          detail={`Membresías ${formatMoney(totals.membershipCents)} · POS ${formatMoney(totals.posCents)}`}
        />
        <SummaryCard label="Egresos" cents={totals.expenseCents} ready={ready} color="text-red-400" />
        <SummaryCard label="Ganancia neta" cents={totals.netCents} ready={ready} color="text-white" />
      </section>

      {ready && mode !== 'auth-required' && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase text-white">
            <Wallet className="h-4 w-4 text-accent" /> Registrar egreso
          </h3>
          <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className="field lg:col-span-2"
              name="concepto"
              aria-label="Concepto"
              placeholder="Concepto: alquiler, luz…"
              maxLength={160}
              required
              value={form.concepto}
              onChange={(event) => patch('concepto', event.target.value)}
            />
            <select
              className="field"
              name="categoria"
              aria-label="Categoría"
              value={form.categoria}
              onChange={(event) => patch('categoria', event.target.value)}
            >
              {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="field"
              name="monto"
              aria-label="Monto"
              placeholder="Monto Bs."
              required
              value={form.monto}
              onChange={(event) => patch('monto', event.target.value)}
            />
            <select
              className="field"
              name="metodo_pago"
              aria-label="Método de pago"
              value={form.metodo_pago}
              onChange={(event) => patch('metodo_pago', event.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.key} value={method.key}>{method.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-1"
            >
              {saving ? 'Guardando…' : 'Registrar egreso'}
            </button>
          </form>
        </section>
      )}

      {ready ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <MovementTable title="Ingresos" rows={incomeRows} emptyLabel={emptyLabel} />
          <MovementTable title="Egresos" rows={expenseRows} emptyLabel={emptyLabel} />
        </div>
      ) : (
        <p className="text-sm text-muted">
          {status === 'loading'
            ? 'Los movimientos se mostrarán cuando termine la consulta.'
            : 'Los movimientos no están disponibles mientras el estado no sea válido.'}
        </p>
      )}
    </div>
  )
}
