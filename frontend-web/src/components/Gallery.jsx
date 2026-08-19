import { Quote, Star } from 'lucide-react'
import { gallery, testimonials } from '../data/gymData'

export default function Gallery() {
  return (
    <section id="galeria" className="bg-ink py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label justify-center">
            <span className="h-px w-8 bg-accent" />
            Galería
            <span className="h-px w-8 bg-accent" />
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
            Así se vive <span className="text-gradient">IronForge</span>
          </h2>
          <p className="mt-4 text-muted">
            Nuestras instalaciones y la energía de la comunidad hablan por nosotros.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {gallery.map((src, i) => (
            <figure
              key={src}
              className={`group relative overflow-hidden rounded-2xl border border-line ${
                i === 0 || i === 3 ? 'row-span-2' : ''
              }`}
            >
              <img
                src={src}
                alt={`Galería IronForge ${i + 1}`}
                loading="lazy"
                className={`w-full object-cover transition duration-500 group-hover:scale-110 ${
                  i === 0 || i === 3 ? 'h-full min-h-[320px]' : 'aspect-[4/3]'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition group-hover:opacity-100" />
              <figcaption className="absolute bottom-3 left-4 right-4 translate-y-3 text-sm font-semibold text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                Entrena con intensidad
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-2xl border border-line bg-card p-6"
            >
              <Quote className="h-8 w-8 text-accent" />
              <blockquote className="mt-4 flex-1 leading-relaxed text-white">
                "{item.quote}"
              </blockquote>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <figcaption>
                  <p className="font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-muted">{item.role}</p>
                </figcaption>
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-volt text-volt" />
                  ))}
                </span>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}