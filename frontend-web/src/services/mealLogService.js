import { supabase } from '../lib/supabase.js'

// Diario de comidas del socio activo. Cada análisis del escáner se guarda
// aquí; el usuario_id lo pone Supabase a través de la policy RLS.

export async function saveMealLog(analysis, { imagenUrl = null } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión no hay diario al que escribir: el análisis sigue siendo válido,
  // así que el llamador decide si avisa o guarda el resultado en memoria.
  if (!user) return { saved: false, reason: 'sin_sesion' }

  const { data, error } = await supabase
    .from('meal_logs')
    .insert({
      user_id: user.id,
      alimento: analysis.alimento,
      descripcion: analysis.descripcion ?? null,
      calorias: analysis.calorias,
      proteinas_g: analysis.proteinas_g,
      carbohidratos_g: analysis.carbohidratos_g,
      grasas_g: analysis.grasas_g,
      es_comida: analysis.es_comida,
      imagen_url: imagenUrl,
    })
    .select()
    .single()

  if (error) throw error
  return { saved: true, entry: data }
}

export async function getMealLogs({ limit = 50 } = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('registrado_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}
