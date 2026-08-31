import { useState } from 'react'
import { BadgeCheck, CalendarClock, Check, Zap } from 'lucide-react'
import { plans } from '../data/gymData'

export default function Plans({ onSelectPlan, activePlan }) {
  const [showAll, setShowAll] = useState(false)

  return (
    <section id="planes" className="relative bg-surface py-20 sm:py-24">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label justify-center">
            <span className="h-px w-8 bg-accent" />
            Planes de membresía
            <span className="h-px w-8 bg-accent" />
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
            Elige tu <span className="text-gradient">camino</span>
          </h2>
          <p className="mt-4 text-muted">
            Todos los planes incluyen acceso a la app, evaluación inicial y pago
            mensual sin permanencia.
          </p>
        </div>

        {activePlan && !showAll && (
          <div className="relative mx-auto mt-12 max-w-3xl overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 to-card p-8 shadow-2xl shadow-accent/20 sm:p-10">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
                <BadgeCheck className="h-10 w-10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-accent">
                  Mi plan activo
                </p>
                <h3 className="mt-1 font-display text-3xl font-bold uppercase text-white">
                  {activePlan.name}
                </h3>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-volt">
                  <CalendarClock className="h-4 w-4" />
                  {activePlan.daysRemaining === 0
                    ? 'Tu membresía vence hoy'
                    : `${activePlan.daysRemaining} días restantes de tu membresía`}
                </p>
              </div>
            </div>

            <ul className="relative mt-8 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
              {(activePlan.features || []).map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="text-muted">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="relative mt-8 w-full rounded-xl border border-line px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:border-accent hover:bg-accent/10 hover:text-accent"
            >
              Renovar o Cambiar Plan
            </button>
          </div>
        )}

        {(activePlan ? showAll : true) && (
          <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-8 transition hover:-translate-y-1.5 ${
                plan.highlighted
                  ? 'border-accent bg-gradient-to-b from-accent/15 to-card shadow-2xl shadow-accent/20 lg:scale-[1.03]'
                  : 'border-line bg-card hover:border-accent/40'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-accent/40">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  Más popular
                </span>
              )}

              <h3 className="font-display text-2xl font-semibold uppercase text-white">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-sm font-semibold text-muted">
                  {plan.currency}
                </span>
                <span className="font-display text-5xl font-bold text-white">
                  {plan.price}
                </span>
                <span className="mb-1.5 text-sm text-muted">{plan.period}</span>
              </div>

              <ul className="mt-7 flex-1 space-y-3.5 border-t border-line pt-7">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        plan.highlighted
                          ? 'bg-accent text-white'
                          : 'bg-accent/15 text-accent'
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onSelectPlan(plan)}
                className={`mt-8 w-full rounded-xl px-6 py-3.5 text-sm font-bold uppercase tracking-wide transition ${
                  plan.highlighted
                    ? 'btn-sheen bg-accent text-white hover:bg-accent-hover'
                    : 'border border-line text-white hover:border-accent hover:bg-accent/10 hover:text-accent'
                }`}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </div>
        )}

        {activePlan && showAll && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent hover:text-accent"
            >
              <BadgeCheck className="h-4 w-4" />
              Ver mi plan activo
            </button>
          </div>
        )}
      </div>
    </section>
  )
}