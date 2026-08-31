// Datos locales del Módulo 6 (panel de recepción / administración).
// Se usan como fallback cuando Supabase no está configurado o la consulta falla,
// conservando la estética de datos del Módulo 1.

export const PLAN_NAMES = {
  basico: 'Plan Básico',
  completo: 'Plan Completo',
  premium: 'Plan Premium',
}

export const PLAN_LIST = [
  { code: 'basico', name: 'Plan Básico' },
  { code: 'completo', name: 'Plan Completo' },
  { code: 'premium', name: 'Plan Premium' },
]

export const METODOS_PAGO = [
  { key: 'qr', label: 'QR' },
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta', label: 'Tarjeta' },
]

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Fecha local formateada (YYYY-MM-DD) desplazada N días desde hoy.
export function shiftDate(days, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return fmt(d)
}

// Fecha de hoy formateada (YYYY-MM-DD).
export function todayISO() {
  return fmt(new Date())
}

function avatar(id) {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(id)}`
}

function nowTime() {
  return new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
}

export const seedClients = [
  {
    id: 'cli-1001',
    nombre: 'Carlos',
    apellido: 'Pérez',
    ci: '7054321',
    telefono: '+591 71234567',
    plan: 'completo',
    planNombre: PLAN_NAMES.completo,
    fechaInicio: shiftDate(-45),
    fechaVencimiento: shiftDate(18),
    photo: avatar('cli-1001'),
  },
  {
    id: 'cli-1002',
    nombre: 'María',
    apellido: 'López',
    ci: '6890123',
    telefono: '+591 72345678',
    plan: 'premium',
    planNombre: PLAN_NAMES.premium,
    fechaInicio: shiftDate(-28),
    fechaVencimiento: shiftDate(3),
    photo: avatar('cli-1002'),
  },
  {
    id: 'cli-1003',
    nombre: 'Jorge',
    apellido: 'Ramírez',
    ci: '6543210',
    telefono: '+591 73456789',
    plan: 'basico',
    planNombre: PLAN_NAMES.basico,
    fechaInicio: shiftDate(-40),
    fechaVencimiento: shiftDate(-2),
    photo: avatar('cli-1003'),
  },
  {
    id: 'cli-1004',
    nombre: 'Ana',
    apellido: 'Torres',
    ci: '6234567',
    telefono: '+591 74567890',
    plan: 'completo',
    planNombre: PLAN_NAMES.completo,
    fechaInicio: shiftDate(-60),
    fechaVencimiento: shiftDate(45),
    photo: avatar('cli-1004'),
  },
  {
    id: 'cli-1005',
    nombre: 'Luis',
    apellido: 'Fernández',
    ci: '5876543',
    telefono: '+591 75678901',
    plan: 'premium',
    planNombre: PLAN_NAMES.premium,
    fechaInicio: shiftDate(-12),
    fechaVencimiento: shiftDate(4),
    photo: avatar('cli-1005'),
  },
  {
    id: 'cli-1006',
    nombre: 'Romina',
    apellido: 'Gutiérrez',
    ci: '5567890',
    telefono: '+591 76789012',
    plan: 'basico',
    planNombre: PLAN_NAMES.basico,
    fechaInicio: shiftDate(-35),
    fechaVencimiento: shiftDate(-8),
    photo: avatar('cli-1006'),
  },
  {
    id: 'cli-1007',
    nombre: 'Diego',
    apellido: 'Vargas',
    ci: '5301234',
    telefono: '+591 77890123',
    plan: 'completo',
    planNombre: PLAN_NAMES.completo,
    fechaInicio: shiftDate(-20),
    fechaVencimiento: shiftDate(25),
    photo: avatar('cli-1007'),
  },
]

export const seedAttendance = [
  {
    id: 'att-seed-1',
    fecha: todayISO(),
    hora: nowTime(),
    plan: PLAN_NAMES.completo,
    client: { id: 'cli-1001', nombre: 'Carlos', apellido: 'Pérez', ci: '7054321' },
  },
  {
    id: 'att-seed-2',
    fecha: todayISO(),
    hora: nowTime(),
    plan: PLAN_NAMES.premium,
    client: { id: 'cli-1002', nombre: 'María', apellido: 'López', ci: '6890123' },
  },
]