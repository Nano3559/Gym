import { useEffect, useState } from 'react'
import { Dumbbell, Menu, X } from 'lucide-react'
import { brand, navLinks } from '../data/gymData'

export default function Navbar({ onInscribirme, onVerPlanes }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNav = (href) => {
    setOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled || open
          ? 'border-b border-line bg-ink/90 backdrop-blur-xl'
          : 'border-b border-transparent bg-gradient-to-b from-black/60 to-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault()
            handleNav('#inicio')
          }}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/30">
            <Dumbbell className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold uppercase tracking-wider">
            {brand.name}
            <span className="text-accent">.</span>
          </span>
        </a>

        <ul className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={(e) => {
                  e.preventDefault()
                  handleNav(link.href)
                }}
                className="text-sm font-medium text-muted transition hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={onInscribirme}
            className="btn-sheen rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Inscribirme
          </button>
          <button
            type="button"
            onClick={onVerPlanes}
            className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-white transition hover:border-accent hover:text-accent"
          >
            Ver planes
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          className="rounded-lg p-2 text-white transition hover:bg-card lg:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-ink px-4 pb-6 pt-2 lg:hidden">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav(link.href)
                  }}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-card hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onInscribirme()
              }}
              className="btn-sheen rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white"
            >
              Inscribirme
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onVerPlanes()
              }}
              className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-white"
            >
              Ver planes
            </button>
          </div>
        </div>
      )}
    </header>
  )
}