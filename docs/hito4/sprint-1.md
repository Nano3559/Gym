# Sprint 1 del nuevo agente — Perfil, meta y pesajes

Fecha: 27 de octubre de 2026. Carpeta activa: `Gym-ultima-version`.

## Implementación

Se reutilizaron perfil, metas versionadas y pesajes existentes. Se mantienen unidades en kg, varias mediciones reales por día, identificador de operación para reintentos y control de versión al corregir o eliminar un pesaje.

Se añadieron:

- Control de concurrencia del perfil: las actualizaciones requieren su `updated_at`; una versión antigua se rechaza. La creación usa inserción, de modo que dos sesiones no se sobrescriben mediante un upsert. La interfaz permite recargar y descartar cambios pendientes.
- Opción voluntaria persistente `estimates_paused`, sin solicitar diagnósticos. Permite seguir usando diario, metas y pesajes. Bloquea cálculo energético y consulta de proyección en los servicios; la migración impide guardar nuevas instantáneas energéticas y proyecciones aunque un cliente antiguo ignore la opción.
- Auditoría atómica de correcciones y eliminaciones de pesajes: valores anteriores y posteriores, fecha, acción e identificador original. Es de solo lectura para el propietario; no se borra al eliminar una medición. Se elimina con la cuenta. Los registros anteriores a aplicar la migración no pueden reconstruirse retroactivamente.
- Timestamps de revisión estrictamente crecientes, incluso dentro de una transacción, y protección de propietario y fecha de creación ante actualizaciones.
- Texto introductorio actualizado para dirigir al diario y sus proyecciones.

Algoritmo: validaciones deterministas y persistencia relacional. No se entrenó ni activó IA.

## Archivos principales

- `frontend-web/src/lib/progressData.js`: validación de suspensión.
- `frontend-web/src/services/progressService.js`: control optimista del perfil.
- `frontend-web/src/components/ProgressPanel.jsx`: suspensión voluntaria y recarga.
- `frontend-web/src/lib/energyData.js`: respeto de suspensión.
- `frontend-web/src/services/projectionService.js`: consulta de suspensión del propietario.
- `supabase/migrations/20261027000020_progress_safety_audit.sql`: columna, auditoría y controles del servidor.
- `supabase/tests/progress_v2_security.sql`: prueba transaccional de permisos, auditoría, concurrencia y borrado de cuenta.

## Pruebas ejecutadas

Las suites `test:progress`, `test:energy`, `test:balance`, `test:projection`, `test:trend` y `test:tracking` finalizaron correctamente. Incluyen validación, servicios con dobles de Supabase y renderizado de tendencia/proyección. Los casos nuevos verifican persistencia en el payload de la pausa, conflicto del perfil, creación concurrente, bloqueo de consulta de proyección y ausencia de gasto al suspender.

`npm run build` pasó. Se mantiene el aviso de tamaño de un bundle. `npm run lint` pasó sin errores, con cinco advertencias en componentes ajenos a estos cambios.

Se reutilizaron las dependencias disponibles de la copia de trabajo para compilar, sin modificar el archivo de dependencias ni instalar paquetes nuevos.

## Persistencia y aceptación pendientes

La migración 20 está preparada y NO se ejecutó en Supabase. Requiere las migraciones 15–19 previas. Debe aplicarse junto con estos archivos antes de usar la nueva interfaz: sin la columna nueva las operaciones del perfil y la consulta de proyección fallarán en vez de ignorar la configuración.

`progress_v2_security.sql` está preparado y NO se ejecutó contra PostgreSQL. Los dobles de servicios no acreditan RLS ni comportamiento real de triggers. Falta ejecutar esta prueba y `progress_security.sql` en una base de pruebas, además de verificar interfaz y persistencia entre sesiones reales en móvil y navegador.

La suspensión no borra las instantáneas anteriores. Cambiarla no modifica datos históricos de comidas o peso. La opción no determina aptitud médica ni elimina las restricciones de edad e historial de los cálculos.

Estado: implementación y pruebas locales completadas; aceptación remota y en dispositivos pendiente. No se marca como desplegado el sprint.
