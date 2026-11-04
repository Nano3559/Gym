import { EXERCISE_REGISTRY } from '../lib/exerciseRegistry.js'

const METRIC_MAP = {
  squat: { key: 'kneeAngle', label: 'Rodilla' },
  pushup: { key: 'elbowAngle', label: 'Codo' },
  curl_biceps: { key: 'elbowAngle', label: 'Codo' },
  lateral_raise: { key: 'shoulderAngle', label: 'Hombro' },
  lunge: { key: 'frontKneeAngle', label: 'Rodilla delantera' },
  calf_raise: { key: 'ankleAngle', label: 'Tobillo' },
  jumping_jack: { key: 'spreadAngle', label: 'Piernas' },
  high_knees: { key: 'hipAngle', label: 'Cadera' },
}

const HIGHLIGHT_MAP = {
  squat: [23, 24, 25, 26, 27, 28],
  pushup: [11, 12, 13, 14, 15, 16, 23, 24, 27, 28],
  curl_biceps: [11, 12, 13, 14, 15, 16],
  lateral_raise: [11, 12, 13, 14, 23, 24],
  lunge: [23, 24, 25, 26, 27, 28],
  calf_raise: [11, 12, 23, 24, 25, 26, 27, 28, 31, 32],
  jumping_jack: [0, 7, 8, 15, 16, 23, 24, 27, 28],
  high_knees: [11, 12, 23, 24, 25, 26],
}

const DESCRIPTION_MAP = {
  squat: 'Colócate de lado, de cuerpo entero, a unos 2 metros de la cámara.',
  pushup: 'Colócate de lado, con la cámara a la altura del suelo y todo el cuerpo visible.',
  curl_biceps: 'Colócate de lado, de cuerpo entero, y flexiona el codo llevando la mano hacia el hombro.',
  lateral_raise: 'Colócate de frente a la cámara, con los brazos caídos al costado del cuerpo.',
  lunge: 'Colócate de lado, con el cuerpo entero visible, y da un paso hacia adelante.',
  calf_raise: 'Colócate de frente a la cámara, de cuerpo entero, con los pies apoyados en el suelo.',
  jumping_jack: 'Colócate de frente a la cámara, de cuerpo entero, con los pies juntos.',
  high_knees: 'Colócate de frente a la cámara, con el cuerpo y las piernas visibles.',
}

const RULES_MAP = {
  squat: 'Una repetición cuenta solo si partes de pie, bajas a una profundidad suficiente, mantienes la posición baja y vuelves a la posición inicial. Los movimientos incompletos no suman.',
  pushup: 'Una repetición cuenta solo si partes con los brazos extendidos, bajas hasta flexionar los codos manteniendo el cuerpo recto y vuelves a estirar los brazos. Las flexiones incompletas o con las caderas caídas no suman.',
  curl_biceps: 'Una repetición cuenta solo si partes con el brazo estirado, flexionas el codo hasta la contracción máxima y vuelves a estirar el brazo. Los curls incompletos no suman.',
  lateral_raise: 'Una repetición cuenta solo si partes con los brazos caídos, los elevas hasta la altura del hombro (brazos en "T") y vuelves a bajarlos. Las elevaciones incompletas no suman.',
  lunge: 'Una repetición cuenta solo si la rodilla delantera se dobla hasta los ~90° mientras la rodilla trasera baja, y luego vuelves a subir. Las zancadas incompletas o sin bajar la rodilla trasera no suman.',
  calf_raise: 'Una repetición cuenta solo si subes apoyándote en la punta de los pies (los hombros se elevan) y vuelves a bajar. Se valida la elevación vertical; los rebotes sin completar la bajada no suman.',
  jumping_jack: 'Una repetición cuenta solo si abres las piernas mientras subes los brazos por encima de la cabeza y vuelves a cerrar la posición. Los saltos incompletos no suman.',
  high_knees: 'Cada pierna cuenta una repetición cuando su rodilla llega a la altura de la cadera. La rodilla debe bajar claramente antes de volver a contar.',
}

export const AVAILABLE_EXERCISES = EXERCISE_REGISTRY.filter((ex) => ex.estado === 'implementado').map((ex) => {
  const metric = METRIC_MAP[ex.id] || { key: 'angle', label: 'Ángulo' }
  return {
    id: ex.id,
    name: ex.nombre,
    analyzer: ex.id,
    metricKey: metric.key,
    metricLabel: metric.label,
    highlight: HIGHLIGHT_MAP[ex.id] || [11, 12, 23, 24],
    description: DESCRIPTION_MAP[ex.id] || `Colócate en posición para realizar ${ex.nombre.toLowerCase()}.`,
    rules: RULES_MAP[ex.id] || 'Mantén la posición correcta para que la repetición cuente.',
  }
})
