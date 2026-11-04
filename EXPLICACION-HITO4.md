# Hito 4: seguimiento y proyección del progreso al bajar de peso

Documento explicativo del proyecto. Actualizado el 27 de octubre de 2026.

## 1. Qué se pretende lograr

Ayudar al usuario a comprender cómo evoluciona su peso al relacionar sus comidas, actividad física y pesajes. El sistema busca responder:

- ¿Cuántas calorías he registrado y cuál es mi gasto estimado?
- ¿Mi balance energético coincide con la tendencia de mi peso?
- ¿Qué peso podría observar a corto plazo si continúa la tendencia reciente?
- ¿Hay suficiente información para estimar cuándo podría acercarme a mi meta?

Se eligió empezar con pérdida de peso porque la aplicación ya dispone de análisis de comidas y seguimiento de entrenamientos. Esas funciones permiten construir un diario útil antes de entrenar un modelo. Las estimaciones de comida, ejercicio y peso tienen incertidumbre; no se promete una fecha exacta de llegada a la meta.

## 2. Cómo funcionará

El flujo es: **registrar → estimar gasto → calcular balance → observar tendencia → comparar → actualizar la proyección**.

### Datos proporcionados por el usuario

| Datos | Para qué se usan |
|---|---|
| Fecha de nacimiento, estatura y sexo utilizado por la fórmula | Estimar el gasto en reposo |
| Zona horaria | Asignar registros al día correcto |
| Nivel de movimiento cotidiano, separado del entrenamiento | Aproximar el gasto habitual |
| Peso en kg y fecha de medición | Seguir la evolución real y actualizar cálculos |
| Peso objetivo | Definir la meta, sin usarla como resultado observado |
| Comidas, porciones y calorías confirmadas | Sumar la ingesta registrada |
| Tipo de actividad y tiempo activo | Estimar el gasto del ejercicio |
| Confirmación de que el día está completo | Distinguir ausencia de registros de consumo o actividad cero |

El reconocimiento de una comida propone una estimación que debe confirmarse. No convierte una foto en una medición exacta. Las series, repeticiones y cargas aportan contexto al entrenamiento; por sí solas no permiten calcular con precisión sus calorías.

### Información definida por el programa

El proyecto aporta fórmulas, categorías de actividad, valores MET, reglas de calidad, ventanas de observación, límites del ajuste y versiones de los cálculos. Estos parámetros quedan documentados para que los resultados puedan reproducirse y revisarse.

## 3. Qué bases de datos y fuentes se escogieron

Hay que distinguir la base de datos de la aplicación, el conjunto externo de investigación y las tablas de referencia.

| Recurso | Función | Por qué se escogió |
|---|---|---|
| Supabase, basado en PostgreSQL | Guardar perfiles, metas, pesajes, comidas, entrenamientos y resultados calculados | Ya forma parte del proyecto; permite relacionar registros, autenticar usuarios y proteger sus filas con RLS |
| Historial real de los usuarios | Sustentar el seguimiento y evaluar futuras predicciones en la población de la aplicación | Refleja cómo se usa realmente el programa y permite comparar un pronóstico emitido con resultados posteriores |
| DIETFITS, archivo `All_outcomes_v4.csv` | Evaluar fuera de la aplicación si una IA aporta mejora | Ofrece seguimiento de muchas personas con peso, ingesta y gasto estimado en distintas visitas |
| Compendium of Physical Activities, categorías MET | Aportar referencias de gasto por actividad | Evita inventar calorías por repetición y permite identificar la procedencia de cada categoría |

Supabase no es un conjunto de entrenamiento externo. DIETFITS tampoco sustituye la base de datos del usuario ni se necesita para utilizar el diario.

### Qué contiene DIETFITS y cuáles son sus límites

La auditoría local encontró **609 participantes y 2.436 filas**, correspondientes a visitas programadas al inicio y a los 3, 6 y 12 meses. Contiene peso, calorías ingeridas y gasto estimado; no todos los campos están completos. Para el intervalo inicial de tres meses hubo 533 pares con ambos pesos, de los cuales 483 tenían las tres entradas iniciales completas.

La actividad utilizada en el experimento es un indicador de gasto total obtenido por cuestionario, expresado en kcal/kg/día. No equivale a un historial de series, cargas o calorías de cada entrenamiento. Las visitas tampoco son pesajes diarios. Por ello, DIETFITS sirve para investigar cambios a tres meses, pero no valida directamente una predicción semanal de nuestra aplicación.

Se escogió para una evaluación exploratoria porque sus variables permiten formular un primer experimento y el archivo público pudo descargarse. Eso no significa que cualquier uso esté resuelto: la revisión realizada el 22 de octubre registró que OSF mostraba **“No License”**, junto con una declaración de reutilización de los investigadores. Se documentó un alcance limitado al análisis local; no se da por autorizado el uso comercial, la redistribución o la producción. Los originales no se incluyen en esta copia consolidada.

Procedencia registrada en el proyecto: [archivo en OSF](https://osf.io/kyiuj/files/ztysq), [diccionario](https://osf.io/kyiuj/files/mfsg4) y [publicación original](https://jamanetwork.com/journals/jama/fullarticle/2673150). Estas referencias describen la evaluación ya realizada; este documento no constituye una nueva revisión de sus condiciones de uso.

## 4. Qué cálculos se usan y por qué

### Gasto en reposo y actividad cotidiana

Se utiliza Mifflin–St Jeor como estimación explicable:

```text
Reposo (kcal/día) = 10 × peso_kg + 6,25 × estatura_cm − 5 × edad + constante
Constante de la fórmula: +5 o −161 según el sexo utilizado por ella.
Base diaria = reposo × factor de movimiento cotidiano.
```

La implementación inicial limita esta estimación a adultos de 19 a 59 años y requiere un pesaje reciente. Los factores disponibles son 1,4, 1,6 y 1,8; son supuestos configurados del producto, no mediciones individuales. Se eligió este enfoque porque funciona sin datos de entrenamiento de IA y permite explicar qué entradas cambian el resultado.

### Gasto del ejercicio

Para una actividad con categoría MET documentada:

```text
Gasto bruto = MET × 3,5 × peso_kg / 200 × minutos activos
Aporte adicional = máximo(0, gasto bruto − gasto base de esos mismos minutos)
Gasto diario estimado = base diaria + aportes adicionales
```

Se descuenta la parte base de esos minutos para evitar sumar dos veces su gasto. Se revisan sesiones solapadas y duraciones inválidas. La fórmula produce una aproximación; no mide directamente el metabolismo.

### Balance y tendencia del peso

```text
Balance diario = calorías ingeridas − gasto estimado
```

Un valor negativo representa déficit estimado. Solo se acumulan días cerrados con ingesta y actividad completas. Los días sin datos no se convierten en cero.

Los pesajes originales se conservan. Se calcula una tendencia separada mediante medianas, para reducir el efecto de valores aislados. Se compara con el balance de periodos suficientemente completos. Una discrepancia persistente invita a revisar la estimación; no demuestra que el usuario haya registrado mal.

### Proyección inicial sin IA

El método del sprint 6 usa un historial de 28 días completos y pesajes suficientes en cada semana. Construye medianas semanales y pendientes observadas para proyectar inicialmente **7 días**. Limita cambios bruscos y conserva los datos, parámetros y versión usados.

Muestra escenarios según las pendientes observadas, que no se presentan como intervalos de confianza. La estimación de llegada a la meta se permite únicamente con una tendencia descendente suficientemente estable y un horizonte máximo de 28 días. Si faltan datos o la meta queda fuera del alcance, se indica que todavía no puede estimarse.

El ajuste energético se guarda por separado y es gradual. No se utiliza una conversión fija de calorías a kilos para prometer una fecha, ni se alteran las comidas o pesajes originales para hacerlos coincidir.

## 5. Qué herramientas se usan

| Herramienta | Uso y motivo |
|---|---|
| React, Vite, JavaScript y Tailwind | Mantener la arquitectura y la interfaz existentes, sin introducir otro sistema de aplicación |
| Supabase Auth y RLS | Identificar al usuario y limitar el acceso a sus registros |
| Python y pandas | Auditar el conjunto externo y preparar pares temporales de forma reproducible |
| scikit-learn | Evaluar modelos pequeños y transformaciones estándar fuera del navegador |
| Ridge | Primer candidato: regresión regularizada, sencilla y exportable; adecuada como experimento inicial con pocas variables |
| Boosting de árboles | Comparación de relaciones más complejas, habilitada solo después del criterio previo de validación |

No se eligieron redes neuronales porque el experimento inicial tiene pocas variables y una cantidad limitada de participantes útiles. Tampoco se necesita un modelo de lenguaje para efectuar estos cálculos. El análisis visual de comidas es una función distinta del modelo de progreso.

## 6. Cómo se evaluó la IA y qué se decidió

El objetivo experimental fue predecir el **cambio de peso a tres meses**, usando únicamente peso, ingesta y gasto de la visita inicial. Las variables del final del intervalo se reservaron para comprobar el resultado; usarlas como entradas habría filtrado información del futuro.

Se separaron participantes entre entrenamiento, validación, calibración y prueba. La imputación y normalización aprendieron solo del entrenamiento. Se seleccionó el modelo con validación y se midió su error en personas reservadas. No se inventaron pesos diarios interpolando las visitas.

Resultados del test inicial, con 78 personas:

| Método | Error absoluto medio, MAE |
|---|---:|
| Mantener el peso inicial | 6,065 kg |
| Aplicar el cambio medio del entrenamiento | 3,160 kg |
| Ridge seleccionado | 3,152 kg |

Aunque Ridge mejora frente a mantener el peso, su ventaja frente al cambio medio fue de apenas **0,008 kg**, insuficiente según el criterio definido. En el diagnóstico posterior entre los meses 3 y 6, su MAE fue 4,819 kg, frente a 2,376 kg de mantener el peso.

**Decisión: no integrar ese candidato de IA y conservar el método explicable.** Entrenar un modelo y conseguir que se ejecute no demuestra que mejore el producto. El detalle del experimento está en [el informe del sprint 7](docs/hito4/hito4-sprint7.md).

## 7. Cómo podría incorporarse IA más adelante

Primero hace falta historial real suficiente y consentimiento para su reutilización. Un experimento nuevo debe definir antes sus variables, horizonte y criterio de mejora; evaluarse temporalmente y compararse con el método vigente al mismo horizonte. No se reentrena con cada comida.

Cada versión deberá conservar procedencia, permisos, fechas de corte, transformaciones y métricas. El seguimiento medirá MAE, sesgo y cobertura de intervalos con resultados posteriores. Si empeora o falla, se vuelve al método anterior; si tampoco dispone de datos suficientes, se informa esa limitación.

El sprint 8 preparó la política y los controles offline. Todavía no implementa en producción la recogida de consentimiento, el registro de versiones ni el cambio automático de modelo. Véase [la política de mantenimiento](research/hito4-ml/MANTENIMIENTO.md).

## 8. Estado de la última versión

La carpeta `Gym-ultima-version` consolida el proyecto original con los cambios del Hito 4 hasta el sprint 8:

- Sprints 1–6: perfil, meta, pesajes, diario, gasto, balance, tendencia y proyección explicable implementados en los archivos entregados.
- Sprint 7: evaluación local de DIETFITS realizada; candidato de IA rechazado.
- Sprint 8: política y controles offline preparados; IA sin activar.
- Pruebas de investigación ejecutadas en la copia de trabajo: 27 del evaluador y 8 de los controles, todas correctas. No equivalen a validación clínica ni a pruebas remotas de Supabase.
- Pendientes: aplicar y verificar migraciones 15–19 en Supabase, comprobar permisos entre usuarios y completar la aceptación en navegador y dispositivos reales.

El resultado buscado es una herramienta de seguimiento que explique sus estimaciones y mejore con evidencia. La incorporación de IA es una posibilidad posterior, condicionada a demostrar una ventaja útil sobre lo que ya puede calcularse.
