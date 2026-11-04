# Hito 4 — Sprint 2: comidas y actividad realizadas

## Estado y ubicación

Implementado en `hito4-work/Gym`, con pruebas locales aprobadas. La carpeta activa `C:/Users/HP/Documents/Gym` sigue fuera del espacio de escritura de la sesión. El paquete acumulado de entrega incluye los sprints 1 y 2, sin variables de entorno, dependencias ni datos personales.

No se han aplicado las migraciones 15 y 16 en Supabase. Tampoco se ha verificado la interfaz con navegador/dispositivos reales. El sprint permanece pendiente de aceptación integrada; no afirmar que ya está desplegado.

## Comidas

- “Mi diario” permite seleccionar un día y ver comidas, estado y calorías/macros confirmados.
- Ambos escáneres incorporan el mismo formulario de confirmación: analizar una foto ya no guarda automáticamente un consumo.
- Se pueden añadir alimentos manualmente sin usar IA, indicar porción de referencia, cantidad de porciones, nutrientes por porción y fecha/hora de consumo.
- Los valores que un escáner no proporciona se solicitan explícitamente; no se inventan macros cero.
- Las correcciones modifican la entrada existente; no crean otra que se sume por duplicado. El servidor vuelve a calcular los totales a partir de nutrientes por porción y cantidad.
- La anulación conserva el registro y lo excluye de los totales. La edición comprueba `updated_at` para detectar cambios de otra sesión.
- Las filas anteriores a este sprint quedan con origen/confirmación `legacy`. Se muestran, pero no se suman como consumo confirmado hasta que el usuario las revise.
- UUID estable de operación evita duplicados al reintentar una inserción con respuesta perdida. Los formularios bloquean cambios durante el guardado.

## Entrenamientos

- El reloj diferencia fase de ejercicio, descanso, preparación y pausa mediante transiciones temporales; no depende del número de ticks ejecutados por el navegador.
- Las series por repeticiones ya conservan duración, además de las isometrías. Se permite indicar carga en kg e intensidad declarada de la sesión.
- Al salir o reiniciar, se intenta guardar la sesión parcial, incluidas las repeticiones y la carga de la serie en curso. Si falla, se conserva en la pantalla para reintentar; no se cierra silenciosamente. También se permite continuar explícitamente sin guardar, advirtiendo que se perderá ese registro, para no bloquear a quien esté sin conexión o sin sesión válida.
- El guardado completo/parcial usa un UUID estable y congela el contenido para reintentos. Reiniciar comienza una operación nueva.
- Al ocultar la pestaña se pausa la sesión. Cambiar de cuenta recrea el contexto de rutina; el servicio comprueba el propietario esperado.
- El diario permite registrar actividades manuales con nombre, inicio, minutos activos e intensidad, y anular registros erróneos.
- Los registros antiguos conservan su duración transcurrida; no se les inventa una duración activa.

“Tiempo activo” significa tiempo en la fase de ejecución, excluyendo pausa/descanso/preparación. No es una medición metabólica ni una prueba de movimiento continuo detectado. No se estiman calorías del ejercicio en este sprint.

## Días y calidad de datos

- Se consultan los eventos por instante y zona horaria del diario; se pagina sin truncar a 50 entradas.
- Se soportan días de 23/25 horas y cambios horarios a medianoche; se rechazan días inexistentes en esa zona y horas individuales ambiguas.
- Las sesiones que cruzan medianoche se presentan en el día de inicio. Esta regla es de organización: el reparto energético por día deberá definirse en los siguientes sprints.
- El usuario marca por separado alimentación y actividad completas. La confirmación no interpreta automáticamente ausencia de registros como cero.
- Añadir, corregir o anular datos invalida en el servidor la completitud de los días afectados. Marcar un campo no sobrescribe la otra confirmación del día.
- Antes de marcar completo un día con registros antiguos, se pide confirmarlos o anularlos. Las actividades antiguas pueden sustituirse por un registro manual revisado.

## Base de datos

`20261022000016_tracking_diary.sql` amplía `meal_logs` y `routine_sessions`, añade `daily_tracking_status`, validaciones, índices únicos de operación y políticas de actualización del propietario. Se mantiene la RLS existente para lectura/inserción. La función `set_tracking_day` ejecuta con permisos del usuario.

La migración depende del esquema vigente y del sprint 1. Revisar el historial remoto antes de aplicarla; no ejecutar todas las migraciones pendientes a ciegas.

## Pruebas

Aprobadas localmente:

- `npm run test:tracking`: totales por porción, edición sin multiplicación doble, exclusión de filas antiguas/anuladas, fechas locales, horario de verano y reloj por fases; series con carga y duración.
- Pruebas de servicios con doble de Supabase: paginación de 501 comidas y actividades, propietario, confirmación, reintentos, conflictos, anulación, independencia de completitud, actividad manual y cuenta de sesión.
- `npm run test:progress`: regresión del sprint 1.
- `npm test` y `npm run test:training`: regresión de analizadores, cámara, rutinas y renderizado de paneles existentes.
- `npm run lint`: sin nuevas advertencias; se conservan las advertencias previas del proyecto.
- `npm run build`: compilación aprobada, con el aviso previo de tamaño del paquete principal.

Preparadas pero NO ejecutadas: `supabase/tests/tracking_security.sql`, para comprobar en una base de pruebas cálculo de totales en servidor, revisión de comidas antiguas, corrección, invalidación de completitud, aislamiento entre usuarios, sesiones parciales y duraciones inconsistentes. Los datos de prueba se revierten al terminar.

## Pendientes antes de darlo por terminado

1. Aplicar el paquete al proyecto activo mediante el instalador incluido; conserva respaldos y rechaza archivos con cambios posteriores no reconocidos.
2. Aplicar y verificar las migraciones 15 y 16 en Supabase.
3. Ejecutar pruebas SQL y pruebas de guardado/recarga con dos cuentas reales.
4. Probar móvil y escritorio: ambos escáneres, edición de porciones, cambio de día, cierre/reinicio parcial y reintento tras error de red.

Limitación: una recarga, cierre abrupto del navegador o apagado antes del guardado puede perder la sesión en curso. El guardado parcial cubre la salida/reinicio mediante los controles del programa; no se implementó una cola persistente sin conexión. El cálculo del balance, gasto y proyecciones corresponde a sprints posteriores.
