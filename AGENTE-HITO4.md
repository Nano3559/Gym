# AGENTE HITO 4 — Implementación del sistema de predicción de pérdida de peso

## Selección de modelos del proyecto

**Modelo principal a desarrollar: regresión Ridge (`sklearn.linear_model.Ridge`).**

**Modelo secundario de comparación: gradient boosting de árboles (`sklearn.ensemble.HistGradientBoostingRegressor`).**

**Modelo inicial de la aplicación: proyección mediante pendiente de medianas semanales de peso.**

El agente deberá implementar el modelo inicial, entrenar Ridge y comparar sus resultados con las referencias definidas. Entrenará el modelo secundario si se cumple la condición de validación del sprint 7. La elección para producción dependerá de la comparación, sin prometer de antemano que un modelo entrenado superará al método sencillo.

Este es un plan de trabajo previo al desarrollo. No incluye resultados de experimentos ni declaraciones de avances.

### Ficha del modelo principal — Regresión Ridge

| Elemento | Especificación obligatoria |
|---|---|
| Tipo de problema | Regresión supervisada: predecir una cantidad continua |
| Algoritmo | Regresión lineal con penalización L2 |
| Implementación | `sklearn.linear_model.Ridge` |
| Salida que aprenderá | Cambio de peso en kg al horizonte del experimento |
| Entradas del experimento DIETFITS | Peso inicial, ingesta calórica inicial y gasto total inicial estimado |
| Horizonte con DIETFITS | Tres meses; modelo independiente del experimento semanal |
| Preparación | Imputación de entradas permitidas con mediana, estandarización y Ridge en un `Pipeline` |
| Hiperparámetro | `alpha` en 0,1; 1; 10; 100 y 1.000, elegido con validación |
| Motivo de elección | Pocas variables tabulares, coste reducido, regularización y facilidad de reproducir la inferencia |
| Limitación | No representa por sí sola relaciones complejas ni garantiza transferencia entre poblaciones |

```text
Etiqueta de entrenamiento = peso posterior − peso inicial
Cambio previsto = intercepto + suma(coeficiente_j × entrada_transformada_j)
Peso previsto = peso inicial + cambio previsto
```

La regularización penalizará coeficientes grandes. Los coeficientes describirán asociaciones predictivas, no efectos causales de ingerir o quemar calorías. No se convertirán directamente en recomendaciones de alimentación.

### Ficha del modelo secundario — HistGradientBoostingRegressor

| Elemento | Especificación obligatoria |
|---|---|
| Tipo de problema | Regresión supervisada sobre la misma etiqueta de Ridge |
| Algoritmo | Gradient boosting de árboles de regresión con particiones basadas en histogramas |
| Implementación | `sklearn.ensemble.HistGradientBoostingRegressor` |
| Entradas y horizonte | Los mismos que Ridge para una comparación equivalente |
| Configuraciones | `max_leaf_nodes` 3 y 7; `max_iter=100`; `learning_rate=0.05`; `min_samples_leaf=20`; `early_stopping=False`; `random_state=407` |
| Condición para entrenarlo | Ridge debe superar ambas referencias en validación según el sprint 7 |
| Motivo de comparación | Puede representar relaciones no lineales e interacciones entre variables |
| Limitación | Mayor complejidad, riesgo de sobreajuste y necesidad de inferencia compatible |

No añadirás Random Forest, XGBoost, LSTM ni otros modelos al experimento por iniciativa propia. La comparación estará acotada a Ridge y este segundo candidato para mantener un protocolo reproducible. Si se propone otro modelo, se definirá un experimento separado antes de consultar su prueba final.

### Métodos auxiliares que no debes confundir con modelos entrenados

- **Mifflin–St Jeor:** ecuación para estimar gasto en reposo.
- **MET:** referencia para estimar gasto por categoría de actividad y duración.
- **Medianas y pendientes semanales:** método inicial de tendencia y proyección.
- **Persistencia y cambio medio:** referencias mínimas de evaluación.
- **Split conformal:** procedimiento de calibración de intervalos del modelo seleccionado, no otro predictor independiente.

### Fases de ejecución y modelo utilizado en cada sprint

| Fase | Sprint | Trabajo principal | Modelo o algoritmo |
|---|---:|---|---|
| I — Análisis y diseño | 0 | Revisar sistema, definir variables y diseñar persistencia | Auditoría; sin entrenamiento |
| II — Construcción de datos | 1 | Perfil, meta y pesajes | Validaciones deterministas |
| II — Construcción de datos | 2 | Comidas, actividad y diario completo | Agregación por día local |
| III — Cálculo energético | 3 | Estimar gasto diario sin doble conteo | Mifflin–St Jeor y MET |
| III — Cálculo energético | 4 | Calcular balance y cobertura | Sumas de días completos |
| IV — Proyección explicable | 5 | Observar tendencia y discrepancias | Medianas móviles |
| IV — Proyección explicable | 6 | Proyectar siete días y medir error posterior | Pendiente de medianas semanales |
| V — Investigación de IA | 7 | Predecir cambio de peso a tres meses en DIETFITS | Ridge; HistGradientBoostingRegressor condicionado; split conformal |
| VI — Validación e integración | 8 | Evaluar con usuarios, aprobar versiones y mantener | Ridge como primer candidato semanal nuevo; boosting condicionado; retorno al método del sprint 6 |

No omitas los sprints de datos para comenzar entrenando. El reconocimiento de calorías de comidas será una fuente de registros confirmados, no el modelo de predicción del peso.

## 1. Tu misión

Eres el agente encargado de implementar el seguimiento y la predicción de pérdida de peso en la aplicación Gym. Ejecuta este plan por sprints. Primero construye un historial fiable y una proyección explicable; después entrena y evalúa los modelos definidos aquí.

Este archivo prescribe trabajo futuro. No es un informe de avances. Cuando recibas «implementa el sprint N», ejecuta sus tareas, realiza sus pruebas y entrega su informe. No marques como realizado algo que solo esté descrito o preparado.

## 2. Reglas de ejecución

1. Lee `agente.md` y este documento antes de modificar el proyecto. Revisa el código y esquema existentes; reutiliza funciones y tablas compatibles.
2. Trabaja sobre la carpeta del proyecto que indique el usuario. No crees copias completas ni paquetes por cada sprint salvo que se soliciten.
3. Antes de iniciar un sprint, verifica sus dependencias. Conserva funcionalidades ya correctas y documenta cualquier bloqueo real.
4. Mantén React, Vite, JavaScript, Tailwind y Supabase. Usa Python, pandas, NumPy y scikit-learn únicamente en el entorno separado de investigación.
5. No incorpores redes neuronales, modelos de lenguaje ni dependencias pesadas para predecir peso.
6. Toda interfaz estará en español y será compatible con móvil. Protege las tablas personales con RLS y mantén secretos fuera del navegador.
7. Conserva los datos originales. Separa registros observados, estimaciones y correcciones. Versiona los cálculos y modelos.
8. No inventes pesajes, calorías ni métricas de precisión. Una prueba sintética verifica software, no valida el modelo con personas reales.
9. Distingue implementación, aplicación de migraciones, pruebas locales, pruebas remotas y aceptación en dispositivos. No presentes una como equivalente de otra.
10. Para cambios de protocolo después de observar el test, abre un experimento nuevo. No ajustes repetidamente hasta obtener un test favorable.

## 3. Decisión técnica que debes seguir

| Etapa | Modelo o algoritmo obligatorio | Función |
|---|---|---|
| Registro | Validaciones deterministas y base relacional | Construir un historial consistente |
| Gasto | Mifflin–St Jeor y categorías MET | Estimar reposo y gasto adicional del ejercicio |
| Balance | Sumas de días completos | Relacionar ingesta y gasto |
| Tendencia | Medianas temporales | Reducir influencia de pesajes aislados |
| Primera proyección | Pendiente de medianas semanales | Estimar peso a siete días sin entrenar IA |
| Referencias de evaluación | Persistencia, cambio medio y tendencia cuando sea comparable | Determinar si entrenar aporta mejora |
| Primer modelo de IA | Regresión Ridge con regularización L2 | Predecir cambio de peso con pocas variables tabulares |
| Segundo modelo de IA | `HistGradientBoostingRegressor` con árboles pequeños, condicionado a validación | Evaluar relaciones no lineales |
| Intervalos de IA | Split conformal con calibración separada | Medir incertidumbre predictiva |

**No hay un modelo de IA elegido de antemano para producción.** Ridge será el primer candidato y boosting el segundo. Solo integrarás un candidato si supera los criterios. Si ninguno mejora, conservarás la proyección explicable del sprint 6.

Se elige Ridge por su sencillez, regularización y facilidad de reproducir inferencia. Se limita boosting por el riesgo de sobreajuste y su mayor complejidad. No presupongas que los histogramas serán superiores con pocas personas: este segundo candidato es una comparación acotada, no una mejora garantizada.

## 4. Fuentes y datos autorizables

### Base operativa

Usa Supabase y PostgreSQL para perfil, meta, pesajes, comidas, actividades, completitud del diario, estimaciones y proyecciones. Reutiliza autenticación y tablas compatibles. Las entidades de consentimiento y versiones de modelos se incorporarán antes de reutilizar datos personales para IA.

### Conjunto externo

Usa DIETFITS, archivo `All_outcomes_v4.csv`, para el experimento de cambio de peso a tres meses. Obtén también el diccionario y verifica unidades y códigos de visita. Procedencia: https://osf.io/kyiuj/.

El acceso público no implica autorización para cualquier uso. Revisa y documenta el alcance permitido antes del entrenamiento; no afirmes autorización comercial ni redistribuyas archivos sin resolver sus condiciones. Si el uso no está permitido o no puede determinarse, prepara el evaluador con casos sintéticos e informa que el experimento real está pendiente.

DIETFITS no contiene el diario continuo que requiere una proyección semanal. No conviertas sus visitas espaciadas en pesajes diarios artificiales. No uses un modelo a tres meses como si estuviera validado a siete días.

### Referencia de actividad

Usa categorías MET documentadas del Compendium of Physical Activities, https://pacompendium.com/. Guarda categoría y procedencia. No asignes calorías arbitrarias por repetición, serie o kilogramo levantado.

### Historial de la aplicación

Para entrenar o validar una IA semanal utiliza exclusivamente registros autorizados y suficientemente completos. Recoge consentimiento separado para reutilización. No copies fotos, nombres, credenciales o texto libre innecesario al conjunto de investigación.

## 5. Plan de implementación por sprints

### Sprint 0 — Revisar y diseñar

**Dependencia:** ninguna.

**Modelo o algoritmo:** ninguno; auditoría de requisitos y datos.

**Ejecuta:**

1. Revisa autenticación, registro nutricional, rutinas, historial de sesiones, esquema SQL y pruebas existentes.
2. Identifica qué se reutiliza y qué falta. No dupliques tablas ni servicios.
3. Define el diccionario de variables con unidades, fecha de medición, procedencia y reglas de ausencia.
4. Diseña perfil, meta, pesajes, comidas, actividades, estados de completitud y resultados versionados.
5. Define permisos y migraciones incrementales.
6. Fija población inicial de 19 a 59 años, historial inicial de 28 días y horizonte de siete días para el método explicable.
7. Revisa disponibilidad y condiciones de DIETFITS, sin entrenar todavía.

**Entrega:** `docs/hito4/sprint-0.md` con inventario, dependencias, diseño de datos, reglas y lista de tareas pendientes.

**Prueba y cierre:** verifica que cada entrada tiene unidad y finalidad, y que el diseño distingue datos ausentes de cero. El sprint termina con un plan ejecutable, no con una afirmación de que la función ya existe.

### Sprint 1 — Perfil de progreso, meta e historial de peso

**Dependencia:** sprint 0.

**Modelo o algoritmo:** validaciones deterministas; sin IA.

**Ejecuta:**

1. Implementa perfil con estatura, parámetros necesarios para la fórmula, actividad cotidiana y zona horaria; reutiliza fecha de nacimiento cuando exista.
2. Permite definir peso objetivo.
3. Implementa alta, consulta y corrección de pesajes en kg con fecha real de medición.
4. Permite varios pesajes reales sin confundir una repetición accidental de la solicitud con una medición nueva.
5. Añade validaciones, manejo de errores, migraciones, índices y RLS.
6. Conserva trazabilidad de correcciones y evita sobrescribir datos por solicitudes concurrentes sin control.

**Entrega:** interfaz de progreso, servicios, migración e informe `docs/hito4/sprint-1.md`.

**Prueba y cierre:** perfil incompleto, valores inválidos, fechas, solicitudes repetidas, correcciones y aislamiento entre usuarios. El usuario debe poder recuperar sus registros tras volver a iniciar sesión.

### Sprint 2 — Diario de comidas y entrenamientos

**Dependencia:** sprint 1.

**Modelo o algoritmo:** agregación temporal y validaciones; sin modelo de progreso entrenado.

**Ejecuta:**

1. Integra las estimaciones de comidas con confirmación explícita de porción y calorías antes de incorporarlas al diario.
2. Permite registro manual y corrección de comidas.
3. Registra actividad, inicio, fin y duración activa; separa pausas y descanso.
4. Conserva series, repeticiones y cargas cuando existan, sin convertirlas directamente en calorías.
5. Agrupa registros por día local y permite confirmar por separado ingesta y actividad completas.
6. Conserva procedencia: manual, estimación confirmada o sesión registrada.

**Entrega:** diario persistente, integración nutricional y registro de actividad; informe del sprint 2.

**Prueba y cierre:** días incompletos, ausencia frente a cero, sesiones parciales, pausas, correcciones y zonas horarias. No uses la ausencia de registros como evidencia de ayuno o inactividad.

### Sprint 3 — Estimación del gasto diario

**Dependencia:** sprint 2.

**Modelo o algoritmo:** Mifflin–St Jeor, factores cotidianos y MET.

**Implementa:**

```text
Reposo = 10 × peso_kg + 6,25 × estatura_cm − 5 × edad + constante
Constante de la fórmula = +5 o −161 según el parámetro de sexo de la ecuación
Base diaria = reposo × factor de actividad cotidiana
Gasto bruto del ejercicio = MET × 3,5 × peso_kg / 200 × minutos activos
Aporte adicional = máximo(0, gasto bruto − base de esos mismos minutos)
Gasto diario = base diaria + suma de aportes adicionales
```

**Ejecuta:**

1. Ofrece factores cotidianos explícitos de 1,4; 1,6 y 1,8, excluyendo entrenamiento. Identifícalos como supuestos iniciales del producto.
2. Incluye únicamente categorías MET con referencia documentada.
3. Evita doble conteo, solapamientos y duración activa superior a duración real.
4. Exige peso reciente de hasta 30 días y perfil válido. No reconstruyas retrospectivamente un perfil desconocido.
5. Distingue gasto provisional y día completo.
6. Guarda versión, entradas y desglose del resultado.

**Entrega:** cálculo puro, servicio y vista de gasto con procedencia; informe del sprint 3.

**Prueba y cierre:** unidades, fórmula, redondeo, población fuera del alcance, pesos antiguos, actividad desconocida y solapamientos. Presenta el resultado como estimación, no como medición del metabolismo.

### Sprint 4 — Balance energético y cobertura

**Dependencia:** sprint 3.

**Modelo o algoritmo:** suma de calorías y balance determinista.

**Implementa:**

```text
Balance diario = ingesta confirmada − gasto estimado
Balance acumulado = suma de balances de días cerrados y completos
```

**Ejecuta:**

1. Presenta ingesta, gasto y balance del mismo día y periodo.
2. Incluye en el acumulado solo días completos de ambas fuentes.
3. Muestra días utilizables, días excluidos y motivos.
4. Recalcula resultados derivados cuando se corrija la fuente.
5. Conserva consistencia entre consultas y evita truncamientos de historiales grandes.

**Entrega:** resumen diario y acumulado con cobertura; informe del sprint 4.

**Prueba y cierre:** signos, cero real, ausencias, día todavía abierto, periodos vacíos y correcciones. No conviertas automáticamente el balance acumulado en kilos usando una equivalencia fija.

### Sprint 5 — Tendencia del peso y discrepancias

**Dependencia:** sprint 4.

**Modelo o algoritmo:** medianas temporales y comparación de ventanas.

**Ejecuta:**

1. Conserva los pesajes originales y calcula una mediana diaria cuando haya varias mediciones.
2. Calcula una tendencia mediante mediana móvil de siete días, con un mínimo de tres días distintos con pesaje por ventana.
3. No rellenes días sin peso con puntos inventados.
4. Compara tendencia y balance de periodos equivalentes suficientemente completos.
5. Detecta discrepancias persistentes usando umbrales iniciales documentados, sin atribuir automáticamente la causa al usuario.
6. Incluye gráfico y tabla accesible, unidades y mensajes de datos insuficientes.

**Entrega:** visualización de peso observado, tendencia y balance; informe del sprint 5.

**Prueba y cierre:** pesajes irregulares, valor aislado, semana sin datos y discrepancia persistente. Una fluctuación individual no debe activar una corrección automática.

### Sprint 6 — Proyección inicial explicable

**Dependencia:** sprint 5.

**Modelo o algoritmo:** pendiente robusta de medianas semanales; versión inicial `observed-weekly-v1`.

**Ejecuta:**

1. Usa los 28 días cerrados anteriores a la emisión, con balance completo y al menos tres días con pesaje en cada semana.
2. Exige un pesaje en los últimos tres días del periodo.
3. Calcula cuatro medianas semanales y las tres pendientes entre semanas.
4. Usa la mediana de pendientes como pendiente inicial y proyecta siete días desde el cierre observado, indicando esa fecha de origen.
5. Bloquea proyecciones con pendientes absolutas superiores al límite inicial de 0,1 kg/día.
6. Actualiza como máximo semanalmente; limita el cambio de pendiente a 0,01 kg/día por actualización.
7. Muestra escenarios según pendientes observadas, identificándolos como escenarios, no intervalos de confianza.
8. Si corriges el balance por discrepancia persistente, guarda un parámetro separado: pasos de hasta 25 kcal/día y magnitud máxima de 200 kcal/día. Limítalo a reducir el balance hacia cero sin invertir su signo. No uses esa corrección para alterar automáticamente la pendiente de peso.
9. Estima acercamiento a la meta solo con pendientes descendentes estables y alcance máximo de 28 días; en otro caso no calcules fecha.
10. Guarda entradas, método, parámetros, emisión y horizonte para reproducir la proyección.
11. Evalúa con pesajes posteriores a la emisión real y compara con persistencia y tendencia previa al mismo horizonte.

**Entrega:** proyección, historial reproducible y métricas; informe del sprint 6.

**Prueba y cierre:** datos futuros, historial insuficiente, límites de actualización, reproducción exacta y comparación temporal. Los umbrales son decisiones iniciales de ingeniería, no límites clínicamente validados.

### Sprint 7 — Entrenar y evaluar candidatos de IA

**Dependencia:** sprint 6 y condiciones de uso resueltas para el experimento.

**Modelos:** referencias de persistencia y cambio medio; `Ridge` obligatorio; `HistGradientBoostingRegressor` condicionado; split conformal para el candidato seleccionado.

**Objetivo experimental:** predecir cambio de peso entre inicio y visita de tres meses de DIETFITS.

**Entradas iniciales:** peso, ingesta calórica y gasto estimado de la visita de origen. Convierte kcal/kg/día a kcal/día con el peso de esa misma visita. No sumes de nuevo gasto basal si la variable ya expresa gasto total.

**Etiqueta:** peso al final menos peso al inicio. No uses datos finales de alimentación, actividad o peso como predictores.

**Ejecuta en este orden:**

1. Crea `research/hito4-ml/` y un entorno separado con versiones fijadas de Python, pandas, NumPy y scikit-learn.
2. Obtén archivo y diccionario; conserva originales, procedencia y SHA-256. Audita columnas, unidades, visitas, faltantes, duplicados y rangos.
3. Divide por participante antes de filtrar según seguimiento disponible: 60% entrenamiento, 15% validación, 10% calibración y 15% prueba; fija semilla 407.
4. Si las particiones no alcanzan al menos 80, 20, 20 y 40 personas utilizables respectivamente, informa insuficiencia para este protocolo. Estos mínimos son operativos y no garantizan precisión.
5. Entrena las referencias usando únicamente entrenamiento.
6. Entrena `Pipeline(SimpleImputer(strategy='median'), StandardScaler(), Ridge(alpha=...))` con alpha 0,1; 1; 10; 100 y 1.000. No imputes etiqueta ni peso inicial necesario para definir el cambio.
7. Selecciona alpha por MAE de validación.
8. Habilita boosting solo si Ridge supera a ambas referencias en validación al menos 0,2 kg y 5%. Evalúa `HistGradientBoostingRegressor` con `max_leaf_nodes` 3 y 7, `max_iter=100`, `learning_rate=0.05`, `min_samples_leaf=20`, `early_stopping=False` y semilla 407. Fija las transformaciones con entrenamiento.
9. Elige el candidato por validación antes de consultar calibración y test.
10. Calibra una banda nominal del 90% con cuantiles finitos de residuos absolutos en la partición de calibración. Informa cobertura y anchura observadas en prueba.
11. Abre el test una sola vez y mide MAE, RMSE y sesgo. Compara con ambas referencias; estima intervalo bootstrap pareado del 95% de mejora con 2.000 remuestreos por participante.
12. Exige mejora de al menos 0,2 kg y 5% frente a la mejor referencia, además de límite inferior positivo del intervalo de mejora. Si no se cumple, descarta el candidato para incorporación.
13. Evalúa 3→6 meses como diagnóstico temporal separado, sin volver a seleccionar. No lo presentes como cohorte externa independiente ni como modelo entrenado a seis meses.
14. No declares comparación directa con el sprint 6 si las visitas no permiten su historial y horizonte.
15. Si exportas Ridge, incluye orden de variables, unidades, imputación, medias, escalas, coeficientes e intercepto. Prueba equivalencia Python/JavaScript. Una exportación experimental no autoriza desplegarla.

**Entrega:** auditoría, scripts, pruebas, métricas agregadas, protocolo y decisión en `docs/hito4/sprint-7.md`. No incluyas originales ni secretos en entregables públicos.

**Prueba y cierre:** ausencia de información futura, separación por persona, transformaciones ajustadas solo con entrenamiento, etiquetas no imputadas, invariancia de originales y paridad de inferencia. Se permite cerrar el experimento con decisión de no adoptar IA, respaldada por resultados.

### Sprint 8 — Validación con usuarios, adopción y mantenimiento

**Dependencia:** sprint 7 para investigación externa; consentimiento y datos autorizados para cualquier piloto con usuarios.

**Modelo:** conserva `observed-weekly-v1` como método vigente. Para un experimento semanal nuevo, usa Ridge como primer candidato; boosting se evaluará solo con protocolo previo y mejora en validación. No reutilices directamente el modelo de tres meses para siete días.

**Ejecuta:**

1. Si el experimento externo no justifica adopción, registra la decisión. Prepara políticas y controles, pero no actives ese modelo. Un experimento distinto requerirá hipótesis y datos propios.
2. Implementa consentimiento voluntario, separado por finalidad, desactivado inicialmente y revocable, antes de extraer datos personales. Rechazarlo no bloqueará el diario ni la proyección explicable.
3. Para una IA semanal, define ejemplos con 28 días previos y resultado a siete días. Usa resúmenes de peso, ingesta, gasto, balance, minutos de actividad y cobertura disponibles al emitir. Define antes la tolerancia temporal del pesaje posterior y excluye etiquetas insuficientes.
4. Fija un protocolo nuevo: personas separadas para generalización y cortes temporales para resultados futuros. No supongas que una sola de estas divisiones garantiza ambas condiciones.
5. Como mínimos operativos iniciales para la revisión de adopción, solicita 200 personas en entrenamiento, 50 en validación, 50 en calibración y 100 en prueba. Comprueba incertidumbre y representatividad; esos números no garantizan suficiencia estadística.
6. Ejecuta primero en modo de evaluación: guarda pronósticos sin sustituir la salida vigente y espera resultados reales posteriores.
7. Compara al mismo horizonte con persistencia y con el método del sprint 6. Exige mejora MAE de 0,2 kg y 5% respecto de la mejor referencia, con límite inferior de mejora positivo.
8. Como criterios iniciales adicionales, solicita sesgo absoluto ≤0,5 kg, cobertura observada ≥85% para banda nominal del 90% y anchura media ≤4 kg. Fíjalos antes del test y documenta su justificación; no los presentes como clínicamente validados.
9. Aprueba una versión únicamente con permisos resueltos, evidencia temporal suficiente, inferencia reproducible y retorno probado. Si usas árboles, define un servicio o formato de inferencia compatible antes de la integración.
10. Registra versiones inmutables con hashes, horizonte, unidades, código, datos, métricas, fecha, aprobación y predecesor. Cada predicción guardará emisión e inputs congelados.
11. Revisa errores maduros semanalmente por versión y horizonte. Evita contar muchas observaciones de una persona como participantes independientes; el monitor inicial usará una observación reciente por persona y exigirá al menos 30 personas para su revisión agregada.
12. Ante datos inválidos, fallo de inferencia o evidencia insuficiente, vuelve al método explicable. También suspende IA si MAE deja de mejorar a la referencia, el sesgo absoluto supera 0,5 kg, la cobertura baja de 85% o la anchura supera 4 kg.
13. Si el método explicable tampoco cumple su historial mínimo, muestra datos insuficientes. No inventes un pronóstico durante el retorno.
14. No reentrenes por cada comida. Revisa como máximo mensualmente y solo con nuevos resultados suficientes; cada actualización deberá superar nuevamente la evaluación antes de sustituir una versión.

**Entrega:** política, consentimiento persistente y permisos si se realiza piloto, registro de modelos, evaluación temporal y mecanismo de retorno. Explica qué requiere esperar resultados posteriores. Si no hay candidato admisible, entrega controles y decisión de mantener el método anterior sin afirmar una integración inexistente.

**Prueba y cierre:** retirada de consentimiento, política antigua, permisos entre usuarios, separación de versiones y horizontes, muestra insuficiente, datos inválidos, degradación y retorno. No cierres validación con usuarios reales mediante pruebas sintéticas.

## 6. Contrato de evaluación común

- La unidad independiente será la persona, no cada fila.
- Todas las entradas deberán existir antes de emitir el pronóstico.
- Separarás entrenamiento, selección, calibración y prueba.
- Informarás participantes utilizables y ejemplos temporales por partición.
- Medirás MAE, RMSE y sesgo por horizonte; para bandas, cobertura y anchura.
- No confundirás el intervalo bootstrap de mejora con el intervalo predictivo de peso.
- No transformarás directamente una banda de peso en certeza sobre una fecha de meta.
- No reutilizarás el test observado para seleccionar configuraciones nuevas.
- No afirmarás generalización a usuarios de la aplicación solo por resultados de DIETFITS.

### Organización de los archivos de investigación

Antes de crear archivos, revisa equivalentes existentes y reutilízalos. La estructura lógica será:

```text
research/hito4-ml/
  requirements.txt             Versiones fijadas del entorno
  README.md                    Instrucciones para reproducir el experimento
  data/                        Originales y extractos autorizados, fuera de entregas públicas
  audit_data.py                Calidad, unidades y procedencia
  build_dataset.py             Entradas al origen y etiquetas futuras
  split_participants.py        Separación por persona y control temporal
  train_ridge.py               Pipeline del modelo principal
  train_boosting.py            Modelo secundario y condición de habilitación
  evaluate_models.py           Referencias, MAE, RMSE, sesgo y comparación
  calibrate_intervals.py       Calibración separada y cobertura
  export_model.py              Artefacto con transformaciones y versión
  tests/                       Pruebas de datos, particiones e inferencia
  reports/                     Resultados agregados y decisión
```

Los archivos pueden agruparse en módulos existentes si conservan responsabilidades claras. No dupliques un evaluador por seguir literalmente estos nombres. El entrenamiento se realizará fuera de React; la interfaz consumirá resultados o inferencia del artefacto aprobado.

### Contrato mínimo del artefacto de modelo

Guarda identificador y versión, tipo de modelo, horizonte, nombres y orden de variables, unidades, transformaciones, parámetros aprendidos, versión del código, hash de los datos, métricas y estado de aprobación. En Ridge incluye medianas de imputación, medias y escalas, coeficientes e intercepto.

La inferencia deberá recibir exactamente el esquema evaluado. Ante entradas incompatibles, modelo sin aprobación o fallo de cálculo, no producirá una predicción silenciosa: devolverá el motivo y permitirá usar el método explicable si corresponde.

## 7. Informe obligatorio al terminar cada sprint

Guarda `docs/hito4/sprint-N.md` con:

1. Objetivo y dependencia verificada.
2. Modelo o algoritmo utilizado y su versión.
3. Cambios implementados y archivos relevantes.
4. Migraciones preparadas y realmente aplicadas, por separado.
5. Pruebas ejecutadas con resultados verificables y omisiones.
6. Límites, errores pendientes y requisitos del siguiente sprint.
7. Criterio de cierre: cumplido, parcial o bloqueado, con motivo concreto.

En el resumen al usuario explica qué puede utilizar y qué necesita todavía integración, datos o validación. No confundas la existencia de este agente con la ejecución del trabajo.

## 8. Definición de terminado del Hito 4

La base funcional estará terminada cuando los sprints 0–6 estén implementados, persistidos, protegidos y probados en la aplicación, con sus migraciones verificadas y aceptación móvil.

La investigación estará terminada cuando el sprint 7 produzca una evaluación reproducible y una decisión. La IA será una ampliación condicionada: únicamente se considerará integrada cuando el sprint 8 demuestre su utilidad al horizonte de la aplicación, con consentimiento, versiones, seguimiento y retorno operativos.
