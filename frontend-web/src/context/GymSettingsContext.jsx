import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { brand as defaultBrand } from '../data/gymData'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const STORAGE_KEY = 'ironforge-gym-settings'
const DEFAULT_TERMS = 'Al registrarte aceptas los términos del servicio y las políticas de tratamiento de datos del gimnasio.'
const GymSettingsContext = createContext(null)

function toUiSettings(row = {}) {
  return {
    ...defaultBrand,
    ...row,
    name: row.gym_name || row.name || defaultBrand.name,
    legalTerms: row.legal_terms || row.legalTerms || DEFAULT_TERMS,
    social: defaultBrand.social,
  }
}

function readLocalSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function GymSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => toUiSettings(readLocalSettings() || {}))
  const [loading, setLoading] = useState(false)
  const [localOnly, setLocalOnly] = useState(!isSupabaseConfigured)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('gym_settings').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      if (data) setSettings(toUiSettings(data))
      setLocalOnly(false)
    } catch {
      setLocalOnly(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
  }, [refresh])

  const saveSettings = useCallback(async (next) => {
    const normalized = toUiSettings(next)
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('gym_settings').update({
        gym_name: normalized.name,
        address: normalized.address,
        phone: normalized.phone,
        whatsapp: normalized.whatsapp,
        email: normalized.email,
        hours: normalized.hours,
        legal_terms: normalized.legalTerms,
        updated_at: new Date().toISOString(),
      }).eq('id', 1).select('*').single()
      if (error) return { ok: false, message: error.message }
      setSettings(toUiSettings(data))
      setLocalOnly(false)
      return { ok: true, local: false }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
      setSettings(normalized)
      setLocalOnly(true)
      return { ok: true, local: true }
    } catch {
      return { ok: false, message: 'No se pudo guardar la configuración en este navegador.' }
    }
  }, [])

  const value = useMemo(() => ({ settings, loading, localOnly, refresh, saveSettings }), [settings, loading, localOnly, refresh, saveSettings])
  return <GymSettingsContext.Provider value={value}>{children}</GymSettingsContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- hook de acceso al provider
export function useGymSettings() {
  const context = useContext(GymSettingsContext)
  if (!context) throw new Error('useGymSettings debe usarse dentro de GymSettingsProvider')
  return context
}
