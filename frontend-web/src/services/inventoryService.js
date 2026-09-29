import { supabase, isSupabaseConfigured } from '../lib/supabase'

const STORAGE_KEY = 'ironforge-inventory-products'

export const INITIAL_PRODUCTS = [
  { id: 'water', name: 'Agua', description: 'Botella 600 ml', costPrice: 2, salePrice: 5, stock: 40, active: true },
  { id: 'protein', name: 'Suplemento', description: 'Porción individual', costPrice: 15, salePrice: 25, stock: 20, active: true },
  { id: 'lock', name: 'Candado', description: 'Candado para casillero', costPrice: 20, salePrice: 35, stock: 12, active: true },
  { id: 'towel', name: 'Toalla', description: 'Toalla deportiva', costPrice: 26, salePrice: 45, stock: 10, active: true },
]

function readLocalProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved)) return saved
  } catch {
    // Inicializa el catálogo base si localStorage no está disponible.
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS))
  return INITIAL_PRODUCTS
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    costPrice: Number(row.cost_price) || 0,
    salePrice: Number(row.sale_price) || 0,
    stock: Number(row.stock) || 0,
    active: row.active !== false,
  }
}

export async function loadInventoryProducts({ includeInactive = false } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    const products = readLocalProducts()
    return { products: includeInactive ? products : products.filter((product) => product.active), local: true }
  }
  let query = supabase.from('inventory_products').select('id, name, description, cost_price, sale_price, stock, active').order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return { products: (data || []).map(fromRow), local: false }
}

export async function saveInventoryProduct(product) {
  if (!isSupabaseConfigured || !supabase) {
    const products = readLocalProducts()
    const saved = { ...product, id: product.id || `product-${Date.now()}`, active: product.active !== false }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(product.id
      ? products.map((item) => item.id === product.id ? saved : item)
      : [...products, saved]))
    return { product: saved, local: true }
  }

  const values = {
    name: product.name,
    description: product.description,
    cost_price: product.costPrice,
    sale_price: product.salePrice,
    stock: product.stock,
    active: product.active !== false,
  }
  const query = product.id
    ? supabase.from('inventory_products').update(values).eq('id', product.id)
    : supabase.from('inventory_products').insert(values)
  const { data, error } = await query.select('id, name, description, cost_price, sale_price, stock, active').single()
  if (error) throw error
  return { product: fromRow(data), local: false }
}

export async function deleteInventoryProduct(productId) {
  if (!isSupabaseConfigured || !supabase) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readLocalProducts().filter((product) => product.id !== productId)))
    return { local: true }
  }
  const { error } = await supabase.from('inventory_products').delete().eq('id', productId)
  if (error) throw error
  return { local: false }
}

export async function sellInventoryProducts(items, sale = {}) {
  if (!items.length) return { ok: false, message: 'Agrega productos antes de cobrar.' }
  if (!isSupabaseConfigured || !supabase) {
    const products = readLocalProducts()
    const requested = new Map(items.map((item) => [item.id, item.quantity]))
    const unavailable = products.find((product) => requested.has(product.id) && (!product.active || product.stock < requested.get(product.id)))
    if (unavailable) return { ok: false, message: `Stock insuficiente de ${unavailable.name}.` }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products.map((product) => requested.has(product.id)
      ? { ...product, stock: product.stock - requested.get(product.id) }
      : product)))
    return { ok: true, local: true }
  }
  const { error } = await supabase.rpc('sell_inventory_products', {
    p_items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
    p_shift_id: sale.shiftId,
    p_total: Number(sale.total),
    p_payment_method: sale.method,
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true, local: false }
}
