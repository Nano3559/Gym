# Sprint 6 del nuevo agente — Proyección inicial y reinicio

Fecha: 3 de noviembre de 2026. Proyecto activo: `Gym-ultima-version`.

## Modelo y versión

Se utiliza `observed-weekly-v2`: proyección explicable basada en medianas semanales y pendiente reciente, sin IA entrenada. Mantiene 28 días completos, tres días de pesaje por semana, pesaje reciente y horizonte de siete días desde el cierre de ayer. Conserva los límites de pendiente y cambio semanal y el ajuste energético separado y gradual, que no modifica el peso proyectado.

Se incrementó la versión porque cambian reglas de continuidad, reinicio y evaluación. El historial v1 permanece disponible, pero no se mezcla con las métricas de v2. Al pasar de v1 a v2 se inicia una cadena sin trasladar la corrección anterior y se sigue respetando la cadencia de siete días entre emisiones.

## Cambios implementados

1. Inicio voluntario de un periodo nuevo por cambio de hábitos, con confirmación explícita. Comienza mañana en la zona del perfil y exige 28 días completos desde esa fecha. No elimina comidas, pesajes ni pronósticos anteriores.
2. Reinicio automático de parámetros cuando pasan más de 28 días entre emisiones: usa la pendiente reciente y corrección energética cero, sin arrastrar el ajuste antiguo. El historial reciente sigue teniendo que cumplir todos los mínimos.
3. La comparación retrospectiva respeta el inicio del nuevo periodo; no simula emisiones anteriores como si pertenecieran a él.
4. Promedio del balance calculado con fechas únicas, evitando que copias de filas alteren el ajuste. Los datos contradictorios o incompletos siguen bloqueados por los controles previos.
5. La fecha de meta no se calcula cuando la mediana del último día observado ya alcanzó la meta, aunque el anclaje semanal todavía esté por encima. Se conservan tendencia descendente consistente y límite de 28 días para escenarios de meta.
6. Instantánea reproducible con fecha de cálculo, entradas, periodo, parámetros previos, identificador del predecesor y configuración. Antes de guardar se reproduce y verifica la salida; se rechazan modificaciones y fechas futuras. Se exige identificador de operación.
7. Evaluación de emisiones solo con fecha real verificable y pesajes posteriores a ella. No se inventa una hora de emisión ausente. Las copias y contradicciones de pesajes posteriores reciben controles equivalentes a los del historial.
8. Diagnóstico adicional de anclaje: conserva la mediana semanal como método principal y registra una alternativa basada en la mediana del último día observado con la misma pendiente. Se calculan errores y persistencia de ese último día cuando maduran los resultados. La interfaz muestra el número de emisiones comparables; no cambia automáticamente de anclaje.
9. Se explica que el anclaje semanal no es un pesaje realizado al cierre. Las bandas siguen siendo escenarios de ritmos observados, no intervalos de confianza.

## Persistencia y controles preparados

Migración nueva: `supabase/migrations/20261103000022_projection_period.sql`, posterior a 21.

Añade `projection_restart_on` al perfil y una RPC autenticada para comenzar el periodo. El cliente no puede sobrescribir ese campo mediante una actualización ordinaria del perfil. Las funciones de lectura y guardado incluyen el periodo; el guardado bloquea el perfil, verifica que el periodo no cambió, exige 28 días nuevos y comprueba el predecesor de la cadena correspondiente.

Permite conservar v1 y guardar v2; impide regresar a v1 después de emitir v2. Para interrupciones largas o cambios de versión exige corrección inicial cero. Conserva autenticación, cadencia, límites, inmutabilidad e idempotencia de las emisiones. El JSON continúa representando una estimación del cliente, no una predicción fisiológica certificada por el servidor.

La migración está preparada y NO aplicada. Debe desplegarse junto con estos archivos: el esquema anterior no admite guardar `observed-weekly-v2` ni ofrece la RPC de reinicio.

## Archivos principales

- `frontend-web/src/lib/projectionData.js`
- `frontend-web/src/services/projectionService.js`
- `frontend-web/src/components/ProjectionPanel.jsx`
- `frontend-web/scripts/projection.test.mjs`
- `frontend-web/scripts/projection-service.test.mjs`
- `frontend-web/scripts/projection-render.test.mjs`
- Migración 22 y `supabase/tests/projection_period_security.sql`.

## Pruebas realizadas

Pasaron `test:projection`, `test:progress`, `test:trend` y `test:balance`. Se comprobaron horizonte, mínimos, límites, ausencia de información futura, corrección gradual, reinicios, interrupciones, cambio de versión, meta alcanzada, promedio sin duplicados, conservación de historial y reproducción tras serialización JSON.

Se verificaron errores de guardado por instantánea alterada, fecha futura o falta de identificador; sesión requerida para reiniciar; bloqueo del periodo nuevo y separación de métricas de versiones anteriores. Las referencias alternativas de anclaje se prueban con casos sintéticos. Esto instrumenta su comparación; no demuestra que un anclaje sea superior con usuarios reales.

Compilación correcta y lint sin errores, con cinco advertencias existentes en otros componentes y el aviso de bundle grande.

## Aceptación pendiente

La prueba SQL nueva verifica cambio de periodo, conservación del historial, permisos de perfil, lectura por propietario, inicio con corrección cero y rechazo de consultas antiguas o periodos todavía insuficientes. Está preparada y NO ejecutada en PostgreSQL. Debe ejecutarse junto con las pruebas de proyección y perfil anteriores en una base de pruebas.

Los servicios se probaron con dobles de Supabase; no acreditan RLS ni funciones remotas. Falta aceptación interactiva en navegador/móvil y validación con resultados posteriores reales. Las métricas actuales no prueban precisión clínica ni permiten afirmar mejora del nuevo anclaje.

La evaluación del método explicable usa un nivel semanal suavizado: mediana de al menos tres días con pesajes posteriores a la emisión y hasta su fecha objetivo. No se confunde con la etiqueta de días 6–8 propuesta para el futuro experimento de IA semanal, que deberá evaluarse por separado.

Estado: implementación y pruebas locales completadas; migración y aceptación remota pendientes. No se entrenó IA, no se aplicaron migraciones en Supabase y no se desplegó la aplicación.
