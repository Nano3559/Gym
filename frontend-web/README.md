# frontend-web

Portal web del gimnasio (React + Vite + Tailwind v4 + Supabase).

## Módulos con cámara

### Analizador nutricional (`VisionModal`)

Abre la cámara con `navigator.mediaDevices.getUserMedia`, captura **una sola** foto al
pulsar "Capturar foto", la reduce a 1024 px y la comprime a JPEG antes de enviarla a
Gemini. Mientras espera, la interfaz muestra "Analizando comida..."; al terminar,
"Análisis completado". Si el usuario vuelve a capturar, se cancela la petición en
vuelo (`AbortController`) y no quedan solicitudes duplicadas.

Configuración: define `VITE_GEMINI_API_KEY` en `frontend-web/.env.local`.

### Entrenador de ejercicios (`SquatCoachModal`)

Detección de pose **local** con `@mediapipe/tasks-vision` (modelo `pose_landmarker_lite`).
Ningún frame de video sale del navegador. A partir de los landmarks se calcula el ángulo
`cadera → rodilla → tobillo` (con suavizado por media móvil) y una máquina de estados
`IDLE → STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING` cuenta una repetición
solo si el ciclo se completa con profundidad suficiente.

El modelo se sirve desde `public/mediapipe/pose_landmarker_lite.task` y los binarios wasm
se resuelven en `/mediapipe/wasm` (Vite los expone desde `node_modules` en desarrollo y
los copia a `dist/` en build).

La cámara se libera al cerrar el modal, al desmontar el componente y al ocultar la pestaña.
El entrenador muestra únicamente los ejercicios conectados a su configuración de pose y
a un analizador compatible; los demás ejercicios del catálogo no están disponibles para
conteo por cámara todavía.

## Comandos

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run lint       # oxlint
npm test           # pruebas de la máquina de estados de sentadillas
```

## Despliegue en Netlify

La configuración de la raíz del repositorio (`netlify.toml`) ejecuta el build de
Vite desde `frontend-web` y publica `frontend-web/dist`, con una regla SPA para
que las rutas de la aplicación carguen correctamente.
