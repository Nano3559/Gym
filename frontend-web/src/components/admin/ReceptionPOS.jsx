import { useEffect, useMemo, useState } from 'react'
import { Banknote, Minus, Plus, Printer, ReceiptText, ShoppingBag, Trash2 } from 'lucide-react'
import { appendPosSale } from '../../services/receptionCashService'
import { loadInventoryProducts, sellInventoryProducts } from '../../services/inventoryService'
import { loadCurrentCashShift } from '../../services/cashRegisterService'

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'yape_plin', label: 'Yape / Plin' },
  { id: 'qr', label: 'QR' },
]

const formatMoney = (amount) => `${Number(amount).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.`

export default function ReceptionPOS({ onToast, onOpenCashControl }) {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [hasCashShift, setHasCashShift] = useState(false)
  const [cashShiftLoading, setCashShiftLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState('')
  const [cart, setCart] = useState({})
  const [method, setMethod] = useState('efectivo')
  const [receipt, setReceipt] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [selling, setSelling] = useState(false)

  const refreshProducts = async () => {
    setProductsLoading(true)
    try {
      const result = await loadInventoryProducts()
      setProducts(result.products)
      setInventoryError('')
    } catch (error) {
      setInventoryError(error.message || 'No se pudo cargar el inventario. Aplica la migración de inventario en Supabase.')
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refreshProducts()
    loadCurrentCashShift()
      .then(({ shift }) => setHasCashShift(Boolean(shift)))
      .catch((error) => setCheckoutError(error.message || 'No se pudo consultar el turno de caja.'))
      .finally(() => setCashShiftLoading(false))
  }, [])

  const items = useMemo(() => products
    .filter((product) => cart[product.id])
    .map((product) => ({ ...product, price: product.salePrice, quantity: cart[product.id], subtotal: product.salePrice * cart[product.id] })), [products, cart])
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)

  const changeQuantity = (productId, delta) => {
    const product = products.find((item) => item.id === productId)
    if (delta > 0 && product && (cart[productId] || 0) >= product.stock) {
      setCheckoutError(`Stock máximo disponible de ${product.name}: ${product.stock}.`)
      return
    }
    setCart((current) => {
      const nextQuantity = (current[productId] || 0) + delta
      if (nextQuantity <= 0) {
        const next = { ...current }
        delete next[productId]
        return next
      }
      return { ...current, [productId]: nextQuantity }
    })
  }

  const completeSale = async () => {
    if (!items.length) return
    let shift
    try {
      const current = await loadCurrentCashShift()
      shift = current.shift
    } catch (error) {
      setCheckoutError(error.message || 'No se pudo consultar el turno de caja.')
      return
    }
    if (!shift) {
      setCheckoutError('Abre el turno de caja antes de registrar ventas.')
      return
    }
    setSelling(true)
    const stockResult = await sellInventoryProducts(
      items.map((item) => ({ id: item.id, quantity: item.quantity })),
      { shiftId: shift.id, total, method }
    )
    if (!stockResult.ok) {
      setCheckoutError(stockResult.message)
      setSelling(false)
      await refreshProducts()
      return
    }
    const now = new Date()
    const sale = {
      receiptId: `IF-${now.getTime().toString().slice(-8)}`,
      shiftId: shift.id,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
      items,
      total,
      method,
    }
    try {
      appendPosSale(sale)
    } catch {
      setCheckoutError('El stock se descontó, pero no se pudo guardar el comprobante local. Anota el número de venta y avisa al administrador.')
      setSelling(false)
      await refreshProducts()
      return
    }
    setReceipt(sale)
    setCart({})
    setCheckoutError('')
    setSelling(false)
    await refreshProducts()
    onToast('Venta registrada. Comprobante interno generado.')
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <section className="cash-receipt rounded-xl border border-line bg-surface p-6 sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent print:hidden"><ReceiptText className="h-6 w-6" /></span>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-accent">IronForge Gym</p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase text-white">Comprobante de venta</h2>
            <p className="mt-2 text-sm text-muted">N.º {receipt.receiptId}</p>
          </div>
          <div className="my-6 border-y border-dashed border-line py-4 text-sm">
            <div className="mb-3 flex justify-between text-muted"><span>Fecha</span><span>{receipt.date} · {receipt.time}</span></div>
            {receipt.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 py-2 text-white">
                <span>{item.quantity} × {item.name}</span><span>{formatMoney(item.subtotal)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold text-white"><span>Total</span><span>{formatMoney(receipt.total)}</span></div>
            <div className="mt-2 flex justify-between text-muted"><span>Pago</span><span>{PAYMENT_METHODS.find((item) => item.id === receipt.method)?.label}</span></div>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted">Comprobante interno de venta. No válido como factura fiscal.</p>
        </section>
        <div className="flex flex-wrap justify-center gap-3 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-hover"><Printer className="h-4 w-4" /> Imprimir comprobante</button>
          <button type="button" onClick={() => setReceipt(null)} className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-muted hover:text-white">Nueva venta</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">Punto de venta</h2>
        <p className="mt-1 text-xs text-muted">Productos de mostrador · Los comprobantes son internos, no facturas fiscales.</p>
      </div>
      {!cashShiftLoading && !hasCashShift && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-200">Debes abrir un turno de caja antes de registrar ventas.</p>
          <button type="button" onClick={onOpenCashControl} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"><Banknote className="h-4 w-4" /> Ir a Caja</button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Productos</h3>
          {inventoryError && <p role="alert" className="mb-3 text-sm text-red-300">{inventoryError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
                <div>
                  <h4 className="font-semibold text-white">{product.name}</h4>
                  <p className="mt-1 text-xs text-muted">{product.description}</p>
                  <p className="mt-3 font-display text-lg font-bold text-volt">{formatMoney(product.salePrice)}</p>
                  <p className="mt-1 text-xs text-muted">Disponible: {product.stock}</p>
                </div>
                <button type="button" disabled={product.stock <= (cart[product.id] || 0)} onClick={() => changeQuantity(product.id, 1)} aria-label={`Añadir ${product.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-5 w-5" /></button>
              </article>
            ))}
            {!productsLoading && products.length === 0 && <p className="text-sm text-muted">No hay productos disponibles. Administra el catálogo en Gestión de Planes → Inventario POS.</p>}
            {productsLoading && <p className="text-sm text-muted">Cargando productos...</p>}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold uppercase text-white"><ShoppingBag className="h-4 w-4 text-accent" /> Venta actual</h3>
          {items.length ? (
            <ul className="mt-4 divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{item.name}</p><p className="text-xs text-muted">{formatMoney(item.subtotal)}</p></div>
                  <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Quitar una unidad de ${item.name}`} className="rounded-md border border-line p-1.5 text-muted hover:text-white"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-sm text-white">{item.quantity}</span>
                  <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Añadir una unidad de ${item.name}`} className="rounded-md border border-line p-1.5 text-muted hover:text-white"><Plus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setCart((current) => { const next = { ...current }; delete next[item.id]; return next })} aria-label={`Eliminar ${item.name}`} className="rounded-md p-1.5 text-muted hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 border-y border-line py-6 text-center text-sm text-muted">Agrega productos para iniciar.</p>}
          <div className="mt-4 flex justify-between border-t border-line pt-4 font-bold text-white"><span>Total</span><span>{formatMoney(total)}</span></div>
          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Método de pago</legend>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((payment) => (
                <button key={payment.id} type="button" aria-pressed={method === payment.id} onClick={() => setMethod(payment.id)} className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${method === payment.id ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-white'}`}>{payment.label}</button>
              ))}
            </div>
          </fieldset>
          {checkoutError && <p role="alert" className="mt-3 text-xs text-red-300">{checkoutError}</p>}
          <button type="button" disabled={!items.length || selling} onClick={completeSale} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"><ReceiptText className="h-4 w-4" /> {selling ? 'Procesando venta...' : 'Cobrar y emitir comprobante'}</button>
        </aside>
      </div>
    </div>
  )
}
