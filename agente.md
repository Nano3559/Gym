# 🤖 GUÍA MAESTRA DEL AGENTE DE DESARROLLO (AGENTE.md)

Este documento define la arquitectura, las reglas de código, el catálogo de ejercicios y el plan por Sprints de la aplicación de gimnasio con visión por computadora.

> **Instrucción para el agente:** lee siempre la sección 1 a 5 (reglas). Lee el **catálogo (sección 6)** únicamente si tu tarea necesita implementar o modificar ejercicios. Si tu sprint no lo requiere, omítelo y trabaja solo tu tarea. también le 8. Definición de "Terminado" cada que termines de hacer lo indicado

---

## 1. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite, JavaScript (`.js` / `.jsx`), Tailwind CSS, Lucide React (íconos) |
| Visión por computadora | `@mediapipe/pose` ejecutado **en el cliente** (navegador / canvas) |
| Análisis postural | Analizadores puros en `frontend-web/src/lib/*Analyzer.js` que consumen `geometry.js` |
| Backend y datos | Supabase (PostgreSQL, Auth, RLS, Storage para fotos). Respetar el `.env` existente |
| IA externa | Gemini 1.5 Flash (o OpenAI) vía REST/`fetch`, solo para nutrición |
| Voz y sonido | `window.speechSynthesis` y `AudioContext` nativos (cero librerías) |

---

## 2. Reglas Generales (no negociables)

1. **Modularidad total.** Cada ejercicio o estiramiento tiene su propio archivo en `frontend-web/src/lib/` (ej. `pressMilitarAnalyzer.js`, `plankAnalyzer.js`). Nunca mezclar dos ejercicios en un archivo.
2. **Sin dependencias pesadas.** Prohibido instalar PyTorch, OpenCV, YOLO, TensorFlow local o modelos de IA locales. Espacio en disco local < 2 GB. La visión corre en MediaPipe JS y la nutrición por API REST.
3. **Compatibilidad móvil obligatoria.**
   - Interfaz *mobile-first*, botones táctiles grandes (mínimo 48×48 px).
   - Selector de cámara frontal (`user`) / trasera (`environment`) en **toda** vista con cámara.
   - Canvas de MediaPipe a **640×480** en móviles; objetivo ≥ 30 FPS en iOS Safari y Android Chrome.
   - Soportar orientación vertical y horizontal.
4. **Persistencia en la nube.** Rutinas, historiales y configuraciones van a Supabase. Nunca usar `localStorage` como fuente de verdad (solo caché de UI).
5. **Respetar la interfaz existente.** Tema oscuro con acentos naranja (`#FF5500` / `orange-500`) y bordes estilizados.
6. **Idioma.** Todo texto visible al usuario (feedback, voz, botones) en **español**. Los nombres de archivos, variables y funciones en inglés.
7. **Seguridad.** Nunca escribir claves de API en el código; usar variables de entorno `VITE_*`. Las tablas de Supabase deben tener RLS activado.
8. **No romper lo existente.** Antes de editar, revisar los archivos actuales de `src/lib/`. Si un ejercicio ya existe, ampliarlo, no duplicarlo.

---

## 3. Estructura de Archivos

```
frontend-web/src/
├── lib/
│   ├── geometry.js              # calcAngle, distancia, midpoint, normalización
│   ├── landmarks.js             # constantes de índices de MediaPipe
│   ├── BaseAnalyzer.js          # clase base común
│   ├── AngleRepAnalyzer.js      # base para ejercicios por ángulo (repeticiones)
│   ├── CoordRepAnalyzer.js      # base para ejercicios por coordenadas X/Y
│   ├── IsometricAnalyzer.js     # base para isometría y estiramientos (temporizador)
│   ├── exerciseRegistry.js      # id → analizador + metadatos
│   ├── imageOptimize.js         # compresión de imágenes (nutrición)
│   └── *Analyzer.js             # un archivo por ejercicio
├── context/RoutineContext.jsx   # máquina de estados de la rutina
├── components/
│   ├── CameraView.jsx
│   ├── ExercisePicker.jsx
│   ├── RoutineRunner.jsx
│   ├── RestTimer.jsx
│   └── NutritionalScanner.jsx
├── pages/
│   ├── TrainerRoutineBuilder.jsx
│   └── ClientRoutines.jsx
└── services/nutritionService.js
supabase/migrations/
```

---

## 4. Contrato Obligatorio del Analizador

Todos los analizadores devuelven **exactamente** este objeto en cada frame:

```js
{
  isRepetition: boolean,   // true solo en el frame en que se completa una repetición
  repCount: number,        // repeticiones acumuladas
  feedback: string,        // mensaje corto en español ("Baja más", "Espalda recta")
  angle: number,           // ángulo (o métrica) principal actual
  postureState: string     // 'UP' | 'DOWN' | 'HOLD' | 'INCORRECT' | 'IDLE'
}
```

Los analizadores isométricos añaden además:

```js
{ holdSeconds: number, targetSeconds: number, isTimerRunning: boolean }
```

### Reglas de implementación

- **Histéresis:** una repetición solo cuenta si pasa por `UP → DOWN → UP` (o al revés). Usar umbrales distintos de entrada y salida para evitar rebotes.
- **Suavizado:** promediar el ángulo de los últimos 3-5 frames (media móvil) para eliminar ruido.
- **Visibilidad:** si `landmark.visibility < 0.5` en un punto requerido, devolver `postureState: 'IDLE'` y `feedback: "No te veo completo"`. No contar repeticiones.
- **Lado:** para ejercicios que se ven mejor de perfil, usar automáticamente el lado con mayor visibilidad promedio.
- **Unilaterales:** medir cada lado por separado y exponer `repCountLeft` / `repCountRight`.
- **Anti-trampa:** exigir un tiempo mínimo por repetición (≈ 400 ms) para evitar conteos falsos por movimientos bruscos.
- **Pureza:** los analizadores no tocan el DOM, ni Supabase, ni `fetch`. Solo reciben landmarks y devuelven el objeto.
- **Configuración por datos:** los umbrales viven en un objeto `config` exportado en la parte superior del archivo para poder calibrarlos sin tocar la lógica.

### Índices de MediaPipe Pose (referencia)

| Punto | Izq. | Der. | Punto | Izq. | Der. |
|---|---|---|---|---|---|
| Nariz | 0 | | Cadera | 23 | 24 |
| Hombro | 11 | 12 | Rodilla | 25 | 26 |
| Codo | 13 | 14 | Tobillo | 27 | 28 |
| Muñeca | 15 | 16 | Talón | 29 | 30 |
| Meñique / índice | 17 / 19 | 18 / 20 | Punta del pie | 31 | 32 |

---

## 5. Cómo Añadir un Ejercicio (receta estándar)

1. Elegir la clase base según el tipo (ángulo, coordenadas o isométrico).
2. Crear `src/lib/<nombre>Analyzer.js` con su `config` (landmarks, umbrales arriba/abajo, mensajes).
3. Registrarlo en `exerciseRegistry.js` con: `id`, `nombre`, `categoria`, `musculos`, `tipo` (`reps` | `tiempo`), `vistaCamara` (`frontal` | `lateral`), `unilateral` (bool), `dificultad`.
4. Verificar que aparece en `ExercisePicker.jsx` dentro de su categoría.
5. Probar en móvil (cámara frontal y trasera) antes de marcar como terminado.

> Los umbrales del catálogo son **valores iniciales**: deben calibrarse con pruebas reales y ajustarse en el `config` de cada analizador.

---

## 6. Catálogo Completo de Ejercicios y Estiramientos

**Leyenda:** `Arriba/Inicio` y `Abajo/Fin` son los ángulos objetivo de la medición indicada. **Vista:** F = frontal (cámara de frente), L = lateral (de perfil). ✅ = ya existente en el proyecto, solo se refactoriza al contrato.

### Categoría A — Brazos, pecho, hombros y espalda (ángulos de brazos)

| ID | Ejercicio | Medición (landmarks) | Arriba/Inicio | Abajo/Fin | Vista |
|---|---|---|---|---|---|
| `pushup` ✅ | Flexiones de pecho | Hombro-Codo-Muñeca | 160° | 70° | L |
| `pushup_knees` | Flexiones con rodillas apoyadas | Hombro-Codo-Muñeca | 160° | 75° | L |
| `pushup_wide` | Flexiones abiertas | Hombro-Codo-Muñeca | 160° | 80° | F/L |
| `pushup_diamond` | Flexiones diamante | Hombro-Codo-Muñeca (+ muñecas juntas en X) | 160° | 70° | F |
| `pushup_incline` | Flexiones inclinadas (manos elevadas) | Hombro-Codo-Muñeca | 160° | 75° | L |
| `pushup_decline` | Flexiones declinadas (pies elevados) | Hombro-Codo-Muñeca | 160° | 65° | L |
| `pike_pushup` | Flexiones pike (hombros) | Hombro-Codo-Muñeca | 165° | 80° | L |
| `bench_press` | Press de banca | Hombro-Codo-Muñeca | 165° | 80° | L/F |
| `incline_press` | Press inclinado con mancuernas | Hombro-Codo-Muñeca | 165° | 80° | L |
| `bench_dip` | Fondos en banco | Hombro-Codo-Muñeca | 165° | 90° | L |
| `dip_parallel` | Fondos en paralelas | Hombro-Codo-Muñeca | 165° | 85° | L |
| `curl_biceps` ✅ | Curl de bíceps | Hombro-Codo-Muñeca | 160° | 30° | F/L |
| `curl_hammer` | Curl martillo | Hombro-Codo-Muñeca | 160° | 35° | F |
| `curl_alternate` | Curl alterno (por brazo) | Hombro-Codo-Muñeca por lado | 160° | 30° | F |
| `curl_concentration` | Curl concentrado | Hombro-Codo-Muñeca | 150° | 35° | L |
| `lateral_raise` ✅ | Elevaciones laterales | Cadera-Hombro-Codo | 15° | 85° | F |
| `front_raise` | Elevaciones frontales | Cadera-Hombro-Codo | 15° | 90° | L |
| `rear_delt_fly` | Pájaros (deltoide posterior) | Cadera-Hombro-Codo (torso inclinado) | 20° | 85° | F |
| `shoulder_press` | Press militar / de hombros | Codo-Hombro-Muñeca | 90° | 160° | F |
| `arnold_press` | Press Arnold | Hombro-Codo-Muñeca + rotación de muñeca | 60° | 165° | F |
| `upright_row` | Remo al mentón | Hombro-Codo-Muñeca; muñeca sube hasta Y del pecho | 160° | 60° | F |
| `lat_pulldown` | Jalón al pecho | Hombro-Codo-Muñeca | 160° | 55° | F |
| `pullup` | Dominadas | Hombro-Codo-Muñeca; mentón sobre muñecas | 165° | 50° | F |
| `chinup` | Dominadas supinas | Hombro-Codo-Muñeca | 165° | 45° | F |
| `seated_row` | Remo sentado en polea | Hombro-Codo-Muñeca | 165° | 70° | L |
| `bent_row` | Remo con barra / mancuernas | Hombro-Codo-Muñeca (torso inclinado) | 160° | 60° | L |
| `single_arm_row` | Remo a una mano | Hombro-Codo-Muñeca por lado | 160° | 60° | L |
| `inverted_row` | Remo invertido (bajo barra) | Hombro-Codo-Muñeca | 165° | 70° | L |
| `face_pull` | Face pull | Hombro-Codo-Muñeca; muñecas a la altura del rostro | 165° | 70° | F |
| `triceps_pushdown` | Extensión de tríceps en polea | Hombro-Codo-Muñeca (codo fijo) | 45° | 165° | L |
| `triceps_overhead` | Extensión de tríceps sobre la cabeza | Hombro-Codo-Muñeca | 170° | 60° | L |
| `skullcrusher` | Press francés | Hombro-Codo-Muñeca (acostado) | 170° | 70° | L |
| `triceps_kickback` | Patada de tríceps | Hombro-Codo-Muñeca (torso inclinado) | 90° | 170° | L |

### Categoría B — Piernas, glúteos y cadera (ángulos de piernas y tronco)

| ID | Ejercicio | Medición (landmarks) | Arriba/Inicio | Abajo/Fin | Vista |
|---|---|---|---|---|---|
| `squat` ✅ | Sentadilla | Cadera-Rodilla-Tobillo | 170° | ≤ 90° | L/F |
| `squat_sumo` | Sentadilla sumo | Cadera-Rodilla-Tobillo + apertura X de tobillos | 170° | 95° | F |
| `squat_goblet` | Sentadilla goblet | Cadera-Rodilla-Tobillo | 170° | 90° | L |
| `squat_jump` | Sentadilla con salto | Cadera-Rodilla-Tobillo + salto en Y | 170° | 95° | L |
| `squat_pistol` | Sentadilla a una pierna (pistol) | Cadera-Rodilla-Tobillo por pierna | 170° | 80° | L |
| `squat_cossack` | Sentadilla cosaca | Rodilla activa + apertura X | 170° | 90° | F |
| `squat_bulgarian` | Sentadilla búlgara | Cadera-Rodilla-Tobillo de pierna delantera | 170° | 90° | L |
| `lunge` ✅ | Zancadas | Rodilla delantera por pierna | 170° | 90° | L |
| `lunge_reverse` | Zancada hacia atrás | Rodilla delantera por pierna | 170° | 90° | L |
| `lunge_lateral` | Zancada lateral | Rodilla de la pierna flexionada | 170° | 95° | F |
| `lunge_walking` | Zancadas caminando | Rodilla delantera alterna + avance en X | 170° | 90° | L |
| `step_up` | Subida al cajón | Cadera-Rodilla-Tobillo de pierna de apoyo | 100° | 170° | L |
| `calf_raise` ✅ | Elevación de pantorrillas | Ángulo de tobillo o desplazamiento Y de hombros | base | +Δ Y | L |
| `calf_raise_seated` | Pantorrillas sentado | Rodilla-Tobillo-Punta del pie | 90° | 130° | L |
| `deadlift` | Peso muerto convencional | Hombro-Cadera-Rodilla | 175° | 95° | L |
| `deadlift_rdl` | Peso muerto rumano | Hombro-Cadera-Rodilla (rodillas semiflexionadas) | 175° | 100° | L |
| `deadlift_single_leg` | Peso muerto a una pierna | Hombro-Cadera-Rodilla por lado | 175° | 100° | L |
| `good_morning` | Buenos días | Hombro-Cadera-Rodilla | 175° | 95° | L |
| `hip_thrust` | Empuje de cadera | Hombro-Cadera-Rodilla (reclinado) | 100° | 175° | L |
| `glute_bridge` | Puente de glúteos | Hombro-Cadera-Rodilla (en el suelo) | 110° | 175° | L |
| `leg_press` | Prensa de piernas | Cadera-Rodilla-Tobillo | 90° | 160° | L |
| `leg_extension` | Extensión de cuádriceps | Cadera-Rodilla-Tobillo | 90° | 170° | L |
| `leg_curl` | Curl femoral | Cadera-Rodilla-Tobillo | 170° | 50° | L |
| `donkey_kick` | Patada de glúteo (cuadrupedia) | Hombro-Cadera-Rodilla por pierna | 90° | 170° | L |
| `fire_hydrant` | Hidrante (cuadrupedia) | Apertura X de rodilla respecto a cadera | base | +Δ X | F |
| `side_leg_raise` | Elevación lateral de pierna | Apertura de tobillo respecto a la vertical | 5° | 40° | F |
| `hip_abduction` | Abducción de cadera (máquina/banda) | Apertura X de tobillos | base | +Δ X | F |

### Categoría C — Cardio, core y coordenadas puras (ejes X / Y)

| ID | Ejercicio | Medición | Condición de repetición | Vista |
|---|---|---|---|---|
| `jumping_jack` ✅ | Polichinelas | Apertura X de tobillos + Y de muñecas sobre la cabeza | Abre con brazos arriba → cierra | F |
| `high_knees` ✅ | Rodillas arriba | Y de rodilla vs Y de cadera | Y rodilla supera Y cadera (alterna) | F/L |
| `butt_kicks` | Talones al glúteo | Y de talón vs Y de cadera / rodilla < 70° | Talón sube al nivel del glúteo (alterna) | L |
| `mountain_climber` | Escaladores | Rodilla hacia el pecho en posición de plancha | Rodilla cruza X del hombro (alterna) | L |
| `burpee` | Burpees | Máquina de estados: de pie → plancha → de pie con salto | Ciclo completo | L |
| `skater_jump` | Saltos de patinador | Desplazamiento X de cadera de lado a lado | Cruce de cada extremo | F |
| `seal_jack` | Seal jacks | Apertura X de tobillos + brazos al frente/abiertos | Abre → cierra | F |
| `crunch` | Abdominales crunch | Distancia Y hombros-cadera (acostado) | Se reduce > 25% y vuelve | L |
| `situp` | Abdominales completos | Hombro-Cadera-Rodilla | 130° → 60° | L |
| `bicycle_crunch` | Bicicleta | Codo hacia rodilla opuesta (distancia) | Distancia < umbral (alterna) | F |
| `leg_raise` | Elevación de piernas | Tobillos superan Y de cadera (acostado) | Ángulo Hombro-Cadera-Tobillo 180° → 90° | L |
| `flutter_kick` | Patadas alternas (flutter) | Y de tobillos alterna sobre la cadera | Cruce alterno de Y | L |
| `v_up` | V-up | Hombro-Cadera-Tobillo | 170° → 70° | L |
| `russian_twist` | Giro ruso | Rotación X de hombros respecto a cadera | Hombro cruza el eje central (alterna) | F |
| `toe_touch` | Tocar puntas (alterno) | Muñeca a tobillo opuesto (distancia) | Distancia < umbral | F |
| `dead_bug` | Bicho muerto | Brazo y pierna opuestos extendidos (acostado) | Alterna extensión | L/F |
| `bird_dog` | Perro de caza (dinámico) | Brazo y pierna opuestos alineados con el tronco | Alineación ≥ 165° (alterna) | L |
| `superman` | Superman (dinámico) | Y de muñecas y tobillos sobre la línea del tronco (boca abajo) | Elevación sostenida 1 s y baja | L |
| `side_bend` | Inclinación lateral | Ángulo de columna Hombro-Cadera respecto a la vertical | 0° → 30° (alterna) | F |
| `pec_deck` | Aperturas de pecho (pec deck / flyes) | Distancia X entre muñecas a la altura del pecho | Abierto → cerrado | F |
| `dumbbell_fly` | Aperturas con mancuernas | Hombro-Codo-Muñeca (codo semiflexionado) + X de muñecas | 150° → 100° | F |
| `shrug` | Encogimientos de trapecio | Y de hombros respecto a la oreja/nariz | Sube Δ Y y baja | F |
| `punch_cross` | Golpes de boxeo (sombra) | Extensión de codo + muñeca supera X de hombro | Codo > 160° (alterna) | F |
| `jump_rope` | Salto de cuerda (simulado) | Oscilación Y de cadera/tobillos | Pico de salto | F |

### Categoría D — Isometría (ángulo mantenido + temporizador)

Todos heredan de `IsometricAnalyzer`. El temporizador **corre solo si la postura es válida** y se pausa al perderla. Cada uno define `targetSeconds` configurable.

| ID | Ejercicio | Validación | Pausa si… |
|---|---|---|---|
| `plank` | Plancha | Hombro-Cadera-Tobillo 170°–180° | Cadera < 150° (cae) o > 200° (sube) |
| `plank_forearm` | Plancha en antebrazos | Hombro-Cadera-Tobillo 170°–180°, codo ≈ 90° | Cadera fuera de rango |
| `plank_side` | Plancha lateral | Hombro-Cadera-Tobillo 165°–180° (de frente a la cámara) | Cadera cae < 150° |
| `plank_reverse` | Plancha inversa | Hombro-Cadera-Tobillo 165°–180° | Cadera cae < 150° |
| `hollow_hold` | Hollow hold | Hombro-Cadera-Tobillo 150°–165° con piernas y hombros elevados | Tobillos bajan del umbral |
| `wall_sit` | Sentadilla isométrica en pared | Cadera-Rodilla-Tobillo 85°–100° | Rodilla fuera de rango |
| `squat_hold` | Sentadilla sostenida | Cadera-Rodilla-Tobillo 85°–110° | Se levanta > 120° |
| `glute_bridge_hold` | Puente de glúteos sostenido | Hombro-Cadera-Rodilla 165°–180° | Cadera baja < 150° |
| `dead_hang` | Colgarse de la barra | Codo ≥ 165° con muñecas sobre hombros | Codo < 150° |
| `chin_hold` | Isométrico de dominada | Codo ≈ 90° con mentón sobre barra | Codo > 110° |
| `superman_hold` | Superman sostenido | Muñecas y tobillos elevados sobre el tronco | Bajan del umbral |
| `bird_dog_hold` | Perro de caza sostenido | Brazo y pierna opuestos alineados ≥ 165° | Alineación < 150° |
| `boat_pose` | Postura del bote | Hombro-Cadera-Rodilla ≈ 70°–90° con piernas elevadas | Tobillos bajan |
| `l_sit` | L-sit | Hombro-Cadera-Tobillo ≈ 90° con piernas rectas | Rodilla < 160° o piernas bajan |
| `chair_pose` | Postura de la silla | Cadera-Rodilla-Tobillo 100°–130° con brazos arriba | Brazos bajan |

### Categoría E — Estiramientos (isometría con temporizador regresivo)

Cada estiramiento se mantiene entre 20 y 45 s por lado (configurable). Los de un lado exigen repetir el lado contrario.

| ID | Estiramiento | Validación | Vista |
|---|---|---|---|
| `st_hamstring` | Isquiotibiales (tocar puntas) | Rodillas ≈ 180° y flexión de tronco; distancia muñeca-tobillo decreciente | L |
| `st_quad` | Cuádriceps de pie | Rodilla < 45° (talón al glúteo) con torso erguido | L |
| `st_calf_wall` | Pantorrilla contra pared | Rodilla trasera ≈ 180°, talón apoyado, inclinación de tronco | L |
| `st_hip_flexor` | Flexor de cadera (zancada baja) | Rodilla trasera en el suelo, delantera ≈ 90°, cadera adelantada | L |
| `st_pigeon` | Paloma | Rodilla delantera flexionada, pierna trasera extendida | L/F |
| `st_figure4` | Figura 4 (glúteo/piriforme) | Tobillo sobre rodilla opuesta; flexión de cadera | F |
| `st_butterfly` | Mariposa (aductores) | Rodillas abiertas, plantas juntas (distancia X tobillos < umbral) | F |
| `st_frog` | Rana (aductores) | Apertura X de rodillas amplia, caderas bajas | F |
| `st_cobra` | Cobra (abdomen / lumbar) | Boca abajo, codos ≈ 160°–180°, pecho elevado | L |
| `st_childs_pose` | Postura del niño | Cadera cerca de talones; brazos extendidos al frente | L |
| `st_cat_cow` | Gato-vaca (dinámico) | Alterna flexión/extensión de columna (ángulo Hombro-Cadera) | L |
| `st_downdog` | Perro boca abajo | Hombro-Cadera-Tobillo ≈ 70°–90° con brazos y piernas rectos | L |
| `st_shoulder_cross` | Deltoides (brazo cruzado) | Muñeca cruza el eje central del pecho | F |
| `st_triceps` | Tríceps sobre la cabeza | Codo flexionado detrás de la cabeza, Y de muñeca bajo la nuca | F |
| `st_chest_door` | Pectoral en puerta | Codo ≈ 90° a altura del hombro, tronco adelantado | F |
| `st_lat` | Dorsal (brazo extendido lateral) | Brazo sobre la cabeza + inclinación lateral de tronco | F |
| `st_neck_side` | Cuello lateral | Inclinación de nariz hacia un hombro (Y/X) | F |
| `st_spinal_twist` | Torsión espinal sentado | Rotación X de hombros respecto a cadera | F |
| `st_side_bend` | Inclinación lateral de pie | Columna a ≈ 30°–40° de la vertical | F |
| `st_standing_forward` | Flexión adelante de pie | Cadera-Rodilla ≈ 170° y tronco bajo la cadera | L |

### Categoría F — Calentamiento y movilidad

| ID | Ejercicio | Medición | Vista |
|---|---|---|---|
| `wu_arm_circles` | Círculos de brazos | Trayectoria de muñeca alrededor del hombro (cuenta vueltas) | F |
| `wu_hip_circles` | Círculos de cadera | Trayectoria de cadera en X/Y | F |
| `wu_torso_twist` | Rotación de torso | Rotación X de hombros vs cadera | F |
| `wu_leg_swing` | Balanceo de piernas | Ángulo de cadera adelante/atrás por pierna | L |
| `wu_inchworm` | Gusano (inchworm) | Estados: de pie → plancha → de pie | L |
| `wu_worlds_greatest` | Estiramiento "world's greatest" | Zancada + rotación de torso + mano al suelo | L |
| `wu_shoulder_dislocate` | Pase de hombros (con banda o palo) | Brazos extendidos arriba → atrás, codo ≥ 165° | F |
| `wu_march` | Marcha en el lugar | Y de rodillas alterna | F |

### Categoría G — Equilibrio (isometría con una pierna)

| ID | Ejercicio | Validación | Vista |
|---|---|---|---|
| `bal_single_leg` | Equilibrio a una pierna | Tobillo levantado > umbral Y; cadera estable (variación X pequeña) | F |
| `bal_tree` | Postura del árbol | Rodilla flexionada hacia afuera, pie sobre muslo, manos juntas | F |
| `bal_warrior3` | Guerrero III | Hombro-Cadera-Tobillo ≈ 175° en horizontal sobre una pierna | L |
| `bal_standing_quad` | Equilibrio con cuádriceps | Rodilla < 45° con apoyo en una pierna | L |

> **Total del catálogo:** más de 120 ejercicios y estiramientos. Marcar cada uno en `exerciseRegistry.js` con su estado: `implementado`, `en_progreso` o `pendiente`.

---

## 7. Plan de Ejecución por Sprints

### 🟢 SPRINT 1 — Motor de análisis extendido e isometría

**Objetivo:** completar el catálogo de la sección 6 en `frontend-web/src/lib/`.

- [ ] **1.1 Base común:** crear `BaseAnalyzer`, `AngleRepAnalyzer`, `CoordRepAnalyzer` e `IsometricAnalyzer`, más `landmarks.js` y las utilidades en `geometry.js` (ángulo, distancia, media móvil, visibilidad).
- [ ] **1.2 Registro:** crear `exerciseRegistry.js` (id → analizador + metadatos: categoría, músculos, tipo, vista, unilateral, dificultad).
- [ ] **1.3 Refactor de existentes (✅):** adaptar pushup, curl, lateral raise, squat, lunge, calf raise, jumping jack y high knees al contrato de la sección 4 sin cambiar su comportamiento.
- [ ] **1.4 Categoría A:** brazos, pecho, hombros y espalda.
- [ ] **1.5 Categoría B:** piernas, glúteos y cadera.
- [ ] **1.6 Categoría C:** cardio y core por coordenadas.
- [ ] **1.7 Categorías D y E:** isometría y estiramientos con temporizador regresivo y pausa automática.
- [ ] **1.8 Categorías F y G:** calentamiento, movilidad y equilibrio.
- [ ] **1.9 Selector (`ExercisePicker.jsx`):** grid con pestañas por categoría, búsqueda por nombre y filtros (grupo muscular, dificultad, tipo).

**Criterio de terminado:** cada ejercicio devuelve el objeto del contrato, está registrado y se puede seleccionar y probar en la cámara.

### 🟡 SPRINT 2 — Motor de rutinas y gestor de estados

**Objetivo:** encadenar ejercicios con descansos temporizados.

- [ ] **2.1 Máquina de estados** (`RoutineContext.jsx`): `IDLE ➔ PREPARING ➔ EXERCISING ➔ RESTING ➔ COMPLETED`, con pausa y reinicio.
- [ ] **2.2 `RoutineRunner.jsx`:** ejercicio actual, objetivo (reps o segundos), serie actual y barra de progreso. Transición automática al llegar a la meta.
- [ ] **2.3 Descanso (`RestTimer.jsx`):** cuenta regresiva, botones "+10 seg" y "Saltar descanso", alerta sonora y visual.
- [ ] **2.4 Voz y sonido:** `window.speechSynthesis` para "Empieza el descanso", "Siguiente ejercicio: Sentadillas", y conteo de las últimas 3 repeticiones.
- [ ] **2.5 Rutinas predeterminadas:** *Fullbody*, *Tren Superior*, *Tren Inferior*, *Core*, *Quema Grasa* y *Movilidad y Estiramiento*.
- [ ] **2.6 Móvil:** botón táctil gigante de pausa/reinicio y selector de cámara frontal/trasera.

### 🟠 SPRINT 3 — Panel del entrenador y creador de rutinas

**Objetivo:** que los entrenadores diseñen y asignen rutinas.

- [ ] **3.1 Migraciones** (`supabase/migrations/`): tablas `routines` (`id, title, description, created_by, is_default`) y `routine_exercises` (`id, routine_id, exercise_id, sets, target_reps, target_duration_sec, rest_duration_sec, order_index`), con RLS por rol.
- [ ] **3.2 `TrainerRoutineBuilder.jsx`:** elegir ejercicios del catálogo, definir series, repeticiones o segundos y descansos; reordenar por arrastrar y soltar o con selectores.
- [ ] **3.3 Asignación:** tabla de asignaciones rutina ➔ cliente y vista del entrenador con sus clientes.
- [ ] **3.4 `ClientRoutines.jsx`:** rutinas asignadas y predeterminadas, con botón "Iniciar" que abre el visor de cámara.
- [ ] **3.5 Historial:** guardar sesiones completadas (fecha, ejercicios, repeticiones, duración) en Supabase.

### 🔴 SPRINT 4 — Escáner nutricional por IA

**Objetivo:** analizar comida por fotografía con Gemini 1.5 Flash.

- [ ] **4.1 `imageOptimize.js`:** redimensionar a máx. 1024×1024 y comprimir a JPEG/WebP (calidad 0.8, < 300 KB).
- [ ] **4.2 `nutritionService.js`:** `fetch` a la API enviando la imagen en base64 y exigiendo JSON estricto: `alimento, descripcion, calorias, proteinas_g, carbohidratos_g, grasas_g, es_comida`. Validar y manejar errores de la respuesta.
- [ ] **4.3 `NutritionalScanner.jsx`:** tomar foto con cámara o subir desde galería; tarjeta con barras de kcal, proteínas, carbohidratos y grasas; aviso si `es_comida` es falso.
- [ ] **4.4 Supabase:** migración de `public.meal_logs` (con RLS) y guardado automático en el diario del socio activo.

### 📱 SPRINT 5 — Optimización móvil, PWA y pulido

**Objetivo:** que funcione como app nativa en iOS y Android.

- [ ] **5.1 Responsive:** que los *overlays* de ángulos y conteo no tapen el cuerpo en pantallas pequeñas.
- [ ] **5.2 Permisos y orientación:** manejo claro del permiso de cámara rechazado; soporte vertical y horizontal durante el entrenamiento.
- [ ] **5.3 PWA:** `manifest.json`, íconos, *service worker* básico y "Añadir a pantalla de inicio".
- [ ] **5.4 Rendimiento:** medir FPS en dispositivos reales (meta ≥ 30 FPS), reducir resolución o frecuencia de inferencia si baja.
- [ ] **5.5 Pruebas finales** de layout y rendimiento en iOS Safari y Android Chrome.

---

## 8. Definición de "Terminado" (para cualquier tarea)

- [ ] Cumple el contrato del analizador (sección 4) y las reglas generales (sección 2).
- [ ] Funciona en móvil con cámara frontal y trasera.
- [ ] No se añadieron dependencias pesadas ni claves en el código.
- [ ] Los textos para el usuario están en español y el estilo respeta el tema oscuro/naranja.
- [ ] Los umbrales están en un `config` calibrable.
- [ ] El ejercicio o módulo está registrado y visible en la interfaz.



