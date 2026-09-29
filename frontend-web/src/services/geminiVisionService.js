const GEMINI_MODEL = 'gemini-3.5-flash'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const FOOD_ANALYSIS_PROMPT = `Analiza esta imagen de comida como nutricionista. Devuelve únicamente JSON válido, sin markdown, con esta forma exacta:
{
  "dishName": "nombre breve del plato",
  "calories": 0,
  "confidence": "alta|media|baja",
  "serving": "porción estimada",
  "items": [{ "name": "alimento", "portion": "cantidad estimada", "calories": 0 }],
  "notes": "suposiciones importantes y cómo mejorar la precisión"
}
Estima las calorías de toda la porción visible. No inventes precisión: usa números enteros aproximados y explica en notes los ingredientes o cantidades que no puedan verse.`

const POSTURE_ANALYSIS_PROMPT = `Evalúa la postura visible de la persona durante el ejercicio en esta imagen. Devuelve únicamente JSON válido, sin markdown, con esta forma exacta:
{
  "exerciseName": "nombre del ejercicio si se reconoce, o No identificado",
  "score": 0,
  "summary": "valoración breve y prudente",
  "confidence": "alta|media|baja",
  "observations": [{ "area": "zona corporal", "assessment": "alineación observable" }],
  "recommendations": ["corrección práctica y concreta"],
  "notes": "limitaciones de la imagen y aspectos que no pueden evaluarse"
}
score debe ser un entero de 1 a 10 solo si la pose es suficientemente visible; usa null si no se puede evaluar. Evalúa únicamente lo observable (por ejemplo espalda, rodillas, hombros y alineación); no afirmes que la postura es segura basándote en una sola imagen, no diagnostiques lesiones y no infieras movimiento, dolor ni ángulos no visibles. Si la persona o el ejercicio no se distinguen, dilo claramente y solicita una imagen más clara.`

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
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

async function analyzeImage(file, prompt) {
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

  const base64Image = await fileToBase64(file)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: file.type, data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

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

export function analyzeFoodImage(file) {
  return analyzeImage(file, FOOD_ANALYSIS_PROMPT)
}

export function analyzeExercisePosture(file) {
  return analyzeImage(file, POSTURE_ANALYSIS_PROMPT)
}