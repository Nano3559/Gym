# Sprint 2 del nuevo agente — Diario y procedencia

Fecha: 27 de octubre de 2026. Proyecto: `Gym-ultima-version`.

## Trabajo realizado

Se revisaron y reutilizaron confirmación explícita de comida manual o del escáner, nutrientes por porción, totales confirmados, actividad manual, sesiones parciales, series/cargas y reloj que separa ejercicio, descanso, preparación y pausa. El estado diario distingue alimentación y actividad completas; ausencia no implica cero.

Se implementaron las diferencias siguientes:

1. Porciones entre 0,01 y 100, con máximo dos decimales en el cliente, para evitar discrepancias con la precisión almacenada.
2. La corrección de una comida conserva el origen registrado. El servicio no lo reescribe y la migración lo protege en el servidor, conservando también el identificador de operación.
3. La actividad manual exige identificador para reintentos y al menos un segundo efectivo. Si cruza de día, solicita dividirla. Una actividad que termina exactamente a medianoche puede cerrar el día anterior.
4. Al seleccionar otro día desde el balance se sincroniza el formulario de actividad y se renueva su identificador de operación. Se impide esa navegación mientras hay un guardado pendiente.
5. El formulario de comida comunica su guardado al diario, que bloquea navegación/cierre mientras termina, evitando cambiar de día durante la escritura.
6. La migración 21 prepara auditoría de modificaciones y eliminaciones de comidas y sesiones: antes/después, fecha, tipo e identificador. Solo el propietario puede leerla; el cliente no puede alterarla. La eliminación de cuenta elimina sus revisiones.
7. La invalidación de completitud considera la zona de cada confirmación, el día antiguo y el nuevo de una corrección, y también eliminaciones. Una modificación alimentaria no invalida actividad ni viceversa.
8. Se mantienen timestamps de revisión crecientes, incluso para actualizaciones dentro de una misma transacción.

Modelo: validaciones y agregaciones deterministas. No se entrenó IA ni se cambió la estimación de calorías por MET.

## Archivos

- `frontend-web/src/lib/trackingData.js`
- `frontend-web/src/services/trackingService.js`
- `frontend-web/src/components/TrackingDiary.jsx`
- `frontend-web/src/components/MealEntry.jsx`
- `frontend-web/scripts/tracking.test.mjs`
- `frontend-web/scripts/tracking-service.test.mjs`
- `frontend-web/scripts/tracking-render.test.mjs`, incluido en `test:tracking`
- `supabase/migrations/20261027000021_tracking_provenance.sql`
- `supabase/tests/tracking_v2_security.sql`

## Verificación local

Pasaron `test:tracking`, `test:training`, `test:energy` y `test:balance`. La prueba nueva de renderizado también pasó: verifica confirmación explícita manual/escáner, unidades y valores por porción al corregir. Se incluyen casos de días de 23/25 horas, día inexistente, duración por fases, sesiones parciales y cargas. Los servicios se verifican con dobles de Supabase, no con una base remota.

Compilación correcta. Lint sin errores; conserva las cinco advertencias existentes de componentes ajenos al cambio. La compilación mantiene el aviso de bundle grande.

## Migración y aceptación pendientes

La migración 21 está preparada, no aplicada. Requiere el esquema previo hasta 20. La prueba SQL nueva está preparada, no ejecutada; verifica invalidación entre zonas/días, origen, auditoría, tokens de revisión, aislamiento entre usuarios y borrado de cuenta. Debe ejecutarse junto con `tracking_security.sql` en una base de pruebas. No se atribuye validación de triggers o RLS a los dobles locales.

La auditoría empieza cuando se aplica la migración; no reconstruye revisiones anteriores. El historial de revisiones queda disponible por consulta protegida, sin una pantalla nueva de auditoría. Las sesiones automáticas que cruzan días se conservan y se identifican por su inicio; el cálculo energético existente requiere dividir/revisar esas sesiones antes de emitir un total válido. No se inventa una distribución de calorías entre días.

Falta aceptación en navegador y dispositivos reales y comprobar los cambios de día durante guardados lentos. El renderizado del servidor y la compilación no sustituyen esa prueba interactiva.

Estado: implementación y pruebas locales completadas; persistencia remota y aceptación de interfaz pendientes. No se desplegó ni se aplicaron migraciones en Supabase.
