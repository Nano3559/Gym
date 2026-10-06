import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { plans as seedPlans } from '../data/gymData'

const PlansContext = createContext(null)
const LOCAL_PLANS_KEY = 'gym_admin_plans'

// Normaliza un plan de cualquier fuente a la forma canónica de la UI.
function normalize(p) {
  return {
    id: p.id,
    name: p.name || p.nombre || 'Plan',
    price: Number(p.price ?? p.precio ?? 0),
    currency: p.currency || 'Bs.',
    period: p.period || '/mes',
    tagline: p.tagline || p.description || p.descripcion || '',
    description: p.description || p.descripcion || p.tagline || '',
    durationDays: Number(p.durationDays ?? p.duracion_dias ?? 30),
    features: Array.isArray(p.features) ? p.features : Array.isArray(p.caracteristicas) ? p.caracteristicas : [],
    highlighted: Boolean(p.highlighted ?? p.destacado),
    cta: p.cta || 'Elegir este plan',
    active: p.active !== false,
    type: p.type || p.tipo || 'membresia',
    startDate: p.startDate || p.fecha_inicio || '',
    endDate: p.endDate || p.fecha_fin || '',
    quantityIncluded: Number(p.quantityIncluded ?? p.cantidad_incluida ?? 1),
  }
}

export function PlansProvider({ children }) {
  const [plans, setPlans] = useState(() => {
    const local = window.localStorage.getItem(LOCAL_PLANS_KEY)
    if (!local) return seedPlans.map(normalize)
    const overrides = JSON.parse(local).map(normalize)
    const byId = new Map(overrides.map((plan) => [plan.id, plan]))
    const merged = seedPlans.map(normalize).map((plan) => byId.get(plan.id) || plan)
    return [...merged, ...overrides.filter((plan) => !seedPlans.some((seed) => normalize(seed).id === plan.id))]
  })
  const [loadError, setLoadError] = useState('')

  const loadRemote = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData?.session) return
      const { data, error } = await supabase.from('plans').select('*')
      if (error) throw error
      setPlans((data || []).map((p) => normalize({
        ...p,
        id: p.codigo || p.id,
        name: p.nombre,
      })))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message)
    }
  }, [])

  useEffect(() => {
    // Carga inicial de planes desde Supabase (sincronización con sistema externo).
    // oxlint-disable-next-line react/set-state-in-effect
    loadRemote()
  }, [loadRemote])

  const persist = useCallback(async (plan) => {
    if (!plan.id) return
    const { data: sessionData, error: sessionError } =
      isSupabaseConfigured && supabase
        ? await supabase.auth.getSession()
        : { data: { session: null }, error: null }
    if (sessionError) throw sessionError
    if (sessionData?.session && supabase) {
      const { error } = await supabase.from('plans').upsert(
        {
          codigo: plan.id,
          nombre: plan.name,
          precio: plan.price,
          descripcion: plan.description || plan.tagline,
          duracion_dias: plan.durationDays,
          caracteristicas: plan.features,
          destacado: plan.highlighted,
          activo: plan.active,
          tipo: plan.type,
          fecha_inicio: plan.startDate || null,
          fecha_fin: plan.endDate || null,
          cantidad_incluida: plan.quantityIncluded,
        },
        { onConflict: 'codigo' }
      )
      if (error) throw error
    } else {
      const current = JSON.parse(window.localStorage.getItem(LOCAL_PLANS_KEY) || '[]')
      const next = current.some((item) => item.id === plan.id)
        ? current.map((item) => item.id === plan.id ? plan : item)
        : [...current, plan]
      window.localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(next))
    }
  }, [])

  const savePlan = useCallback(
    async (planData) => {
      const plan = normalize(planData)
      await persist(plan)
      setPlans((prev) => {
        const exists = prev.some((p) => p.id === plan.id)
        return exists ? prev.map((p) => (p.id === plan.id ? plan : p)) : [...prev, plan]
      })
      return plan
    },
    [persist]
  )

  const togglePlan = useCallback(
    async (id) => {
      const current = plans.find((p) => p.id === id)
      if (!current) return
      await savePlan({ ...current, active: !current.active })
    },
    [plans, savePlan]
  )

  const value = useMemo(
    () => ({
      plans,
      activePlans: plans.filter((p) => {
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        return p.active
          && (!p.startDate || p.startDate <= today)
          && (!p.endDate || p.endDate >= today)
      }),
      loadError,
      savePlan,
      togglePlan,
    }),
    [plans, loadError, savePlan, togglePlan]
  )

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- hook del contexto de planes
export function usePlans() {
  const ctx = useContext(PlansContext)
  if (!ctx) throw new Error('usePlans debe usarse dentro de <PlansProvider>')
  return ctx
}