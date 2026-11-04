import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Camera,
  CameraOff,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  LoaderCircle,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useRoutine } from '../context/RoutineContext.jsx'
import { useCamera } from '../hooks/useCamera.js'
import { usePoseDetection } from '../hooks/usePoseDetection.js'
import { useOrientation } from '../hooks/useOrientation.js'
import { useVoiceFeedback } from '../hooks/useVoiceFeedback.js'
import { getExerciseById } from '../lib/exerciseRegistry.js'
import PoseOverlay from './PoseOverlay.jsx'
import MobileControls from './MobileControls.jsx'
import CameraPermissionNotice from './CameraPermissionNotice.jsx'
import RestTimer from './RestTimer.jsx'

export default function RoutineRunner({ onClose }) {
  const {
    status,
    saveStatus,
    retrySave,
    isPaused,
    currentExercise,
    currentSet,
    totalSets,
    targetReps,
    targetDuration,
    preparingCountdown,
    restCountdown,
    routine,
    currentIndex,
    pause,
    resume,
    reset,
    startRoutine,
    routineId,
    routineTitle,
    skipRest,
    exerciseComplete,
  } = useRoutine()

  const [facingMode, setFacingMode] = useState('user')
  const [repCount, setRepCount] = useState(0)
  const [holdSeconds, setHoldSeconds] = useState(0)
  const canvasRef = useRef(null)

  const exerciseMeta = useMemo(
    () => (currentExercise ? getExerciseById(currentExercise.exerciseId) : null),
    [currentExercise],
  )

  const isTimeBased = exerciseMeta?.tipo === 'tiempo'
  const cameraActive = status === 'PREPARING' || status === 'EXERCISING' || status === 'RESTING'
  // Solo la cámara frontal se muestra en espejo (efecto "selfie"); con la
  // trasera el reflejo sería engañoso.
  const isFrontCamera = facingMode === 'user'

  const { videoRef, status: cameraStatus, error: cameraError, errorCode, start: startCamera, stop: stopCamera } = useCamera({
    facingMode,
    active: cameraActive,
  })

  const { poseState, modelStatus, landmarksRef, resetReps, performance } = usePoseDetection({
    enabled: cameraActive && cameraStatus === 'ready',
    videoRef,
    exercise: currentExercise?.exerciseId ?? 'squat',
    targetSeconds: targetDuration || 30,
  })

  const { voiceEnabled, toggleVoice } = useVoiceFeedback({ ...poseState, repCount })

  // Girar el teléfono no reinicia la cámara: solo cambia la proporción del
  // encuadre, de modo que el cuerpo entra completo en vertical y en horizontal.
  const { isPortrait } = useOrientation()

  const previousFrameRef = useRef(null)
  const previousRepRef = useRef(null)
  const completedSetRef = useRef(null)
  useEffect(() => {
    if (status !== 'EXERCISING' || isPaused) {
      previousFrameRef.current = null
      previousRepRef.current = null
      return
    }
    const setKey = currentIndex + ':' + currentSet
    const rawReps = poseState.repCount ?? 0
    const repDelta = previousRepRef.current === null ? 0 : Math.max(0, rawReps - previousRepRef.current)
    previousRepRef.current = rawReps
    if (repDelta) setRepCount(value => value + repDelta)
    const count = repCount
    // Integrate only the analyzer's valid hold deltas; invalid posture and pause add zero.
    const nowHold = poseState.holdSeconds ?? 0
    const previous = previousFrameRef.current
    const delta = previous !== null && poseState.isTimerRunning ? Math.max(0, nowHold - previous) : 0
    previousFrameRef.current = nowHold
    if (delta) setHoldSeconds(value => value + delta)
    const reached = isTimeBased ? holdSeconds >= targetDuration && targetDuration > 0 : count >= targetReps && targetReps > 0
    if (reached && completedSetRef.current !== setKey) {
      completedSetRef.current = setKey
      exerciseComplete(count, isTimeBased ? holdSeconds : 0)
    }
  }, [status, isPaused, poseState, targetReps, targetDuration, isTimeBased, exerciseComplete, currentIndex, currentSet, holdSeconds, repCount])
  useEffect(() => {
    if (status === 'PREPARING') {
      setRepCount(0)
      setHoldSeconds(0)
      resetReps()
      previousFrameRef.current = null
      previousRepRef.current = null
    }
  }, [status, currentIndex, currentSet, resetReps])

  const handleClose = useCallback(() => {
    stopCamera()
    reset()
    onClose?.()
  }, [stopCamera, reset, onClose])

  const toggleCamera = useCallback(() => {
    // getUserMedia no reencuadra un video ya abierto: hay que liberar el stream
    // para que useCamera vuelva a pedirlo con la otra cámara.
    stopCamera()
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }, [stopCamera])

  const progress = useMemo(() => {
    if (isTimeBased) {
      return targetDuration > 0 ? Math.min(holdSeconds / targetDuration, 1) : 0
    }
    return targetReps > 0 ? Math.min(repCount / targetReps, 1) : 0
  }, [isTimeBased, holdSeconds, targetDuration, repCount, targetReps])

  const overallProgress = useMemo(() => {
    if (!routine.length) return 0
    const exerciseProgress = (currentIndex + (currentSet - 1 + progress) / totalSets) / routine.length
    return status === 'COMPLETED' ? 1 : Math.min(exerciseProgress, 1)
  }, [routine.length, currentIndex, currentSet, totalSets, progress, status])

  if (!currentExercise) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent/50 hover:text-white"
            aria-label="Cerrar rutina"
          >
            <CameraOff className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Ejercicio {currentIndex + 1} de {routine.length}</p>
            <p className="font-display text-lg font-bold text-white">{exerciseMeta?.nombre ?? 'Ejercicio'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-volt/40 bg-volt/10 px-3 py-1.5 text-sm font-bold text-volt">
            Serie {currentSet}/{totalSets}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* pb-32 deja libre la barra fija de controles de móvil al final del scroll. */}
        <div className="mx-auto max-w-5xl p-4 pb-32 md:p-6">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted">
              <span>Progreso general</span>
              <span>{Math.round(overallProgress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-volt transition-all duration-300"
                style={{ width: `${overallProgress * 100}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-gray-900">
              <video
                ref={videoRef}
                className={`w-full object-cover ${isPortrait ? 'aspect-[3/4]' : 'aspect-video'} ${
                  isFrontCamera ? '-scale-x-100' : ''
                }`}
                autoPlay
                muted
                playsInline
                aria-label="Cámara en vivo"
              />
              {cameraStatus === 'ready' && (
                <PoseOverlay
                  canvasRef={canvasRef}
                  videoRef={videoRef}
                  landmarksRef={landmarksRef}
                  highlight={[11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]}
                  mirrored={isFrontCamera}
                />
              )}

              {/* Los avisos van en una banda superior y el centro del encuadre
                  queda libre: en pantallas pequeñas un overlay centrado tapaba
                  justo la zona del cuerpo que el usuario debe corregir. */}
              {(status === 'PREPARING' || status === 'RESTING' || (isPaused && status !== 'COMPLETED')) && (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent px-3 py-2 sm:px-4 sm:py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                      {status === 'PREPARING' ? 'Prepárate' : status === 'RESTING' ? 'Descanso' : 'Pausado'}
                    </p>
                    <p className="truncate text-xs text-white sm:text-sm">
                      {status === 'PREPARING'
                        ? (exerciseMeta?.nombre ?? 'Ejercicio')
                        : status === 'RESTING'
                          ? `Siguiente: ${getExerciseById(routine[currentIndex + 1]?.exerciseId)?.nombre ?? '—'}`
                          : 'Toca Reanudar para seguir'}
                    </p>
                  </div>
                  {(status === 'PREPARING' || status === 'RESTING') && (
                    <p
                      className={`shrink-0 font-display text-4xl font-bold leading-none sm:text-5xl ${
                        status === 'PREPARING' ? 'text-volt' : 'text-accent'
                      }`}
                    >
                      {status === 'PREPARING' ? preparingCountdown : restCountdown}
                    </p>
                  )}
                  {isPaused && status !== 'COMPLETED' && <Pause className="h-7 w-7 shrink-0 text-white" />}
                </div>
              )}

              {/* Al terminar la sesión ya no importa ver el cuerpo, así que el
                  aviso de completion sí puede ocupar el centro. */}
              {status === 'COMPLETED' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-4 text-center">
                  <CheckCircle2 className="mb-3 h-12 w-12 text-volt sm:mb-4 sm:h-16 sm:w-16" />
                  <p className="font-display text-2xl font-bold text-white sm:text-3xl">¡Rutina completada!</p>
                  <p className="mt-2 text-sm text-muted">Has terminado todos los ejercicios</p>
                </div>
              )}

              {modelStatus === 'loading' && (
                <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs text-white sm:text-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Cargando modelo...
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-line bg-card p-4 text-center sm:p-5">
                <p className="text-xs uppercase tracking-widest text-muted">
                  {isTimeBased ? 'Segundos restantes en postura válida' : 'Repeticiones'}
                </p>
                <p className="mt-1 font-display text-5xl font-bold leading-none text-white sm:mt-2 sm:text-6xl">
                  {isTimeBased ? Math.max(0, Math.ceil(targetDuration - holdSeconds)) : repCount}
                </p>
                <p className="mt-1 text-sm text-muted">
                  de {isTimeBased ? `${targetDuration}s` : targetReps}
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-volt transition-all duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Ángulo</span>
                  <span className="font-bold text-volt">
                    {poseState.angle !== null && poseState.angle !== undefined
                      ? `${Math.round(poseState.angle)}°`
                      : '--'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">Estado</span>
                  <span className="font-semibold text-white">{poseState.postureState ?? '—'}</span>
                </div>
                <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-white" aria-live="polite">
                  {poseState.feedback ?? 'Colócate en posición'}
                </p>
                {performance && (
                  <p className="mt-2 text-xs text-muted">
                    Detección {performance.fps} FPS
                    {performance.isDegraded && (
                      <span className="text-volt"> · calidad {performance.level}</span>
                    )}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={isPaused ? resume : pause}
                  disabled={status === 'COMPLETED' || status === 'IDLE'}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white transition hover:bg-accent-hover disabled:opacity-40"
                >
                  {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  {isPaused ? 'Reanudar' : 'Pausar'}
                </button>
                <button
                  onClick={toggleVoice}
                  className={`flex h-14 w-14 items-center justify-center rounded-xl border font-bold transition ${
                    voiceEnabled
                      ? 'border-volt/50 bg-volt/10 text-volt'
                      : 'border-line text-muted hover:border-volt/50 hover:text-white'
                  }`}
                  aria-label={voiceEnabled ? 'Silenciar voz' : 'Activar voz'}
                >
                  {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line font-bold text-white transition hover:border-volt/50"
                >
                  <Camera className="h-5 w-5" />
                  {facingMode === 'user' ? 'Frontal' : 'Trasera'}
                </button>
                <button
                  onClick={skipRest}
                  disabled={status !== 'RESTING'}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line font-bold text-white transition hover:border-volt/50 disabled:opacity-40"
                >
                  <SkipForward className="h-5 w-5" />
                  Saltar
                </button>
                <button
                  onClick={() => {
                    completedSetRef.current = null
                    previousFrameRef.current = null
                    previousRepRef.current = null
                    resetReps()
                    setRepCount(0)
                    setHoldSeconds(0)
                  }}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line font-bold text-white transition hover:border-volt/50"
                >
                  <RotateCcw className="h-5 w-5" />
                  Reiniciar
                </button>
              </div>

              <RestTimer />
              {status === 'COMPLETED' && <p role="status" className="text-sm text-muted">{saveStatus === 'saved' ? 'Sesión guardada en tu historial.' : saveStatus === 'failed' ? 'No se pudo guardar el historial. Revisa tu conexión y tu sesión.' : 'Guardando sesión...'}</p>}
              {status === 'COMPLETED' && saveStatus === 'failed' && <button onClick={retrySave} className="min-h-12 rounded-xl border border-line px-4">Reintentar guardar sesión</button>}
              <CameraPermissionNotice
                error={cameraError}
                errorCode={errorCode}
                onRetry={startCamera}
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-card p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted">Ejercicios de la rutina</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {routine.map((ex, idx) => {
                const meta = getExerciseById(ex.exerciseId)
                const isCurrent = idx === currentIndex
                const isDone = idx < currentIndex
                return (
                  <div
                    key={`${ex.exerciseId}-${idx}`}
                    className={`flex min-w-[140px] flex-col rounded-xl border p-3 ${
                      isCurrent
                        ? 'border-accent bg-accent/10'
                        : isDone
                        ? 'border-volt/40 bg-volt/5'
                        : 'border-line bg-gray-800'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{meta?.nombre ?? ex.exerciseId}</p>
                    <p className="mt-1 text-xs text-muted">
                      {meta?.tipo === 'tiempo' ? `${ex.targetDuration}s` : `${ex.targetReps} reps`} · {ex.sets} series
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <MobileControls
        facingMode={facingMode}
        onToggleCamera={toggleCamera}
        onClose={handleClose}
        onRestart={() => { completedSetRef.current = null; resetReps(); startRoutine(routine, { routineId, routineTitle }) }}
      />
    </div>
  )
}
