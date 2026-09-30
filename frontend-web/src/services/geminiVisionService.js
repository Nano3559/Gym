import { optimizeImageSource } from '../lib/imageOptimize'

const GEMINI_MODEL = 'gemini-3.6-flash'
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
    throw new Error('Gemini devolvió una respuesta que no se pudo interpretar.')
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

  const response = await fetch(`${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: ANALYSIS_PROMPT },
            { inlineData: { mimeType: imageBlob.type || 'image/jpeg', data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        maxOutputTokens: 700,
      },
    }),
  })

  if (signal?.aborted) {
    throw new DOMException('Análisis cancelado', 'AbortError')
  }

  if (!response.ok) {
    let message = 'No se pudo analizar la imagen.'
    try {
      const errorBody = await response.json()
      message = errorBody.error?.message || message
    } catch {
      // Conserva el mensaje genérico si Gemini no devuelve JSON.
    }
    throw new Error(message)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini no encontró una respuesta para esta imagen.')
  return parseAnalysis(text)
}