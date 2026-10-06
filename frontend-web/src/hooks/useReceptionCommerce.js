import { useCallback, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { todayISO } from '../data/adminData'

const STORAGE_KEYS = {
  products: 'gym_pos_products',
  sales: 'gym_pos_sales',
  expenses: 'gym_reception_expenses',
  cash: 'gym_reception_cash_sessions',
}

function readLocal(key) {
  const raw = window.localStorage.getItem(key)
  if (!raw) return []
  const value = JSON.parse(raw)
  if (!Array.isArray(value)) throw new Error('Los datos locales del panel tienen un formato inválido.')
  return value
}

function writeLocal(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getTodayBounds() {
  const today = todayISO()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, start: start.toISOString(), end: tomorrow.toISOString() }
}

export default function useReceptionCommerce() {
  const [products, setProducts] = useState([])
  const [incomeToday, setIncomeToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cashSession, setCashSession] = useState(null)
  const [cashSessions, setCashSessions] = useState([])
  const [expenses, setExpenses] = useState([])
  const [sales, setSales] = useState([])

  const refresh = useCallback(async () => {
    try {
      const { start } = getTodayBounds()
      const { data: sessionData, error: sessionError } =
        isSupabaseConfigured && supabase
          ? await supabase.auth.getSession()
          : { data: { session: null }, error: null }
      if (sessionError) throw sessionError

      if (sessionData?.session && supabase) {
        const userId = sessionData.session.user.id
        const sessionsResult = await supabase
          .from('cash_register_sessions')
          .select('*')
          .order('inicio', { ascending: false })
          .limit(100)
        if (sessionsResult.error) throw sessionsResult.error
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nombre, apellido')
        if (profilesError) throw profilesError
        const staffById = new Map((profiles || []).map((profile) => [
          profile.id,
          `${profile.nombre} ${profile.apellido}`.trim(),
        ]))
        const ownOpenSession = (sessionsResult.data || []).find(
          (session) => session.staff_id === userId && !session.cierre
        )
        const activityStart = ownOpenSession?.inicio || start
        const [productsResult, salesResult, expensesResult, paymentsResult] = await Promise.all([
          supabase
            .from('pos_products')
            .select('id, nombre, costo_compra, precio, stock, stock_minimo, activo')
            .order('nombre'),
          supabase
            .from('pos_sales')
            .select('id, receipt_number, metodo_pago, total, created_at, cashier_id')
            .eq('cashier_id', userId)
            .gte('created_at', activityStart),
          supabase
            .from('operating_expenses')
            .select('*')
            .eq('created_by', userId)
            .gte('created_at', activityStart),
          supabase
            .from('payments')
            .select('monto, metodo_pago, estado_pago, created_at')
            .eq('cashier_id', userId)
            .eq('estado_pago', 'completado')
            .gte('created_at', activityStart),
        ])
        if (productsResult.error) throw productsResult.error
        if (salesResult.error) throw salesResult.error
        if (expensesResult.error) throw expensesResult.error
        if (paymentsResult.error) throw paymentsResult.error
        setProducts(productsResult.data || [])
        setSales([
          ...(salesResult.data || []),
          ...(paymentsResult.data || [])
            .filter((payment) => payment.metodo_pago === 'efectivo')
            .map((payment) => ({
              total: payment.monto,
              metodo_pago: payment.metodo_pago,
              created_at: payment.created_at,
              tipo: 'Membresía',
            })),
        ])
        setIncomeToday(
          (salesResult.data || []).reduce((total, sale) => total + Number(sale.total), 0)
          + (paymentsResult.data || []).reduce((total, payment) => total + Number(payment.monto), 0)
        )
        setCashSessions((sessionsResult.data || []).map((session) => ({
          ...session,
          staffName: staffById.get(session.staff_id) || session.staff_id,
        })))
        setCashSession(ownOpenSession || null)
        setExpenses(expensesResult.data || [])
      } else {
        const localProducts = readLocal(STORAGE_KEYS.products)
        const localSales = readLocal(STORAGE_KEYS.sales)
        const localSessions = readLocal(STORAGE_KEYS.cash)
        const localExpenses = readLocal(STORAGE_KEYS.expenses)
        const ownOpenSession = localSessions.find((session) => !session.closedAt)
        const activityStart = ownOpenSession ? new Date(ownOpenSession.inicio).getTime() : new Date(start).getTime()
        setProducts(localProducts)
        setSales(localSales.filter((sale) => sale.createdAt && new Date(sale.createdAt).getTime() >= activityStart))
        setIncomeToday(
          localSales
            .filter((sale) => sale.createdAt && new Date(sale.createdAt).getTime() >= activityStart)
            .reduce((total, sale) => total + Number(sale.total || 0), 0)
        )
        setCashSessions(localSessions)
        setCashSession(ownOpenSession || null)
        setExpenses(localExpenses.filter((item) => item.createdAt && new Date(item.createdAt).getTime() >= activityStart))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const saveProduct = useCallback(async (product) => {
    const { data: sessionData, error: sessionError } =
      isSupabaseConfigured && supabase
        ? await supabase.auth.getSession()
        : { data: { session: null }, error: null }
    if (sessionError) throw sessionError

    if (sessionData?.session && supabase) {
      const payload = {
        nombre: product.nombre.trim(),
        costo_compra: Number(product.costoCompra ?? product.costo_compra ?? 0),
        precio: Number(product.precio),
        stock: Number(product.stock || 0),
        stock_minimo: Number(product.stockMinimo ?? product.stock_minimo ?? 0),
        activo: Boolean(product.activo),
      }
      const result = product.id
        ? await supabase.from('pos_products').update(payload).eq('id', product.id).select().single()
        : await supabase.from('pos_products').insert(payload).select().single()
      if (result.error) throw result.error
      setProducts((current) =>
        product.id
          ? current.map((item) => (item.id === product.id ? result.data : item))
          : [...current, result.data].sort((a, b) => a.nombre.localeCompare(b.nombre))
      )
      return result.data
    }

    const current = readLocal(STORAGE_KEYS.products)
    const saved = {
      ...product,
      nombre: product.nombre.trim(),
      costoCompra: Number(product.costoCompra ?? product.costo_compra ?? 0),
      precio: Number(product.precio),
      stock: Number(product.stock || 0),
      stockMinimo: Number(product.stockMinimo ?? product.stock_minimo ?? 0),
    }
    const next = product.id
      ? current.map((item) => (item.id === product.id ? saved : item))
      : [...current, { ...saved, id: makeId() }]
    writeLocal(STORAGE_KEYS.products, next)
    setProducts(next)
    return saved
  }, [])

  const deleteProduct = useCallback(async (productId) => {
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData?.session) {
        const { count, error: salesError } = await supabase
          .from('pos_sale_items')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
        if (salesError) throw salesError
        if (count) {
          const { error } = await supabase
            .from('pos_products')
            .update({ activo: false })
            .eq('id', productId)
          if (error) throw error
          setProducts((current) => current.map((product) =>
            product.id === productId ? { ...product, activo: false } : product
          ))
          return { deactivated: true }
        }
        const { error } = await supabase.from('pos_products').delete().eq('id', productId)
        if (error) throw error
      } else {
        const next = readLocal(STORAGE_KEYS.products).filter((product) => product.id !== productId)
        writeLocal(STORAGE_KEYS.products, next)
        setProducts(next)
        return { deactivated: false }
      }
    } else {
      const next = readLocal(STORAGE_KEYS.products).filter((product) => product.id !== productId)
      writeLocal(STORAGE_KEYS.products, next)
      setProducts(next)
      return { deactivated: false }
    }
    setProducts((current) => current.filter((product) => product.id !== productId))
    return { deactivated: false }
  }, [])

  const registerSale = useCallback(async ({ items, metodoPago }) => {
    const { data: sessionData, error: sessionError } =
      isSupabaseConfigured && supabase
        ? await supabase.auth.getSession()
        : { data: { session: null }, error: null }
    if (sessionError) throw sessionError

    if (sessionData?.session && supabase) {
      const { data, error } = await supabase.rpc('register_pos_sale', {
        p_payment_method: metodoPago,
        p_items: items.map(({ productId, quantity }) => ({
          product_id: productId,
          quantity: Number(quantity),
        })),
      })
      if (error) throw error
      const sale = {
        ...data,
        items: items.map((item) => {
          const product = products.find((entry) => entry.id === item.productId)
          return {
            product_name: product?.nombre || item.nombre,
            unit_price: Number(product?.precio || 0),
            quantity: Number(item.quantity),
            line_total: Number(product?.precio || 0) * Number(item.quantity),
          }
        }),
        createdAt: data.created_at,
      }
      setIncomeToday((total) => total + Number(data.total))
      setSales((current) => [sale, ...current])
      setProducts((current) => current.map((product) => {
        const sold = items.filter((item) => item.productId === product.id)
          .reduce((total, item) => total + Number(item.quantity), 0)
        return sold ? { ...product, stock: Math.max(0, Number(product.stock) - sold) } : product
      }))
      return sale
    }

    if (!cashSession) throw new Error('Abre tu caja antes de registrar ventas.')
    const catalog = readLocal(STORAGE_KEYS.products)
    const saleItems = items.map(({ productId, quantity }) => {
      const product = catalog.find((entry) => entry.id === productId && entry.activo)
      if (!product) throw new Error('Uno de los productos seleccionados ya no está disponible.')
      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(product.stock || 0) < Number(quantity)) {
        throw new Error(`Stock insuficiente para ${product.nombre}.`)
      }
      return {
        productId,
        nombre: product.nombre,
        precio: Number(product.precio),
        cantidad: Number(quantity),
        subtotal: Number(product.precio) * Number(quantity),
      }
    })
    const sale = {
      id: makeId(),
      metodoPago,
      items: saleItems,
      total: saleItems.reduce((total, item) => total + item.subtotal, 0),
      createdAt: new Date().toISOString(),
    }
    writeLocal(STORAGE_KEYS.sales, [sale, ...readLocal(STORAGE_KEYS.sales)])
    setIncomeToday((total) => total + sale.total)
    setSales((current) => [sale, ...current])
    setProducts((current) => current.map((product) => {
      const sold = saleItems.find((item) => item.productId === product.id)
      return sold ? { ...product, stock: Number(product.stock || 0) - sold.cantidad } : product
    }))
    writeLocal(
      STORAGE_KEYS.products,
      catalog.map((product) => {
        const sold = saleItems.find((item) => item.productId === product.id)
        return sold ? { ...product, stock: Number(product.stock || 0) - sold.cantidad } : product
      })
    )
    return sale
  }, [products, cashSession])

  const registerExpense = useCallback(async (expense) => {
    const { data: sessionData, error: sessionError } =
      isSupabaseConfigured && supabase
        ? await supabase.auth.getSession()
        : { data: { session: null }, error: null }
    if (sessionError) throw sessionError

    const payload = {
      concepto: expense.concepto.trim(),
      categoria: expense.categoria,
      monto: Number(expense.monto),
      metodo_pago: expense.metodoPago || 'efectivo',
    }
    if (sessionData?.session && supabase) {
      const { data, error } = await supabase
        .from('operating_expenses')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      setExpenses((current) => [data, ...current])
      return data
    }
    const saved = { ...payload, id: makeId(), createdAt: new Date().toISOString() }
    writeLocal(STORAGE_KEYS.expenses, [saved, ...readLocal(STORAGE_KEYS.expenses)])
    setExpenses((current) => [saved, ...current])
    return saved
  }, [])

  const openCashRegister = useCallback(async (openingCash) => {
    const amount = Number(openingCash)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El fondo inicial no puede ser negativo.')
    const { data: sessionData, error: sessionError } =
      isSupabaseConfigured && supabase
        ? await supabase.auth.getSession()
        : { data: { session: null }, error: null }
    if (sessionError) throw sessionError
    let session
    if (sessionData?.session && supabase) {
      const { data, error } = await supabase.rpc('open_cash_register', { p_opening_cash: amount })
      if (error) throw error
      session = data
    } else {
      if (readLocal(STORAGE_KEYS.cash).some((entry) => !entry.closedAt)) {
        throw new Error('Ya tienes una caja abierta.')
      }
      session = { id: makeId(), apertura_efectivo: amount, inicio: new Date().toISOString() }
      writeLocal(STORAGE_KEYS.cash, [session, ...readLocal(STORAGE_KEYS.cash)])
    }
    setCashSession(session)
    setCashSessions((current) => [session, ...current])
    return session
  }, [])

  const closeCashRegister = useCallback(async ({ reportedCash, observation = '' }) => {
    if (!cashSession) throw new Error('No hay una caja abierta.')
    const amount = Number(reportedCash)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El efectivo contado no puede ser negativo.')
    const { data: sessionData, error: sessionError } =
      isSupabaseConfigured && supabase
        ? await supabase.auth.getSession()
        : { data: { session: null }, error: null }
    if (sessionError) throw sessionError
    let closed
    if (sessionData?.session && supabase) {
      const { data, error } = await supabase.rpc('close_cash_register', {
        p_session_id: cashSession.id,
        p_reported_cash: amount,
        p_observation: observation,
      })
      if (error) throw error
      closed = data
    } else {
      const openedAt = new Date(cashSession.inicio).getTime()
      const saleCash = sales
        .filter((sale) => sale.metodoPago === 'efectivo' && new Date(sale.createdAt).getTime() >= openedAt)
        .reduce((sum, sale) => sum + Number(sale.total), 0)
      const expenseCash = expenses
        .filter((expense) => (expense.metodo_pago || expense.metodoPago || 'efectivo') === 'efectivo'
          && new Date(expense.createdAt).getTime() >= openedAt)
        .reduce((sum, expense) => sum + Number(expense.monto), 0)
      const expected = Number(cashSession.apertura_efectivo) + saleCash - expenseCash
      closed = {
        ...cashSession,
        cierre: new Date().toISOString(),
        efectivo_esperado: expected,
        efectivo_declarado: amount,
        diferencia: amount - expected,
        observacion,
        closedAt: new Date().toISOString(),
      }
      const all = readLocal(STORAGE_KEYS.cash).map((entry) => entry.id === closed.id ? closed : entry)
      writeLocal(STORAGE_KEYS.cash, all)
    }
    setCashSession(null)
    setCashSessions((current) => current.map((entry) => entry.id === closed.id ? closed : entry))
    return closed
  }, [cashSession, sales, expenses])

  return {
    products,
    incomeToday,
    loading,
    cashSession,
    cashSessions,
    expenses,
    sales,
    refresh,
    saveProduct,
    deleteProduct,
    registerSale,
    registerExpense,
    openCashRegister,
    closeCashRegister,
  }
}
