import { optimizeImageSource } from '../lib/imageOptimize'

// Se prueban en orden: el primero que responda gana. Los modelos "flash"
// más nuevos fallan a veces con "high demand", así que la cadena evita que
// un análisis se quede esperando más de un minuto sin resultado.
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash']
const MODEL_TIMEOUT_MS = 45_000
const MAX_OUTPUT_TOKENS = 1_200
const RETRY_DELAY_MS = 1_200
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

const ANALYSIS_PROMPT = `Analiza esta imagen de comida como nutricionista. Devuelve únicamente JSON válido, sin markdown, con esta forma exacta:
{
  "dishName": "nombre breve del plato",
  "calories": 0,
  "confidence": "alta|media|baja",
  "serving": "porción estimada",
  "items": [{ "name": "alimento", "portion": "cantidad estimada", "calories": 0 }],
  "notes": "suposiciones importantes y cómo mejorar la precisión"
}
Estima las calorías de toda la porción visible. No inventes precisión: usa números enteros aproximados y explica en notes los ingredientes o cantidades que no puedan verse.`

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}

function parseAnalysis(text) {
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

function friendlyMessage(message) {
  if (/high demand|overloaded|resource exhausted/i.test(message)) {
    return 'Gemini está saturado en este momento. Intenta de nuevo en unos segundos.'
  }
  if (/tardó más de/i.test(message)) {
    return 'Gemini no respondió a tiempo. Intenta de nuevo en unos segundos.'
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

async function requestModel({ model, apiKey, base64Image, mimeType, signal }) {
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
              { text: ANALYSIS_PROMPT },
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
    return { ok: true, data: parseAnalysis(text) }
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

export function isGeminiConfigured() {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY)
}

export async function analyzeFoodImage(file, { signal, maxEdge = 1024, quality = 0.72 } = {}) {
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
  const imageBlob = optimizedBlob && optimizedBlob.size < file.size ? optimizedBlob : file
  const base64Image = await blobToBase64(imageBlob)
  const mimeType = imageBlob.type || 'image/jpeg'

  let lastError = ''
  for (const model of GEMINI_MODELS) {
    const result = await requestModel({ model, apiKey, base64Image, mimeType, signal })
    if (result.ok) return result.data
    lastError = result.message
    if (!result.retryable) break
    if (model !== GEMINI_MODELS.at(-1)) await wait(RETRY_DELAY_MS)
  }

  throw new Error(friendlyMessage(lastError))
}