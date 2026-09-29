import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { plans as seedPlans } from '../data/gymData'

const PlansContext = createContext(null)

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
    planType: p.planType || p.plan_type || 'standard',
    startsAt: p.startsAt || p.starts_at || '',
    endsAt: p.endsAt || p.ends_at || '',
    features: Array.isArray(p.features)
      ? p.features
      : Array.isArray(p.caracteristicas) ? p.caracteristicas : [],
    highlighted: Boolean(p.highlighted),
    cta: p.cta || 'Elegir este plan',
    active: p.active !== false,
  }
}

export function PlansProvider({ children }) {
  const [plans, setPlans] = useState(() => seedPlans.map(normalize))

  const loadRemote = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data, error } = await supabase.from('plans').select('*')
      if (error) throw error
      if (Array.isArray(data) && data.length) {
        setPlans(data.map((p) => normalize({ ...p, id: p.codigo || p.id, name: p.nombre })))
      }
    } catch {
      // Fallback: se conserva el catálogo local.
    }
  }, [])

  useEffect(() => {
    // Carga inicial de planes desde Supabase (sincronización con sistema externo).
    // oxlint-disable-next-line react/set-state-in-effect
    loadRemote()
  }, [loadRemote])

  // Persistencia best-effort; ante cualquier error se conserva el estado local.
  const persist = useCallback(async (plan) => {
    if (!isSupabaseConfigured || !supabase || !plan.id) return
    const { error } = await supabase.from('plans').upsert(
      {
        codigo: plan.id,
        nombre: plan.name,
        precio: plan.price,
        descripcion: plan.description || plan.tagline,
        duracion_dias: plan.durationDays,
        caracteristicas: plan.features,
        activo: plan.active,
        plan_type: plan.planType,
        starts_at: plan.startsAt || null,
        ends_at: plan.endsAt || null,
      },
      { onConflict: 'codigo' }
    )
    if (error) throw error
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
      activePlans: plans.filter((plan) => {
        const today = new Date().toISOString().slice(0, 10)
        return plan.active && (!plan.startsAt || plan.startsAt <= today) && (!plan.endsAt || plan.endsAt >= today)
      }),
      savePlan,
      togglePlan,
    }),
    [plans, savePlan, togglePlan]
  )

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- hook del contexto de planes
export function usePlans() {
  const ctx = useContext(PlansContext)
  if (!ctx) throw new Error('usePlans debe usarse dentro de <PlansProvider>')
  return ctx
}