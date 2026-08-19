import { Dumbbell, MapPin, Phone, Mail } from 'lucide-react'
import { Facebook, Instagram, XIcon, YouTube } from './SocialIcons'
import { brand, navLinks } from '../data/gymData'

export default function Footer({ onNavigate }) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault()
                onNavigate('#inicio')
              }}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
                <Dumbbell className="h-5 w-5" />
              </span>
              <span className="font-display text-xl font-bold uppercase tracking-wider">
                {brand.name}
                <span className="text-accent">.</span>
              </span>
            </a>
            <p className="mt-4 max-w-sm leading-relaxed text-muted">
              {brand.slogan} Únete a la comunidad que entrena fuerte y vive mejor.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Facebook, href: brand.social.facebook, label: 'Facebook' },
                { icon: Instagram, href: brand.social.instagram, label: 'Instagram' },
                { icon: XIcon, href: brand.social.twitter, label: 'Twitter / X' },
                { icon: YouTube, href: brand.social.youtube, label: 'YouTube' },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent hover:bg-accent/10 hover:text-accent"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Navegación
            </h4>
            <ul className="mt-4 space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault()
                      onNavigate(link.href)
                    }}
                    className="text-sm text-muted transition hover:text-accent"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Contacto
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {brand.address}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-accent" />
                {brand.phone}
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                {brand.email}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <p>
            © {year} {brand.name} Gym. Todos los derechos reservados.
          </p>
          <p>
            Hecho con <span className="text-accent">intensidad</span> en Bolivia 🇧🇴
          </p>
        </div>
      </div>
    </footer>
  )
}