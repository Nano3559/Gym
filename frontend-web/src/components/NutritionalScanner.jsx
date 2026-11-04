import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Flame,
  LoaderCircle,
  RotateCcw,
  ScanSearch,
  Upload,
  Beef,
  Wheat,
  Droplet,
  TriangleAlert,
} from 'lucide-react'
import Modal from './ui/Modal'
import useCamera from '../hooks/useCamera'
import { blobToFile, optimizeImageSource } from '../lib/imageOptimize'
import { analyzeFoodNutrition, isNutritionServiceConfigured } from '../services/nutritionService'
import MealEntry from './MealEntry.jsx'

// Escáner nutricional: foto con cámara o desde la galería, y una tarjeta con las
// calorías y los macros devueltos por la IA, con aviso si la imagen no es comida.

const PREVIEW_MAX_EDGE = 640
const CAPTURE_MAX_EDGE = 1024

// Referencia visual de la barra de calorías (una comida habitual).
const KCAL_REFERENCE = 700
const KCAL_PER_GRAM = { proteinas_g: 4, carbohidratos_g: 4, grasas_g: 9 }

const MACROS = [
  { field: 'proteinas_g', label: 'Proteínas', icon: Beef, color: 'bg-accent' },
  { field: 'carbohidratos_g', label: 'Carbohidratos', icon: Wheat, color: 'bg-volt' },
  { field: 'grasas_g', label: 'Grasas', icon: Droplet, color: 'bg-sky-500' },
]

export default function NutritionalScanner({ open, onClose }) {
  const uploadInputRef = useRef(null)
  const abortRef = useRef(null)
  const shotCountRef = useRef(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 'idle' | 'saving' | 'saved' | 'failed' | 'sin_sesion'
  const [configured] = useState(() => isNutritionServiceConfigured())

  const { videoRef, status: cameraStatus, error: cameraError, setError: setCameraError, stop } = useCamera({
    facingMode,
    active: open && cameraActive,
  })

  useEffect(() => {
    if (!preview) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // Libera cámara y peticiones en vuelo al desmontar el modal.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      stop()
    },
    [stop],
  )

  const reset = () => {
    abortRef.current?.abort()
    stop()
    setCameraActive(false)
    setFile(null)
    setPreview('')
    setResult(null)
    setError('')
    setLoading(false)
  }

  const selectFile = (nextFile) => {
    if (!nextFile) return
    abortRef.current?.abort()
    setFile(nextFile)
    setPreview(URL.createObjectURL(nextFile))
    setResult(null)
    setError('')
  }

  const handleFile = (event) => {
    selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  const openCamera = () => {
    setError('')
    setCameraError('')
    setCameraActive(true)
  }

  const closeCamera = () => {
    stop()
    setCameraActive(false)
  }

  // Cambiar de cámara exige liberar el stream: getUserMedia no puede reencuadrar
  // un video ya abierto, así que se detiene y useCamera lo vuelve a pedir.
  const toggleFacingMode = () => {
    stop()
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  const handleAnalyzeFile = useCallback(
    async (targetFile) => {
      if (!targetFile) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError('')
        try {
        const analysis = await analyzeFoodNutrition(targetFile, { signal: controller.signal })
        if (controller.signal.aborted) return
        setResult(analysis)
      } catch (analysisError) {
        if (analysisError.name === 'AbortError') return
        setError(analysisError.message)
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
          setLoading(false)
        }
      }
    },
    [],
  )

  // Captura UNA sola imagen y la optimiza antes de cualquier análisis.
  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setError('La cámara todavía no está lista. Inténtalo de nuevo.')
      return
    }

    try {
    const analysisBlob = await optimizeImageSource(video, { maxEdge: CAPTURE_MAX_EDGE, quality: 0.8 })
    if (!analysisBlob) {
      setError('No se pudo capturar la foto.')
      return
    }

    const previewBlob = await optimizeImageSource(video, { maxEdge: PREVIEW_MAX_EDGE, quality: 0.6 })
    shotCountRef.current += 1
    const analysisFile = blobToFile(analysisBlob, `comida-analisis-${shotCountRef.current}.jpg`)

    setFile(analysisFile)
    setPreview(URL.createObjectURL(blobToFile(previewBlob || analysisBlob, `comida-${shotCountRef.current}.jpg`)))
    setResult(null)
    setError('')
    closeCamera()

    // El análisis arranca solo con la foto ya capturada, nunca por frame.
    void handleAnalyzeFile(analysisFile)
    } catch (captureError) { setError(captureError.message || 'No se pudo capturar la foto.') }
  }

  const handleAnalyze = () => {
    if (!file || loading) return
    void handleAnalyzeFile(file)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const showCamera = cameraActive && (cameraStatus === 'starting' || cameraStatus === 'ready')
  const showCameraToggle = facingMode === 'user'

  // Cada barra de macro usa su aporte calórico sobre el total de macros, que es
  // la comparación que significa algo; los gramos van en la etiqueta.
  const macroKcalTotal = result
    ? MACROS.reduce((sum, macro) => sum + result[macro.field] * KCAL_PER_GRAM[macro.field], 0)
    : 0

  return (
    <Modal open={open} onClose={handleClose} title="Escáner nutricional" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div>
          <p className="section-label">
            <ScanSearch className="h-4 w-4" /> Análisis nutricional por IA
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Fotografía tu plato o elige una imagen para estimar calorías y macros.
          </p>
        </div>

        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {showCamera ? (
          <div className="overflow-hidden rounded-2xl border border-accent/50 bg-black">
            <video
              ref={videoRef}
              className={`aspect-video w-full object-cover ${showCameraToggle ? '-scale-x-100' : ''}`}
              autoPlay
              muted
              playsInline
              aria-label="Vista previa de la cámara"
            />
            <div className="flex flex-wrap justify-between gap-3 p-4">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted transition hover:text-white"
              >
                <CameraOff className="h-4 w-4" />
                {showCameraToggle ? 'Usar trasera' : 'Usar frontal'}
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="min-h-12 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted transition hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={cameraStatus !== 'ready'}
                className="btn-sheen inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
              >
                {cameraStatus === 'starting' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {cameraStatus === 'starting' ? 'Abriendo cámara...' : 'Capturar foto'}
              </button>
            </div>
          </div>
        ) : !preview ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={openCamera}
              className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 px-5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent/20"
            >
              <Camera className="h-8 w-8 text-accent" />
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-card px-5 text-sm font-bold uppercase tracking-wide text-white transition hover:border-volt/60"
            >
              <Upload className="h-8 w-8 text-volt" />
              Subir foto
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <img src={preview} alt="Comida seleccionada para analizar" className="max-h-80 w-full object-cover" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-muted transition hover:text-white"
              >
                <RotateCcw className="h-4 w-4" /> Elegir otra
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="btn-sheen inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {loading ? 'Analizando...' : result ? 'Analizar de nuevo' : 'Analizar plato'}
              </button>
            </div>
          </div>
        )}

        {cameraError && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{cameraError}</p>
        )}
        {!configured && (
          <p className="rounded-xl border border-volt/30 bg-volt/5 px-4 py-3 text-sm text-volt">
            El análisis no está disponible en este momento. Puedes volver a intentarlo más tarde.
          </p>
        )}
        {loading && (
          <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-white" aria-live="polite">
            Analizando comida...
          </p>
        )}
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        {result && (
          <section className="space-y-4 rounded-2xl border border-volt/30 bg-volt/5 p-5" aria-live="polite">
            {!result.es_comida && (
              <div className="flex items-start gap-2 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-volt">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">
                  La imagen no parece una comida. Los valores pueden no ser fiables, prueba con una foto más clara del plato.
                </span>

              </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt">Análisis completado</p>
                <h4 className="mt-1 break-words font-display text-2xl font-bold uppercase text-white">{result.alimento}</h4>
                {result.descripcion && <p className="mt-1 text-sm text-muted">{result.descripcion}</p>}
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-white">
                <Flame className="h-4 w-4" />
                <strong className="text-lg">{result.calorias}</strong>
                <span className="text-xs">kcal</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                <span>Calorías</span>
                <span className="text-white">
                  {result.calorias} / {KCAL_REFERENCE} kcal
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${Math.min((result.calorias / KCAL_REFERENCE) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {MACROS.map((macro) => {
                const grams = result[macro.field]
                const share = macroKcalTotal > 0 ? (grams * KCAL_PER_GRAM[macro.field]) / macroKcalTotal : 0
                const Icon = macro.icon
                return (
                  <div key={macro.field} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted">
                        <Icon className="h-4 w-4" />
                        {macro.label}
                      </span>
                      <strong className="text-white">{grams} g</strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/40">
                      <div
                        className={`h-full rounded-full ${macro.color} transition-[width] duration-500`}
                        style={{ width: `${share * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <MealEntry key={preview + result.alimento} source="scan" analysis={result} />
          </section>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Los valores son una estimación visual y pueden variar según ingredientes, preparación y tamaño de la porción.
        </p>
      </div>
    </Modal>
  )
}
