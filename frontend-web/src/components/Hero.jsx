import { ArrowRight, Play, Star, Users, CalendarCheck } from 'lucide-react'
import { brand, heroImage } from '../data/gymData'

export default function Hero({ onInscribirme, onVerPlanes }) {
  return (
    <section id="inicio" className="relative min-h-[100svh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Interior del gimnasio IronForge"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
        <div className="absolute inset-0 overlay-dark" />
        <div className="absolute inset-0 bg-grid opacity-60" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="max-w-2xl animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-black/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-volt backdrop-blur">
            <Star className="h-3.5 w-3.5" />
            El gimnasio N°1 de Santa Cruz
          </p>

          <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Forja tu cuerpo.
            <br />
            <span className="text-gradient-volt">Domina tu mente.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {brand.slogan} Más de 1.200 socios activos entrenan con nosotros cada
            semana. {brand.tagline}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onInscribirme}
              className="btn-sheen group inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-xl shadow-accent/30 transition hover:bg-accent-hover"
            >
              Inscribirme
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={onVerPlanes}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 text-sm font-bold uppercase tracking-wide text-white backdrop-blur transition hover:border-white/50"
            >
              <Play className="h-4 w-4 fill-current" />
              Ver planes
            </button>
          </div>

          <div className="mt-14 grid max-w-lg grid-cols-3 gap-4">
            {[
              { value: '1.200+', label: 'Socios activos', icon: Users },
              { value: '25', label: 'Clases semanales', icon: CalendarCheck },
              { value: '12', label: 'Entrenadores', icon: Play },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-line bg-black/30 p-4 backdrop-blur"
              >
                <item.icon className="mb-2 h-5 w-5 text-accent" />
                <p className="font-display text-2xl font-bold text-white">
                  {item.value}
                </p>
                <p className="text-xs text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-muted md:flex">
        <span className="text-[11px] uppercase tracking-[0.3em]">Desliza</span>
        <span className="h-10 w-px bg-gradient-to-b from-muted to-transparent" />
      </div>
    </section>
  )
}