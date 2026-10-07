import { useMemo, useRef, useState } from 'react'
import { Activity, Camera, LoaderCircle, RefreshCw, Square } from 'lucide-react'
import Modal from './ui/Modal'
import PoseOverlay from './PoseOverlay'
import useCamera from '../hooks/useCamera'
import usePoseDetection from '../hooks/usePoseDetection'

import { AVAILABLE_EXERCISES } from '../data/exercises'

// Entrenador virtual de ejercicios con cámara. Soporta varios ejercicios
// (sentadillas, flexiones...) cada uno con su propio analizador de pose.

const STATE_STYLES = {
  IDLE: 'border-line text-muted',
  TOP: 'border-volt/60 text-volt',
  STANDING: 'border-volt/60 text-volt',
  DESCENDING: 'border-accent/60 text-accent',
  BOTTOM: 'border-accent text-accent',
  ASCENDING: 'border-volt/60 text-volt',
}

export default function SquatCoachModal({ open, onClose }) {
  const [selectedId, setSelectedId] = useState(() => AVAILABLE_EXERCISES[0].id)
  const [cameraActive, setCameraActive] = useState(false)
  const canvasRef = useRef(null)
  const exercise = useMemo(
    () => AVAILABLE_EXERCISES.find((item) => item.id === selectedId) ?? AVAILABLE_EXERCISES[0],
    [selectedId],
  )

  const { videoRef, status: cameraStatus, error: cameraError, stop } = useCamera({
    facingMode: 'user',
    active: open && cameraActive,
  })

  const { poseState, modelStatus, landmarksRef, resetReps } = usePoseDetection({
    enabled: open && cameraActive && cameraStatus === 'ready',
    videoRef,
    exercise: exercise.id,
  })

  const stopEverything = () => {
    stop()
    setCameraActive(false)
  }

  const handleClose = () => {
    stopEverything()
    onClose()
  }

  const showCamera = cameraActive && (cameraStatus === 'starting' || cameraStatus === 'ready')
  const isDetecting = enabledPose(showCamera, cameraStatus)

  return (
    <Modal open={open} onClose={handleClose} title="Entrenador con cámara" maxWidth="max-w-3xl">
      <div className="space-y-5">
        <div>
          <p className="section-label">
            <Activity className="h-4 w-4" /> Análisis de ejercicio en tiempo real
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {AVAILABLE_EXERCISES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selectedId === item.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  selectedId === item.id
                    ? 'border-volt/70 bg-volt/10 text-volt'
                    : 'border-line text-muted hover:border-volt/40 hover:text-white'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{exercise.description}</p>
        </div>

        {!showCamera ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-accent/50 bg-accent/10 px-5 py-10 text-center">
            <Camera className="h-10 w-10 text-accent" />
            <p className="text-sm text-white">
              Activa la cámara para contar {exercise.name.toLowerCase()} con detección local.
            </p>
            <button
              type="button"
              onClick={() => setCameraActive(true)}
              className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
            >
              <Camera className="h-4 w-4" /> Abrir cámara
            </button>
            <p className="text-xs text-muted">
              El conteo se calcula en tu dispositivo. Ningún video sale del navegador.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
                <video
                  ref={videoRef}
                  className="aspect-video w-full -scale-x-100 object-cover"
                  autoPlay
                  muted
                  playsInline
                  aria-label="Cámara en vivo"
                />
                {isDetecting && (
                  <PoseOverlay
                    canvasRef={canvasRef}
                    videoRef={videoRef}
                    landmarksRef={landmarksRef}
                    highlight={exercise.highlight}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resetReps}
                  className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-volt/50 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" /> Reiniciar contador
                </button>
                <button
                  type="button"
                  onClick={stopEverything}
                  className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent/50 hover:text-white"
                >
                  <Square className="h-4 w-4" /> Detener cámara
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-card p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{exercise.name}</p>
                <p className="mt-2 font-display text-6xl font-bold text-white" aria-live="polite">
                  {poseState.repCount}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">Repeticiones válidas</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Estado</span>
                  <span
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                      STATE_STYLES[poseState.state] ?? 'border-line text-muted'
                    }`}
                  >
                    {poseState.stateLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{exercise.metricLabel}</span>
                  <strong className="text-sm text-volt">
                    {poseState[exercise.metricKey] === null || poseState[exercise.metricKey] === undefined
                      ? '--'
                      : `${Math.round(poseState[exercise.metricKey])}°`}
                  </strong>
                </div>
                {exercise.secondaryMetricKey && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      {exercise.secondaryMetricLabel}
                    </span>
                    <strong className="text-sm text-volt">
                      {poseState[exercise.secondaryMetricKey] === null ||
                      poseState[exercise.secondaryMetricKey] === undefined
                        ? '--'
                        : `${Math.round(poseState[exercise.secondaryMetricKey])}°`}
                    </strong>
                  </div>
                )}
                <p className="rounded-xl bg-black/20 px-3 py-2 text-sm text-white" aria-live="polite">
                  {poseState.feedback}
                </p>
              </div>

              {modelStatus === 'loading' && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando modelo de pose...
                </p>
              )}
              {modelStatus === 'error' && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  No se pudo cargar el detector de pose. Revisa la conexión y recarga la página.
                </p>
              )}
            </div>
          </div>
        )}

        {cameraError && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {cameraError}
          </p>
        )}

        <p className="text-xs leading-relaxed text-muted">{exercise.rules}</p>
      </div>
    </Modal>
  )
}

function enabledPose(showCamera, cameraStatus) {
  return showCamera && cameraStatus === 'ready'
}
