const seconds = value => Number.isFinite(value) ? Math.floor(Math.max(0, value)) : 0

export default function ExerciseCounter({ exercise, poseState }) {
  const timed = exercise.tipo === 'tiempo'
  return <div className="rounded-2xl border border-line bg-card p-5 text-center">
    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{exercise.name ?? exercise.nombre}</p>
    <p className="mt-2 font-display text-6xl font-bold text-white" aria-live="polite">
      {timed ? seconds(poseState.holdSeconds) : poseState.repCount}
    </p>
    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
      {timed ? 'Segundos acumulados en postura válida' : 'Repeticiones válidas'}
    </p>
    {timed && exercise.unilateral && <div className="mt-3 text-sm text-muted">
      <p>Izquierdo: {seconds(poseState.holdSecondsLeft)} s · Derecho: {seconds(poseState.holdSecondsRight)} s</p>
      <p>El total corresponde al lado con menos tiempo. Completa ambos lados.</p>
    </div>}
  </div>
}
