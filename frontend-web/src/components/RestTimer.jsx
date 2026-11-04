import { useEffect, useRef, useCallback, useState } from 'react'
import { SkipForward, Plus, Volume2, VolumeX } from 'lucide-react'
import { useRoutine } from '../context/RoutineContext.jsx'
import { getExerciseById } from '../lib/exerciseRegistry.js'

const ALERT_THRESHOLD = 3

export default function RestTimer() {
  const {
    status,
    isPaused,
    restCountdown,
    restDuration,
    routine,
    currentIndex,
    currentSet,
    totalSets,
    skipRest,
    extendRest,
  } = useRoutine()

  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioCtxRef = useRef(null)
  const lastAlertRef = useRef(null)

  const nextExercise = routine[currentIndex + (currentSet >= totalSets ? 1 : 0)]
  const nextMeta = nextExercise ? getExerciseById(nextExercise.exerciseId) : null

  const playAlert = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio no disponible
    }
  }, [soundEnabled])

  useEffect(() => {
    if (status !== 'RESTING' || isPaused) return
    if (restCountdown <= ALERT_THRESHOLD && restCountdown > 0 && lastAlertRef.current !== restCountdown) {
      lastAlertRef.current = restCountdown
      playAlert()
    }
  }, [status, isPaused, restCountdown, playAlert])

  useEffect(() => {
    if (status !== 'RESTING') {
      lastAlertRef.current = null
    }
  }, [status])

  const progress = restDuration > 0 ? Math.min(restCountdown / restDuration, 1) : 0
  const isUrgent = restCountdown <= ALERT_THRESHOLD && restCountdown > 0

  if (status !== 'RESTING') return null

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 text-center">
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setSoundEnabled((prev) => !prev)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-muted transition hover:border-volt/50 hover:text-white"
          aria-label={soundEnabled ? 'Silenciar alerta' : 'Activar alerta'}
        >
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </div>

      <p className="text-sm uppercase tracking-widest text-muted">Descanso</p>

      <p
        className={`font-display text-8xl font-bold transition-colors ${
          isUrgent ? 'animate-pulse text-accent' : 'text-white'
        }`}
        aria-live="polite"
      >
        {restCountdown}
      </p>

      <p className="mt-2 text-sm text-muted">
        {isUrgent ? '¡Prepárate!' : `Siguiente: ${nextMeta?.nombre ?? 'Ejercicio'}`}
      </p>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isUrgent ? 'bg-accent' : 'bg-gradient-to-r from-accent to-volt'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={extendRest}
          className="flex h-14 items-center justify-center gap-2 rounded-xl border border-line font-bold text-white transition hover:border-volt/50"
        >
          <Plus className="h-5 w-5" />
          +10 seg
        </button>
        <button
          onClick={skipRest}
          disabled={isPaused}
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <SkipForward className="h-5 w-5" />
          Saltar
        </button>
      </div>
    </div>
  )
}
