# hito4 — Agente de predicción de pérdida de peso

## Objetivo

Preparar primero el programa para registrar y relacionar peso, comidas y entrenamientos. Estimar el gasto diario, calcular el balance acumulado, compararlo con la tendencia del peso y ajustar la proyección cuando ambos no coincidan. Incorporar aprendizaje automático únicamente después de completar y comprobar esa base.

La primera versión será un seguimiento con cálculos y ajustes explicables, sin necesidad de entrenar una IA. Presentar estimaciones y sus limitaciones, sin prometer una fecha exacta para alcanzar la meta.

Este documento es la especificación de referencia. Las solicitudes posteriores del usuario autorizan implementar los sprints correspondientes; el estado de cada uno se registra con sus pruebas y límites pendientes.

## Contexto y reglas

- Revisar `agente.md`, la documentación y el código vigente antes de implementar; localizar la copia activa del proyecto y no trabajar sobre una exportación antigua por error.
- Reutilizar el registro nutricional, historial de entrenamientos y autenticación existentes.
- Mantener React, Vite, JavaScript, Tailwind y Supabase; interfaz en español, compatible con móviles y con el diseño existente.
- Evitar redes neuronales y dependencias pesadas. No se necesita un modelo de lenguaje para calcular la predicción.
- Mantener los secretos en el servidor. Las variables `VITE_*` son públicas: nunca colocar en ellas claves privadas, tokens administrativos ni claves de proveedores de IA.
- Proteger datos por usuario mediante RLS y no modificar funcionalidades ajenas a este hito.

## Fuente candidata para la etapa posterior de IA: DIETFITS

DIETFITS no es una dependencia de los primeros sprints. El registro, el balance y la proyección inicial deben funcionar con los datos del usuario sin importar este conjunto ni entrenar un modelo.

Archivo comprobado: `All_outcomes_v4.csv`.

- Archivo y descarga: https://osf.io/ztysq/ y https://osf.io/ztysq/download
- Proyecto: https://osf.io/kyiuj/
- Metadatos y licencia: https://osf.io/kyiuj/metadata/osf
- Método original: https://jamanetwork.com/journals/jama/fullarticle/2673150

La comprobación realizada encontró 609 participantes, 2.436 filas y cuatro evaluaciones por persona: inicio, 3, 6 y 12 meses. Las filas pueden contener valores ausentes; no representan registros diarios.

| Variable | Columna | Uso |
|---|---|---|
| Identificador | `study_id` | Agrupar observaciones de la misma persona |
| Evaluación | `redcap_event_name`, `time` | Ordenar y construir intervalos temporales |
| Peso | `weight_gcrc` | Peso corporal en kg y resultado futuro |
| Ingesta | `cal` | Calorías ingeridas estimadas por entrevistas alimentarias |
| Actividad/gasto | `par_kcal_kg_day` | Gasto energético total estimado por cuestionario, en kcal/kg/día |
| Otras variables | `height_bl`, `scr_gender`, `diet`, `bmi` | Variables opcionales, después de verificar código y unidades |

Se encontraron las tres variables principales simultáneamente en 554 registros iniciales, 473 del mes 3, 366 del mes 6 y 376 del mes 12. Hay 238 participantes con las tres variables completas en las cuatro evaluaciones. Recalcular estas cifras cuando se obtenga la versión que se vaya a utilizar.

### Condiciones de uso

La descarga respondió sin cuenta ni solicitud de acceso. Sin embargo, OSF muestra “No License”; no atribuirle CC BY, CC0 ni otra licencia estándar inexistente.

En https://onlinelibrary.wiley.com/doi/10.1002/oby.22389 los investigadores declaran que los datos anonimizados descritos en esa publicación se compartirían para “any purpose by anyone”. Esta declaración favorable no debe presentarse como una licencia formal de todo el repositorio.

Antes de utilizar el archivo para entrenamiento, documentar la procedencia y el alcance de la autorización aplicable. No considerar resuelto el uso comercial. Si se necesita aclaración, preparar la consulta al titular; no enviarla sin autorización del usuario. Se puede continuar definiendo el sistema y el protocolo de evaluación mientras se resuelve este punto.

### Límites del conjunto

- La ingesta procede de autoinforme y tiene error; no representa calorías medidas de manera exacta.
- `par_kcal_kg_day` representa gasto total estimado, no únicamente ejercicio. No sumarle de nuevo metabolismo basal y ejercicio.
- El estudio recoge adultos de 18 a 50 años con IMC de 28 a 40; evaluar la transferencia a la población de la aplicación.
- Cuatro evaluaciones por persona permiten estudiar cambios a varios meses. No generan evidencia suficiente para validar pronósticos semanales ni fechas exactas de llegada a la meta.

## Datos que registrará la aplicación

### Perfil inicial

Peso inicial, estatura, edad, peso objetivo y nivel habitual de actividad. Solicitar el sexo utilizado por la ecuación fisiológica solo si se adopta una fórmula que lo requiera, explicando su finalidad. Registrar la fecha inicial y las unidades.

### Seguimiento

- Pesajes con fecha y hora; permitir varios por semana y obtener una tendencia para reducir fluctuaciones diarias.
- Calorías ingeridas por día, conservando el origen: escáner nutricional, entrada manual o corrección del usuario.
- Actividad diaria y entrenamientos: tipo, duración y, cuando existan, pasos y calorías estimadas con su método de cálculo.
- Series, repeticiones y cargas disponibles como historial complementario. No convertirlas directamente en calorías con una equivalencia inventada.
- Distinguir días sin datos de días con valor cero. No asumir que una comida detectada equivale a toda la ingesta del día.
- Pedir consentimiento para reutilizar registros personales en entrenamiento; permitir usar la función sin consentir ese uso secundario.

## Plan de trabajo por sprints

Estado revisado: sprint 0 terminado como auditoría estática y diseño; sprints 1 a 6 implementados en copia de trabajo con pruebas locales, pendientes de aplicar al proyecto activo y validar Supabase e interfaz; sprint 7 evaluado offline con DIETFITS y 27 pruebas completas: el candidato no supera el criterio de adopción y se conserva el método del sprint 6; no hay integración de IA. Uso documentado limitado a investigación local, sin resolver licencia formal amplia o comercial. Sprint 8 no iniciado. Ver [sprint 0](hito4-sprint0.md), [sprint 1](hito4-sprint1.md), [sprint 2](hito4-sprint2.md), [sprint 3](hito4-sprint3.md), [sprint 4](hito4-sprint4.md), [sprint 5](hito4-sprint5.md), [sprint 6](hito4-sprint6.md) y [sprint 7](hito4-sprint7.md) para evidencia y límites de verificación. El agente debe completar solo las partes faltantes; no dar por terminado un sprint únicamente porque haya una pantalla o una tabla.

Cada sprint depende del anterior. Registrar alcance implementado, pruebas, limitaciones y estado: pendiente, en curso o terminado. No fijar una duración de calendario sin acordarla.

### Sprint 0 — Revisar el programa y diseñar los datos

**Objetivo:** conocer qué está funcionando antes de añadir módulos.

- Revisar perfil, escáner de comidas, historial nutricional, rutinas, sesiones y pesajes existentes.
- Identificar si el escáner guarda resultados y permite corregir porciones y calorías.
- Comprobar si cada entrenamiento conserva fecha, duración efectiva, ejercicio, series, repeticiones y carga cuando correspondan.
- Definir unidades, zona horaria del usuario y fecha local a la que pertenece cada registro.
- Diseñar las relaciones y migraciones mínimas en Supabase, con RLS por usuario. Diferenciar registros originales de resúmenes y proyecciones derivados.
- Preparar un inventario de funciones existentes, faltantes y cambios necesarios por sprint.

**Terminado cuando:** exista un mapa de datos y una propuesta de cambios compatible con el programa actual, sin duplicar funcionalidades.

### Sprint 1 — Perfil, meta e historial de peso

**Objetivo:** disponer de una referencia real para observar el progreso.

- Completar el perfil con los datos necesarios para la estimación fisiológica elegida y con peso objetivo.
- Permitir registrar, consultar, corregir y eliminar pesajes propios con fecha y hora.
- Validar unidades y mostrar peso inicial, último peso y evolución histórica.
- Mantener los pesajes originales y evitar confundir una corrección con un pesaje nuevo.
- Acordar el alcance inicial de población de la función; no extrapolar automáticamente las fórmulas a perfiles para los que no sean apropiadas.

**Terminado cuando:** el usuario pueda mantener su historial entre sesiones y otro usuario no pueda acceder a él. Probar unidades, fechas, edición y aislamiento de datos.

### Sprint 2 — Incorporar comidas y entrenamientos

**Objetivo:** obtener registros diarios utilizables, aprovechando lo que ya existe.

- Conectar el escáner nutricional con un diario de comidas persistente.
- Permitir registrar comidas manualmente y corregir porciones, cantidades y calorías estimadas.
- Guardar el origen y estado del registro; una detección pendiente no debe contarse como comida consumida confirmada.
- Consolidar las sesiones realmente realizadas; no contabilizar una rutina planificada como ejercicio completado.
- Conservar duración, tipo de actividad y los detalles disponibles de series, repeticiones y peso utilizado.
- Permitir señalar si el registro alimentario del día está completo. No interpretar ausencia de comidas como ingesta cero.
- Evitar duplicados por reintentos, sincronización o guardados repetidos. Una edición debe reemplazar su contribución al total.

**Terminado cuando:** comidas y sesiones confirmadas alimenten un resumen del día y sus correcciones actualicen los totales sin duplicarlos.

### Sprint 3 — Estimar el gasto energético diario

**Objetivo:** obtener una estimación explicable de cuánta energía gasta el usuario.

- Elegir y documentar una ecuación de gasto en reposo y un método para actividad cotidiana, indicando fuente, unidades y población aplicable antes de implementarlos.
- Elegir un método documentado para estimar el gasto de entrenamientos según tipo, intensidad y duración efectiva; registrar qué método se usó.
- Aplicar una sola convención: si el gasto base ya incluye ejercicio habitual, no volver a sumarlo. Si se añade ejercicio por separado, descontar la parte ya incluida en la base.
- Distinguir gasto en reposo, gasto por actividad y gasto total; usar siempre el total para el balance.
- No calcular calorías únicamente multiplicando series, repeticiones o carga por un coeficiente inventado. Si faltan datos, identificar la limitación.
- Actualizar la estimación con el peso vigente y conservar las entradas y versión de cálculo usadas para cada día.

**Terminado cuando:** el resumen explique el gasto total y su procedencia, y las pruebas comprueben que un entrenamiento no se cuenta dos veces ni una actividad desconocida se considera gasto cero con falsa precisión.

### Sprint 4 — Calcular el balance diario y acumulado

**Objetivo:** relacionar ingesta y gasto de forma consistente.

- Usar la convención `balance diario = calorías ingeridas − gasto energético total estimado`.
- Mostrar valores negativos como déficit y positivos como superávit.
- Calcular el balance de periodos seleccionados sumando los días evaluables y mostrando su cobertura: por ejemplo, 5 de 7 días completos.
- Diferenciar el balance provisional del día en curso del balance de un día cerrado; no comparar una ingesta parcial con un gasto completo sin indicarlo.
- Marcar días incompletos; no rellenarlos silenciosamente con cero ni presentar su suma como el balance completo del periodo.
- Recalcular los días afectados cuando se corrija una comida, sesión o dato relevante, con una política explícita para cambios históricos del perfil.
- No convertir automáticamente el déficit acumulado en kilos de grasa perdidos ni extrapolar la regla fija de 7.700 kcal/kg a largo plazo.

**Terminado cuando:** se puedan explicar y reproducir los balances diarios y acumulados, incluyendo correcciones, días faltantes y límites entre fechas locales.

### Sprint 5 — Comparar el balance con la tendencia del peso

**Objetivo:** comprobar si lo registrado coincide con lo observado en la báscula.

- Mantener visibles los pesajes individuales y calcular una tendencia suavizada separada; usar fechas reales y no inventar pesajes en días faltantes.
- Definir y documentar la ventana de suavizado y el mínimo de pesajes y días completos necesario para comparar periodos.
- Mostrar en una misma vista la evolución del peso y el resumen energético del mismo periodo, con unidades y escalas claras.
- Detectar situaciones como déficit registrado con peso estable o creciente; presentarlas como discrepancias, no como prueba de que el usuario registró mal.
- Considerar fluctuaciones de agua y registros incompletos antes de interpretar el cambio; no ajustar el cálculo por una subida aislada.
- Si los datos no alcanzan, mostrar “Datos insuficientes” y explicar qué registros faltan.

**Terminado cuando:** el usuario pueda distinguir peso observado, tendencia y balance estimado. Probar pesajes irregulares, un valor aislado, periodos sin datos y discrepancias persistentes.

### Sprint 6 — Proyección inicial y ajuste con resultados reales

**Objetivo:** actualizar una proyección explicable sin entrenar todavía un modelo de IA.

- Construir una proyección inicial basada en la tendencia y, cuando exista suficiente información, en un modelo fisiológico documentado. Identificar qué parte es observación y qué parte depende de supuestos.
- Especificar antes de implementar el horizonte inicial, historial mínimo, método, límites del ajuste y cómo se evaluará; no presentar estos parámetros como clínicamente validados por defecto.
- Comparar periódicamente la proyección emitida con los pesajes posteriores y evaluar si existe un desajuste persistente entre balance y tendencia.
- Ajustar gradualmente la estimación efectiva del balance o del gasto con suficiente historial. No cambiar simultáneamente ingesta y gasto para forzar coincidencia: los datos no permiten identificar por sí solos la causa del error.
- Conservar comidas, entrenamientos y pesajes originales. Guardar la corrección como un parámetro separado con fecha, versión y motivo.
- Recalcular con nuevos datos completos sin reaccionar a cada fluctuación diaria. Informar qué cambió y por qué.
- Mostrar una banda o escenarios de incertidumbre con método documentado, sin inventar porcentajes de confianza.
- Mostrar tiempo estimado hasta la meta solo si hay una tendencia descendente suficientemente estable y el horizonte es defendible; en otro caso indicar que aún no se puede estimar. No extender indefinidamente una recta hasta cualquier meta.

**Terminado cuando:** se pueda reproducir cada proyección, comparar su error con resultados posteriores y comprobar que el ajuste es gradual, trazable y no se activa con datos insuficientes. Evaluar en orden temporal frente a mantener el peso y extrapolar la tendencia reciente, sin prometer precisión antes de medirla.

### Sprint 7 — Evaluar si incorporar IA aporta una mejora

**Objetivo:** decidir con evidencia si un modelo entrenado mejora los cálculos ya disponibles.

Este sprint empieza después de completar los sprints 0 a 6. La aplicación debe poder funcionar sin él. Resolver antes el alcance de uso de DIETFITS y revisar si las entradas de la aplicación son comparables a las del conjunto.

Verificar el diccionario de datos, unidades, valores ausentes, duplicados, intervalos y rangos. Conservar los originales y documentar cada transformación cuando se autorice implementar.

Crear una referencia que prediga el mismo peso actual y otra basada en el método del sprint 6 cuando sea comparable. Contrastarlas con una regresión regularizada que prediga cambio de peso a tres meses usando información disponible al inicio del intervalo. DIETFITS no valida automáticamente el horizonte más corto de la proyección de la aplicación.

Probar regresión Ridge y, solo si aporta una mejora verificable, un modelo de árboles con boosting. Entrenamiento fuera del navegador con Python, pandas y scikit-learn, en un entorno separado y ligero. Exportar una regresión pequeña como coeficientes JSON si permite reproducir fielmente las transformaciones en JavaScript; para otro modelo, definir un servicio de inferencia compatible antes de integrarlo.

Empezar con peso, ingesta y gasto estimado, añadiendo variables solo si están disponibles tanto en el entrenamiento como en la aplicación. No usar `diet` como requisito si la aplicación no recoge una categoría equivalente. No inventar edad u otras columnas ausentes.

La ingesta o actividad medidas al final de un intervalo no están disponibles al emitir su pronóstico: no usarlas como predictores del futuro. Un escenario con ingesta planificada debe identificarse como tal y diferenciarse de una predicción observacional.

No generar pesos diarios artificiales mediante interpolación para aumentar el tamaño de entrenamiento. No mezclar datos sintéticos con reales sin identificarlos.

**Terminado cuando:** haya un informe reproducible de calidad de datos, condiciones de uso, errores por horizonte y comparación con las referencias. Integrar IA únicamente si existe una mejora verificable y un uso autorizado de los datos; si no mejora, conservar el método anterior y documentarlo.

### Sprint 8 — Validación y mantenimiento del modelo, si se adopta IA

Cuando exista suficiente historial real de la aplicación, evaluar cómo ajustar la estimación al usuario y corregir sesgos con sus pesajes recientes. No reentrenar automáticamente con cada comida. Definir un mínimo de observaciones y una evaluación previa para cada actualización del modelo.

**Terminado cuando:** exista una política de consentimiento, evaluación temporal, versiones, seguimiento del error y retorno al método anterior ante fallos. El ajuste explicable del sprint 6 no depende de este reentrenamiento.

## Evaluación adicional obligatoria para los sprints de IA

- Separar entrenamiento y prueba por participante: una persona no puede aparecer en ambos conjuntos. Ajustar imputación y normalización solo con entrenamiento.
- Respetar el tiempo de predicción y evitar cualquier dato futuro, incluido el peso objetivo usado como etiqueta.
- Definir primero el horizonte de tres meses; evaluar seis meses por separado si hay datos suficientes.
- Medir MAE en kg, sesgo y error por horizonte; comparar contra la referencia de peso constante.
- Informar participantes y pares temporales realmente utilizables. Los intervalos de una persona no son personas independientes.
- Evaluar un intervalo de predicción y su cobertura en datos separados. No mostrar un porcentaje de confianza inventado.
- Si el modelo no mejora la referencia, informar el resultado y no presentarlo como una mejora validada.
- Realizar validación posterior con usuarios de la aplicación antes de afirmar que generaliza a ellos.

## Integración futura

Guardar en Supabase perfil, pesajes, resúmenes de ingesta y actividad, consentimiento y predicciones. Reutilizar tablas existentes cuando proceda. Cada predicción debe conservar fecha, horizonte, versión del modelo y datos de entrada utilizados.

Mostrar peso actual, tendencia, estimación al horizonte validado e intervalo de predicción. Explicar cuándo faltan datos. No extrapolar una fecha de meta que el modelo no pueda respaldar. No generar dietas restrictivas automáticamente.

Antes de desplegar, probar permisos RLS entre usuarios, unidades, registros incompletos, consistencia de la inferencia con el entrenamiento y comportamiento de la interfaz móvil. Ejecutar las comprobaciones existentes de compilación y calidad que correspondan a los cambios.

## Entregables y criterio de terminado

1. Inventario de funciones actuales y estado verificable de cada sprint.
2. Perfil y registro persistente de pesajes, comidas y entrenamientos.
3. Estimación del gasto diario y balance acumulado, con cobertura y procedencia.
4. Comparación del balance con la tendencia de peso y visualización del progreso.
5. Proyección inicial con ajuste gradual y trazable a partir de resultados reales.
6. Integración y pruebas de Supabase, permisos, cálculos e interfaz móvil.
7. En la etapa posterior: informe de procedencia, condiciones de uso y evaluación de DIETFITS y de los modelos candidatos.
8. Modelo de IA versionado e inferencia comprobada únicamente si su adopción está justificada.

La primera versión estará lista cuando se completen los sprints 0 a 6 con una función integrada y evaluada. Los sprints 7 y 8 corresponden a una ampliación posterior con IA, no bloquean esa primera versión. Este archivo es la especificación del agente, no una declaración de que las funciones o el modelo ya existan.

## Estado del sprint 8 (22 de octubre de 2026)

Política y controles offline preparados y probados (8 pruebas nuevas, 27 de regresión). IA sin adoptar; integración de consentimiento, registro y retorno en producción pendiente de un candidato válido y piloto autorizado. Consultar `hito4-sprint8.md`.
