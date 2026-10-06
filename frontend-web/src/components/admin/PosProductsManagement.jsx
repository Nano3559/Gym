import { useState } from 'react'
import { PackagePlus, Pencil, Power, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'

const EMPTY_PRODUCT = { nombre: '', costoCompra: '', precio: '', stock: '0', stockMinimo: '0', activo: true }

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('es-BO')} Bs.`
}

export default function PosProductsManagement({ products, onSaveProduct, onDeleteProduct, onToast }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const openForm = (product = null) => {
    setEditing(product)
    setForm(product ? {
      ...product,
      costoCompra: String(product.costo_compra ?? product.costoCompra ?? 0),
      stockMinimo: String(product.stock_minimo ?? product.stockMinimo ?? 0),
      precio: String(product.precio),
      stock: String(product.stock || 0),
    } : { ...EMPTY_PRODUCT })
    setFormOpen(true)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!form.nombre.trim() || !Number.isFinite(Number(form.precio)) || Number(form.precio) <= 0
      || !Number.isFinite(Number(form.costoCompra)) || Number(form.costoCompra) < 0
      || !Number.isInteger(Number(form.stock)) || Number(form.stock) < 0
      || !Number.isInteger(Number(form.stockMinimo)) || Number(form.stockMinimo) < 0) {
      onToast('Revisa el nombre, costo, precio y stock del producto.', 'error')
      return
    }
    setSaving(true)
    try {
      await onSaveProduct({ ...form, id: editing?.id, precio: Number(form.precio) })
      onToast(editing ? 'Producto actualizado.' : 'Producto agregado al catálogo.')
      setFormOpen(false)
    } catch (error) {
      onToast(`No se pudo guardar el producto: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Catálogo de productos POS
          </h2>
          <p className="mt-1 text-xs text-muted">
            Configura costos, precios y existencias; el stock se descuenta al registrar ventas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white transition hover:bg-accent/80"
        >
          <PackagePlus className="h-4 w-4" />
          Agregar producto
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-card/40 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Costo</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line/60">
                  <td className="px-4 py-3 font-semibold text-white">{product.nombre}</td>
                  <td className="px-4 py-3 text-muted">{formatMoney(product.costo_compra ?? product.costoCompra)}</td>
                  <td className="px-4 py-3 text-muted">{formatMoney(product.precio)}</td>
                  <td className="px-4 py-3 text-muted">{product.stock} <span className="text-xs">· mín. {product.stock_minimo ?? product.stockMinimo ?? 0}</span></td>
                  <td className={`px-4 py-3 font-semibold ${product.activo ? 'text-volt' : 'text-muted'}`}>
                    {product.activo ? 'Activo' : 'Inactivo'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openForm(product)}
                      aria-label={`Editar ${product.nombre}`}
                      className="mr-2 rounded-lg border border-line p-2 text-muted hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`¿Borrar "${product.nombre}"? Si ya tiene ventas se conservará el historial y se desactivará.`)) return
                        onDeleteProduct(product.id)
                          .then((result) => onToast(result?.deactivated
                            ? 'Producto desactivado para conservar su historial de ventas.'
                            : 'Producto borrado.'))
                          .catch((error) => onToast(`No se pudo borrar: ${error.message}`, 'error'))
                      }}
                      aria-label={`Borrar ${product.nombre}`}
                      className="ml-2 rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveProduct({ ...product, activo: !product.activo })
                          .then(() => onToast(product.activo ? 'Producto desactivado.' : 'Producto activado.'))
                          .catch((error) => onToast(`No se pudo actualizar el producto: ${error.message}`, 'error'))
                      }
                      aria-label={`${product.activo ? 'Desactivar' : 'Activar'} ${product.nombre}`}
                      className="rounded-lg border border-line p-2 text-muted hover:text-white"
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No hay productos. Agrega el primer producto del catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar producto' : 'Agregar producto'}
      >
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Nombre</span>
            <input
              value={form.nombre}
              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
              className="field"
              maxLength={100}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Costo de compra (Bs.)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.costoCompra}
              onChange={(event) => setForm((current) => ({ ...current, costoCompra: event.target.value }))}
              className="field"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Precio (Bs.)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.precio}
              onChange={(event) => setForm((current) => ({ ...current, precio: event.target.value }))}
              className="field"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Stock
              <input type="number" min="0" step="1" value={form.stock}
                onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
                className="field mt-1.5" required />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Stock mínimo
              <input type="number" min="0" step="1" value={form.stockMinimo}
                onChange={(event) => setForm((current) => ({ ...current, stockMinimo: event.target.value }))}
                className="field mt-1.5" required />
            </label>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={Boolean(form.activo)}
                onChange={(event) => setForm((current) => ({ ...current, activo: event.target.checked }))}
              />
              Disponible para ventas
            </label>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent/80 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar producto'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
