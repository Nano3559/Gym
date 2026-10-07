import { useState } from 'react'
import { Banknote, Minus, Plus } from 'lucide-react'
import Modal from '../ui/Modal'
import { METODOS_PAGO } from '../../data/adminData'

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('es-BO')} Bs.`
}

export function PosModal({ open, products, loading = false, onClose, onSave, onToast }) {
  const [quantities, setQuantities] = useState({})
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const activeProducts = products.filter((product) => product.activo)
  const selectedItems = activeProducts
    .filter((product) => Number(quantities[product.id]) > 0)
    .map((product) => ({
      productId: product.id,
      quantity: Number(quantities[product.id]),
      subtotal: Number(product.precio) * Number(quantities[product.id]),
    }))
  const total = selectedItems.reduce((sum, item) => sum + item.subtotal, 0)

  const submit = async (event) => {
    event.preventDefault()
    if (selectedItems.length === 0) {
      onToast('Selecciona al menos un producto para registrar la venta.', 'error')
      return
    }
    setSaving(true)
    try {
      const sale = await onSave({
        items: selectedItems.map(({ productId, quantity }) => ({
          productId,
          quantity,
          nombre: activeProducts.find((product) => product.id === productId)?.nombre || '',
        })),
        metodoPago,
      })
      setReceipt({ ...sale, items: sale.items || selectedItems.map((item) => ({
        ...item,
        nombre: activeProducts.find((product) => product.id === item.productId)?.nombre || '',
      })) })
      onToast('Venta registrada correctamente.')
    } catch (error) {
      onToast(`No se pudo registrar la venta: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { setReceipt(null); setQuantities({}); onClose() }} title={receipt ? 'Comprobante de venta' : 'Nueva venta · POS'}>
      {receipt ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-volt/30 bg-volt/5 p-5">
            <p className="font-display text-lg font-bold text-white">IronForge Gym</p>
            <p className="mt-1 text-sm text-muted">Comprobante de venta #{receipt.receipt_number || receipt.id}</p>
            <p className="text-xs text-muted">
              {receipt.created_at || receipt.createdAt
                ? new Date(receipt.created_at || receipt.createdAt).toLocaleString('es-BO')
                : 'Fecha no disponible'}
            </p>
            <ul className="my-4 space-y-2 border-y border-line py-3">
              {receipt.items.map((item, index) => (
                <li key={item.id || item.productId || index} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted">{item.quantity || item.cantidad} × {item.product_name || item.nombre}</span>
                  <span className="font-semibold text-white">{formatMoney(item.line_total || item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between text-base font-bold text-white">
              <span>Total</span><span>{formatMoney(receipt.total)}</span>
            </p>
            <p className="mt-2 text-sm text-muted">Pago: {METODOS_PAGO.find((method) => method.key === receipt.metodo_pago || method.key === receipt.metodoPago)?.label || receipt.metodoPago}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const lines = [
                'IRONFORGE GYM',
                `Comprobante #${receipt.receipt_number || receipt.id}`,
                receipt.created_at || receipt.createdAt
                  ? new Date(receipt.created_at || receipt.createdAt).toLocaleString('es-BO')
                  : 'Fecha no disponible',
                '',
                ...receipt.items.map((item) => `${item.quantity || item.cantidad} x ${item.product_name || item.nombre} - ${formatMoney(item.line_total || item.subtotal)}`),
                '',
                `TOTAL: ${formatMoney(receipt.total)}`,
                `Método de pago: ${METODOS_PAGO.find((method) => method.key === receipt.metodo_pago || method.key === receipt.metodoPago)?.label || receipt.metodoPago}`,
              ]
              const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `comprobante-${receipt.receipt_number || receipt.id}.txt`
              link.click()
              URL.revokeObjectURL(url)
            }}
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white"
          >
            Descargar comprobante
          </button>
        </div>
      ) : loading ? (
        <p className="rounded-xl border border-line bg-card/40 p-6 text-center text-sm text-muted">
          Cargando catálogo…
        </p>
      ) : activeProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/40 p-6 text-center">
          <Banknote className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-semibold text-white">El catálogo aún está vacío</p>
          <p className="mt-1 text-sm text-muted">
            Pide al administrador que cargue productos antes de registrar una venta.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {activeProducts.map((product) => {
              const quantity = Number(quantities[product.id] || 0)
              return (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{product.nombre}</span>
                    <span className="text-xs text-muted">{formatMoney(product.precio)}</span>
                    <span className={`block text-xs ${Number(product.stock) > 0 ? 'text-muted' : 'text-red-400'}`}>
                      Stock: {product.stock ?? '—'}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Quitar una unidad de ${product.nombre}`}
                    onClick={() =>
                      setQuantities((current) => ({
                        ...current,
                        [product.id]: Math.max(0, quantity - 1),
                      }))
                    }
                    className="rounded-lg border border-line p-2 text-muted hover:text-white"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-white">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Añadir una unidad de ${product.nombre}`}
                    onClick={() =>
                      setQuantities((current) => ({ ...current, [product.id]: quantity + 1 }))
                    }
                    disabled={Number(product.stock || 0) <= quantity}
                    className="rounded-lg border border-accent/40 bg-accent/10 p-2 text-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Método de pago
            </span>
            <select
              value={metodoPago}
              onChange={(event) => setMetodoPago(event.target.value)}
              className="field"
            >
              {METODOS_PAGO.map((method) => (
                <option key={method.key} value={method.key}>{method.label}</option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
            <span className="font-semibold text-muted">Total de venta</span>
            <span className="font-display text-xl font-bold text-white">{formatMoney(total)}</span>
          </div>
          <button
            type="submit"
            disabled={saving || selectedItems.length === 0}
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Registrando…' : 'Registrar venta'}
          </button>
        </form>
      )}
    </Modal>
  )
}

const EXPENSE_CATEGORIES = ['Sueldos', 'Alquiler', 'Servicios', 'Insumos', 'Mantenimiento', 'Otros']

export function ExpenseModal({ open, onClose, onSave, onToast }) {
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState(EXPENSE_CATEGORIES[0])
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!concepto.trim() || !Number.isFinite(Number(monto)) || Number(monto) <= 0) {
      onToast('Ingresa un concepto y un importe mayor a cero.', 'error')
      return
    }
    setSaving(true)
    try {
      await onSave({ concepto, categoria, monto, metodoPago })
      setConcepto('')
      setMonto('')
      onToast('Gasto registrado correctamente.')
      onClose()
    } catch (error) {
      onToast(`No se pudo registrar el gasto: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar gasto">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Concepto
          </span>
          <input
            value={concepto}
            onChange={(event) => setConcepto(event.target.value)}
            className="field"
            placeholder="Ej.: compra de artículos de limpieza"
            maxLength={160}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Método de pago
          </span>
          <select value={metodoPago} onChange={(event) => setMetodoPago(event.target.value)} className="field">
            {METODOS_PAGO.map((method) => (
              <option key={method.key} value={method.key}>{method.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Categoría
          </span>
          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            className="field"
          >
            {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Importe (Bs.)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
            className="field"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar gasto'}
        </button>
      </form>
    </Modal>
  )
}
