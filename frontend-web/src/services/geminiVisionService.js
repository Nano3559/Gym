import { analyzeImageWithGemini, isGeminiConfigured } from './geminiClient.js'

// Análisis de una foto de comida que devuelve el detalle del plato y sus
// ingredientes. El prompt y el esquema son propios; el transporte a Gemini
// (base64, cadena de modelos, reintentos y errores) vive en geminiClient.js.

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

export { isGeminiConfigured }

export async function analyzeFoodImage(file, options = {}) {
  return analyzeImageWithGemini(file, { prompt: ANALYSIS_PROMPT, ...options })
}
