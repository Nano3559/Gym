import { CAMERA_GUIDES, CAMERA_VIEW_LABELS } from '../data/cameraGuidance.js'

export default function CameraGuidance({ exercise, fallback = '' }) {
  const guide = CAMERA_GUIDES[exercise?.id]
  if (!guide) return fallback ? <p className="mt-3 text-sm leading-relaxed text-muted">{fallback}</p> : null
  return <aside aria-label="Posición y encuadre de cámara" className="my-3 space-y-2 rounded-xl border border-line bg-card p-3 text-sm leading-relaxed">
    <p className="font-semibold">Vista recomendada: {CAMERA_VIEW_LABELS[guide.view]}</p>
    <p>{guide.position}</p>
    <p className="text-muted">{guide.framing}</p>
    <p className="text-xs text-muted">{guide.avoid}</p>
  </aside>
}
