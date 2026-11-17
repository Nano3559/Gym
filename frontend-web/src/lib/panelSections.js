// Matriz centralizada de secciones por rol.
// Devuelve la lista de secciones activas y el título/subtítulo correspondiente.
// Función pura: no importa React, no toca Supabase.

export const PANEL_SECTIONS = {
  // Estructura: { key, label, icon, adminOnly, receptionOnly, trainerOnly }
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    adminOnly: false,
    receptionOnly: false,
    trainerOnly: false,
  },
  attendance: {
    key: 'attendance',
    label: 'Control de Asistencia',
    icon: 'Clock3',
    // Visible para TODOS los roles: admin, recepción y entrenador.
    // El panel original mostraba Asistencia tanto para admin como para non-admin.
    adminOnly: false,
    receptionOnly: false,
    trainerOnly: false,
  },
  clients: {
    key: 'clients',
    label: 'Gestión de Clientes',
    icon: 'Users',
    // Admin y recepción pueden ver; entrenador no.
    adminOnly: true,
    receptionOnly: true,
    trainerOnly: false,
  },
  cash: {
    key: 'cash',
    label: 'Caja',
    icon: 'Wallet',
    // Admin y recepción pueden ver; entrenador no.
    adminOnly: true,
    receptionOnly: true,
    trainerOnly: false,
  },
  products: {
    key: 'products',
    label: 'POS / Productos',
    icon: 'Package',
    // Solo admin puede ver y usar el catálogo de productos.
    // Recepción tiene acceso al POS operativo por el tab 'cash'.
    // Entrenador no tiene acceso.
    adminOnly: true,
    receptionOnly: false,
    trainerOnly: false,
  },
  reports: {
    key: 'reports',
    label: 'Reportes',
    icon: 'FileBarChart',
    // Solo admin.
    adminOnly: true,
    receptionOnly: false,
    trainerOnly: false,
  },
  finance: {
    key: 'finance',
    label: 'Finanzas',
    icon: 'Banknote',
    // Solo admin.
    adminOnly: true,
    receptionOnly: false,
    trainerOnly: false,
  },
  plans: {
    key: 'plans',
    label: 'Gestión de Planes',
    icon: 'Settings2',
    // Solo admin.
    adminOnly: true,
    receptionOnly: false,
    trainerOnly: false,
  },
  staff: {
    key: 'staff',
    label: 'Staff',
    icon: 'UserRoundCog',
    // Solo admin.
    adminOnly: true,
    receptionOnly: false,
    trainerOnly: false,
  },
  // D-03: Configuración se retira de la navegación principal para todos los roles.
  // El módulo GymSettings.jsx y la tabla gym_settings se conservan pero no aparecen
  // en la matriz de navegación centralizada.
  settings: {
    key: 'settings',
    label: 'Configuración',
    icon: 'SlidersHorizontal',
    adminOnly: false,
    receptionOnly: false,
    trainerOnly: false,
  },
}

// Constructor de la matriz visible para cada rol.
// @param {boolean} isAdmin - ¿es usuario administrador?
// @param {boolean} isTrainer - ¿es usuario entrenador?
// @returns {Array<{key, label, icon}[]>}
export function buildPanelSections({ isAdmin, isTrainer }) {
  const allSections = [
    PANEL_SECTIONS.dashboard,
    PANEL_SECTIONS.attendance,
    PANEL_SECTIONS.clients,
    PANEL_SECTIONS.cash,
    PANEL_SECTIONS.products,
    PANEL_SECTIONS.reports,
    PANEL_SECTIONS.finance,
    PANEL_SECTIONS.plans,
    PANEL_SECTIONS.staff,
    // settings NO se incluye en la navegación principal (D-03)
  ]

  const visible = allSections.filter((section) => {
    // dashboard: siempre visible para todos los roles
    if (section.key === 'dashboard') return true

    // attendance: visible para todos los roles (admin, recepción, entrenador)
    if (section.key === 'attendance') return true

    // clients: admin y recepción (no entrenador)
    if (section.key === 'clients') return isAdmin || (!isAdmin && !isTrainer)

    // cash: admin y recepción (no entrenador)
    if (section.key === 'cash') return isAdmin || (!isAdmin && !isTrainer)

    // products: solo admin (catálogo). Recepción accede al POS por el tab 'cash'.
    if (section.key === 'products') return isAdmin

    // reports: admin solo
    if (section.key === 'reports') return isAdmin

    // finance: admin solo
    if (section.key === 'finance') return isAdmin

    // plans: admin solo
    if (section.key === 'plans') return isAdmin

    // staff: admin solo
    if (section.key === 'staff') return isAdmin

    return false
  })

  // Título y subtítulo según el rol dominante en la vista actual
  let panelTitle, panelSubtitle

  if (isAdmin) {
    panelTitle = 'Panel Administrativo'
    panelSubtitle = 'Métricas, reportes y gestión de planes'
  } else if (isTrainer) {
    panelTitle = 'Panel de Entrenador'
    panelSubtitle = 'Control de asistencia y perfiles mínimos'
  } else {
    // Recepción (o rol sin definido)
    panelTitle = 'Panel de Recepción'
    panelSubtitle = 'Control de asistencia y gestión de clientes'
  }

  return { visible, panelTitle, panelSubtitle }
}