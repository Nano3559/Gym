import { Flame } from 'lucide-react'

const words = [
  'Disciplina', 'Fuerza', 'Resistencia', 'Superación', 'Energía',
  'Transformación', 'Compromiso', 'Pasión', 'Resultados', 'Comunidad',
]

export default function Marquee() {
  const items = [...words, ...words]
  return (
    <div className="relative overflow-hidden border-y border-line bg-accent py-4">
      <div className="flex w-max animate-marquee gap-8">
        {items.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="flex items-center gap-8 font-display text-sm font-bold uppercase tracking-[0.2em] text-white"
          >
            {word}
            <Flame className="h-4 w-4 fill-white/80" />
          </span>
        ))}
      </div>
    </div>
  )
}