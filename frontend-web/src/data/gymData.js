const img = (id, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const brand = {
  name: "IronForge",
  tagline: "Entrena. Supera. Transforma.",
  slogan:
    "Forja tu mejor versión en un espacio diseñado para quienes no se rinden.",
  address: "Av. Bolívar #245, Zona Central, Santa Cruz",
  phone: "+591 7 123 4567",
  whatsapp: "59171234567",
  email: "contacto@ironforgegym.bo",
  hours: "Lunes a Viernes 05:30 – 22:00 · Sábado 07:00 – 18:00",
  social: {
    facebook: "https://facebook.com/ironforgegym",
    instagram: "https://instagram.com/ironforgegym",
    twitter: "https://x.com/ironforgegym",
    youtube: "https://youtube.com/@ironforgegym",
    tiktok: "https://tiktok.com/@ironforgegym",
  },
}

export const navLinks = [
  { label: "Inicio", href: "#inicio" },
  { label: "Nosotros", href: "#nosotros" },
  { label: "Servicios", href: "#servicios" },
  { label: "Planes", href: "#planes" },
  { label: "Entrenadores", href: "#entrenadores" },
  { label: "Horarios", href: "#horarios" },
  { label: "Galería", href: "#galeria" },
  { label: "Contacto", href: "#contacto" },
]

export const heroImage = img("photo-1534438327276-14e5300c3a48", 1800)

export const services = [
  {
    id: "musculacion",
    name: "Musculación",
    tag: "Fuerza",
    image: img("photo-1583454110551-21f2fa2afe61"),
    schedule: "Lun a Vie · 05:30 – 22:00",
    description:
      "Zona de pesas con máquinas de última generación, bancos libres y mancuernas de hasta 50 kg. Perfecto para ganar masa muscular y fuerza.",
  },
  {
    id: "cardio",
    name: "Cardio",
    tag: "Resistencia",
    image: img("photo-1540497077202-7c8a3999166f"),
    schedule: "Lun a Vie · 05:30 – 22:00",
    description:
      "Cintas, elípticas, remos y bicicletas estáticas con conectividad y métricas en tiempo real para mejorar tu capacidad aeróbica.",
  },
  {
    id: "crossfit",
    name: "CrossFit",
    tag: "Intensidad",
    image: img("photo-1517836357463-d25dfeac3438"),
    schedule: "Lun · Mié · Vie · 18:00 y 19:30",
    description:
      "WODs diarios de alta intensidad combinando halterofilia, gimnasia y acondicionamiento metabólico. Escalable a cualquier nivel.",
  },
  {
    id: "funcional",
    name: "Entrenamiento Funcional",
    tag: "Movimiento",
    image: img("photo-1541534741688-6078c6bfb5c5"),
    schedule: "Lun a Vie · 18:00 y 19:30",
    description:
      "Circuitos con kettlebells, TRX, cuerdas y balones medicinales para potenciar tu movilidad, equilibrio y coordinación.",
  },
  {
    id: "spinning",
    name: "Spinning",
    tag: "Sprint",
    image: img("photo-1558618666-fcd25c85cd64"),
    schedule: "Mar · Jue · Sáb · 09:00",
    description:
      "Clases de ciclismo indoor con música motivadora, luces y perfiles de terreno variados. Quema hasta 600 calorías por sesión.",
  },
  {
    id: "yoga",
    name: "Yoga",
    tag: "Equilibrio",
    image: img("photo-1544367567-0f2fcb009e0b"),
    schedule: "Lun · Mié · Vie · 07:00 y 20:00",
    description:
      "Sesiones de vinyasa y yoga restaurativo que mejoran tu flexibilidad, reducen el estrés y complementan tu rutina de fuerza.",
  },
  {
    id: "zumba",
    name: "Zumba",
    tag: "Diversión",
    image: img("photo-1518609878373-06d740f60d8b"),
    schedule: "Mar · Jue · 09:00",
    description:
      "Ritmos latinos y coreografías fáciles de seguir. Baila, suda y diviértete mientras mejoras tu condición cardiovascular.",
  },
  {
    id: "personalizado",
    name: "Entrenamiento Personalizado",
    tag: "1 a 1",
    image: img("photo-1571019613454-1cb2f99b2d8b"),
    schedule: "Agenda a tu medida",
    description:
      "Plan 100% adaptado a tus objetivos con seguimiento semanal, evaluación física y asesoría nutricional incluida.",
  },
]

export const plans = [
  {
    id: "basico",
    name: "Plan Básico",
    price: 180,
    currency: "Bs.",
    period: "/mes",
    tagline: "Para empezar tu transformación",
    features: [
      "Acceso al gimnasio",
      "Lunes a viernes",
      "Horario limitado (08:00 – 17:00)",
      "Acceso a zona de musculación y cardio",
      "Casilleros y estacionamiento",
    ],
    highlighted: false,
    cta: "Elegir este plan",
  },
  {
    id: "completo",
    name: "Plan Completo",
    price: 240,
    currency: "Bs.",
    period: "/mes",
    tagline: "El favorito de nuestros socios",
    features: [
      "Acceso ilimitado",
      "Todas las clases grupales",
      "Lunes a sábado",
      "Horario completo (05:30 – 22:00)",
      "Evaluación física mensual",
      "Casilleros, toalla y parqueo",
    ],
    highlighted: true,
    cta: "Elegir este plan",
  },
  {
    id: "premium",
    name: "Plan Premium",
    price: 300,
    currency: "Bs.",
    period: "/mes",
    tagline: "Experiencia integral",
    features: [
      "Acceso ilimitado 24/7",
      "Todas las clases + priority booking",
      "Entrenador personalizado",
      "Evaluación física completa",
      "Asesoría nutricional",
      "Acceso a la app + seguimiento",
    ],
    highlighted: false,
    cta: "Elegir este plan",
  },
]

export const trainers = [
  {
    id: "carlos-perez",
    name: "Carlos Pérez",
    specialty: "Entrenador funcional y musculación",
    experience: "10 años de experiencia · Certificación ISSA",
    schedules: ["Lun · Mié · Vie — 07:00 a 12:00", "Mar · Jue — 18:00 a 21:00"],
    image: img("photo-1567013127542-490d757e51fc", 800),
    bio: "Ex-atleta de halterofilia. Especialista en fuerza y acondicionamiento, lleva más de 500 alumnos a sus objetivos.",
  },
  {
    id: "maria-lopez",
    name: "María López",
    specialty: "Especialista en yoga y movilidad",
    experience: "8 años de experiencia · RYT 500",
    schedules: ["Lun · Mié · Vie — 07:00 y 20:00", "Sáb — 09:00"],
    image: img("photo-1573496359142-b8d87734a5a2", 800),
    bio: "Guía certificada de yoga y movilidad. Ayuda a los atletas a recuperarse y prevenir lesiones con prácticas conscientes.",
  },
  {
    id: "jorge-ramirez",
    name: "Jorge Ramírez",
    specialty: "Head Coach CrossFit",
    experience: "12 años de experiencia · CrossFit L2",
    schedules: ["Lun · Mié · Vie — 18:00 y 19:30"],
    image: img("photo-1580489944761-15a19d654956", 800),
    bio: "Director deportivo de CrossFit. Diseña los WODs del box y entrena a los equipos de competición del gimnasio.",
  },
  {
    id: "ana-torres",
    name: "Ana Torres",
    specialty: "Instructora de Spinning y Zumba",
    experience: "6 años de experiencia · ACE Certified",
    schedules: ["Mar · Jue — 09:00", "Sáb — 09:00 y 10:30"],
    image: img("photo-1438761681033-6461ffad8d80", 800),
    bio: "Especialista en cardio grupal. Sus clases combinan música, ritmo y técnica para que cada sesión sea intensa y divertida.",
  },
]

export const scheduleDays = [
  { id: "lun", name: "Lunes" },
  { id: "mar", name: "Martes" },
  { id: "mie", name: "Miércoles" },
  { id: "jue", name: "Jueves" },
  { id: "vie", name: "Viernes" },
  { id: "sab", name: "Sábado" },
  { id: "dom", name: "Domingo" },
]

export const scheduleTimes = ["07:00", "09:00", "18:00", "20:00"]

export const weeklyClasses = {
  lun: [
    { id: "lun-07", name: "CrossFit", trainer: "Jorge Ramírez", time: "07:00", capacity: 16, booked: 9 },
    { id: "lun-09", name: "Spinning", trainer: "Ana Torres", time: "09:00", capacity: 20, booked: 12 },
    { id: "lun-18", name: "Funcional", trainer: "Carlos Pérez", time: "18:00", capacity: 24, booked: 18 },
    { id: "lun-20", name: "Yoga", trainer: "María López", time: "20:00", capacity: 18, booked: 7 },
  ],
  mar: [
    { id: "mar-07", name: "Yoga", trainer: "María López", time: "07:00", capacity: 18, booked: 10 },
    { id: "mar-09", name: "Zumba", trainer: "Ana Torres", time: "09:00", capacity: 30, booked: 21 },
    { id: "mar-18", name: "CrossFit", trainer: "Jorge Ramírez", time: "18:00", capacity: 16, booked: 13 },
    { id: "mar-20", name: "Spinning", trainer: "Ana Torres", time: "20:00", capacity: 20, booked: 11 },
  ],
  mie: [
    { id: "mie-07", name: "CrossFit", trainer: "Jorge Ramírez", time: "07:00", capacity: 16, booked: 8 },
    { id: "mie-09", name: "Spinning", trainer: "Ana Torres", time: "09:00", capacity: 20, booked: 15 },
    { id: "mie-18", name: "Funcional", trainer: "Carlos Pérez", time: "18:00", capacity: 24, booked: 20 },
    { id: "mie-20", name: "Yoga", trainer: "María López", time: "20:00", capacity: 18, booked: 6 },
  ],
  jue: [
    { id: "jue-07", name: "Yoga", trainer: "María López", time: "07:00", capacity: 18, booked: 12 },
    { id: "jue-09", name: "Zumba", trainer: "Ana Torres", time: "09:00", capacity: 30, booked: 19 },
    { id: "jue-18", name: "CrossFit", trainer: "Jorge Ramírez", time: "18:00", capacity: 16, booked: 14 },
    { id: "jue-20", name: "Spinning", trainer: "Ana Torres", time: "20:00", capacity: 20, booked: 9 },
  ],
  vie: [
    { id: "vie-07", name: "Funcional", trainer: "Carlos Pérez", time: "07:00", capacity: 24, booked: 15 },
    { id: "vie-09", name: "Spinning", trainer: "Ana Torres", time: "09:00", capacity: 20, booked: 10 },
    { id: "vie-18", name: "Funcional", trainer: "Carlos Pérez", time: "18:00", capacity: 24, booked: 22 },
    { id: "vie-20", name: "Yoga", trainer: "María López", time: "20:00", capacity: 18, booked: 8 },
  ],
  sab: [
    { id: "sab-09", name: "Open Gym", trainer: "Staff", time: "09:00", capacity: 40, booked: 25 },
    { id: "sab-10", name: "Spinning", trainer: "Ana Torres", time: "10:30", capacity: 20, booked: 13 },
  ],
  dom: [],
}

export const gallery = [
  img("photo-1571902943202-507ec2618e8f", 800),
  img("photo-1581009146145-b5ef050c2e1e", 800),
  img("photo-1540497077202-7c8a3999166f", 800),
  img("photo-1517836357463-d25dfeac3438", 800),
  img("photo-1571019613454-1cb2f99b2d8b", 800),
  img("photo-1518310383802-640c2de311b2", 800),
]

export const testimonials = [
  {
    name: "Lucía Fernández",
    role: "Socia Plan Premium",
    quote:
      "En 6 meses transformé mi cuerpo y mi energía. El entrenador personalizado marcó toda la diferencia.",
  },
  {
    name: "Diego Vargas",
    role: "Socio Plan Completo",
    quote:
      "Las clases de CrossFit y el ambiente te empujan a dar más. El mejor gimnasio de la ciudad, sin dudas.",
  },
  {
    name: "Romina Gutiérrez",
    role: "Socia Plan Básico",
    quote:
      "Empecé con el plan básico y hoy el gimnasio es parte de mi rutina. Las instalaciones son impecables.",
  },
]

export const gallerySectionImages = gallery