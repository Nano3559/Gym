import { useEffect, useRef } from 'react'

// Dibuja el esqueleto de la pose sobre el video y resalta las articulaciones
// usadas por el analizador de sentadilla (cadera, rodilla, tobillo).

const CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
]

const HIGHLIGHT = new Set([23, 24, 25, 26, 27, 28])
const MIN_VISIBILITY = 0.5

export default function PoseOverlay({ canvasRef, videoRef, landmarksRef }) {
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef?.current
    if (!canvas || !video) return undefined

    const context = canvas.getContext('2d')

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) return

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      context.clearRect(0, 0, width, height)

      const landmarks = landmarksRef.current
      if (!landmarks) return

      context.lineCap = 'round'
      context.lineWidth = Math.max(3, width / 260)

      for (const [start, end] of CONNECTIONS) {
        const a = landmarks[start]
        const b = landmarks[end]
        if (!a || !b) continue
        if ((a.visibility ?? 1) < MIN_VISIBILITY || (b.visibility ?? 1) < MIN_VISIBILITY) continue

        const isHighlight = HIGHLIGHT.has(start) && HIGHLIGHT.has(end)
        context.strokeStyle = isHighlight ? 'rgba(216, 243, 78, 0.95)' : 'rgba(255, 255, 255, 0.45)'
        context.beginPath()
        context.moveTo(a.x * width, a.y * height)
        context.lineTo(b.x * width, b.y * height)
        context.stroke()
      }

      landmarks.forEach((point, index) => {
        if ((point.visibility ?? 1) < MIN_VISIBILITY) return
        const radius = HIGHLIGHT.has(index) ? Math.max(5, width / 110) : Math.max(3, width / 200)
        context.fillStyle = HIGHLIGHT.has(index) ? '#d8f34e' : 'rgba(255, 255, 255, 0.75)'
        context.beginPath()
        context.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2)
        context.fill()
      })
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasRef, videoRef, landmarksRef])

  // El video se muestra en espejo, por eso el canvas aplica la misma escala.
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
      aria-hidden="true"
    />
  )
}
