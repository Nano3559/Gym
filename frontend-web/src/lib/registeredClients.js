import { PLAN_NAMES, shiftDate, todayISO } from '../data/adminData'

const STORAGE_KEY = 'gym_registered_clients'

export function getRegisteredClients() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Almacenamiento no disponible; el registro solo queda en memoria.
  }
}

export function saveRegisteredClient(client) {
  const list = getRegisteredClients()
  const ci = String(client.ci || '').trim()
  const email = String(client.email || '').trim().toLowerCase()
  const dupIndex = list.findIndex(
    (c) => (ci && String(c.ci || '').trim() === ci) || (email && String(c.email || '').trim().toLowerCase() === email)
  )
  if (dupIndex >= 0) {
    list[dupIndex] = { ...list[dupIndex], ...client }
  } else {
    list.push(client)
  }
  persist(list)
  return list
}

export function removeRegisteredClient(ci) {
  persist(getRegisteredClients().filter((c) => String(c.ci || '').trim() !== String(ci || '').trim()))
}

const displayToCode = Object.fromEntries(
  Object.entries(PLAN_NAMES).map(([code, name]) => [name, code])
)

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/)
  const nombre = parts[0] || ''
  const apellido = parts.slice(1).join(' ') || ''
  return { nombre, apellido }
}

export function toClientShape(rc) {
  const { nombre, apellido } = splitName(rc.name)
  const planNombre = rc.plan || PLAN_NAMES.basico
  return {
    id: rc.id || `cli-${rc.ci || Date.now()}`,
    nombre,
    apellido,
    ci: rc.ci || '',
    telefono: rc.phone || '',
    plan: displayToCode[planNombre] || '',
    planNombre,
    fechaInicio: rc.startDate || todayISO(),
    fechaVencimiento: rc.endDate || shiftDate(30),
    status: rc.status || 'Activa',
    photo: null,
  }
}

export function registeredClientFromForm(form) {
  return {
    id: `cli-${form.ci}`,
    name: `${form.nombre} ${form.apellido}`.trim(),
    email: form.correo,
    ci: form.ci,
    phone: form.telefono,
    plan: PLAN_NAMES[form.plan] || 'Plan Básico',
    startDate: todayISO(),
    endDate: shiftDate(30),
    status: 'Activa',
  }
}

export function registeredClientFromUser(user, plan) {
  const dur = Number(plan?.durationDays ?? 30)
  const nombre = user?.nombre || user?.name || ''
  const apellido = user?.apellido || ''
  return {
    id: user?.id || `cli-${user?.ci || Date.now()}`,
    name: `${nombre} ${apellido}`.trim() || 'Cliente',
    email: user?.email || user?.correo || '',
    ci: user?.ci || '',
    phone: user?.telefono || user?.phone || '',
    plan: plan?.name || 'Plan Básico',
    startDate: todayISO(),
    endDate: shiftDate(dur),
    status: 'Activa',
  }
}