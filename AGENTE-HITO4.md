# Hito 4 — Pasos de implementación y configuración de modelos

## 1. Configuración del agente

Implementa un sistema de seguimiento y predicción de pérdida de peso en Gym. Ejecuta los sprints en orden y verifica sus dependencias antes de avanzar. Revisa el código y el esquema existentes para reutilizarlos. Este archivo define el trabajo por realizar, sin declarar avances ni resultados.

Usa React, Vite y JavaScript para la aplicación; Supabase y PostgreSQL para persistencia y autenticación; Python, pandas, NumPy y scikit-learn para entrenamiento fuera del navegador. Fija versiones del entorno y registra semilla, datos y código de cada experimento.

Guarda los datos personales con RLS por usuario y las claves privadas en el servidor. No reutilices datos para entrenamiento sin consentimiento. Las correcciones conservarán trazabilidad y no modificarán retrospectivamente las entradas congeladas de un pronóstico ya emitido.

Configuración inicial de los experimentos:

```yaml
hito: 4
objetivo: predecir_cambio_de_peso
semilla: 407
metodo_inicial:
  nombre: pendiente_de_medianas_semanales
  historial_dias: 28
  horizonte_dias: 7
  minimo_dias_con_pesaje_por_semana: 3
  antiguedad_maxima_pesaje_reciente_dias: 3
  actualizacion_minima_dias: 7
experimento_externo:
  fuente: DIETFITS_All_outcomes_v4.csv
  horizonte: visita_programada_a_tres_meses
  modelo_principal: Ridge
  modelo_comparacion: HistGradientBoostingRegressor
experimento_aplicacion:
  fuente: historial_autorizado_de_usuarios
  horizonte_dias: 7
  modelo_principal: Ridge
  modelo_comparacion: HistGradientBoostingRegressor
  independiente_del_modelo_externo: true
evaluacion:
  metrica_principal: MAE_kg
  particiones: [entrenamiento, validacion, calibracion, prueba]
  porcentajes: [60, 15, 10, 15]
  intervalo_nominal: 0.90
  bootstrap_por_persona: 2000
  mejora_minima_absoluta_kg: 0.2
  mejora_minima_relativa: 0.05
```

Esta configuración es una especificación para implementar, no un archivo que la aplicación ya interprete. Los límites son decisiones iniciales de ingeniería; no equivalen a validación clínica. No cambies el protocolo después de observar la prueba final para favorecer un resultado.

## 2. Modelos que vamos a usar

| Modelo | Implementación | Entrada y salida | Uso |
|---|---|---|---|
| Proyección de tendencia | Medianas semanales y mediana de pendientes | Historial de peso → peso proyectado a siete días | Primera versión funcional y referencia personalizada |
| Persistencia | Peso futuro igual al actual | Último peso disponible → mismo peso | Referencia mínima |
| Cambio medio | Media de cambios del entrenamiento | Peso inicial → peso inicial más cambio medio | Referencia del experimento al mismo horizonte |
| Regresión Ridge | `sklearn.linear_model.Ridge` | Variables disponibles al emitir → cambio de peso | Modelo principal de IA que se entrenará |
| Gradient boosting de árboles | `sklearn.ensemble.HistGradientBoostingRegressor` | Mismas variables y etiqueta que Ridge | Segundo candidato que se entrenará para comparar |

**Selección propuesta:** Ridge será el modelo principal por su bajo coste, regularización y facilidad de reproducir inferencia. HistGradientBoostingRegressor permitirá evaluar relaciones no lineales. Ambos se compararán en validación; ninguno tendrá garantizada su adopción. No se añadirán redes neuronales, LSTM, Transformers ni otros candidatos sin definir un experimento nuevo.

### Entradas del modelo externo

Usa DIETFITS con su diccionario para obtener peso inicial, calorías ingeridas iniciales y gasto estimado inicial. Si el gasto está en kcal/kg/día, multiplícalo por el peso de esa misma visita. Predice el cambio entre inicio y visita de tres meses. No uses ingesta o actividad de la visita final como entrada.

Obtén originales de su repositorio, conserva sus hashes y verifica permisos antes de usarlos. No supongas autorización comercial por descarga pública. No conviertas sus visitas en pesajes diarios artificiales ni utilices el modelo a tres meses para pronosticar siete días.

### Entradas del modelo de la aplicación

Construye un experimento independiente con peso reciente, medianas semanales, pendiente, variabilidad, medias de ingesta y gasto, balance, minutos activos y cobertura de los 28 días anteriores. Incluye solo variables presentes al emitir y recogidas de forma consistente. El peso objetivo no será etiqueta ni predictor del resultado observado.

Registra series, repeticiones y cargas como historial de entrenamiento, pero no las conviertas directamente en calorías ni las añadas al modelo sin evaluar calidad y utilidad. No se puede medir el gasto exacto únicamente con esas variables.

## 3. Modelos y algoritmos matemáticos

### 3.1 Gasto en reposo y ejercicio

Usa Mifflin–St Jeor para estimar reposo:

```text
R = 10 × peso_kg + 6,25 × estatura_cm − 5 × edad + constante
Constante de la ecuación: +5 o −161 según el parámetro de sexo utilizado.
Base diaria = R × factor cotidiano
```

Ofrece factores cotidianos 1,4; 1,6 y 1,8 como supuestos explícitos, separados del entrenamiento. Utiliza categorías MET documentadas del Compendium of Physical Activities:

```text
Ejercicio bruto = MET × 3,5 × peso_kg / 200 × minutos activos
Ejercicio adicional = máximo(0, ejercicio bruto − base de los mismos minutos)
Gasto diario = base diaria + suma de ejercicios adicionales
Balance diario = ingesta confirmada − gasto diario
```

Descuenta la base del mismo intervalo para evitar doble conteo. No sumes nuevamente reposo y ejercicio a una variable externa que ya represente gasto total. No conviertas balance en kilos mediante una equivalencia fija para prometer una fecha.

### 3.2 Tendencia y primera proyección

Calcula mediana diaria si hay varios pesajes, luego medianas de cuatro semanas. Para semanas consecutivas calcula:

```text
pendiente_i = (mediana_semana_i+1 − mediana_semana_i) / 7
pendiente = mediana de las tres pendientes
peso_proyectado = mediana de la última semana + pendiente × días_de_proyección
```

Identifica el anclaje como resumen de la última semana, no como un pesaje real al cierre. Evalúa el desplazamiento que ese anclaje puede introducir frente al último peso observado. El horizonte será de siete días desde el cierre del periodo y deberá quedar guardado sin ambigüedad.

Bloquea pendientes absolutas superiores al límite inicial de 0,1 kg/día y limita cambios de pendiente entre actualizaciones a 0,01 kg/día. Estos límites restringen el método; no clasifican un ritmo de pérdida como saludable. Los escenarios entre pendientes observadas no son intervalos de confianza.

### 3.3 Regresión Ridge

Entrena sobre cambio de peso:

```text
y = peso_posterior − peso_inicial
y_estimado = intercepto + suma(coeficiente_j × entrada_transformada_j)
Objetivo Ridge = suma de errores cuadrados + alpha × suma de coeficientes cuadrados
peso_estimado = peso_inicial + y_estimado
```

Usa `Pipeline(SimpleImputer(strategy='median'), StandardScaler(), Ridge())`. Ajusta imputación y escalado exclusivamente con entrenamiento. Prueba `alpha` en `[0.1, 1, 10, 100, 1000]` y selecciona por MAE de validación. No imputes etiquetas ni el peso inicial necesario para definir el cambio.

### 3.4 Gradient boosting

Entrena árboles que corrigen sucesivamente el error del conjunto. Usa la misma etiqueta, variables, particiones y horizonte que Ridge. Limita la búsqueda a:

```python
HistGradientBoostingRegressor(
    loss='squared_error',
    max_leaf_nodes=3,  # comparar también 7
    max_iter=100,
    learning_rate=0.05,
    min_samples_leaf=20,
    early_stopping=False,
    random_state=407,
)
```

Usa imputación ajustada en entrenamiento si el pipeline la necesita; no requiere estandarización como Ridge. Selecciona entre las dos configuraciones y Ridge solo con validación. Los histogramas no garantizan ventaja con muestras pequeñas.

### 3.5 Intervalos y evaluación matemática

Calibra el candidato seleccionado mediante split conformal: calcula errores absolutos en calibración y el cuantil de orden `ceil((n+1) × 0.90)`. Si ese orden supera el número disponible de residuos, no emitas una banda finita ni inventes cobertura. Construye la banda con predicción menos y más el cuantil y comprueba cobertura y anchura en prueba.

```text
MAE = media de |predicción − resultado|
RMSE = raíz de la media de (predicción − resultado)²
Sesgo = media de (predicción − resultado)
Cobertura = proporción de resultados dentro del intervalo
Anchura = media de límite superior − límite inferior
```

El nivel nominal no garantiza cobertura ante cambios temporales o de población. Usa bootstrap pareado por persona para estimar incertidumbre de la mejora entre modelos; no confundas ese intervalo con una banda predictiva individual.

## 4. Criterios que se van a usar

### Datos y posibilidad de emitir una predicción

- Exige unidades explícitas, fechas reales, zona horaria y procedencia. Convierte libras a kg solo con unidad identificada.
- Conserva mediciones repetidas reales; evita duplicados accidentales mediante identificadores de operación. No confundas cero con ausencia.
- Incluye solo días cerrados y completos en balances. El día actual no representa un día completo.
- Para el método inicial exige 28 días completos y al menos tres días de pesaje por semana, con peso de los últimos tres días. Si no se cumple, muestra qué falta.
- La estimación energética inicial cubrirá adultos de 19 a 59 años. No la apliques automáticamente a embarazo, lactancia, edema u otras situaciones que alteren la interpretación del peso o requieran otro método. No infieras diagnósticos; permite suspender la proyección y explica el alcance.
- Una ausencia prolongada, cambio importante de rutina o circunstancia declarada que invalide continuidad activará revisión del periodo. No encadenes automáticamente el ajuste anterior; solicita nuevo historial suficiente.
- El patrón de registro incompleto puede ser sistemático. No imputes ingesta cero ni interpretes su ausencia como comportamiento real.
- No emitas fecha de meta si la tendencia es estable, creciente, inconsistente o la meta ya se alcanzó. Para tendencia descendente, limita la extrapolación inicial a 28 días; si queda fuera, indica que no puede estimarse todavía.

### Particiones y entrenamiento

- Separa entrenamiento, validación, calibración y prueba por persona. Varias filas no equivalen a varias personas independientes.
- Añade una evaluación de periodos posteriores con cortes temporales y etiquetas maduras. La separación por persona no sustituye el control temporal, ni al revés.
- Para personalización evalúa por separado pasado y futuro del mismo usuario. No mezcles sus resultados con generalización a usuarios nuevos.
- En DIETFITS comprueba al menos 80, 20, 20 y 40 personas utilizables por partición, respectivamente. Son mínimos operativos para ejecutar el protocolo, no garantías estadísticas.
- Para el piloto semanal planifica inicialmente 200, 50, 50 y 100 personas por partición y revisa si la incertidumbre y representatividad son suficientes. No sustituyas personas faltantes por filas interpoladas.
- Define antes de entrenar cómo obtener el resultado semanal: mediana de pesajes en días 6–8 desde la emisión, con al menos dos días distintos, y conservación de las fechas efectivas. Sin resultado suficiente, excluye la etiqueta. El objetivo será esa ventana semanal y debe describirse así.
- No reutilices la prueba observada para escoger nuevos parámetros. Un experimento posterior tendrá hipótesis y evaluación nuevas.

### Selección e integración

- Entrena Ridge y las dos configuraciones de boosting. Selecciona por validación, calibra aparte y abre prueba una sola vez.
- Compara a igual horizonte con persistencia, cambio medio y tendencia cuando pueda calcularse. No compares directamente MAE a tres meses con MAE semanal.
- Exige reducción del MAE de al menos 0,2 kg y 5% frente a la mejor referencia comparable, con límite inferior positivo del intervalo bootstrap del 95% de mejora.
- Para una adopción semanal exige además sesgo absoluto ≤0,5 kg, cobertura observada ≥85% para banda nominal del 90% y anchura media ≤4 kg. Son umbrales iniciales que se justificarán antes de abrir prueba; no se trasladan automáticamente al horizonte de tres meses.
- Revisa resultados por nivel de cobertura, actividad y características disponibles con muestra suficiente. Un promedio favorable no justifica uso en grupos sin representación o fuera de los rangos evaluados.
- Integra únicamente con condiciones de uso resueltas, consentimiento cuando corresponda, equivalencia de entradas, validación al horizonte de la aplicación y retorno probado. Si falla algún criterio, conserva el método explicable.
- Verifica matemáticas, servicios, RLS y móvil. Las pruebas sintéticas y de compilación no equivalen a validar precisión con usuarios reales.

## 5. Pasos de implementación por sprint

### Sprint 0 — Diseñar datos y protocolo

**Modelo:** ninguno; auditoría y diseño.

1. Revisa perfil, autenticación, comidas, sesiones, esquema y pruebas existentes.
2. Define variables, unidades, estados de completitud y restricciones del apartado 4.
3. Diseña migraciones y permisos para perfil de progreso, meta, pesajes, diario y proyecciones.
4. Verifica diccionario y condiciones de DIETFITS; congela protocolo, métricas y particiones.
5. Define antes del desarrollo el tratamiento de etiquetas semanales, cambios de hábitos y población fuera del alcance.

**Entrega y prueba:** inventario y diseño verificables, diccionario de datos y protocolo. Ninguna entrada o etiqueta quedará sin definición temporal.

### Sprint 1 — Perfil, meta y peso

**Modelo:** validaciones deterministas, sin IA.

1. Implementa estatura, parámetros de fórmula, zona horaria, actividad cotidiana y meta; reutiliza edad o nacimiento existente.
2. Implementa registro y consulta de pesajes con correcciones trazables.
3. Guarda en Supabase y protege con RLS; evita duplicados de solicitud y pérdida de cambios concurrentes.

**Entrega y prueba:** perfil y pesajes persistentes; prueba unidades, fechas, duplicados accidentales, varias mediciones reales, correcciones y acceso entre usuarios.

### Sprint 2 — Diario nutricional y de actividad

**Modelo:** agrupación temporal, sin predictor de peso entrenado.

1. Integra estimación de comida con confirmación de porción y calorías; permite registro manual.
2. Registra categoría, duración activa, descanso y sesiones parciales; conserva series y cargas como contexto.
3. Permite marcar por separado alimentación y actividad completas en el día local.
4. Conserva estado de confirmación y procedencia de los registros.

**Entrega y prueba:** diario completo; prueba omisiones, ceros reales, pausas, registros corregidos y días de 23 o 25 horas cuando la zona lo requiera.

### Sprint 3 — Gasto energético

**Modelo:** Mifflin–St Jeor y MET del apartado 3.1.

1. Implementa cálculo puro con peso reciente de hasta 30 días y perfil válido al periodo.
2. Añade selección explícita de categoría MET y factor cotidiano.
3. Descuenta base del intervalo del ejercicio y detecta solapamientos.
4. Separa gasto provisional y completo; guarda entradas, desglose y versión.

**Entrega y prueba:** gasto reproducible; prueba fórmulas, unidades, doble conteo, pesos antiguos, actividad desconocida y población fuera del alcance.

### Sprint 4 — Balance energético

**Modelo:** balance determinista del apartado 3.1.

1. Suma ingesta confirmada y resta gasto para el mismo día.
2. Acumula solo días cerrados y completos; informa cobertura y exclusiones.
3. Actualiza resultados derivados tras correcciones, conservando las instantáneas de pronósticos emitidos.

**Entrega y prueba:** balance diario y por periodo; prueba signos, ausencias, días abiertos y consistencia ante modificaciones.

### Sprint 5 — Tendencia del peso

**Modelo:** medianas temporales.

1. Calcula medianas diarias y una tendencia de siete días con al menos tres días con pesaje.
2. Mantén visibles las mediciones originales sin rellenar huecos artificialmente.
3. Compara periodos completos de balance y tendencia; informa discrepancias persistentes sin atribuir una causa no demostrada.

**Entrega y prueba:** gráfico y tabla accesible; prueba fluctuaciones aisladas, pesajes irregulares, ventanas vacías y cambios de cobertura.

### Sprint 6 — Proyección sin IA

**Modelo:** pendiente de medianas semanales del apartado 3.2.

1. Construye la proyección de siete días con el historial y límites configurados.
2. Guarda emisión real, origen, horizonte, versión, entradas y parámetros.
3. Evalúa anclaje semanal frente a último peso con datos de validación; cualquier cambio de método tendrá versión nueva.
4. Implementa actualización semanal y salida de datos insuficientes; limita la fecha de meta según los criterios.
5. Evalúa con resultados posteriores y compara con persistencia y tendencia previa a igual horizonte.

**Entrega y prueba:** proyección reproducible y evaluación temporal; prueba ausencia de información futura, insuficiencia, reinicio tras cambios y límites de actualización.

### Sprint 7 — Entrenar Ridge y comparar gradient boosting

**Modelos:** `Ridge` y `HistGradientBoostingRegressor`, con referencias y split conformal.

1. Crea entorno separado y versiones fijadas; conserva originales y hashes de DIETFITS.
2. Audita esquema, unidades, visitas, duplicados y faltantes. Construye etiqueta de cambio a tres meses sin datos futuros.
3. Asigna personas según las particiones y semilla configuradas; aprende transformaciones solo en entrenamiento.
4. Entrena referencias, cinco configuraciones Ridge y dos configuraciones boosting definidas en el apartado 3.
5. Selecciona mediante validación, calibra intervalos y evalúa una sola vez en prueba.
6. Mide MAE, RMSE, sesgo, cobertura, anchura y mejora pareada. Diagnostica por separado 3→6 meses sin volver a seleccionar; no lo presentes como cohorte independiente.
7. Decide si se justifica continuar hacia una adopción al horizonte evaluado. Un resultado favorable a tres meses no autoriza inferencia semanal.

**Entrega y prueba:** scripts reproducibles, auditoría e informe comparativo; prueba separación de personas, ausencia de futuro, etiquetas no imputadas y equivalencia de inferencia. No inventes resultados si no se puede ejecutar el experimento real.

### Sprint 8 — Validar el modelo semanal e integrar si cumple

**Modelos:** Ridge y boosting como candidatos semanales independientes; tendencia como método de retorno.

1. Implementa consentimiento por finalidad, retirada y permisos antes de extraer historial personal.
2. Construye ejemplos de 28 días anteriores y resultado semanal según la ventana definida; excluye etiquetas incompletas.
3. Entrena, selecciona y calibra con un protocolo semanal congelado y particiones por persona y tiempo.
4. Ejecuta piloto en modo de evaluación, guardando predicciones sin sustituir inicialmente el método vigente. Espera resultados posteriores reales.
5. Aplica todos los criterios de adopción del apartado 4. Si no se cumplen, conserva el método inicial y documenta la decisión.
6. Para Ridge exporta orden de variables, unidades, imputación, escalas, coeficientes e intercepto, con prueba de paridad Python/JavaScript. Para boosting define y prueba servicio o formato de inferencia compatible antes de desplegar.
7. Registra versiones inmutables, datos y código utilizados, horizonte, métricas, aprobación y predecesor. Cada pronóstico guardará sus entradas congeladas.
8. Revisa errores maduros semanalmente por versión y horizonte, con una observación reciente por persona y al menos 30 personas para revisión agregada; informa también incertidumbre y cobertura de seguimiento.
9. Ante fallo de inferencia, entradas fuera del alcance o evidencia insuficiente, usa el método explicable. Suspende IA si deja de mejorar MAE, supera los límites de sesgo o anchura, o cae la cobertura mínima. Si el método inicial tampoco tiene datos suficientes, no emitas predicción.
10. No reentrenes por comida. Revisa como máximo mensualmente con suficientes resultados nuevos y repite la evaluación antes de aprobar una actualización.

**Entrega y prueba:** consentimiento, informe del piloto, modelo versionado si procede y retorno operativo; prueba retirada, datos incompatibles, población no evaluada, muestra insuficiente, degradación y recuperación. No declares validación real por haber terminado únicamente el código.
