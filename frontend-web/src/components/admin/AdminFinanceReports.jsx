import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadCsv } from '../../lib/csv'
import {
  buildFinanceCsvRows,
  buildMovements,
  currentMonthBounds,
  filterMovementsByPeriod,
  periodQueryBounds,
  resolveFinanceMode,
  summarizeMovements,
} from '../../lib/financeMetrics'
import {
  appendLocalFinanceExpense,
  defaultFinanceSource,
  fetchFinanceRows,
  hasFinanceSession,
  insertFinanceExpense,
  readLocalFinanceData,
} from '../../services/financeService'
import AdminFinanceView from './AdminFinanceView'

const EMPTY_ROWS = { payments: [], posSales: [], expenses: [] }
const INITIAL_FORM = { concepto: '', categoria: 'Servicios', monto: '', metodo_pago: 'efectivo' }

export default function AdminFinanceReports({ onToast, financeSource = defaultFinanceSource }) {
  const { configured, client, storage } = financeSource
  const defaults = useMemo(() => currentMonthBounds(), [])
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [status, setStatus] = useState('loading')
  const [mode, setMode] = useState(() => resolveFinanceMode({ configured, hasSession: false }))
  const [rows, setRows] = useState(EMPTY_ROWS)
  const [error, setError] = useState('')
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const requestRef = useRef(0)
  const savingRef = useRef(false)

  const load = useCallback(async ({ from: rangeFrom, to: rangeTo }) => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setError('')

    const bounds = periodQueryBounds(rangeFrom, rangeTo)
    if (!bounds) {
      setRows(EMPTY_ROWS)
      setError('El rango de fechas no es válido: revisa que «Desde» no sea posterior a «Hasta».')
      setStatus('error')
      return
    }

    // Sin Supabase configurado: modo local explícito, sin mezclar con datos reales.
    if (!configured) {
      setMode('local')
      setRows(readLocalFinanceData(storage))
      setStatus('ready')
      return
    }

    if (!client) {
      setRows(EMPTY_ROWS)
      setError('No se pudo inicializar la conexión con la base de datos.')
      setStatus('error')
      return
    }

    setStatus('loading')
    try {
      const hasSession = await hasFinanceSession(client)
      if (requestId !== requestRef.current) return
      if (!hasSession) {
        setMode('auth-required')
        setRows(EMPTY_ROWS)
        setStatus('auth-required')
        return
      }
      setMode('remote')
      const data = await fetchFinanceRows({ client, from: rangeFrom, to: rangeTo })
      if (requestId !== requestRef.current) return
      setRows(data)
      setStatus('ready')
    } catch (loadError) {
      if (requestId !== requestRef.current) return
      setRows(EMPTY_ROWS)
      setError(loadError?.message || 'Error desconocido al consultar la base de datos.')
      setStatus('error')
      onToast?.(`No se pudieron cargar finanzas: ${loadError.message}`, 'error')
    }
  }, [client, configured, onToast, storage])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- La carga inicial y por rango es asíncrona.
    load({ from, to })
  }, [load, from, to])

  const movements = useMemo(() => {
    if (status !== 'ready') return []
    return filterMovementsByPeriod(buildMovements(rows), from, to)
  }, [rows, from, to, status])

  const summary = useMemo(
    () => (status === 'ready' ? summarizeMovements(movements) : null),
    [movements, status],
  )

  const addExpense = async (event) => {
    event.preventDefault()
    if (savingRef.current) return
    if (mode === 'auth-required') {
      onToast?.('Inicia sesión para registrar egresos reales.', 'error')
      return
    }
    const monto = Number(form.monto)
    if (!form.concepto.trim() || !Number.isFinite(monto) || monto <= 0) {
      onToast?.('Ingresa el concepto y un monto válido.', 'error')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const payload = { ...form, concepto: form.concepto.trim(), monto }
      if (mode === 'local') {
        appendLocalFinanceExpense(payload, storage)
      } else {
        await insertFinanceExpense(payload, client)
      }
      setForm(INITIAL_FORM)
      await load({ from, to })
      onToast?.('Egreso registrado.')
    } catch (saveError) {
      onToast?.(`No se pudo registrar el egreso: ${saveError.message}`, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const exportCsv = () => {
    if (status !== 'ready') return
    downloadCsv(`finanzas-${from}_${to}.csv`, buildFinanceCsvRows(movements))
  }

  // Al cambiar el período se invalida de inmediato lo mostrado/exportable.
  const changeRange = (setter) => (value) => {
    setter(value)
    setStatus('loading')
    setError('')
  }

  return (
    <AdminFinanceView
      status={status}
      mode={mode}
      error={error}
      from={from}
      to={to}
      onFromChange={changeRange(setFrom)}
      onToChange={changeRange(setTo)}
      summary={summary}
      movements={movements}
      form={form}
      onFormChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
      onSubmit={addExpense}
      saving={saving}
      onExport={exportCsv}
      onRetry={() => load({ from, to })}
    />
  )
}
