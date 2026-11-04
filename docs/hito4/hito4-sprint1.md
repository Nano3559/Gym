# Hito 4 — Sprint 1

## Estado

Implementado en la copia de trabajo `hito4-work/Gym`; pruebas locales superadas. Pendiente de aplicar al proyecto activo y desplegar/probar la migración en Supabase. No marcar este sprint como aceptado en producción todavía.

La sesión permite escribir en `C:/Users/HP/Documents/Codex`, pero no en `C:/Users/HP/Documents/Gym`. Se tomó una copia del proyecto activo para trabajar sin sobrescribirlo. El paquete de entrega contiene únicamente los archivos del sprint y un instalador con comprobación de hashes; no incluye `.env`, credenciales, dependencias ni compilados.

## Funciones implementadas

- Botón “Mi progreso” junto a rutinas y nutrición; requiere una cuenta autenticada. Cuentas de demostración sin sesión real no pueden guardar.
- Perfil: estatura, actividad habitual, dato opcional para futuras fórmulas y zona horaria IANA. No duplica la fecha de nacimiento del perfil base.
- Metas versionadas: cada cambio cierra la meta anterior de manera atómica. Los reintentos con el mismo identificador no reactivan metas antiguas.
- Pesajes: registrar varios al día, consultar historial, corregir y eliminar con confirmación explícita.
- Resumen: primer peso por fecha de medición, último peso, diferencia y meta actual. No se presentan pronósticos ni estimaciones calóricas en este sprint.
- Validación de kg/cm, fechas futuras, zonas inválidas y horas ambiguas/inexistentes por cambio de horario. Límites de entrada son controles técnicos, no recomendaciones de peso saludable.
- El evento conserva su zona y día local aunque cambie el perfil. Ediciones y eliminaciones detectan conflictos con otra sesión por `updated_at`.
- UUID estable para reintentos de inserción, consultas paginadas de pesajes y filtro por propietario en los servicios.

## Persistencia y seguridad

Migración: `20261022000015_progress_profile_weight.sql`.

Tablas nuevas: `progress_profiles`, `weight_goals`, `weight_logs`, con claves hacia el usuario y RLS. Las metas se modifican únicamente mediante `set_weight_goal`, que obtiene el usuario desde Auth y serializa cambios mediante bloqueo de su perfil. El servidor valida rangos y zona horaria y calcula la fecha local de los pesajes. No se modificaron tablas de comidas o entrenamientos.

La migración está preparada, pero NO se ha ejecutado. No hay un servidor PostgreSQL local disponible y la instalación de un entorno temporal de prueba falló por falta de acceso a la red. La aplicación necesita esta migración antes de guardar o cargar progreso.

## Pruebas realizadas

- `node scripts/progress.test.mjs`: aprobado; pesos válidos e inválidos, perfil, cambio de día por zona, Nepal, futuro, fechas imposibles, cambios de horario y resumen cronológico sin mutar entradas.
- `node scripts/progress-service.test.mjs`: aprobado con doble de Supabase; paginación de 501 registros, filtro por usuario, reintentos, ausencia de sesión, errores y conflictos de edición/eliminación.
- `npm test`: aprobado; regresión de analizadores, rutinas, cámara y comprobaciones móviles existentes.
- `npm run test:training`: aprobado.
- `npm run lint`: aprobado con advertencias preexistentes; se corrigió la advertencia introducida en el componente nuevo.
- `npm run build`: aprobado; aviso de tamaño de un paquete ya existente.

## Pendiente de aceptación

1. Aplicar los archivos del paquete al proyecto activo; el instalador no sobrescribe archivos preexistentes que hayan cambiado desde esta revisión y crea respaldo de los reemplazados.
2. Aplicar únicamente la migración nueva después de revisar el historial real del proyecto Supabase. No se aplican migraciones automáticamente con el instalador.
3. Ejecutar `supabase/tests/progress_security.sql` en una base de pruebas con el esquema previo. Comprueba propietario, aislamiento entre dos usuarios, metas idempotentes, fecha local, futuro, edición y eliminación, y revierte los datos al terminar. El archivo fue preparado y revisado, pero no ejecutado; no afirmar que RLS remoto ya está validado.
4. Probar con cuentas reales guardado/recarga y cambio de usuario. Verificar interfaz en móvil y escritorio, errores de red y eliminación. Se intentó la navegación local de prueba, pero el navegador no alcanzó el servidor de la sesión; no hay aceptación visual ni funcional de navegador completada.

No se entrenó IA ni se introdujeron dependencias nuevas en la aplicación. Los sprints de nutrición, gasto energético y proyección permanecen pendientes.
