import { optimizeImageSource } from '../lib/imageOptimize.js'

// Núcleo común para las llamadas a Gemini con imagen (escáner nutricional y
// análisis de platos). Cada servicio de dominio mantiene su propio prompt y
// la validación de su esquema; aquí vive todo lo que era idéntico: la cadena
// de modelos con reintentos, el timeout, el paso a base64 y los mensajes de
// error en español.

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

// Se prueban en orden: el primero que responda gana. Los modelos "flash" más
// nuevos fallan a veces con "high demand", así que la cadena evita que un
// análisis se quede esperando más de un minuto sin resultado.
export const GEMINI_MODELS = [...new Set([import.meta.env.VITE_GEMINI_MODEL, 'gemini-2.5-flash'].filter(Boolean))]
export const MODEL_TIMEOUT_MS = 45_000
export const MAX_OUTPUT_TOKENS = 1_200
export const RETRY_DELAY_MS = 1_200
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export function isGeminiConfigured() {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY)
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}

// Gemini a veces envuelve el JSON en un bloque ```json. Se limpia y, si aun
// así no parsea, se recorta al primer objeto JSON de la respuesta.
export function parseJsonResponse(text) {
  const cleanText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(cleanText)
  } catch {
    // Último recurso: quedarse solo con el primer objeto JSON de la respuesta.
    const start = cleanText.indexOf('{')
    const end = cleanText.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleanText.slice(start, end + 1))
      } catch {
        // Sigue sin ser JSON válido.
      }
    }
    throw new Error('Gemini devolvió una respuesta que no se pudo interpretar.')
  }
}

function isRetryable(status, message) {
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    /high demand|overloaded|rate limit|resource exhausted|unavailable/i.test(message)
  )
}

export function friendlyMessage(message, serviceName = 'Gemini') {
  if (/high demand|overloaded|resource exhausted/i.test(message)) {
    return `${serviceName} está saturado en este momento. Intenta de nuevo en unos segundos.`
  }
  if (/tardó más de/i.test(message)) {
    return `${serviceName} no respondió a tiempo. Intenta de nuevo en unos segundos.`
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'No se pudo conectar con Gemini. Revisa tu conexión a internet.'
  }
  if (/api key not valid|permission|PERMISSION_DENIED|401|403/i.test(message)) {
    return 'La clave de Gemini no es válida o no tiene acceso al modelo.'
  }
  if (/quota|billing|429/i.test(message)) {
    return 'Se agotó la cuota de la clave de Gemini. Revisa la facturación de la clave.'
  }
  return message
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function requestModel({ model, apiKey, base64Image, mimeType, prompt, signal }) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, MODEL_TIMEOUT_MS)

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          // Los modelos 3.x razonan antes de responder y sus thinking tokens
          // consumen el mismo presupuesto que la respuesta: con el límite
          // anterior el JSON llegaba cortado y no se podía interpretar.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    if (!response.ok) {
      let message = 'No se pudo analizar la imagen.'
      try {
        const errorBody = await response.json()
        message = errorBody.error?.message || message
      } catch {
        // Conserva el mensaje genérico si Gemini no devuelve JSON.
      }
      return { ok: false, retryable: isRetryable(response.status, message), message }
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return { ok: false, retryable: false, message: 'Gemini no encontró una respuesta para esta imagen.' }
    return { ok: true, data: parseJsonResponse(text) }
  } catch (error) {
    // Un timeout propio no debe cancelar el análisis: se prueba el siguiente
    // modelo. Solo la cancelación del usuario aborta de verdad.
    if (signal?.aborted) throw new DOMException('Análisis cancelado', 'AbortError')
    if (timedOut) {
      return { ok: false, retryable: true, message: `${model} tardó más de ${MODEL_TIMEOUT_MS / 1000} s` }
    }
    return { ok: false, retryable: true, message: friendlyMessage(error.message) }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// Envía una imagen (File/Blob) ya reducida y comprimida a Gemini y devuelve el
// JSON ya parseado, sin validar: cada servicio de dominio aplica su esquema.
export async function analyzeImageWithGemini(file, { prompt, serviceName, signal, maxEdge = 1024, quality = 0.72 } = {}) {
  if (!file?.type.startsWith('image/')) {
    throw new Error('Selecciona una imagen válida.')
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('La imagen debe pesar menos de 10 MB.')
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Falta configurar VITE_GEMINI_API_KEY en frontend-web/.env.local.')
  }

  // Se envía una sola imagen reducida y comprimida: menos bytes que subir
  // significa menor tiempo de espera en cada análisis.
  const optimizedBlob = await optimizeImageSource(file, { maxEdge, quality })
  if (!optimizedBlob) throw new Error('No se pudo optimizar la imagen.')
  const imageBlob = optimizedBlob
  const base64Image = await blobToBase64(imageBlob)
  const mimeType = imageBlob.type || 'image/jpeg'

  let lastError = ''
  for (const model of GEMINI_MODELS) {
    const result = await requestModel({ model, apiKey, base64Image, mimeType, prompt, signal })
    if (result.ok) return result.data
    lastError = result.message
    if (!result.retryable) break
    if (model !== GEMINI_MODELS.at(-1)) await wait(RETRY_DELAY_MS)
  }

  throw new Error(friendlyMessage(lastError, serviceName))
}
