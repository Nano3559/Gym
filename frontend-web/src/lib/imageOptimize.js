// Utilidades de imagen compartidas por el escáner nutricional y cualquier
// futuro análisis por cámara. El objetivo es reducir resolución y peso antes
// de enviar el archivo a la API de visión para reducir el tiempo de espera.

export const MAX_ANALYSIS_EDGE = 1024
export const JPEG_QUALITY = 0.72

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
    image.src = url
  })
}

// Redimensiona manteniendo proporción hasta el lado mayor indicado.
export function downscaleToBlob(source, { maxEdge = MAX_ANALYSIS_EDGE, quality = JPEG_QUALITY } = {}) {
  const width = source.videoWidth || source.naturalWidth || source.width
  const height = source.videoHeight || source.naturalHeight || source.height
  if (!width || !height) return Promise.reject(new Error('La imagen no tiene dimensiones válidas.'))

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d', { alpha: false })
  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      resolve(null)
    }, 'image/jpeg', quality)
  })
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
