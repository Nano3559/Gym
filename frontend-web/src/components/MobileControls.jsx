import { Pause, Play, Camera, RotateCcw, Home } from 'lucide-react'
import { useRoutine } from '../context/RoutineContext.jsx'

export default function MobileControls({ facingMode, onToggleCamera, onClose, onRestart }) {
  const {
    status,
    isPaused,
    pause,
    resume,
  } = useRoutine()

  const isActive = status === 'PREPARING' || status === 'EXERCISING' || status === 'RESTING'
  const isCompleted = status === 'COMPLETED'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-black/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-accent/50 hover:text-white"
          aria-label="Cerrar rutina"
        >
          <Home className="h-6 w-6" />
        </button>

        <button
          onClick={onToggleCamera}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-volt/50 hover:text-white"
          aria-label={facingMode === 'user' ? 'Cambiar a cámara trasera' : 'Cambiar a cámara frontal'}
        >
          <Camera className="h-6 w-6" />
        </button>

        <button
          onClick={isPaused ? resume : pause}
          disabled={!isActive || isCompleted}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition hover:bg-accent-hover active:scale-95 disabled:opacity-40 disabled:shadow-none"
          aria-label={isPaused ? 'Reanudar' : 'Pausar'}
        >
          {isPaused ? <Play className="h-10 w-10" /> : <Pause className="h-10 w-10" />}
        </button>

        <button
          onClick={onRestart}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-volt/50 hover:text-white"
          aria-label="Reiniciar rutina"
        >
          <RotateCcw className="h-6 w-6" />
        </button>

        <div className="w-14" />
      </div>
    </div>
  )
}
