import { useState } from 'react'
import {
  MapPin, Phone, Mail, Send, MessageCircle, Clock3,
} from 'lucide-react'
import { Facebook, Instagram, XIcon, YouTube } from './SocialIcons'
import { brand } from '../data/gymData'

const initialForm = { nombre: '', correo: '', telefono: '', mensaje: '' }

export default function Contact({ onSend }) {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.nombre.trim()) errs.nombre = 'Ingresa tu nombre'
    if (!form.correo.trim()) errs.correo = 'Ingresa tu correo'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()))
      errs.correo = 'Correo inválido'
    if (!form.mensaje.trim()) errs.mensaje = 'Escribe un mensaje'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    onSend(form)
    setForm(initialForm)
  }

  const socials = [
    { icon: Facebook, href: brand.social.facebook, label: 'Facebook' },
    { icon: Instagram, href: brand.social.instagram, label: 'Instagram' },
    { icon: XIcon, href: brand.social.twitter, label: 'Twitter / X' },
    { icon: YouTube, href: brand.social.youtube, label: 'YouTube' },
  ]

  const info = [
    { icon: MapPin, label: 'Dirección', value: brand.address },
    { icon: Phone, label: 'Teléfono', value: brand.phone },
    { icon: Mail, label: 'Correo', value: brand.email },
    { icon: Clock3, label: 'Horarios', value: brand.hours },
  ]

  return (
    <section id="contacto" className="bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label justify-center">
            <span className="h-px w-8 bg-accent" />
            Contacto
            <span className="h-px w-8 bg-accent" />
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
            Hablemos, <span className="text-gradient">empecemos hoy</span>
          </h2>
          <p className="mt-4 text-muted">
            Visítanos, escríbenos por WhatsApp o envíanos un mensaje. Te
            responderemos lo antes posible.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-line bg-card p-6">
              <ul className="space-y-5">
                {info.map((item) => (
                  <li key={item.label} className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15">
                      <item.icon className="h-5 w-5 text-accent" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-sm text-white">{item.value}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <a
                href={`https://wa.me/${brand.whatsapp}?text=Hola%20IronForge%2C%20quiero%20más%20información`}
                target="_blank"
                rel="noreferrer"
                className="btn-sheen mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#25d366] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-110"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp directo
              </a>

              <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent hover:bg-accent/10 hover:text-accent"
                  >
                    <s.icon className="h-4.5 w-4.5" />
                  </a>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="flex items-center gap-2 border-b border-line px-5 py-3">
                <MapPin className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-white">Ubicación</span>
              </div>
              <iframe
                title="Mapa de IronForge Gym"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-63.1912%2C-17.7962%2C-63.1712%2C-17.7762&layer=mapnik"
                className="h-64 w-full"
                loading="lazy"
              />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-2xl border border-line bg-card p-6 sm:p-8 lg:col-span-3"
          >
            <h3 className="font-display text-2xl font-semibold uppercase text-white">
              Envíanos un mensaje
            </h3>
            <p className="mt-1 text-sm text-muted">
              Cuéntanos tu objetivo y te ayudaremos a lograrlo.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ct-nombre" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Nombre <span className="text-accent">*</span>
                </label>
                <input
                  id="ct-nombre"
                  value={form.nombre}
                  onChange={set('nombre')}
                  placeholder="Tu nombre"
                  className={`field ${errors.nombre ? 'has-error' : ''}`}
                />
                {errors.nombre && <p className="mt-1 text-xs text-red-400">{errors.nombre}</p>}
              </div>
              <div>
                <label htmlFor="ct-correo" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Correo <span className="text-accent">*</span>
                </label>
                <input
                  id="ct-correo"
                  type="email"
                  value={form.correo}
                  onChange={set('correo')}
                  placeholder="tucorreo@ejemplo.com"
                  className={`field ${errors.correo ? 'has-error' : ''}`}
                />
                {errors.correo && <p className="mt-1 text-xs text-red-400">{errors.correo}</p>}
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="ct-telefono" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Teléfono
              </label>
              <input
                id="ct-telefono"
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="+591 7 000 0000"
                className="field"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="ct-mensaje" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Mensaje <span className="text-accent">*</span>
              </label>
              <textarea
                id="ct-mensaje"
                rows={4}
                value={form.mensaje}
                onChange={set('mensaje')}
                placeholder="Quiero información sobre los planes…"
                className={`field resize-none ${errors.mensaje ? 'has-error' : ''}`}
              />
              {errors.mensaje && <p className="mt-1 text-xs text-red-400">{errors.mensaje}</p>}
            </div>

            <button
              type="submit"
              className="btn-sheen mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
            >
              <Send className="h-4 w-4" />
              Enviar mensaje
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}