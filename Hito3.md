# 📸 Escáner Nutricional con IA

Módulo web para socios del gimnasio que permite tomar o subir una foto de un plato de comida y recibir, en segundos, un desglose nutricional automático (calorías, proteínas, carbohidratos y grasas) generado por Inteligencia Artificial.

---

## 📋 Tabla de contenidos

- [Descripción general](#-descripción-general)
- [Escenarios de uso](#-escenarios-de-uso)
- [Arquitectura y tecnologías](#-arquitectura-y-tecnologías)
- [Flujo de datos](#-flujo-de-datos)
- [Estrategia de optimización de espacio](#-estrategia-de-optimización-de-espacio)
- [Plan Premium: integración con objetivos de entrenamiento](#-plan-premium-integración-con-objetivos-de-entrenamiento)
- [Limitaciones conocidas](#-limitaciones-conocidas)
- [Roadmap / Posibles mejoras](#-roadmap--posibles-mejoras)

---

## 🧠 Descripción general

El **Escáner Nutricional por Imagen** analiza una fotografía de comida usando IA multimodal en la nube. El sistema:

1. Identifica el alimento o platillo.
2. Genera una descripción breve.
3. Estima macronutrientes (kcal, proteínas, carbohidratos, grasas).
4. Guarda el registro en el historial diario del usuario.

---

## 🍽️ Escenarios de uso

### 1. Registro de comida saludable
- **Acción:** el usuario fotografía pechuga de pollo, arroz y ensalada.
- **Resultado:**
  - **Alimento:** Pechuga de pollo a la plancha con arroz integral y ensalada fresca.
  - **Descripción:** comida balanceada, rica en proteínas magras y carbohidratos complejos.
  - **Macronutrientes:** 450 kcal | 40 g proteína | 45 g carbohidratos | 10 g grasa.
  - **Acción disponible:** botón para registrar en el diario del día.

### 2. Evaluación de "cheat meal" o postre
- **Acción:** el usuario sube una foto de pastel de chocolate.
- **Resultado:**
  - **Alimento:** Pastel de chocolate con cobertura de ganache.
  - **Descripción:** postre de alta densidad calórica y elevado contenido de azúcares.
  - **Macronutrientes:** 380 kcal | 4 g proteína | 52 g carbohidratos | 18 g grasa.
  - **Retroalimentación:** alerta visual suave sugiriendo compensar con actividad física o ajustar las calorías de la cena.

### 3. Imagen no comestible o borrosa
- **Acción:** el usuario sube por error la foto de un objeto (mancuerna, tenis) o una imagen desenfocada.
- **Resultado:** *"No se ha podido detectar ningún alimento en la imagen. Intenta tomar una fotografía clara del plato con buena iluminación."*

---

## 🏗️ Arquitectura y tecnologías

> Restricción de diseño: el equipo cuenta con solo **2 GB de almacenamiento local libre**, por lo que se descarta instalar modelos de visión por computadora pesados (PyTorch, TensorFlow, OpenCV, YOLO, etc., que pueden ocupar de 4 a 8 GB). En su lugar se adopta una **arquitectura serverless basada en APIs en la nube**.

| Componente | Tecnología | Impacto en disco local | Justificación |
|---|---|---|---|
| Frontend | React + Vite | ~150 MB (`node_modules`) | Interfaz liviana y responsive para cámara/subida de imágenes. |
| Backend & DB | Supabase | 0 MB (servicio cloud) | Almacena el historial de comidas e imágenes procesadas. |
| IA / Visión por computadora | Google Gemini 1.5 Flash API u OpenAI GPT-4o-mini API | 0 MB (vía HTTPS/Fetch) | Modelo multimodal en la nube que identifica alimentos en menos de 2 segundos. |
| Envío de imágenes | Canvas API + Web Storage | 0 MB (nativo del navegador) | Comprime la imagen a WebP/JPEG en el cliente antes de enviarla, reduciendo el consumo de ancho de banda. |

---

## 🔄 Flujo de datos

1. **Captura:** el usuario sube una imagen o la toma con la cámara desde el navegador.
2. **Compresión local:** el cliente (React) escala la imagen a un máximo de 1024×1024 px y la convierte a base64.
3. **Petición a la API:** se envía el base64 a la API de IA solicitando una respuesta estructurada en JSON:

```json
{
  "alimento": "Nombre del plato",
  "descripcion": "Breve análisis",
  "calorias": 0,
  "proteinas_g": 0,
  "carbohidratos_g": 0,
  "grasas_g": 0,
  "es_comida": true
}
```

4. **Despliegue:** la interfaz renderiza una tarjeta con los valores nutricionales recibidos.
5. **Persistencia:** si el usuario confirma, el JSON se inserta en la tabla `public.meal_logs` de Supabase.

---

## 💾 Estrategia de optimización de espacio

- **Sin SDKs pesados de Python:** todo el frontend/backend se maneja con Node.js o llamadas `fetch` HTTP REST directas a la API de IA.
- **Compresión en cliente:** la imagen se procesa con herramientas nativas del navegador antes de guardarla, evitando saturar memoria o almacenamiento temporal.
- **Uso de CDN / cloud:** las imágenes no ocupan espacio en el disco de desarrollo; se almacenan en los buckets de Supabase Storage.

---

## ⭐ Plan Premium: integración con objetivos de entrenamiento

En el **plan premium** del gimnasio, el registro nutricional se conecta con el plan acordado entre el cliente y el instructor:

- **Ganancia de masa muscular:** prioriza el seguimiento de proteínas y calorías en superávit.
- **Déficit calórico:** monitorea carbohidratos y grasas para asegurar la reducción calórica.
- **Definición:** equilibra macronutrientes para estabilidad energética y estética.
- **Mantenimiento:** sostiene el balance calórico actual.

### Funcionalidades asociadas
- Seguimiento nutricional personalizado comparado contra el plan del instructor.
- Relación entre nutrición y métricas de rendimiento (fuerza, resistencia, recuperación).
- Gráficas y alertas educativas sobre exceso o déficit de macronutrientes.
- Panel para que el instructor revise registros y ajuste el plan del cliente.
- Exportación de datos a apps de salud externas.

---

## ⚠️ Limitaciones conocidas

- **Precisión de imagen:** el modelo puede fallar con platos mixtos o comidas locales no reconocidas.
- **Estimación de porciones:** depende de la calidad de la foto o de datos manuales ingresados por el usuario.
- **Dependencia de bases de datos nutricionales:** si un alimento no está registrado (ej. USDA/FAO), no puede calcularse automáticamente.
- **Sin validación científica:** el etiquetado oficial requeriría métodos de laboratorio (Kjeldahl, HPLC, Soxhlet), fuera del alcance de este módulo.
- **Personalización limitada:** las sugerencias del sistema deben ser validadas por el instructor antes de aplicarse.

---

## 🚀 Roadmap / Posibles mejoras

- Integrar bases de datos nutricionales oficiales (USDA FoodData Central, FAO) como respaldo cuando la IA no reconozca un alimento.
- Panel instructor-cliente para revisión y ajuste de planes.
- Exportación de historial a formatos compatibles con otras apps de salud.

