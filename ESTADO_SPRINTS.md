# Estado de los sprints — 16 de octubre de 2026

Se trabajó sobre C:\Users\HP\Documents\Gym, que contenía el proyecto; el ZIP indicado no estaba disponible. Se conservaron los cambios locales previos. No se hicieron commits, despliegues ni cambios en la base remota.

## Cambios por sprint

| Sprint | Trabajo realizado | Validación pendiente |
| --- | --- | --- |
| 1. Analizadores | Contrato uniforme para los 131 ejercicios; adaptación de los ocho analizadores originales; corrección de ciclos, reloj, visibilidad, lado más visible, métricas relativas al cuerpo, posturas de isometría, secuencias y alternancia. Catálogo y filtros accesibles desde la cámara. | Calibrar cada ejercicio con grabaciones y personas reales; verificar las variantes de postura y ambos lados en cámaras físicas. |
| 2. Rutinas | Inicio conectado a la cámara; preparación, series, objetivos, descansos automáticos, +10 segundos, salto, pausa, reinicio, voz y alertas. Tiempo válido de postura, conteos conservados al pausar e historial de todas las series. | Recorrido completo en navegador con cámara y audio; restricciones de reproducción de iOS. |
| 3. Entrenador | Creación, ordenación, asignación/reactivación, consulta de rutinas con ejercicios, historial y reintento de guardado. Creación atómica mediante función SQL y políticas para lectura de rutinas asignadas y escritura por rol. | Aplicar migraciones y probar con cuentas reales de entrenador y socio, incluidos rechazos de acceso cruzado. |
| 4. Nutrición | Escáner accesible, cámara/galería, validación estricta de respuesta, compresión obligatoria a 1024 px y menos de 300 KB, guardado automático y reintento sin volver a consumir IA. Modelo configurable. | Probar una petición real al proveedor y verificar el diario en Supabase. |
| 5. Móvil/PWA | Conservación e integración de manifest, iconos e instalación; controles táctiles, orientación, cámaras frontal/trasera, cancelación de aperturas antiguas, superposición alineada y caché limitada a la aplicación. Carga diferida de los nuevos paneles. | Layout real, permisos, instalación y medición de FPS en iOS Safari y Android Chrome. |

## Verificación ejecutada

- Pruebas originales de los ocho ejercicios y de rendimiento/layout simulados.
- Contrato, ausencia de landmarks, visibilidad y reinicio de los 131 analizadores.
- Ciclo angular completo, rechazo de movimientos demasiado rápidos y de ciclos interrumpidos por pérdida de seguimiento.
- Tiempo de plancha, rechazo de una postura de pie, métrica relativa de muñecas, secuencia del gusano y equilibrio separado por pierna.
- Máquina de estados de rutinas: preparación, pausa, descansos, series, finalización única e historial por serie.
- Renderizado de los paneles de entrenador, rutinas y nutrición, con sus proveedores de contexto.
- Validación nutricional con respuestas válidas, incompletas, negativas y de tipos incorrectos.
- Compilación de producción y revisión de código. Las advertencias de React sobre sincronización en efectos/recarga rápida y el aviso de tamaño del paquete principal se detallan en los registros de verificación.

Las pruebas de perfiles de dispositivos son simulaciones; no demuestran 30 FPS en teléfonos reales. El navegador integrado agotó el tiempo de conexión al servidor local y el control de Edge no estaba disponible. No se verificó visualmente la aplicación ni se usaron cámaras físicas.

## Preparación de Supabase

Las migraciones 20261008000009 a 20261008000012 estaban presentes como cambios locales. Se añadió 20261016000013_training_integration.sql. Revisar cuáles están aplicadas y ejecutar las pendientes en orden sobre el proyecto correcto. La migración 13 depende de las anteriores y de current_gym_role(), definida en 20261006000007_admin_operations.sql.

La función create_training_routine guarda la cabecera y los ejercicios dentro de una sola transacción. Los roles se consultan en el servidor. Un socio puede leer una rutina personalizada únicamente si la creó o tiene una asignación activa. Los historiales y diarios conservan sus políticas por usuario.

No se aplicó SQL a la base remota ni se validó su estado. Las cuentas de demostración del proyecto no equivalen a sesiones reales de Supabase para crear o guardar registros.

## Ejecución

Dentro de frontend-web:

```text
npm install
npm test
npm run test:training
npm run build
npm run lint
npm run dev
```

Mantener las variables existentes en frontend-web/.env.local. El paquete de entrega excluye los archivos con credenciales. VITE_GEMINI_MODEL es opcional; se utiliza gemini-2.5-flash como modelo predeterminado, publicado en https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash . No se conserva Gemini 1.5 ni nombres de modelos sin verificar como primera opción.

Desde la página principal, «Tu entrenamiento» ofrece las rutinas e historial y el escáner. Con un rol de entrenador o administrador aparecen «Crear rutina» y «Asignar rutinas». El entrenador con cámara permite seleccionar el catálogo completo.

## Criterio de cierre

No se marcan los cinco sprints como totalmente terminados: los requisitos de calibración real, base de datos y pruebas físicas de la sección 8 de agente.md siguen pendientes. La implementación y las comprobaciones locales no sustituyen esos criterios.

## Correcciones de filtros y cámara

- Dificultad y tipo muestran «No especificado» cuando no hay filtro; músculo conserva su opción actual.
- Las tarjetas usan menos columnas en el modal y permiten que dificultad, tipo y unilateral pasen a otra línea.
- Se declaró el identificador de apertura de cámara que faltaba. El vídeo también se conecta al stream después de montar su elemento, evitando una vista negra si el permiso se resuelve antes del renderizado.
- Se liberan streams al cambiar de cámara, cerrar o cancelar, y una reproducción antigua no vuelve a activar una vista cerrada. Los errores de reproducción ofrecen reintento.
- Se añadió `npm run test:camera:unit`, con cinco comprobaciones del ciclo de cámara sin acceso a cámaras físicas.
- Se preparó la migración 14 para conceder permisos de API al rol autenticado, conservando las políticas RLS.
- La comprobación remota sin sesión devuelve acceso restringido en las cuatro tablas de rutinas; `meal_logs` devuelve PGRST205 (no aparece en el esquema de la API). No se considera una verificación administrativa de migraciones.
- La aplicación de migraciones espera autenticación administrativa en la CLI; la URL del proyecto está confirmada como bqdokhumlqyeupreyarg.

## Migraciones aplicadas y pruebas del 16 de octubre de 2026

El registro de la terminal autenticada confirma la aplicación de 20261008000012_meal_logs.sql, 20261016000013_training_integration.sql y 20261016000014_training_api_permissions.sql al proyecto bqdokhumlqyeupreyarg. El listado posterior muestra todas las versiones locales presentes también en el historial remoto. La consulta anónima a meal_logs ya devuelve acceso restringido (401), en lugar de tabla ausente (404).

Se ejecutaron correctamente npm test, npm run test:training, npm run build y npm run lint. La revisión conserva advertencias de React y el aviso de tamaño del paquete, sin errores. Las pruebas incluyen los 131 contratos de analizadores y cinco casos de apertura/cierre de cámara con dispositivos simulados.

La verificación SQL de tablas, permisos y aislamiento de socios está en supabase/tests/training_security.sql. Su ejecución remota requiere la sesión autenticada del escritorio: Windows deniega a la terminal del agente leer el almacén de credenciales (error 5). El primer intento de consulta posterior a las migraciones omitió --linked y se corrigió; la confirmación final se registra por separado. Se mantienen pendientes las pruebas físicas de cámara, calibración y FPS en dispositivos reales.
