export const DEFAULT_ROUTINES = [
  {
    id: 'fullbody',
    nombre: 'Fullbody',
    descripcion: 'Trabajo completo de todo el cuerpo',
    ejercicios: [
      { exerciseId: 'squat', sets: 3, targetReps: 12, restDuration: 60 },
      { exerciseId: 'pushup', sets: 3, targetReps: 10, restDuration: 60 },
      { exerciseId: 'lunge', sets: 3, targetReps: 10, restDuration: 60 },
      { exerciseId: 'plank', sets: 3, targetDuration: 30, restDuration: 45 },
      { exerciseId: 'deadlift', sets: 3, targetReps: 8, restDuration: 90 },
    ],
  },
  {
    id: 'tren_superior',
    nombre: 'Tren Superior',
    descripcion: 'Pecho, hombros, brazos y espalda',
    ejercicios: [
      { exerciseId: 'bench_press', sets: 4, targetReps: 10, restDuration: 90 },
      { exerciseId: 'shoulder_press', sets: 3, targetReps: 12, restDuration: 60 },
      { exerciseId: 'curl_biceps', sets: 3, targetReps: 12, restDuration: 60 },
      { exerciseId: 'triceps_pushdown', sets: 3, targetReps: 15, restDuration: 60 },
      { exerciseId: 'lateral_raise', sets: 3, targetReps: 15, restDuration: 45 },
    ],
  },
  {
    id: 'tren_inferior',
    nombre: 'Tren Inferior',
    descripcion: 'Piernas, glúteos y core',
    ejercicios: [
      { exerciseId: 'squat', sets: 4, targetReps: 12, restDuration: 90 },
      { exerciseId: 'deadlift_rdl', sets: 3, targetReps: 10, restDuration: 90 },
      { exerciseId: 'lunge', sets: 3, targetReps: 10, restDuration: 60 },
      { exerciseId: 'calf_raise', sets: 4, targetReps: 15, restDuration: 45 },
      { exerciseId: 'wall_sit', sets: 3, targetDuration: 45, restDuration: 60 },
    ],
  },
  {
    id: 'core',
    nombre: 'Core',
    descripcion: 'Abdominales, oblicuos y estabilidad',
    ejercicios: [
      { exerciseId: 'plank', sets: 3, targetDuration: 45, restDuration: 45 },
      { exerciseId: 'crunch', sets: 3, targetReps: 15, restDuration: 45 },
      { exerciseId: 'russian_twist', sets: 3, targetReps: 20, restDuration: 45 },
      { exerciseId: 'dead_bug', sets: 3, targetReps: 10, restDuration: 45 },
      { exerciseId: 'bicycle_crunch', sets: 3, targetReps: 20, restDuration: 45 },
    ],
  },
  {
    id: 'quema_grasa',
    nombre: 'Quema Grasa',
    descripcion: 'Cardio intenso para quemar calorías',
    ejercicios: [
      { exerciseId: 'jumping_jack', sets: 4, targetReps: 30, restDuration: 30 },
      { exerciseId: 'high_knees', sets: 4, targetReps: 20, restDuration: 30 },
      { exerciseId: 'burpee', sets: 3, targetReps: 10, restDuration: 60 },
      { exerciseId: 'mountain_climber', sets: 3, targetReps: 20, restDuration: 45 },
      { exerciseId: 'skater_jump', sets: 3, targetReps: 16, restDuration: 45 },
    ],
  },
  {
    id: 'movilidad',
    nombre: 'Movilidad y Estiramiento',
    descripcion: 'Flexibilidad y recuperación muscular',
    ejercicios: [
      { exerciseId: 'st_hamstring', sets: 2, targetDuration: 30, restDuration: 15 },
      { exerciseId: 'st_quad', sets: 2, targetDuration: 30, restDuration: 15 },
      { exerciseId: 'st_hip_flexor', sets: 2, targetDuration: 30, restDuration: 15 },
      { exerciseId: 'st_pigeon', sets: 2, targetDuration: 30, restDuration: 15 },
      { exerciseId: 'st_childs_pose', sets: 2, targetDuration: 30, restDuration: 15 },
    ],
  },
]
