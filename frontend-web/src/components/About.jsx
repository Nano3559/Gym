import { ShieldCheck, HeartPulse, Clock3, Medal } from 'lucide-react'

const values = [
  {
    icon: ShieldCheck,
    title: 'Instalaciones de elite',
    text: 'Equipos modernos, áreas ventiladas y protocolos de higiene estrictos.',
  },
  {
    icon: HeartPulse,
    title: 'Comunidad real',
    text: 'Un ambiente que motiva: todos entrenan, todos se apoyan.',
  },
  {
    icon: Clock3,
    title: 'Horarios flexibles',
    text: 'Abierto desde las 05:30 hasta las 22:00, incluso fines de semana.',
  },
  {
    icon: Medal,
    title: 'Equipo certificado',
    text: 'Entrenadores con certificaciones internacionales y años de experiencia.',
  },
]

export default function About() {
  return (
    <section id="nosotros" className="relative bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-accent/30 to-volt/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-line">
              <img
                src="https://images.unsplash.com/photo-1546483875-ad9014c88eba?auto=format&fit=crop&w=1200&q=80"
                alt="Socios entrenando en IronForge"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
                <p className="font-display text-lg font-bold text-white">
                  Desde 2012
                </p>
                <p className="text-xs text-muted">Más de una década forjando atletas</p>
              </div>
            </div>
          </div>

          <div>
            <p className="section-label">
              <span className="h-px w-8 bg-accent" />
              Nosotros
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
              Más que un gimnasio, <span className="text-gradient">una mentalidad</span>
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              En IronForge creemos que el cambio no empieza en el espejo, empieza en
              la decisión. Ofrecemos entrenamiento de alto nivel, asesoría
              personalizada y un ambiente que te impulsa a volver cada día.
            </p>
            <p className="mt-3 leading-relaxed text-muted">
              Desde nuestros inicios hemos ayudado a miles de personas a recuperar su
              energía, mejorar su salud y alcanzar metas que creían imposibles.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {values.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-line bg-card p-5 transition hover:border-accent/50"
                >
                  <item.icon className="mb-3 h-6 w-6 text-accent transition group-hover:scale-110" />
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}