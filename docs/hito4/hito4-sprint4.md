# Hito 4 — Sprint 4: balance diario y acumulado

## Estado

Implementado y probado localmente en `hito4-work/Gym`. No aplicado al proyecto original ni al servidor Supabase. La migración nueva es `20261022000018_balance_read.sql`, posterior a las migraciones 15–17. La aceptación en base de datos y navegador real sigue pendiente.

## Funcionalidad

“Mi diario” incorpora un panel de balance con fechas desde/hasta, consulta de periodos de 1 a 31 días, cobertura de días evaluables, detalle diario y acceso al día que necesita completar sus registros. El periodo aplicado se muestra por separado de las fechas que se están editando.

La convención es `balance = ingesta confirmada − gasto total estimado`:

- Negativo: déficit estimado.
- Positivo: superávit estimado.
- Cero: equilibrio aritmético de las estimaciones.

No se convierten calorías en kilos de grasa ni se calcula una fecha de llegada a la meta.

## Cuándo se considera evaluable un día

1. Ya terminó en la zona horaria seleccionada.
2. Alimentación y actividad fueron marcadas completas explícitamente.
3. No quedan comidas antiguas sin revisar.
4. Existe una selección de actividad cotidiana guardada para ese día con el método compatible del sprint 3.
5. El gasto recalculado es completo: perfil, pesaje, categorías, duraciones y fechas utilizables; sin sesiones desconocidas o solapadas.

Un día incompleto tiene balance no disponible, nunca cero por defecto. La ausencia de comidas puede representar ingesta cero únicamente cuando el usuario confirmó expresamente que registró toda la alimentación y se cumplen las otras condiciones.

En un día en curso se pueden mostrar los registros confirmados y la estimación de gasto de día entero como contexto, pero no su diferencia numérica: se advierte que una ingesta parcial no se compara con un gasto completo.

## Acumulado y cobertura

El acumulado suma exclusivamente los balances de días evaluables. Se informa “X de Y días”. Si hay huecos, la cifra se llama “Suma únicamente de los días evaluables”; no se presenta como balance completo del periodo. Si no existe ningún día evaluable, el resultado es “No disponible”, no cero.

No se exige que los días evaluables sean consecutivos; las omisiones se muestran y no se rellenan con estimaciones silenciosas. Se conservan las fronteras reales de cada día según zona horaria y horario de verano.

## Correcciones y estimaciones desactualizadas

La consulta NO confía en el total guardado en `daily_energy_estimates`. Recupera de la instantánea compatible únicamente el factor cotidiano explícitamente seleccionado y vuelve a ejecutar el método del sprint 3 con perfil, nacimiento, pesajes, sesiones y categorías vigentes.

- Corregir una comida reemplaza su aportación al total de consumo; anularla la excluye.
- Cambiar peso o categorías modifica el gasto calculado, si siguen existiendo entradas válidas.
- Una actividad nueva sin clasificar, una sesión inconsistente o una modificación del perfil posterior al día puede dejar ese día no evaluable.
- No se sustituye silenciosamente un método incompatible por otro ni se busca una instantánea anterior para ocultar ese problema.
- Se compara la identidad de las entradas con la instantánea guardada y se avisa si cambiaron. Las estimaciones anteriores permanecen inmutables como historial.
- La invalidación de completitud del sprint 2 sigue aplicándose: después de editar comidas o actividad, el usuario debe volver a revisar el día antes de que entre al acumulado.

Las modificaciones en la pantalla y guardar una estimación de gasto actualizan el balance. Para cambios de otra pestaña/cuenta se usa “Actualizar diario” o una nueva consulta; no se añadió una suscripción Realtime.

## Lectura coherente, permisos y volumen

`get_balance_data` es una función de solo lectura con `security invoker` y filtros explícitos de `auth.uid()` en todas las entidades. No acepta un identificador de propietario enviado por el navegador y conserva las RLS existentes.

El conjunto de entradas se obtiene mediante un único SELECT dentro de una función STABLE, para evitar combinar lecturas independientes de distintas versiones de los registros durante la misma consulta. Se devuelve una marca temporal de lectura; posteriores correcciones requieren actualizar la consulta.

Se limita el periodo a 31 días. Los agregados JSON incluyen todos los eventos correspondientes, sin el límite habitual de 50/1.000 filas de las consultas de listado. Se recuperan los pesajes del intervalo y el último anterior al margen de consulta; no se descarga todo el historial de peso.

El servidor incluye un margen de un día en ambos extremos para cambios horarios a medianoche. El cálculo filtra los eventos con los límites IANA exactos de cada día y detecta sesiones que lo cruzan. No se altera la regla del sprint 3 de bloquear sesiones entre días que aún no se hayan dividido/revisado.

El balance es un dato derivado que se reconstruye al consultar: no se creó una tabla con totales que pudieran quedar desactualizados. Los supuestos y limitaciones del gasto del sprint 3 continúan vigentes; un día “evaluable” significa que sus registros están completos para este método, no que su gasto real esté medido con precisión clínica.

## Pruebas

- `npm run test:balance`: signos de déficit/superávit, equilibrio, cero explícito, días incompletos y en curso, cobertura con huecos, corrección de comida/peso, gasto guardado manipulado o antiguo, sesiones sin clasificar, método incompatible y rangos válidos/inválidos.
- Servicios con doble de Supabase: autenticación requerida, RPC de solo lectura sin propietario arbitrario, periodo máximo y rechazo de respuestas incompletas.
- Regresión: suites de energía, diario, progreso, rutinas/cámara y renderizado existentes.
- Lint y compilación locales, con las advertencias previas del proyecto.

`supabase/tests/balance_security.sql` queda preparado pero NO ejecutado: comprueba lectura de 1.001 comidas sin truncamiento, aislamiento entre usuarios y validación de periodos/zonas. No hay confirmación de RLS remoto ni pruebas visuales completas de este sprint.

## Entrega y aceptación pendiente

Paquete acumulado de sprints 1–4 con instalador, respaldo y comprobación de hashes. No incluye `.env`, dependencias ni datos personales. El instalador no aplica migraciones.

Para aceptar: aplicar archivos al proyecto activo, revisar/aplicar migraciones 15–18, ejecutar las pruebas SQL y probar el flujo real con dos cuentas, periodos incompletos, correcciones, anulaciones, cambios de zona y actualización del diario. La comparación con la tendencia del peso corresponde al sprint 5.
