import { analyzeImageWithGemini, isGeminiConfigured } from './geminiClient.js'

// Escáner nutricional: devuelve las calorías y macros de una foto de comida
// con un esquema estricto y validado. El prompt y la validación son propios;
// el transporte a Gemini vive en geminiClient.js.

const NUTRITION_PROMPT = `Analiza esta imagen de comida como nutricionista. Devuelve únicamente JSON válido, sin markdown, con esta forma exacta:
{
  "alimento": "nombre breve del plato o alimento",
  "descripcion": "descripción corta del plato y sus ingredientes principales",
  "calorias": 0,
  "proteinas_g": 0,
  "carbohidratos_g": 0,
  "grasas_g": 0,
  "es_comida": true
}
Estima los valores nutricionales de toda la porción visible. Usa números enteros aproximados. Si la imagen no muestra comida, establece "es_comida" en false y deja los valores en 0.`

const REQUIRED_FIELDS = [
  'alimento',
  'descripcion',
  'calorias',
  'proteinas_g',
  'carbohidratos_g',
  'grasas_g',
  'es_comida',
]

const MACRO_FIELDS = ['calorias', 'proteinas_g', 'carbohidratos_g', 'grasas_g']

// Exige los 7 campos del contrato: si falta alguno o llega con el tipo
// equivocado, la respuesta se considera inválida y no llega a la interfaz.
export function validateNutritionData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('La respuesta no tiene el formato esperado.')
  }

  const missing = REQUIRED_FIELDS.filter((field) => !(field in data))
  if (missing.length > 0) {
    throw new Error(`La respuesta no contiene los campos requeridos: ${missing.join(', ')}`)
  }

  if (typeof data.alimento !== 'string' || !data.alimento.trim()) {
    throw new Error('El campo "alimento" debe ser un texto no vacío.')
  }
  if (typeof data.descripcion !== 'string') {
    throw new Error('El campo "descripcion" debe ser un texto.')
  }
  if (typeof data.es_comida !== 'boolean') {
    throw new Error('El campo "es_comida" debe ser un booleano.')
  }

  for (const field of MACRO_FIELDS) {
    if (typeof data[field] !== 'number' || !Number.isFinite(data[field]) || data[field] < 0) {
      throw new Error(`El campo "${field}" debe ser un número mayor o igual a 0.`)
    }
  }

  return {
    alimento: data.alimento.trim(),
    descripcion: data.descripcion,
    ...Object.fromEntries(MACRO_FIELDS.map((field) => [field, Math.round(data[field])])),
    es_comida: data.es_comida,
  }
}

export function isNutritionServiceConfigured() {
  return isGeminiConfigured()
}

export async function analyzeFoodNutrition(file, { quality = 0.8, ...options } = {}) {
  const data = await analyzeImageWithGemini(file, {
    prompt: NUTRITION_PROMPT,
    serviceName: 'El servicio',
    quality,
    ...options,
  })
  return validateNutritionData(data)
}
