import { useState } from 'react'
import { Clock3, ArrowRight, CalendarCheck } from 'lucide-react'
import { services } from '../data/gymData'
import Modal from './ui/Modal'

function ServiceModal({ service, onClose, onBook }) {
  if (!service) return null
  return (
    <Modal open={!!service} onClose={onClose} title={service.name}>
      <div className="overflow-hidden rounded-xl border border-line">
        <img
          src={service.image}
          alt={service.name}
          className="aspect-video w-full object-cover"
        />
      </div>
      <span className="mt-4 inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
        {service.tag}
      </span>
      <p className="mt-3 leading-relaxed text-muted">{service.description}</p>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm">
        <Clock3 className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-white">{service.schedule}</span>
      </div>

      <button
        type="button"
        onClick={onBook}
        className="btn-sheen mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
      >
        <CalendarCheck className="h-4 w-4" />
        Reservar esta clase
      </button>
    </Modal>
  )
}

export default function Services({ onBookService }) {
  const [active, setActive] = useState(null)

  return (
    <section id="servicios" className="bg-ink py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="section-label">
              <span className="h-px w-8 bg-accent" />
              Servicios
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
              Entrena lo que <span className="text-gradient">amas</span>
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              8 disciplinas con instructores especializados, horarios amplios y
              cupos limitados para garantizar tu atención.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <article
              key={service.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition hover:-translate-y-1.5 hover:border-accent/60 hover:shadow-xl hover:shadow-accent/10"
            >
              <div className="relative overflow-hidden">
                <img
                  src={service.image}
                  alt={service.name}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-110"
                />
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt backdrop-blur">
                  {service.tag}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-xl font-semibold uppercase text-white">
                  {service.name}
                </h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">
                  {service.description}
                </p>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <Clock3 className="h-3.5 w-3.5 text-accent" />
                  {service.schedule}
                </p>
                <button
                  type="button"
                  onClick={() => setActive(service)}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent transition group-hover:gap-3"
                >
                  Ver más
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <ServiceModal
        service={active}
        onClose={() => setActive(null)}
        onBook={() => {
          onBookService(active)
          setActive(null)
        }}
      />
    </section>
  )
}