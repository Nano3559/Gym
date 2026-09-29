import { useEffect, useState } from 'react'
import { Archive, Edit3, PackagePlus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { deleteInventoryProduct, loadInventoryProducts, saveInventoryProduct } from '../../services/inventoryService'

const EMPTY_PRODUCT = { name: '', description: '', costPrice: '', salePrice: '', stock: '', active: true }
const money = (amount) => `${Number(amount).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.`

export default function InventoryManagement({ onToast }) {
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [deleting, setDeleting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isLocal, setIsLocal] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await loadInventoryProducts({ includeInactive: true })
      setProducts(result.products)
      setIsLocal(result.local)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el inventario.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [])

  const openNew = () => {
    setForm(EMPTY_PRODUCT)
    setEditing('new')
  }

  const openEdit = (product) => {
    setForm({ ...product, costPrice: String(product.costPrice), salePrice: String(product.salePrice), stock: String(product.stock) })
    setEditing(product)
  }

  const closeEdit = () => {
    setEditing(null)
    setForm(EMPTY_PRODUCT)
  }

  const submit = async (event) => {
    event.preventDefault()
    const values = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      costPrice: Number(form.costPrice),
      salePrice: Number(form.salePrice),
      stock: Number(form.stock),
      active: Boolean(form.active),
      id: editing === 'new' ? undefined : form.id,
    }
    if (!values.name || values.costPrice < 0 || values.salePrice < 0 || !Number.isInteger(values.stock) || values.stock < 0) {
      setError('Completa el nombre, costos/precio válidos y un stock entero igual o mayor que cero.')
      return
    }
    setSaving(true)
    try {
      const result = await saveInventoryProduct(values)
      setProducts((current) => editing === 'new'
        ? [...current, result.product].sort((a, b) => a.name.localeCompare(b.name))
        : current.map((item) => item.id === result.product.id ? result.product : item))
      setIsLocal(result.local)
      onToast?.(result.local ? 'Producto guardado localmente.' : 'Producto guardado en inventario.')
      closeEdit()
      setError('')
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      const result = await deleteInventoryProduct(deleting.id)
      setProducts((current) => current.filter((item) => item.id !== deleting.id))
      setIsLocal(result.local)
      onToast?.('Producto eliminado del inventario.')
      setDeleting(null)
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar el producto.')
      setDeleting(null)
    }
  }

  const field = 'field mt-1.5'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-white"><Archive className="h-5 w-5 text-accent" /> Inventario POS</h2>
          <p className="mt-1 text-xs text-muted">Gestiona costos de compra, precios de venta y existencias de productos.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} disabled={loading} aria-label="Actualizar inventario" className="rounded-xl border border-line p-2.5 text-muted hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover"><PackagePlus className="h-4 w-4" /> Nuevo producto</button>
        </div>
      </div>

      {isLocal && <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-200">Inventario guardado localmente en este navegador. Aplica la migración Supabase para sincronizarlo entre dispositivos.</p>}
      {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead><tr className="border-b border-line bg-card/40 text-xs uppercase tracking-wide text-muted"><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Costo compra</th><th className="px-4 py-3">Precio venta</th><th className="px-4 py-3">Margen unitario</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line/60">
                  <td className="px-4 py-3"><p className="font-semibold text-white">{product.name}</p><p className="mt-0.5 text-xs text-muted">{product.description || '—'}</p></td>
                  <td className="px-4 py-3 text-muted">{money(product.costPrice)}</td>
                  <td className="px-4 py-3 font-semibold text-volt">{money(product.salePrice)}</td>
                  <td className="px-4 py-3 text-white">{money(product.salePrice - product.costPrice)}</td>
                  <td className={`px-4 py-3 font-bold ${product.stock <= 5 ? 'text-amber-300' : 'text-white'}`}>{product.stock}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${product.active ? 'border-volt/30 bg-volt/10 text-volt' : 'border-line text-muted'}`}>{product.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(product)} aria-label={`Editar ${product.name}`} className="rounded-lg border border-line p-2 text-muted hover:border-accent hover:text-accent"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => setDeleting(product)} aria-label={`Eliminar ${product.name}`} className="rounded-lg border border-line p-2 text-muted hover:border-red-400/50 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
              {!loading && products.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No hay productos. Crea el primero para habilitar el catálogo del POS.</td></tr>}
              {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">Cargando inventario...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={Boolean(editing)} onClose={closeEdit} title={editing === 'new' ? 'Nuevo producto' : 'Editar producto'}>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Nombre<input className={field} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Descripción<input className={field} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Costo de compra<input className={field} type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm((current) => ({ ...current, costPrice: event.target.value }))} required /></label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Precio de venta<input className={field} type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => setForm((current) => ({ ...current, salePrice: event.target.value }))} required /></label>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Stock inicial / disponible<input className={field} type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} required /></label>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Disponible en el POS</label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeEdit} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-white"><X className="h-4 w-4" /> Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Guardar producto'}</button>
          </div>
        </form>
      </Modal>

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Eliminar producto">
          <div className="space-y-5">
            <p className="text-sm text-muted">Se eliminará <strong className="text-white">{deleting.name}</strong> del catálogo de inventario.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDeleting(null)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-white">Cancelar</button><button type="button" onClick={confirmDelete} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-400"><Trash2 className="h-4 w-4" /> Eliminar</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
