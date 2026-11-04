import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Flame, LoaderCircle, RotateCcw, ScanSearch, Upload } from 'lucide-react'
import Modal from './ui/Modal'
import useCamera from '../hooks/useCamera'
import { blobToFile, optimizeImageSource } from '../lib/imageOptimize'
import { analyzeFoodImage, isGeminiConfigured } from '../services/geminiVisionService'

const PREVIEW_MAX_EDGE = 640

export default function VisionModal({ open, onClose }) {
  const uploadInputRef = useRef(null)
  const abortRef = useRef(null)
  const shotCountRef = useRef(0)
  const [cameraActive, setCameraActive] = useState(false)
  const { videoRef, status: cameraStatus, error: cameraError, setError: setCameraError, stop } = useCamera({
    facingMode: 'environment',
    active: open && cameraActive,
  })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [geminiReady] = useState(() => isGeminiConfigured())

  useEffect(() => {
    if (!preview) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // Libera cámara y peticiones en vuelo al desmontar el modal.
  useEffect(() => () => {
    abortRef.current?.abort()
    stop()
  }, [stop])

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

  // Captura UNA sola imagen y la optimiza antes de cualquier análisis.
  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setError('La cámara todavía no está lista. Inténtalo de nuevo.')
      return
    }

    const analysisBlob = await optimizeImageSource(video, { maxEdge: 1024, quality: 0.72 })
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
  }

  const handleAnalyzeFile = async (targetFile) => {
    if (!targetFile) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError('')
    try {
      const analysis = await analyzeFoodImage(targetFile, { signal: controller.signal })
      if (!controller.signal.aborted) setResult(analysis)
    } catch (analysisError) {
      if (analysisError.name === 'AbortError') return
      setError(analysisError.message)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }

  const handleAnalyze = useCallback(() => {
    if (!file || loading) return
    void handleAnalyzeFile(file)
  }, [file, loading])

  const handleClose = () => {
    reset()
    onClose()
  }

  const showCamera = cameraActive && (cameraStatus === 'starting' || cameraStatus === 'ready')

  return (
    <Modal open={open} onClose={handleClose} title="Analizar comida" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div>
          <p className="section-label">
            <ScanSearch className="h-4 w-4" /> Visión nutricional
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Fotografía tu plato o elige una imagen para obtener una estimación de calorías.
          </p>
        </div>

        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {showCamera ? (
          <div className="overflow-hidden rounded-2xl border border-accent/50 bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              autoPlay
              muted
              playsInline
              aria-label="Vista previa de la cámara"
            />
            <div className="flex flex-wrap justify-end gap-3 p-4">
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted transition hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={cameraStatus !== 'ready'}
                className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
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
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-white"
              >
                <RotateCcw className="h-4 w-4" /> Elegir otra
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {loading ? 'Analizando comida...' : result ? 'Analizar de nuevo' : 'Analizar plato'}
              </button>
            </div>
          </div>
        )}

        {cameraError && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{cameraError}</p>
        )}
        {!geminiReady && (
          <p className="rounded-xl border border-volt/30 bg-volt/5 px-4 py-3 text-sm text-volt">
            Falta configurar VITE_GEMINI_API_KEY en frontend-web/.env.local para activar el análisis.
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt">Análisis completado</p>
                <h4 className="mt-1 font-display text-2xl font-bold uppercase text-white">{result.dishName}</h4>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-white">
                <Flame className="h-4 w-4" />
                <strong className="text-lg">{result.calories}</strong>
                <span className="text-xs">kcal</span>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="rounded-xl bg-black/20 px-3 py-2 text-muted">Porción: <span className="text-white">{result.serving}</span></p>
              <p className="rounded-xl bg-black/20 px-3 py-2 text-muted">Confianza: <span className="capitalize text-white">{result.confidence}</span></p>
            </div>
            {result.items?.length > 0 && (
              <ul className="divide-y divide-line rounded-xl border border-line bg-black/20 px-4">
                {result.items.map((item) => (
                  <li key={`${item.name}-${item.portion}`} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="text-white">{item.name} <span className="text-muted">({item.portion})</span></span>
                    <strong className="whitespace-nowrap text-volt">{item.calories} kcal</strong>
                  </li>
                ))}
              </ul>
            )}
            {result.notes && <p className="text-xs leading-relaxed text-muted">Nota: {result.notes}</p>}
          </section>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Las calorías son una estimación visual y pueden variar según ingredientes, preparación y tamaño de la porción.
        </p>
      </div>
    </Modal>
  )
}
