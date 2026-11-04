# Hito 4 — Propuesta de un sistema de seguimiento y predicción de pérdida de peso

## 1. Presentación

Se propone incorporar a la aplicación de gimnasio un módulo que relacione el peso corporal, las calorías ingeridas y la actividad física del usuario para observar su progreso y estimar su evolución. El desarrollo se organizará en fases: primero se construirá un seguimiento mediante cálculos explicables y después se evaluará si el aprendizaje automático mejora las estimaciones.

La incorporación de inteligencia artificial dependerá de su evaluación. Entrenar un modelo no será suficiente para seleccionarlo: deberá ofrecer una mejora útil frente a métodos sencillos y funcionar con datos equivalentes a los que recoge la aplicación.

## 2. Planteamiento del problema

Un usuario puede registrar comidas y realizar entrenamientos sin comprender cómo se relacionan esos registros con los cambios de su peso. Conocer las calorías de una comida o las repeticiones de un ejercicio no permite, por sí solo, estimar su progreso.

Será necesario integrar los registros en el tiempo, estimar el gasto energético total y comparar el balance calculado con los pesajes. También habrá que considerar días incompletos, errores de estimación y fluctuaciones del peso. El sistema deberá explicar cuándo dispone de información suficiente y cuándo todavía no puede emitir una proyección.

### Pregunta del proyecto

¿Se puede estimar la evolución del peso de un usuario a partir de su historial de pesajes, ingesta y actividad, y mejorar esa estimación mediante un modelo de regresión frente a una proyección basada en su tendencia reciente?

## 3. Objetivos

### 3.1 Objetivo general

Desarrollar un módulo de seguimiento y proyección de pérdida de peso que integre información del usuario, estime su balance energético y evalúe modelos predictivos para apoyar la interpretación de su progreso.

### 3.2 Objetivos específicos

1. Registrar el perfil, la meta y el historial de peso del usuario.
2. Integrar comidas y entrenamientos en un diario con fechas, unidades y estado de completitud.
3. Estimar el gasto diario mediante una fórmula de reposo y referencias de actividad física.
4. Calcular el balance energético y compararlo con la tendencia observada del peso.
5. Construir una proyección inicial explicable y evaluar su error con pesajes posteriores.
6. Preparar un conjunto de datos longitudinal sin utilizar información futura como entrada.
7. Comparar regresión Ridge y árboles con gradient boosting frente a referencias sencillas.
8. Incorporar un modelo únicamente si supera los criterios de evaluación y las condiciones de uso de los datos.
9. Definir consentimiento, trazabilidad, seguimiento del error y retorno al método anterior.

## 4. Alcance del sistema

### 4.1 Funciones previstas

- Perfil de progreso, meta e historial de pesajes.
- Registro y confirmación de calorías ingeridas.
- Registro de actividades y duración activa de los entrenamientos.
- Estimación del gasto diario y del balance acumulado.
- Visualización del peso observado y su tendencia.
- Proyección a un horizonte definido, con información sobre su incertidumbre.
- Estimación condicionada del acercamiento a la meta cuando la tendencia y el horizonte lo permitan.
- Evaluación de un modelo de aprendizaje automático antes de su incorporación.

### 4.2 Límites

La primera versión se centrará en pérdida de peso de adultos y no en ganancia muscular. No diagnosticará enfermedades ni generará tratamientos o dietas restrictivas. Las calorías de alimentos y ejercicios se considerarán estimaciones. El sistema no prometerá una fecha exacta para alcanzar una meta ni asumirá que todo cambio de peso corresponde a grasa corporal.

La propuesta inicial de gasto energético se limitará a adultos de 19 a 59 años. Su ampliación a otras poblaciones requerirá revisar fórmulas, supuestos y validación.

## 5. Datos que necesitará el sistema

### 5.1 Datos proporcionados por el usuario

| Variable | Unidad o formato | Finalidad |
|---|---|---|
| Fecha de nacimiento | Fecha | Calcular edad para la fórmula de reposo |
| Estatura | Centímetros | Estimar gasto en reposo |
| Sexo utilizado por la fórmula | Categoría definida en el perfil | Seleccionar la constante de la ecuación |
| Zona horaria | Identificador de zona | Agrupar registros por día local |
| Actividad cotidiana | Categoría, excluyendo entrenamiento | Estimar el gasto habitual |
| Peso registrado | Kilogramos y fecha de medición | Medir evolución y actualizar cálculos |
| Peso objetivo | Kilogramos | Definir la meta |
| Comidas y porciones | Registro con fecha y calorías confirmadas | Calcular ingesta diaria |
| Actividad realizada | Categoría y minutos activos | Estimar gasto de ejercicio |
| Series, repeticiones y carga | Conteos y kilogramos cuando corresponda | Describir entrenamiento y explorar variables posteriores |
| Día completo | Confirmación separada de ingesta y actividad | Distinguir ausencia de datos de un valor cero |

Las series, repeticiones y cargas no se convertirán directamente en calorías mediante una regla inventada. Para la primera estimación se utilizarán categoría de actividad, peso corporal y duración activa.

### 5.2 Variables calculadas por el programa

| Variable derivada | Procedimiento previsto |
|---|---|
| Gasto en reposo | Fórmula Mifflin–St Jeor |
| Gasto habitual | Reposo multiplicado por un factor explícito de actividad cotidiana |
| Gasto adicional del ejercicio | Referencias MET, descontando la base del mismo tiempo |
| Balance diario | Ingesta confirmada menos gasto estimado |
| Balance acumulado | Suma de días completos del periodo |
| Cobertura del periodo | Días completos y pesajes disponibles |
| Tendencia de peso | Medianas de pesajes en ventanas temporales |
| Pendiente reciente | Cambio entre resúmenes semanales de peso |
| Error del pronóstico | Diferencia entre la predicción emitida y el resultado posterior |

### 5.3 Reglas de calidad

Se comprobarán unidades, fechas, duplicados, duraciones imposibles, actividades solapadas y valores fuera de los rangos establecidos. Se conservarán los registros originales y la procedencia de sus correcciones. No se interpretará un día sin comidas registradas como ingesta cero ni se inventarán pesajes diarios mediante interpolación para aumentar el conjunto de entrenamiento.

## 6. Bases de datos y fuentes propuestas

### 6.1 Supabase y PostgreSQL

Supabase será la plataforma de persistencia de la aplicación. PostgreSQL permitirá relacionar usuarios, metas, pesajes, comidas, actividades y proyecciones. La autenticación identificará al usuario y las políticas RLS limitarán el acceso a sus registros.

Se elige porque permite conservar datos estructurados, consultar periodos, mantener integridad mediante restricciones y proteger información por usuario. Esta base será operativa: no debe confundirse con un conjunto externo para entrenar modelos.

Entidades lógicas previstas:

| Entidad | Contenido principal |
|---|---|
| Perfil de progreso | Estatura, parámetros de fórmula, zona horaria y actividad cotidiana |
| Meta | Peso objetivo y fecha de definición |
| Pesajes | Peso, fecha de medición y procedencia |
| Comidas | Fecha, porción y calorías confirmadas |
| Actividades | Tipo, inicio, fin y tiempo activo |
| Estado del diario | Confirmación de completitud por día |
| Estimaciones energéticas | Entradas utilizadas, resultados y versión del cálculo |
| Proyecciones | Fecha de emisión, horizonte, versión, entradas y salida |
| Consentimiento | Finalidad, aceptación o retirada, fecha y versión de política |
| Registro de modelos | Versión, artefacto, métricas, aprobación y estado |

Los nombres físicos se definirán al revisar el esquema de la aplicación para reutilizar tablas compatibles y evitar duplicaciones.

### 6.2 DIETFITS como conjunto externo de investigación

Se propone evaluar el archivo `All_outcomes_v4.csv` de DIETFITS, junto con su diccionario. Su interés reside en que reúne seguimiento de múltiples personas con peso, ingesta calórica y gasto estimado en visitas separadas en el tiempo.

Se estudiará un objetivo de cambio de peso a tres meses, coherente con la separación entre visitas. El gasto expresado en kcal/kg/día se convertirá utilizando el peso de esa misma visita. Se verificará que representa gasto total para evitar volver a sumar metabolismo y ejercicio.

**Limitaciones:** las visitas no equivalen a un diario continuo, el gasto estimado por cuestionario no equivale a calorías exactas por entrenamiento y puede haber datos ausentes. El conjunto no validará por sí solo un modelo semanal ni la estimación de una fecha de meta.

El acceso público a un archivo no resolverá automáticamente sus permisos de reutilización. Antes del experimento se revisarán procedencia, diccionario y condiciones de uso; antes de una integración comercial se deberá resolver expresamente ese alcance. No se redistribuirán originales por el mero hecho de poder descargarlos.

### 6.3 Historial real de la aplicación

Será necesario para evaluar el horizonte semanal y comprobar si un modelo generaliza a los usuarios del programa. La reutilización para entrenamiento se realizará únicamente con consentimiento y datos minimizados, separada del uso normal del diario.

Se elige como fuente de validación porque refleja la frecuencia de registro, las estimaciones de comida y las categorías de actividad que el modelo encontrará en funcionamiento.

### 6.4 Compendium of Physical Activities

Se utilizarán categorías MET documentadas como referencia para estimar el gasto de actividades seleccionadas. Es una tabla de referencia, no un conjunto longitudinal para predecir el peso.

Se elige porque permite asociar cada estimación a una actividad y fuente reconocibles, en lugar de asignar calorías arbitrarias a una repetición. Los valores seguirán siendo aproximaciones poblacionales.

## 7. Métodos y algoritmos propuestos

### 7.1 Estimación energética mediante fórmulas

Se utilizará Mifflin–St Jeor para una estimación inicial de reposo:

```text
R = 10 × peso_kg + 6,25 × estatura_cm − 5 × edad + constante
Constante de la ecuación: +5 o −161 según el sexo utilizado por la fórmula.
Base diaria = R × factor de actividad cotidiana.
```

Para las actividades con MET conocido:

```text
Gasto bruto = MET × 3,5 × peso_kg / 200 × minutos activos
Gasto adicional = máximo(0, gasto bruto − base correspondiente a esos minutos)
Gasto diario = base diaria + suma de gastos adicionales
Balance = calorías ingeridas − gasto diario
```

Se eligen fórmulas como punto de partida porque producen resultados interpretables y no necesitan entrenar una IA. Los factores cotidianos y límites se documentarán como supuestos del producto. No se utilizará una equivalencia fija de calorías a kilogramos para garantizar una fecha de llegada a la meta.

### 7.2 Tendencia mediante medianas y proyección de pendiente

Se calcularán resúmenes de peso mediante medianas en ventanas temporales y se estimará una pendiente reciente. La mediana reducirá la influencia de pesajes aislados, sin borrar los originales.

La primera proyección se basará en 28 días de historial suficiente y un horizonte de 7 días. Como criterio inicial, se solicitarán al menos tres días con pesaje en cada semana y un pesaje reciente. Las pendientes tendrán límites de cambio y se actualizarán con una cadencia semanal.

Se elige como primer método porque es sencillo, reproducible y permite establecer una referencia que cualquier modelo posterior deberá mejorar. No es un modelo de IA entrenado. Sus escenarios de pendientes no se presentarán como intervalos de confianza.

### 7.3 Referencias de comparación

Antes de entrenar se definirán los siguientes modelos base:

1. **Persistencia:** el peso futuro será igual al peso actual.
2. **Cambio medio:** se aplicará el cambio medio observado exclusivamente en entrenamiento, para el mismo horizonte.
3. **Tendencia reciente:** se extrapolará la pendiente calculada con datos anteriores a la emisión, cuando la frecuencia de pesajes lo permita.

Estas referencias permitirán comprobar si una técnica más compleja aporta valor. No se compararán directamente errores de una predicción a tres meses con errores de una predicción a siete días.

### 7.4 Regresión Ridge como primer candidato de aprendizaje automático

Se propone Ridge como primer modelo supervisado. Predecirá un cambio de peso continuo mediante una combinación de variables de entrada, con regularización L2 para limitar la magnitud de los coeficientes.

```text
Objetivo: Δpeso = peso futuro − peso al emitir
Predicción: Δpeso_estimado = b + β1x1 + β2x2 + ... + βpxp
Ajuste Ridge: minimizar error cuadrático + α × suma(βj²)
Peso futuro estimado = peso al emitir + Δpeso_estimado
```

Se elige por su simplicidad, regularización, bajo coste y facilidad de reproducir la inferencia. Será especialmente útil como primera comparación con pocas variables tabulares. Una relación aprendida no se interpretará como efecto causal de las calorías o el ejercicio.

El entrenamiento utilizará `Pipeline`, imputación de entradas mediante la mediana de entrenamiento, normalización y `Ridge`. Se probará una rejilla pequeña de valores de `alpha`, por ejemplo 0,1; 1; 10; 100 y 1.000, seleccionando con validación. No se imputará la etiqueta de peso futuro.

### 7.5 Árboles con gradient boosting como candidato secundario

Se evaluará un regresor de gradient boosting para explorar relaciones no lineales e interacciones que Ridge no represente. Esta familia combina árboles que corrigen progresivamente errores del conjunto.

Se limitarán profundidad o número de hojas, iteraciones y tamaño mínimo por hoja. Se comparará una configuración pequeña con Ridge y las referencias, sin una búsqueda extensa guiada por el test.

Para muestras pequeñas se considerará `GradientBoostingRegressor`. `HistGradientBoostingRegressor` será otra alternativa si el tamaño y la evaluación justifican su uso; no se elegirá por una supuesta ventaja universal. El algoritmo exacto y su rejilla se fijarán antes de abrir la prueba final.

Se propone como segundo candidato porque puede capturar interacciones con datos tabulares. Su complejidad adicional solo se aceptará si ofrece una mejora medida y existe una forma de desplegarlo y mantenerlo.

### 7.6 Calibración de intervalos mediante split conformal

Después de seleccionar el modelo se utilizará un conjunto de calibración separado para obtener un cuantil de los errores absolutos. Ese cuantil permitirá construir un intervalo alrededor de la predicción puntual.

Se medirá su cobertura y anchura en prueba. Se informará el nivel nominal junto con la cobertura realmente observada; no se garantizará automáticamente la misma cobertura ante cambios de población o de tiempo. El intervalo tampoco se convertirá sin validación en un intervalo de fecha de meta.

### 7.7 Técnicas que no se priorizarán

No se comenzará con redes neuronales, LSTM o Transformers: el objetivo inicial utiliza pocas variables y todavía requiere construir un historial longitudinal suficiente. Su coste y complejidad no se justifican sin evidencia de mejora. Un modelo de lenguaje tampoco será el algoritmo para calcular el cambio de peso.

Los modelos ARIMA no serán la primera opción porque requieren revisar la estructura temporal y no resuelven por sí solos las entradas de comidas y actividad ni los pesajes irregulares de múltiples usuarios.

### 7.8 Orden de selección propuesto

| Orden | Método | Papel en el proyecto |
|---|---|---|
| 1 | Fórmulas energéticas y medianas | Base funcional explicable |
| 2 | Persistencia y cambio medio | Referencias mínimas para evaluar utilidad |
| 3 | Proyección por tendencia | Referencia personalizada a corto plazo |
| 4 | Ridge | Primer candidato entrenable |
| 5 | Gradient boosting | Candidato condicionado a evidencia adicional |
| 6 | Split conformal | Calibración de intervalos del candidato seleccionado |

## 8. Preparación del experimento predictivo

### 8.1 Definir la unidad de observación

Cada ejemplo representará a una persona en una fecha de emisión, con entradas disponibles hasta ese momento y un resultado posterior al horizonte establecido. Se conservarán identificador seudónimo, origen temporal, horizonte y fecha del resultado.

### 8.2 Separar dos experimentos

**Experimento externo con DIETFITS:** predecir el cambio a tres meses usando peso, calorías ingeridas y gasto estimado de la visita inicial. No se utilizarán las calorías o actividad medidas al final del intervalo como entradas.

**Experimento con la aplicación:** predecir inicialmente el peso a siete días usando resúmenes de las cuatro semanas anteriores. Se definirá de antemano la ventana aceptada para el pesaje posterior, el tratamiento de varios pesajes y la exclusión de ejemplos sin resultado suficiente.

Se entrenarán y evaluarán por separado. No se supondrá que un modelo de tres meses puede cambiarse a siete días sustituyendo una constante.

### 8.3 Variables candidatas para el experimento de la aplicación

- Peso reciente y medianas semanales anteriores a la emisión.
- Pendiente del peso y variabilidad reciente.
- Ingesta media de días completos.
- Gasto estimado medio y balance medio de esos mismos días.
- Número de días completos y número de días con pesaje.
- Minutos de actividad y distribución semanal, si su registro es consistente.
- Variables de perfil disponibles y autorizadas, solo si aportan mejora verificable.

Se evitará introducir simultáneamente muchas variables redundantes sin evaluarlas. Las series y cargas se explorarán después de comprobar su calidad y utilidad. El peso objetivo no será la etiqueta de entrenamiento ni una prueba del resultado real.

### 8.4 Limpieza y particiones

1. Auditar columnas, unidades, faltantes, duplicados y visitas.
2. Conservar el archivo original y registrar su hash.
3. Asignar participantes a entrenamiento, validación, calibración y prueba.
4. Construir ejemplos temporales con entradas estrictamente anteriores al resultado.
5. Ajustar imputación y escalado solo con entrenamiento.
6. Seleccionar hiperparámetros solo mediante validación.
7. Calibrar intervalos con la partición reservada para ello.
8. Abrir la prueba final una vez, después de congelar la selección.

Una persona no aparecerá en entrenamiento y prueba para la evaluación de generalización a nuevos usuarios. Además se realizará una evaluación temporal: entrenar o ajustar con periodos anteriores y comprobar periodos posteriores. Un corte temporal simple no asegura separación de personas; una separación por personas tampoco asegura por sí sola validación temporal. Se comprobarán ambas condiciones según la pregunta experimental.

La personalización de un usuario se evaluará aparte, usando su pasado para ajustar y su futuro para comprobar. No se confundirá con el experimento de usuarios nuevos.

## 9. Fases y sprints de implementación

### Parte I — Análisis y diseño

#### Sprint 0 — Requisitos y diseño técnico

**Objetivo:** definir el alcance y revisar qué funciones de la aplicación se pueden reutilizar.

**Pasos:** inventariar autenticación, comidas y entrenamientos; diseñar entidades y permisos; fijar unidades, población, horizontes, criterios de calidad y casos de prueba; revisar las condiciones de DIETFITS.

**Entregables:** documento de requisitos, esquema de datos, diccionario de variables y plan de evaluación.

**Criterio de cierre:** cada cálculo y cada dato requerido tendrán finalidad, unidad y procedencia definidas.

### Parte II — Construcción del historial del usuario

#### Sprint 1 — Perfil, meta y pesajes

**Pasos:** implementar formularios; guardar perfil y meta; registrar, consultar y corregir pesajes; validar fechas y unidades; proteger acceso por usuario.

**Entregables:** módulo de progreso y migraciones de persistencia.

**Pruebas:** registros duplicados, valores inválidos, correcciones, acceso entre usuarios y presentación móvil.

#### Sprint 2 — Comidas y entrenamientos

**Pasos:** integrar confirmación de comidas; registrar actividad y tiempo activo; separar pausas; agrupar por día local; permitir confirmar si ingesta y actividad están completas.

**Entregables:** diario de alimentación y actividad con procedencia y cobertura.

**Pruebas:** días incompletos, cambios de zona horaria, pausas, sesiones parciales y correcciones de calorías.

### Parte III — Estimación energética

#### Sprint 3 — Gasto diario

**Pasos:** implementar Mifflin–St Jeor; definir factores cotidianos; incorporar categorías MET; descontar gasto base durante ejercicio; guardar entradas y versión del cálculo.

**Entregables:** estimación desglosada en reposo, actividad habitual y ejercicio adicional.

**Pruebas:** unidades, peso antiguo, perfiles fuera del alcance, actividades sin categoría y solapamientos.

#### Sprint 4 — Balance energético

**Pasos:** sumar comidas confirmadas; restar gasto; acumular solo días cerrados y completos; mostrar cobertura; actualizar resultados derivados cuando se corrijan registros.

**Entregables:** vista de balance diario y acumulado.

**Pruebas:** diferencias entre cero y ausente, días abiertos, periodos incompletos y cambios de datos fuente.

### Parte IV — Tendencia y primera proyección

#### Sprint 5 — Tendencia del peso

**Pasos:** calcular medianas por ventanas; conservar pesajes originales; mostrar tendencia y balance del mismo periodo; identificar discrepancias persistentes sin atribuir una causa no demostrada.

**Entregables:** gráfico de progreso, tabla accesible y mensajes de suficiencia de datos.

**Pruebas:** pesajes irregulares, valores aislados, periodos vacíos y discrepancias sostenidas.

#### Sprint 6 — Proyección explicable

**Pasos:** fijar 28 días de historial y horizonte de 7 días; calcular pendientes semanales; limitar variaciones; guardar una instantánea reproducible; comparar con pesajes posteriores; mantener correcciones energéticas separadas.

**Entregables:** proyección semanal y evaluación temporal frente a persistencia y tendencia previa.

**Pruebas:** insuficiencia de historial, resultados posteriores a la emisión, ausencia de información futura, límites del ajuste y reproducción de una proyección guardada.

La fecha de meta será una salida condicionada a tendencia descendente estable y alcance defendible. No se extrapolará indefinidamente una recta.

### Parte V — Evaluación de aprendizaje automático

#### Sprint 7 — Preparación, entrenamiento y selección

**Pasos:** auditar DIETFITS y permisos; preparar pares temporales; separar participantes; entrenar referencias y Ridge; evaluar boosting solo según el protocolo; calibrar intervalos; medir test y diagnóstico temporal; redactar la decisión.

**Entregables:** scripts reproducibles, informe de datos, métricas por horizonte, comparación de modelos y decisión de incorporación.

**Pruebas:** separación de participantes, transformaciones ajustadas solo con entrenamiento, ausencia de variables futuras, conservación de originales y equivalencia de inferencia.

**Criterio de cierre:** la decisión estará respaldada por métricas, incluso si el resultado es conservar el método sencillo. No se garantizará anticipadamente que un modelo entrenado será el seleccionado.

### Parte VI — Validación en la aplicación y mantenimiento

#### Sprint 8 — Piloto, integración condicionada y seguimiento

**Pasos:** habilitar consentimiento separado; reunir historial suficiente; ejecutar predicciones en modo de evaluación sin sustituir inicialmente el método vigente; esperar resultados maduros; validar al mismo horizonte; aprobar una versión solo si supera los criterios; implementar seguimiento y retorno.

**Entregables:** política de consentimiento, registro de versiones, informe del piloto, monitor de error y procedimiento de retirada de un modelo.

**Pruebas:** revocación de consentimiento, aislamiento de datos, artefactos incompatibles, fallo de inferencia, deterioro de métricas y retorno al método anterior.

El sprint podrá requerir un periodo prolongado de observación. Completar su código no sustituirá la espera necesaria para disponer de resultados posteriores reales.

## 10. Métricas y criterios de decisión

### 10.1 Métricas

| Métrica | Interpretación |
|---|---|
| MAE en kg | Magnitud media del error absoluto; será la métrica principal |
| RMSE en kg | Indicador complementario más sensible a errores grandes |
| Sesgo medio | Tendencia a predecir por encima o por debajo del resultado |
| Cobertura del intervalo | Proporción de resultados dentro de la banda predictiva |
| Anchura del intervalo | Utilidad de la banda; una cobertura alta con banda enorme puede aportar poco |
| Participantes y pares utilizables | Tamaño efectivo y disponibilidad real de datos |
| Cobertura del diario | Calidad y completitud de las entradas de la aplicación |

Se calcularán por horizonte y versión. Se analizará incertidumbre de la mejora mediante bootstrap por participante, preservando juntos los registros de una misma persona.

### 10.2 Criterio inicial de adopción

Antes de abrir la prueba se fijará una mejora mínima, como reducir MAE al menos 0,2 kg y 5% respecto de la mejor referencia comparable, con un intervalo de mejora cuyo límite inferior sea positivo. Se comprobarán también sesgo, cobertura y anchura. Estos valores serán criterios iniciales de ingeniería y deberán justificarse para el horizonte elegido; no constituyen validación clínica.

La adopción requerirá además uso autorizado, entradas equivalentes entre entrenamiento y aplicación, validación temporal con usuarios de la aplicación, inferencia reproducible y mecanismo de retorno probado. Si falta alguna condición, se mantendrá el método explicable.

El tamaño mínimo de la muestra se planificará según participantes independientes, variabilidad e incertidumbre deseada. No se elegirá un número universal que garantice precisión ni se aumentará artificialmente con filas repetidas de una persona.

## 11. Arquitectura y herramientas

```text
Interfaz React
  → registro y confirmación de datos
  → Supabase Auth y PostgreSQL con RLS
  → cálculos explicables versionados
  → tendencia y proyección

Proceso de investigación separado
  → extracto autorizado y seudonimizado
  → auditoría con Python y pandas
  → entrenamiento con scikit-learn
  → validación y calibración
  → aprobación de un artefacto versionado
  → inferencia y seguimiento en la aplicación, si se autoriza su adopción
```

| Tecnología | Justificación |
|---|---|
| React, Vite, JavaScript y Tailwind | Mantener la arquitectura de interfaz y facilitar uso móvil |
| Supabase y PostgreSQL | Persistencia relacional, autenticación y permisos por usuario |
| Python y pandas | Auditoría y preparación reproducible de datos tabulares |
| NumPy y scikit-learn | Operaciones numéricas, pipelines y modelos de regresión |
| Pruebas automatizadas | Verificar cálculos, contratos de datos y prevención de filtraciones |

Ridge podrá exportarse como coeficientes y transformaciones versionadas si se demuestra equivalencia con la implementación JavaScript. Un modelo de árboles necesitará un servicio de inferencia o formato compatible cuya salida se compruebe frente al entrenamiento. No se copiarán únicamente coeficientes sin su orden de variables, unidades y transformaciones.

## 12. Seguridad, consentimiento y mantenimiento

- El diario personal y la reutilización para entrenamiento tendrán finalidades separadas.
- El entrenamiento con datos de usuarios requerirá aceptación voluntaria y posibilidad de retirada.
- Se utilizarán identificadores seudónimos; se excluirán credenciales, nombres, fotos y texto libre innecesario.
- Las claves privadas permanecerán en el servidor. Las variables públicas del navegador no contendrán secretos administrativos.
- Se probarán permisos entre usuarios y acceso a extractos de investigación.
- Se conservará la versión de datos, código, modelo y parámetros que produjo cada pronóstico.
- No se reentrenará automáticamente después de cada comida. Se definirán revisiones periódicas con suficientes resultados nuevos y una evaluación previa.
- Ante fallos o deterioro sostenido, se suspenderá la IA y se regresará al método anterior si tiene datos suficientes.

## 13. Riesgos y medidas previstas

| Riesgo | Medida |
|---|---|
| Calorías estimadas de manera imprecisa | Confirmación del usuario y contraste con tendencia observada |
| Doble conteo del ejercicio | Descontar la base del mismo intervalo |
| Días incompletos | Mostrar cobertura y bloquear conclusiones sin información suficiente |
| Fluctuaciones aisladas de peso | Utilizar medianas y ventanas de observación |
| Sobreajuste del modelo | Regularización, rejillas pequeñas y particiones independientes |
| Uso de información futura | Congelar entradas en la emisión y auditar fechas |
| Diferencias entre DIETFITS y la aplicación | Experimentos separados y validación con usuarios reales |
| Permisos de reutilización insuficientes | Revisar condiciones antes de entrenar o desplegar |
| Fecha de meta poco defendible | Limitar horizonte y permitir salida de datos insuficientes |

## 14. Entregables finales y criterio de terminación

1. Documento de requisitos y diccionario de variables.
2. Esquema de base de datos, migraciones y pruebas de permisos.
3. Perfil, meta, pesajes y diario de alimentación y actividad.
4. Estimación energética y balance con procedencia y cobertura.
5. Tendencia y proyección explicable con evaluación temporal.
6. Auditoría del conjunto externo y revisión de condiciones de uso.
7. Experimentos reproducibles de Ridge y, si corresponde, gradient boosting.
8. Informe comparativo de errores e incertidumbre por horizonte.
9. Decisión justificada de incorporar o descartar cada candidato.
10. Si se adopta IA, integración versionada, piloto validado, monitor y retorno probado.

La primera versión funcional podrá completarse con los sprints 0 a 6. La ampliación de IA abarcará los sprints 7 y 8 y dependerá de disponer de datos y evidencia suficientes. El éxito del proyecto se medirá por la utilidad y fiabilidad del seguimiento, no por incorporar obligatoriamente el algoritmo más complejo.

## 15. Fuentes de consulta

- [Repositorio DIETFITS en OSF](https://osf.io/kyiuj/): procedencia del conjunto propuesto; revisar sus archivos, diccionario y condiciones antes del uso.
- [Estudio DIETFITS en JAMA](https://jamanetwork.com/journals/jama/fullarticle/2673150): contexto del ensayo y de sus mediciones.
- [Compendium of Physical Activities](https://pacompendium.com/): referencia de categorías de actividad y MET.
- [Ridge en scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html): regresión con regularización L2.
- [GradientBoostingRegressor](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.GradientBoostingRegressor.html): regresión mediante boosting de árboles.
- [HistGradientBoostingRegressor](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html): alternativa basada en histogramas.
- [Validación cruzada en scikit-learn](https://scikit-learn.org/stable/modules/cross_validation.html): separación por grupos y evaluación temporal; sus requisitos se aplicarán según la unidad de observación.
- [Pipelines y prevención de filtración de datos](https://scikit-learn.org/stable/common_pitfalls.html): separación entre ajuste de transformaciones y prueba.
- [Documentación de Supabase sobre RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): protección de filas por usuario.
