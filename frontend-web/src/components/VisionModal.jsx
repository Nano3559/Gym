import { useEffect, useRef, useState } from 'react'
import { Camera, Flame, LoaderCircle, RotateCcw, ScanSearch, Upload } from 'lucide-react'
import Modal from './ui/Modal'
import { analyzeFoodImage } from '../services/geminiVisionService'

export default function VisionModal({ open, onClose }) {
  const uploadInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  useEffect(() => {
    if (!preview) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const selectFile = (nextFile) => {
    if (!nextFile) return
    setFile(nextFile)
    setPreview(URL.createObjectURL(nextFile))
    setResult(null)
    setError('')
  }

  const handleFile = (event) => {
    selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  const startCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no permite abrir la cámara. Usa “Subir foto”.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setError('No se pudo abrir la cámara. Concede permiso al navegador o usa “Subir foto”.')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setError('La cámara todavía no está lista. Inténtalo de nuevo.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('No se pudo capturar la foto.')
        return
      }
      selectFile(new File([blob], `comida-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      setResult(await analyzeFoodImage(file))
    } catch (analysisError) {
      setError(analysisError.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    stopCamera()
    setFile(null)
    setPreview('')
    setResult(null)
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

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

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {cameraOpen ? (
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
                onClick={stopCamera}
                className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted transition hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-accent-hover"
              >
                <Camera className="h-4 w-4" /> Capturar foto
              </button>
            </div>
          </div>
        ) : !preview ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startCamera}
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
                {loading ? 'Analizando...' : 'Analizar plato'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        {result && (
          <section className="space-y-4 rounded-2xl border border-volt/30 bg-volt/5 p-5" aria-live="polite">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt">Resultado estimado</p>
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