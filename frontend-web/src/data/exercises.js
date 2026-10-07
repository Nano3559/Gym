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
]
