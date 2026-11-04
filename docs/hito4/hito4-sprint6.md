# Hito 4 — Sprint 6: proyección explicable y ajuste trazable

## Estado y alcance

Implementado en `hito4-work/Gym`. No aplicado al proyecto original ni al Supabase remoto. Nueva migración `20261022000019_progress_projections.sql`, después de las migraciones 15–18. No se entrenó IA ni se importó DIETFITS. La aceptación con dos cuentas reales y navegador móvil sigue pendiente.

“Mi diario” incorpora un panel independiente de proyección. Su periodo siempre son los últimos 28 días terminados hasta ayer en la zona del diario; el periodo seleccionable del balance no cambia ese corte. Las consultas incluyen hasta 84 días para evaluación retrospectiva y hasta 12 emisiones guardadas. La vista se recalcula al actualizar el diario, pero una emisión anterior nunca se sobrescribe.

## Método y parámetros iniciales

Versión `observed-weekly-v1`, configuración en `PROJECTION_CONFIG`. Son decisiones iniciales del producto, no parámetros clínicamente validados:

- Horizonte: 7 días calendario desde el corte de datos (ayer), con la fecha objetivo explícita. La emisión ocurre hoy: no significa siete periodos de 24 horas desde pulsar Guardar.
- Mínimo: 28 balances diarios evaluables, tres días distintos con pesajes en cada semana de siete días y al menos un pesaje en los tres últimos días del corte. Se reutilizan las restricciones de población y completitud del cálculo energético.
- Mediana por día y mediana semanal con igual peso por día. No se inventan pesajes para rellenar huecos.
- Tres ritmos semanales: diferencia entre medianas de semanas consecutivas dividida por siete. Ritmo inicial: mediana de esos tres ritmos. Referencia de nivel: mediana de la última semana, no peso exacto del último día.
- El resultado previsto es esa referencia semanal más el ritmo multiplicado por siete. Se evalúa contra un nivel semanal suavizado posterior, no contra un pesaje puntual. Es una extrapolación descriptiva corta; no se implementó un modelo fisiológico ni se convirtieron kcal a kg con un factor fijo.
- Si algún ritmo semanal supera en valor absoluto 0,1 kg/día (0,7 kg/semana), se bloquea la emisión. Es un límite conservador de esta versión, no una afirmación sobre ritmos saludables o posibles.
- Tras una primera emisión, el ritmo usado se acerca al nuevo ritmo observado como máximo 0,01 kg/día por revisión. No se emite más de una vez cada siete días. Un periodo largo sin emitir permite un solo paso, no acumula pasos automáticamente.

El suavizado limita el efecto de una subida aislada, aunque puede modificar ligeramente el nivel de referencia. Una subida individual no basta para activar la corrección energética. Se conservan todos los pesajes originales y los totales registrados.

## Ajuste energético separado

No es posible identificar a partir de estos registros si la causa de un desajuste es ingesta, gasto, agua corporal u otra variable. Por eso no se recalibra el metabolismo ni se modifica simultáneamente alimentación y gasto para forzar coincidencia.

Se guarda un parámetro experimental de atenuación del balance, separado de los registros y sin conversión a peso:

1. Primera emisión: parámetro cero.
2. Una revisión posterior requiere siete días desde la emisión anterior, 28 días completos y discrepancia persistente según el sprint 5 (dos quincenas consecutivas discordantes).
3. Para déficit registrado con peso estable/creciente, el objetivo del parámetro apunta hacia cero desde el balance negativo; para superávit con peso estable/descendente, en sentido contrario. El objetivo no supera 200 kcal/día en valor absoluto ni la magnitud del balance medio.
4. El parámetro cambia como máximo 25 kcal/día por revisión y nunca supera ±200 kcal/día. Sin nueva discrepancia persistente, se conserva.
5. Se aplica solamente la parte que atenúa el balance vigente hacia cero, sin invertir su signo. Un parámetro conservado de signo incompatible se muestra, pero no se aplica. Esto evita amplificar un balance cuando cambia la dirección de los registros.

La interfaz distingue parámetro conservado, corrección aplicada, balance registrado y balance de seguimiento. Este último es un indicador experimental conservador, **no una nueva estimación certificada del gasto real**. No alimenta la proyección en kg: la proyección depende exclusivamente del peso observado. Se evita así inventar una equivalencia fisiológica para que ambas curvas coincidan.

Las revisiones usan ventanas móviles parcialmente solapadas; no representan confirmaciones estadísticas independientes.

## Escenarios y meta

Los escenarios bajo/alto aplican al nivel semanal los ritmos mínimo y máximo entre los tres ritmos observados y el ritmo suavizado. Son escenarios descriptivos, no un intervalo de confianza ni una banda con cobertura estadística garantizada. Un historial plano puede producir escenarios iguales; no implica incertidumbre real nula.

Solo se presenta un escenario de llegada a la meta si las tres semanas descienden al menos 0,01 kg/día, el ritmo suavizado también es descendente, la meta está por debajo de la referencia y todos los tiempos calculados caben en 28 días. Se informa un rango de fechas condicionado a mantener esos ritmos. Si no se cumplen esas condiciones, se explica por qué no se estima la fecha. No se prolonga indefinidamente una recta hasta una meta distante.

## Persistencia y seguridad

`progress_projections` conserva instantáneas inmutables con propietario, fecha de corte, zona, versión, operación y fecha real de creación. Incluyen pesajes usados, balances diarios derivados, meta, parámetros anteriores, configuración, instante de cálculo, escenarios, corrección y motivo. Los identificadores de las estimaciones energéticas permanecen en los balances derivados. Se puede reproducir el cálculo a partir de esas entradas sin modificar el historial original.

- RLS de lectura por propietario. Sin permisos directos de inserción, edición ni borrado para usuarios autenticados.
- `get_projection_data` es STABLE con security invoker: reúne tres ventanas de 28 días mediante la lectura del sprint 4, la meta propia y las últimas 12 emisiones. Las lecturas del mismo comando usan una instantánea coherente; no se mezclan tres solicitudes HTTP independientes. Los márgenes repetidos de pesajes se deduplican por id en el cliente.
- `save_progress_projection` es la única escritura: security definer con search_path vacío, autenticación y propietario obtenidos de auth.uid(), bloqueo del perfil propio, operación idempotente y comprobación optimista del predecesor. No acepta un propietario arbitrario.
- El servidor limita fecha, versión, horizonte, valores básicos, tamaño de instantánea, cadencia semanal, primer ajuste cero y magnitud/paso de los parámetros. Una pestaña con historial antiguo debe volver a consultar. No permite omitir estas reglas mediante inserción directa.
- Los resultados siguen siendo estimaciones calculadas por el cliente. La validación de estructura y límites no certifica los cálculos fisiológicos ni demuestra que todos los registros de entrada sean auténticos.

## Evaluación temporal

Las emisiones guardadas se comparan con la mediana de las medianas diarias de pesajes posteriores a la **hora real de emisión** y hasta la fecha objetivo. Se requieren tres días distintos; no se usa como resultado un pesaje que ya existía antes de emitir. Si aún no llegó la fecha objetivo se muestra Pendiente; si faltan pesajes, Datos posteriores insuficientes. Las correcciones posteriores de pesajes actualizan la evaluación actual, pero no el pronóstico guardado.

Se muestran error absoluto medio (MAE, kg), sesgo (previsto menos observado), número de emisiones evaluables y dos referencias calculadas al emitir: mantener la mediana semanal actual y prolongar el ritmo entre las dos últimas medianas semanales. No se afirma que la proyección ajustada supere esas referencias.

La comprobación retrospectiva recorre hasta ocho orígenes semanales con 28 días de historia y siete de resultado dentro de los últimos 84 días. En cada origen se excluyen pesajes posteriores del cálculo y se encadenan únicamente parámetros de orígenes anteriores utilizables. Se omiten orígenes incompletos. Se informa el número realmente evaluable y los mismos errores de las referencias.

Esta simulación reutiliza comidas, pesos y perfiles corregidos tal como existen hoy: no reconstruye versiones históricas que nunca se guardaron. No equivale a una evaluación prospectiva ni a evidencia clínica. La evaluación de emisiones realmente guardadas se presenta por separado. Los datos sintéticos de las pruebas sirven para verificar la implementación; no prueban precisión con personas reales.

## Pruebas y aceptación pendiente

`npm run test:projection` cubre horizonte y límites de meta, datos faltantes, pesaje reciente, una subida aislada, límites de velocidad, zonas y horario de verano, ajustes graduales y acotados, cambio de signo del balance, reproducción exacta de instantáneas, evaluación posterior a la emisión, ausencia de fuga de pesajes futuros, comparación contra referencias y renderizado con/sin datos. El servicio se prueba con un doble de Supabase: autenticación, lectura sin propietario arbitrario, errores, respuesta incompleta y operación estable para reintentos.

Regresión: `test:trend`, `test:balance`, `test:energy`, `test:tracking`, `test:progress`, `test:training`, `npm test`, lint y compilación. Se conservan las advertencias previas del proyecto.

`supabase/tests/projection_security.sql` está preparado pero **no ejecutado**: aislamiento, acceso por RPC, idempotencia, límite de paso, cadencia y bloqueo de modificaciones directas. No hay herramienta SQL disponible en esta sesión. Se intentó consultar la CLI de Supabase, pero no pudo iniciarse: la restricción del sistema de archivos bloquea su escritura de telemetría en `C:/Users/HP/.supabase`. Por ello no se pudo verificar el estado del acceso administrativo ni ejecutar SQL remoto. También falta verificar concurrencia real entre pestañas, RLS remoto, instalación de la migración y presentación/interacción móvil en navegador.

## Entrega

Paquete acumulado `Hito4-sprints1a6.zip`, instalador con comprobación de hashes y respaldo, documentación y migraciones 15–19. Sin secretos, dependencias ni datos personales. El instalador se verifica en una carpeta de prueba, conserva cambios ajenos y no ejecuta migraciones.

La primera versión funcional del hito queda implementada localmente hasta el sprint 6, pero todavía no aceptada ni desplegada: requiere aplicar al proyecto activo, migrar Supabase y completar pruebas reales. Los sprints 7–8 de IA siguen pendientes y no se iniciaron.
