# Hito 4 — Resultado del sprint 0

## Alcance y estado

Sprint 0 terminado como revisión estática y diseño de cambios. Proyecto revisado: `C:/Users/HP/Documents/Gym`, no la copia exportada en `outputs/Gym`. Se revisaron los flujos web, servicios, estado de rutinas, migraciones locales y presencia de módulos equivalentes en Flutter. No se modificó código del programa, no se ejecutaron migraciones ni se consultaron datos personales.

Las conclusiones describen el código local. No confirman que todas las migraciones estén aplicadas en Supabase ni sustituyen pruebas con usuarios autenticados, cámara y base de datos remota. No se ejecutó compilación: esta entrega solo añade documentación.

## Inventario comprobado

| Área | Existe | Falta para el hito 4 |
|---|---|---|
| Identidad | Supabase Auth y `profiles`, con fecha de nacimiento | Perfil de progreso: estatura, actividad habitual, objetivo, zona horaria y datos requeridos por la ecuación elegida |
| Peso corporal | No se encontró un módulo ni tabla de pesajes en el código y migraciones revisados | Alta, consulta, corrección y eliminación de pesajes; unidades, validación y tendencia |
| Nutrición | `NutritionalScanner` estima calorías y macros y guarda automáticamente análisis reconocidos como comida | Confirmación de consumo, entrada manual, porciones editables, fecha de consumo, correcciones y pantalla de diario |
| Lectura de comidas | `getMealLogs` consulta hasta 50 registros | No se encontraron consumidores de esta función; faltan filtros por periodo y paginación para historiales completos |
| Entrenamientos | Rutinas, asignaciones, ejecución con cámara y `routine_sessions` | Tiempo activo real, cargas utilizadas, intensidad y registro de sesiones parciales/manuales |
| Series realizadas | JSON con `exerciseId`, `set`, `reps` y `durationSec` | Duración efectiva de series por repeticiones y carga real; actualmente esas series envían duración cero |
| Gasto energético | No se encontró un cálculo de gasto diario o de ejercicio | Método de estimación documentado, entradas, versión y prevención de doble conteo |
| Balance | No se encontró resumen energético diario | Ingesta diaria confirmada, gasto total, cobertura, balance diario y acumulado |
| Progreso | Historial básico de sesiones: título, fecha y minutos | Gráfico de peso, comparación con balance, proyección y ajuste trazable |
| Seguridad | RLS y permisos de lectura/inserción para comidas y sesiones en migraciones | Permisos controlados para correcciones; políticas nuevas para datos del hito 4 y pruebas remotas de aislamiento |
| Flutter | Portal, membresías y reservas; no se encontró seguimiento equivalente del hito 4 | Paridad futura si se incluye la aplicación Flutter; la primera integración propuesta es web móvil |

## Hallazgos que condicionan la implementación

1. **Analizar una imagen ya la registra como comida.** `NutritionalScanner.jsx` llama a `persistMeal` cuando `analysis.es_comida` es verdadero. Fotografiar un plato no demuestra que se haya consumido. Separar análisis, confirmación y registro, conservando la compatibilidad con las filas antiguas; esas filas no permiten reconstruir si hubo confirmación real.
2. **Hay dos flujos de análisis alimentario.** `App.jsx` monta tanto `NutritionalScanner` como `VisionModal`. El segundo usa `geminiVisionService` y no integra `mealLogService`. Unificar el guardado mediante el servicio común o identificar claramente qué flujo alimenta el diario.
3. **El escáner no ofrece corrección nutricional ni entrada manual.** El esquema guarda el plato y macros agregados, pero no porciones estructuradas, cantidad consumida, origen o estado de confirmación.
4. **Comidas y sesiones son de solo inserción/lectura para el cliente.** Las migraciones 11, 12 y 14 no habilitan UPDATE/DELETE del usuario. Insertar una segunda comida como corrección sumaría ambas si no se diseña una sustitución explícita. Introducir correcciones controladas, invalidación o versionado; no sumar originales y revisiones.
5. **El tiempo de rutina no es tiempo activo.** `RoutineContext.jsx` calcula la diferencia de reloj entre inicio y fin, incluyendo preparación, descansos y pausas. Guardarlo como tiempo transcurrido y medir por separado el tiempo activo.
6. **Las series por repeticiones guardan duración cero.** `RoutineRunner.jsx` envía `exerciseComplete(count, isTimeBased ? holdSeconds : 0)`. Los isométricos conservan segundos válidos; no existe duración activa equivalente para ejercicios por repeticiones.
7. **La sesión se persiste al completar toda la rutina.** El progreso del contexto vive en memoria y no se guarda como sesión parcial al cancelar. Esto deja actividad realizada fuera del seguimiento.
8. **No hay idempotencia persistente de guardado.** Los servicios hacen INSERT con UUID generado en el servidor; las referencias de React reducen duplicados durante la ejecución, pero no garantizan que un reintento tras respuesta perdida no duplique la operación.
9. **Los historiales se limitan a 50 entradas.** No deben utilizarse esas consultas tal cual para calcular balances mensuales ni entrenar modelos.
10. **Las fechas existentes son instantes, no días de seguimiento.** Se guardan `registrado_at` y `completed_at`; no hay zona horaria de progreso por usuario. El formato `es-BO` de una fecha no fija su zona horaria. Definir día local y separar consumo/realización del momento de creación del registro.
11. **No se registra la carga de las series.** El estado y el servicio conservan repeticiones y segundos, sin peso utilizado. El peso de una carga no debe confundirse con el peso corporal.

## Mapa de datos propuesto

Propuesta lógica, sin SQL aplicado. Todas las entidades personales se relacionan con `auth.users.id`; reutilizar `profiles` para identidad y fecha de nacimiento, sin duplicarla innecesariamente.

| Entidad | Propuesta | Datos principales / relación |
|---|---|---|
| `progress_profiles` | Nueva, una fila por usuario | `user_id`, estatura en cm, actividad habitual, zona IANA, dato opcional para fórmula, fechas y versión; validar si conviene integrarla en `profiles` según su RLS vigente |
| `weight_goals` | Nueva, con historial de cambios | Usuario, peso objetivo en kg, fecha inicial y vigencia; no sobrescribir metas históricas |
| `weight_logs` | Nueva | Usuario, kg, instante del pesaje, zona y día local, origen, identificador de operación y fechas de edición |
| `meal_logs` | Ampliar la existente | Instante de consumo, zona/día local, fuente, cantidad/porción, confirmado/anulado, vínculo de revisión e identificador de operación; mantener calorías/macros actuales |
| `routine_sessions` | Ampliar la existente | Inicio/fin, zona/día local, estado, tiempo transcurrido/activo/descanso/pausa y UUID estable de operación; conservar el JSON de series compatible |
| Series de sesión | Extender contrato JSON inicialmente | Ejercicio, número de serie, repeticiones, tiempo activo, carga en kg cuando corresponda y procedencia; no requiere duplicar de entrada todo el historial en otra tabla |
| `daily_tracking_status` | Nueva | Usuario + día local único, completitud de comidas y actividad, observaciones; cero explícito distinto de dato ausente |
| `daily_energy_summaries` | Derivada, vista o almacenamiento por decidir | Usuario + día, ingesta, gasto base/actividad/total, balance, cobertura, versión y fecha de cálculo; reconstruible desde originales |
| `progress_projections` | Nueva en sprint 6 | Usuario, fecha de emisión, horizonte, entradas usadas, método/versión, proyección, escenarios e identificador del ajuste |
| `progress_adjustments` | Nueva en sprint 6 | Usuario, periodo observado, corrección, motivo, evidencia y versión; no altera comidas o pesos originales |
| Consentimiento de entrenamiento | Solo para etapa posterior | Finalidad, versión, fecha de aceptación y revocación; independiente de usar los cálculos iniciales |

### Reglas transversales

- kg para peso corporal y cargas, cm para estatura, segundos para duración y kcal para energía; explicitar unidades en interfaz y contratos.
- Instantes en UTC y zona IANA del evento para asignar su día local. No cambiar retrospectivamente los días históricos al cambiar la zona del perfil; las sesiones que cruzan medianoche necesitan una política de reparto documentada.
- Índices de usuario/fecha y unicidad de UUID de operación para reintentos. Una corrección debe invalidar o sustituir la contribución previa al resumen.
- Resúmenes energéticos únicamente con consumo confirmado y actividad efectivamente realizada. Mantener trazabilidad y una categoría de registros antiguos de confirmación desconocida.
- RLS por propietario en las nuevas tablas. Acceso de entrenadores a estos datos solo mediante una regla explícita, no como consecuencia automática de poder asignar rutinas.
- No confiar en totales derivados enviados por el navegador como datos definitivos: recalcular o validar con un método común y versionado; no usar credenciales administrativas en el cliente.
- Los parámetros fisiológicos deben tener vigencia temporal para no recalcular un día pasado con el perfil actual por accidente.

## Cambios ordenados por sprint

| Sprint | Estado tras la revisión | Trabajo concreto |
|---|---|---|
| 0 | Terminado: revisión estática y diseño | Este inventario y mapa; quedan separadas las comprobaciones remotas |
| 1 | Pendiente | Perfil de progreso, metas y pesajes; servicios, formulario, historial, migración y pruebas RLS |
| 2 | Parcial: existe captura nutricional y guardado de rutinas | Confirmación/edición/registro manual de comidas, diario, sesiones parciales, duración activa, cargas, idempotencia y completitud diaria |
| 3 | Pendiente | Selección documentada del método de gasto, estimación por actividad y separación de componentes sin doble conteo |
| 4 | Pendiente | Consultas por periodo, resúmenes diarios, cobertura y recálculo por correcciones |
| 5 | Pendiente | Tendencia del peso, gráfico y comparación temporal con balance |
| 6 | Pendiente | Proyección inicial, ajuste gradual, versiones e informe del error observado |
| 7–8 | Posteriores | Evaluación y mantenimiento de IA; no necesarios para poner en marcha los anteriores |

## Comprobaciones pendientes de entorno

Antes de implementar migraciones, inspeccionar el esquema real de Supabase y su historial de migración sin asumir que coincide con los archivos locales. Después, probar con dos cuentas el aislamiento, las correcciones y los reintentos. La lectura de políticas locales realizada aquí no demuestra por sí sola el comportamiento del servidor.

El sprint 1 puede comenzar con esta propuesta. No es necesario descargar DIETFITS ni instalar herramientas de entrenamiento para preparar perfil, pesajes y diario.

## Archivos que sustentan la revisión

Rutas relativas a `C:/Users/HP/Documents/Gym/`:

- `frontend-web/src/context/AuthContext.jsx` y `components/RegisterModal.jsx`: identidad y fecha de nacimiento.
- `frontend-web/src/components/NutritionalScanner.jsx`, `VisionModal.jsx`, `services/mealLogService.js`, `nutritionService.js` y `App.jsx`: análisis, guardado y puntos de entrada.
- `frontend-web/src/context/RoutineContext.jsx`, `lib/routineState.js`, `components/RoutineRunner.jsx`, `ClientRoutines.jsx` y `services/routineService.js`: ejecución, detalle de series y persistencia.
- `supabase/migrations/20260820000001_init_schema.sql`, `20261008000011_routine_sessions.sql`, `20261008000012_meal_logs.sql`, `20261016000013_training_integration.sql` y `20261016000014_training_api_permissions.sql`: esquema y permisos locales.
