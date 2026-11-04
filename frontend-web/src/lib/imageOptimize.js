// Utilidades de imagen compartidas por el escáner nutricional y cualquier
// futuro análisis por cámara. El objetivo es reducir resolución y peso antes
// de enviar el archivo a la API de visión para reducir el tiempo de espera.

export const MAX_ANALYSIS_EDGE = 1024
export const JPEG_QUALITY = 0.8
export const MAX_FILE_SIZE_KB = 300

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      resolve(null)
    }, type, quality)
  })
}

function getSupportedMimeType() {
  const canvas = document.createElement('canvas')
  if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    return 'image/webp'
  }
  return 'image/jpeg'
}

// Redimensiona manteniendo proporción hasta el lado mayor indicado.
// Comprime a JPEG/WebP con calidad 0.8 y asegura un tamaño < 300 KB.
export async function downscaleToBlob(source, { maxEdge = MAX_ANALYSIS_EDGE, quality = JPEG_QUALITY, maxSizeKB = MAX_FILE_SIZE_KB } = {}) {
  const width = source.videoWidth || source.naturalWidth || source.width
  const height = source.videoHeight || source.naturalHeight || source.height
  if (!width || !height) return Promise.reject(new Error('La imagen no tiene dimensiones válidas.'))

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d', { alpha: false })
  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  const mimeType = getSupportedMimeType()
  let blob = await canvasToBlob(canvas, mimeType, quality)

  if (blob && blob.size > maxSizeKB * 1024) {
    let currentQuality = quality
    while (blob && blob.size > maxSizeKB * 1024 && currentQuality > 0.1) {
      currentQuality -= 0.1
      blob = await canvasToBlob(canvas, mimeType, currentQuality)
    }
  }

  return blob
}

// Acepta File/Blob o un <video> y devuelve un Blob optimizado.
export async function optimizeImageSource(source, options) {
  if (source instanceof HTMLVideoElement) {
    const blob = await downscaleToBlob(source, options)
    if (blob) return blob
    return null
  }

  const url = URL.createObjectURL(source)
  try {
    const image = await loadImage(url)
    return await downscaleToBlob(image, options)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobToFile(blob, name) {
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}
