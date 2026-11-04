import { useState } from 'react'
import { Award, CalendarDays, Clock3, GraduationCap, ArrowRight } from 'lucide-react'
import { trainers } from '../data/gymData'
import Modal from './ui/Modal'

function TrainerModal({ trainer, onClose }) {
  if (!trainer) return null
  return (
    <Modal open={!!trainer} onClose={onClose} title={trainer.name} maxWidth="max-w-2xl">
      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-xl border border-line">
          <img
            src={trainer.image}
            alt={trainer.name}
            className="aspect-[3/4] w-full object-cover"
          />
        </div>
        <div>
          <p className="font-semibold text-accent">{trainer.specialty}</p>
          <p className="mt-3 leading-relaxed text-muted">{trainer.bio}</p>

          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-sm text-white">{trainer.experience}</span>
            </div>
            {trainer.schedules.map((schedule) => (
              <div key={schedule} className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-sm text-white">{schedule}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function Trainers() {
  const [active, setActive] = useState(null)

  return (
    <section id="entrenadores" className="bg-ink py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="section-label">
              <span className="h-px w-8 bg-accent" />
              Nuestro equipo
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
              Entrenadores <span className="text-gradient">certificados</span>
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Profesionales apasionados que te acompañan en cada paso. Conócelos y
              encuentra al que se adapta a tu objetivo.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trainers.map((trainer) => (
            <article
              key={trainer.id}
              className="group overflow-hidden rounded-2xl border border-line bg-card transition hover:-translate-y-1.5 hover:border-accent/60 hover:shadow-xl hover:shadow-accent/10"
            >
              <div className="relative overflow-hidden">
                <img
                  src={trainer.image}
                  alt={trainer.name}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-display text-xl font-semibold uppercase text-white">
                    {trainer.name}
                  </h3>
                  <p className="text-xs text-volt">{trainer.specialty}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Award className="h-3.5 w-3.5 text-accent" />
                  {trainer.experience.split('·')[0]}
                </div>
                <button
                  type="button"
                  onClick={() => setActive(trainer)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition group-hover:gap-2.5"
                >
                  Ver perfil
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-line bg-card px-6 py-4">
          {['Fuerza', 'Resistencia', 'Movilidad', 'Hiit', 'Recuperación'].map((item) => (
            <span key={item} className="flex items-center gap-2 text-sm text-muted">
              <CalendarDays className="h-4 w-4 text-accent" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <TrainerModal trainer={active} onClose={() => setActive(null)} />
    </section>
  )
}