// Catálogo de ejercicios analizables por cámara.
// Cada entrada describe un ejercicio y el analizador que le corresponde.
// metricKey/metricLabel indican qué ángulo se muestra en pantalla.

export const AVAILABLE_EXERCISES = [
  {
    id: 'squat',
    name: 'Sentadillas',
    analyzer: 'squat',
    metricKey: 'kneeAngle',
    metricLabel: 'Rodilla',
    highlight: [23, 24, 25, 26, 27, 28],
    description: 'Colócate de lado, de cuerpo entero, a unos 2 metros de la cámara.',
    rules:
      'Una repetición cuenta solo si partes de pie, bajas a una profundidad suficiente, mantienes la posición baja y ' +
      'vuelves a la posición inicial. Los movimientos incompletos no suman.',
  },
  {
    id: 'pushup',
    name: 'Flexiones',
    analyzer: 'pushup',
    metricKey: 'elbowAngle',
    metricLabel: 'Codo',
    secondaryMetricKey: 'bodyAngle',
    secondaryMetricLabel: 'Cuerpo',
    highlight: [11, 12, 13, 14, 15, 16, 23, 24, 27, 28],
    description: 'Colócate de lado, con la cámara a la altura del suelo y todo el cuerpo visible.',
    rules:
      'Una repetición cuenta solo si partes con los brazos extendidos, bajas hasta flexionar los codos manteniendo el ' +
      'cuerpo recto y vuelves a estirar los brazos. Las flexiones incompletas o con las caderas caídas no suman.',
  },
  {
    id: 'curl',
    name: 'Curl de bíceps',
    analyzer: 'curl',
    metricKey: 'elbowAngle',
    metricLabel: 'Codo',
    highlight: [11, 12, 13, 14, 15, 16],
    description: 'Colócate de lado, de cuerpo entero, y flexiona el codo llevando la mano hacia el hombro.',
    rules:
      'Una repetición cuenta solo si partes con el brazo estirado, flexionas el codo hasta la contracción máxima y ' +
      'vuelves a estirar el brazo. Los curls incompletos no suman.',
  },
  {
    id: 'lateralRaise',
    name: 'Elevaciones laterales',
    analyzer: 'lateralRaise',
    metricKey: 'shoulderAngle',
    metricLabel: 'Hombro',
    highlight: [11, 12, 13, 14, 23, 24],
    description: 'Colócate de frente a la cámara, con los brazos caídos al costado del cuerpo.',
    rules:
      'Una repetición cuenta solo si partes con los brazos caídos, los elevas hasta la altura del hombro (brazos en ' +
      '"T") y vuelves a bajarlos. Las elevaciones incompletas no suman.',
  },
  {
    id: 'lunge',
    name: 'Zancadas',
    analyzer: 'lunge',
    metricKey: 'frontKneeAngle',
    metricLabel: 'Rodilla delantera',
    secondaryMetricKey: 'backKneeAngle',
    secondaryMetricLabel: 'Rodilla trasera',
    highlight: [23, 24, 25, 26, 27, 28],
    description: 'Colócate de lado, con el cuerpo entero visible, y da un paso hacia adelante.',
    rules:
      'Una repetición cuenta solo si la rodilla delantera se dobla hasta los ~90° mientras la rodilla trasera baja, ' +
      'y luego vuelves a subir. Las zancadas incompletas o sin bajar la rodilla trasera no suman.',
  },
  {
    id: 'calfRaise',
    name: 'Elevación de pantorrillas',
    analyzer: 'calfRaise',
    metricKey: 'ankleAngle',
    metricLabel: 'Tobillo',
    highlight: [11, 12, 23, 24, 25, 26, 27, 28, 31, 32],
    description: 'Colócate de frente a la cámara, de cuerpo entero, con los pies apoyados en el suelo.',
    rules:
      'Una repetición cuenta solo si subes apoyándote en la punta de los pies (los hombros se elevan) y vuelves a ' +
      'bajar. Se valida la elevación vertical; los rebotes sin completar la bajada no suman.',
  },
  {
    id: 'jack',
    name: 'Polichinelas',
    analyzer: 'jack',
    metricKey: 'spreadAngle',
    metricLabel: 'Piernas',
    highlight: [0, 7, 8, 15, 16, 23, 24, 27, 28],
    description: 'Colócate de frente a la cámara, de cuerpo entero, con los pies juntos.',
    rules:
      'Una repetición cuenta solo si abres las piernas mientras subes los brazos por encima de la cabeza y vuelves a ' +
      'cerrar la posición. Los saltos incompletos no suman.',
  },
  {
    id: 'highKnee',
    name: 'Rodillas arriba',
    analyzer: 'highKnee',
    metricKey: 'hipAngle',
    metricLabel: 'Cadera',
    highlight: [11, 12, 23, 24, 25, 26],
    description: 'Colócate de frente a la cámara, con el cuerpo y las piernas visibles.',
    rules:
      'Cada pierna cuenta una repetición cuando su rodilla llega a la altura de la cadera. La rodilla debe bajar ' +
      'claramente antes de volver a contar.',
  },
]
