# PLAN DE MEJORA — PANEL ADMINISTRATIVO Y RECEPCIÓN

## IronForge Gym

---

## 1. Objetivo general

Realizar un reconocimiento técnico y funcional del proyecto IronForge Gym para planificar la mejora de los paneles administrativo y de recepción. El objetivo es mejorar la organización de las interfaces, separar correctamente las funcionalidades según los roles, garantizar la integridad de los datos financieros y desarrollar mecanismos confiables de generación de reportes y exportación de información.

---

## 2. Contexto técnico y arquitectura actual

- **Aplicación web** con React y JavaScript en el frontend.
- **Backend** con Node.js y Express.js.
- **Base de datos** y autenticación mediante **Supabase**.
- **Roles** del sistema: Administrador, Recepción, Entrenador, Cliente o socio.
- Ya existen paneles administrativo y de recepción con funcionalidades implementadas.

**Arquitectura relevante (actualizada al 2026-11-16):**
- `frontend-web/src/hooks/useAdminReports.js` — Hook principal de reportes. Sustituyó `SEED_PAYMENTS` y los clientes semilla por consultas reales paginadas a `payments`, `pos_sales`, `memberships`, `profiles` y `staff_accounts`; expone estados de carga, error y datos no disponibles.
- `frontend-web/src/components/admin/AdminReports.jsx` — Componente UI del módulo de Reportes, con exportación CSV, documento imprimible y estados honestos.
- `frontend-web/src/lib/adminReportMetrics.js` — Lógica pura de ingresos e indicadores de clientes por persona (nueva en el cierre de Reportes).
- `frontend-web/src/lib/reportExport.js` — Generación de filas CSV y documento HTML imprimible (nueva en el cierre de Reportes).
- `frontend-web/src/lib/csv.js` — Utilidad `downloadCsv` (Blob + `URL.createObjectURL`) reutilizada por Reportes y por el CSV detallado de Finanzas.
- `frontend-web/src/components/admin/AdminFinanceReports.jsx` — Contenedor de la pantalla de Finanzas (Fase 3): sesión, paginación por fuente, estados de carga/error/vacío y registro de egresos.
- `frontend-web/src/components/admin/AdminFinanceView.jsx` — Vista presentacional de Finanzas (Fase 3): banners de estado, tarjetas de totales, formulario con método de pago y tablas de movimientos; no accede a red.
- `frontend-web/src/lib/financeMetrics.js` — Lógica pura de Finanzas (Fase 3): normalización de ingresos/egresos, precisión en centavos, filtro inclusivo por fechas, deduplicación por identificador, totales, orden descendente y filas CSV.
- `frontend-web/src/lib/financePagination.js` — Paginación de consultas de Finanzas en bloques de 1000; un error de página invalida la consulta completa (Fase 3).
- `frontend-web/src/services/financeService.js` — Consultas paginadas a `payments`, `pos_sales` y `operating_expenses`, verificación de sesión, inserción de egresos y modo local aislado (Fase 3).
- `frontend-web/src/lib/dashboardFinanceMetrics.js` — Lógica pura de los indicadores financieros del Dashboard (Fase 4): mes anterior con zona de Bolivia, resumen por período reutilizando `financeMetrics.js` y comparación en centavos/Bs. con valores `null` cuando no hay datos válidos.
- `frontend-web/src/hooks/useAdminFinance.js` — Hook de finanzas del Dashboard. En la Fase 4 se reescribió para consultar los períodos actual y anterior con `fetchFinanceRows`, verificar sesión, paginar `profiles`/`memberships` con `fetchAllRows`, calcular en centavos y exponer estados de carga, error, sesión y disponibilidad parcial. Se eliminó `MONTHLY_INCOME_FALLBACK = 24850`.
- `frontend-web/src/components/admin/AdminDashboard.jsx` — Dashboard administrativo. En la Fase 4 consume los estados nuevos del hook financiero, muestra `—` cuando no hay datos válidos, añade banners persistentes con reintento y conserva los indicadores no financieros y la vista de recepción.
- `frontend-web/src/hooks/useAdminDashboard.js` — Hook del dashboard. En la copia local sin commit se eliminó `SEED_INCOME = 24850` y se fijó `ingresosMes = 0`; las métricas de socios siguen basadas en `seedClients` y `refresh` no alimenta el estado. Cambio no validado en ejecución.
- Archivos de migraciones SQL en `supabase/migrations/` definen el esquema: `plans`, `profiles`, `memberships`, `payments`, `pos_sales`, `pos_products`, `pos_sale_items`, `operating_expenses`, `classes`, `bookings`, `staff_accounts`, `gym_attendance`, entre otras.

---

## 3. Estado del apartado de Reportes

**Estado al 2026-11-16: implementación cerrada y verificada en el entorno local. No se validó contra datos reales de producción.**

**Implementado y comprobado en código:**
- Consultas reales a Supabase para ingresos de membresías (`payments` con `estado_pago = 'completado'`) y ventas POS (`pos_sales`), con filtros de período sobre `created_at`.
- Total de clientes únicos desde `profiles`, incluyendo personas que nunca tuvieron membresía.
- Exclusión de personal: `profiles` **no tiene columna `role`**; el rol funcional vive en `app_metadata.gym_role`. El personal se descuenta con las filas de `staff_accounts` (recepción/entrenadores), la cuenta actual si es staff y los correos de respaldo `admin@ironforge.com` / `recepcion@ironforge.com`.
- Clasificación de clientes activos y vencidos **por persona** (`user_id`), no por membresía: activo si tiene al menos una `activa` o `por_vencer`; vencido solo si tiene `vencida` y ninguna vigente. Si coinciden estados, prevalece activo. El resultado no depende del orden de los registros.
- Paginación de todas las consultas en bloques de 1000 filas mediante `.range()`; un error en cualquier página aborta la carga en lugar de aceptar resultados parciales.
- Manejo explícito de errores y estados: `hasLoaded`, `unavailable` y `error`. Diferencia cargando / cero válido / consulta fallida. Los valores no disponibles se representan con `null` y se muestran como `—`, nunca como cero.
- Si falla la consulta de personal, los indicadores de clientes quedan como “no disponible” para no mostrar cifras posiblemente infladas.
- Exportación CSV del resumen de Reportes (período, ingresos por membresías/POS/total, desglose por método, clientes activos/vencidos/total y fecha de generación).
- Documento imprimible generado con HTML y el diálogo de impresión del navegador para guardar como PDF (sin librerías nuevas).
- Eliminación del flujo de caja con egresos ficticios en cero; los egresos se remiten al apartado Finanzas.
- “Reservas de clases” identificadas como reservas y no como asistencias. No se agregan indicadores de reservas porque `bookings` solo permite a cada usuario leer las suyas (RLS); se declara la sección como no disponible en Reportes.
- Pruebas de lógica, exportación y renderizado en `frontend-web/scripts/`.

**Evidencia de verificación (2026-11-16):**
- `npm run test:reports`: exit 0; 16 pruebas de lógica/exportación y prueba de renderizado satisfactorias.
- `npm run build`: satisfactorio; 2097 módulos transformados.
- `npm run lint`: exit 0; cinco advertencias preexistentes en archivos ajenos al módulo (sin advertencias en los archivos de Reportes).

**Historial del problema (diagnóstico previo, conservado como referencia):**
- En una fase anterior se sustituyeron `SEED_PAYMENTS` (40 pagos inventados) y `seedClients` (7 clientes ficticios) por consultas reales.
- En ese momento los indicadores `activas`/`vencidas`/`totalClientes` quedaban en `0`/pendiente y no existía manejo explícito de errores.
- También se había retirado `yape_plin` de `METHOD_KEYS`; en el cierre se reincorporó porque `pos_sales` admite ese método (aunque `payments` no).

**Pendiente / limitado por el entorno remoto:**
- Validación funcional con datos reales de producción (no realizada).
- El acceso y los resultados dependen de una sesión de personal autorizada por las políticas RLS.
- No hay agregación de reservas de clases por restricciones de lectura.
- El PDF es imprimible desde el navegador; no incluye gráficos ni tendencias.
- El CSV de Reportes es un resumen; el detalle de movimientos financieros vive en el apartado Finanzas (implementado en la Fase 3).

---

## 4. Plan de exportación PDF y CSV

**Estado al 2026-11-16:** Implementación parcial y funcional:
- **CSV de resumen de Reportes:** implementado.
- **Documento imprimible para guardar como PDF:** implementado.
- **CSV detallado de movimientos de Finanzas:** implementado en el cierre de Fase 3.
- **No implementado:** gráficos y tendencias dentro del PDF, exportación de asistencias/reservas y comparativos históricos entre períodos.

**PDF — Reportes (implementado en `frontend-web/src/lib/reportExport.js` + `window.print()`):**
- Nombre del gimnasio.
- Título del reporte.
- Período consultado.
- Fecha de generación.
- Resumen de ingresos (membresías, POS, total).
- Desglose por método de pago.
- Estado de clientes (activos, vencidos, total).

**PDF — no incluido todavía:**
- Gráficos y tendencias.
- Asistencias y reservas (no disponibles por RLS).
- Comparativos históricos entre períodos.

**CSV — Reportes (implementado):**
- Período seleccionado y fecha de generación.
- Ingresos por membresías, ingresos POS e ingresos totales.
- Desglose por método de pago (conteos y montos).
- Clientes activos, vencidos y total de clientes.
- Los datos no disponibles se escriben como “No disponible”, no como cero.

**CSV — Finanzas (implementado en el cierre de Fase 3):**
- Fecha.
- Tipo de movimiento (ingreso/egreso).
- Concepto.
- Categoría.
- Método de pago.
- Monto.
- Identificador del registro.
- Distingue ingresos de egresos y no mezcla la fila de resultado neto con los movimientos.
- Exporta únicamente el período seleccionado, con fecha legible `dd/mm/yyyy` y montos a dos decimales.
- Implementado con `buildFinanceCsvRows` (`financeMetrics.js`) y `downloadCsv` (`csv.js`); conserva BOM y escape de comas/comillas. No exporta datos parciales ni resultados obsoletos: la acción permanece deshabilitada durante carga o error.

**Implementación real:** se reutilizó `frontend-web/src/lib/csv.js` (`downloadCsv`, Blob + `URL.createObjectURL`) y se generó el documento imprimible como HTML, sin instalar dependencias nuevas. La hipótesis inicial de usar `jsPDF`/`html2pdf` o `PapaParse` no fue necesaria. La recomendación se aplicó también al CSV detallado de Finanzas en la Fase 3.

**Recomendación conservada:** la utilidad `frontend-web/src/lib/csv.js` ya existía y fue reutilizada en Reportes y en el CSV detallado de Finanzas (Fase 3); cualquier exportación futura debería evaluarla antes de añadir librerías.

---

## 5. Estado del apartado de Finanzas

**Estado al 2026-11-16: Fase 3 cerrada en código y pruebas automatizadas. No validada contra datos reales de producción ni con una sesión RLS real.**

**Implementado y comprobado en código (Fase 3):**
- La pantalla se separó en un contenedor (`AdminFinanceReports.jsx`) y una vista presentacional (`AdminFinanceView.jsx`), lo que permite probar estados sin red.
- **Paginación completa por fuente:** `payments`, `pos_sales` y `operating_expenses` se leen con `.range()` en bloques de 1000 mediante `financePagination.js`; si una página falla se aborta la consulta completa y no se muestran totales parciales. Se eliminó el `.limit(5000)`.
- **Filtros de fechas en servidor:** las tres consultas aplican `created_at >= inicio` y `created_at < fin+1` con la zona horaria fija de Bolivia (`-04:00`); el filtro en cliente queda como verificación inclusiva, no como única fuente.
- **Cálculo monetario en centavos:** `financeMetrics.js` normaliza importes a enteros y evita errores de coma flotante; no se alteran los importes almacenados.
- **Estados honestos:** carga, datos, vacío válido, error persistente y sesión no disponible. Durante carga o error los indicadores muestran `—`, el error se presenta en un banner `role="alert"` y no se renderizan tablas vacías. La exportación permanece deshabilitada hasta tener datos completos.
- **Registro de egresos:** selector con los cinco métodos admitidos por el esquema (`qr`, `efectivo`, `transferencia`, `tarjeta`, `yape_plin`), validación de concepto/categoría/monto positivo, guardia contra doble envío, persistencia del método y recarga de lista y totales.
- **Separación entre datos reales y modo local:** con Supabase configurado y sin sesión no se lee ni escribe `localStorage`; se muestra “Sesión no disponible” y se solicita iniciar sesión. El modo local solo se usa cuando Supabase no está configurado y aparece rotulado como tal.
- **Movimientos ordenados e identificados:** lista combinada descendente por fecha; cada fila muestra fecha, tipo (`Membresía`, `POS` o `Egreso`), concepto, método, monto e identificador. No se añadieron acciones de edición o eliminación.
- **Deduplicación:** por identificador fiable (fuente + ID), nunca por coincidencia de monto o fecha; se conservan movimientos legítimos con el mismo importe y fecha.
- **CSV detallado de siete columnas:** `Fecha, Tipo, Concepto, Categoría, Método de pago, Monto, Identificador`; solo el período seleccionado, sin fila de neto mezclada y con BOM/escape de `downloadCsv`.
- **Pruebas:** 18 casos de lógica/paginación/CSV y 9 de renderizado con cliente inyectado (sin red).

**Hook del Dashboard (estado al cierre de Fase 3, conservado como historial):**
- `useAdminFinance.js` consultaba `payments` (`estado_pago = 'completado'`), `pos_sales`, `operating_expenses`, `profiles`, `memberships`.
- `available` pasaba a `true` solo si **todas** las 5 consultas eran exitosas.
- `currentIncome = sum(payments.monto) + sum(pos_sales.total)`.
- Ganancia neta = Ingresos comerciales - Egresos operativos.
- Conservaba `MONTHLY_INCOME_FALLBACK = 24850`; el Dashboard lo mostraba sin comprobar `financeAvailable`.

**Resuelto en la Fase 4:** el fallback fue eliminado, el hook dejó de usar sumas directas sin paginación y ahora distingue carga, error, sesión y disponibilidad parcial. El detalle está en §6.

**Evidencia de verificación (2026-11-16):**
- `npm run test:finance`: exit 0; 27/27 pruebas (18 de lógica/paginación/CSV + 9 de render).
- `npm run test:reports`: exit 0; 16/16 pruebas de lógica/exportación y render (regresión preservada).
- `npm run build`: correcto; 2101 módulos transformados.
- `npm run lint`: exit 0; cinco advertencias preexistentes en archivos ajenos a Finanzas, ninguna en los archivos de esta fase.

**Pendiente / limitado por el entorno remoto:**
- Validación funcional con datos reales de producción y con una sesión de administración real (RLS en ejecución): no realizada.
- Sin unión de `payments` con `plans`/`profiles`: el concepto de membresía y el cliente no se muestran porque las consultas actuales no los traen.
- Sin detección automática de una duplicación manual entre `payments` y `pos_sales` si se registra el mismo cobro en ambas tablas con identificadores distintos.
- Coherencia Dashboard↔Finanzas↔Reportes: los criterios quedaron alineados en la Fase 4 (mismas fuentes, centavos y zona de Bolivia), pero no se compararon cifras con registros productivos.
- El `max_rows` real del Supabase remoto es desconocido; la paginación asume bloques de 1000.

**Estado de las propuestas conservadas:**
- Alinear períodos y fórmulas entre Finanzas, Reportes y Dashboard: **aplicado en la Fase 4** para el Dashboard financiero.
- Confirmar la eliminación efectiva del fallback `24.850 Bs.` en Dashboard: **aplicado en la Fase 4**; el valor ya no existe en el hook.
- Verificar que `operating_expenses` no aparezcan como ingresos en ningún módulo: la pantalla de Finanzas y el Dashboard los mantienen como egresos.

---

## 6. Estado del Dashboard administrativo

**Estado al 2026-11-16: Fase 4 completada en implementación y pruebas automatizadas. No validada contra Supabase real ni con una sesión RLS en ejecución.**

**Implementado y comprobado en código (Fase 4):**
- **Fallback eliminado:** se eliminó `MONTHLY_INCOME_FALLBACK = 24850` de `useAdminFinance.js`. No existe ningún importe ficticio de respaldo en el Dashboard.
- **KPI de ingresos honesto:** “Ingresos del Mes” muestra `—` durante la carga, ante error o sin sesión; con datos válidos muestra el importe real. El cero válido se muestra como `0 Bs.`. Se dejó de usar `ingresosMes` de `useAdminDashboard` como respaldo visible, sin modificar ese hook.
- **Estados diferenciados:** `loading`, `available`, `financeAvailable`, `peopleAvailable`, `authRequired` y `error`. Se añadieron `peopleError`, `currentNet` y `previousNet` como campos complementarios. `available` conserva el significado de disponibilidad conjunta (`financeAvailable && peopleAvailable`).
- **Invalidación al refrescar:** al iniciar una actualización los importes anteriores pasan a `null`, de modo que ninguna cifra obsoleta se presenta como actual.
- **Sesión:** se comprueba antes de consultar. Sin sesión se activa `authRequired` y no se leen datos financieros.
- **Períodos y paginación:** se consultan el mes actual y el anterior con `fetchFinanceRows`; `profiles`, `memberships` y los pagos necesarios para la fórmula de bajas se leen con `fetchAllRows` en bloques de 1000.
- **Cálculo financiero:** se reutilizan `buildMovements`, `filterMovementsByPeriod`, `summarizeMovements` y `centsToAmount`; la comparación actual/anterior se compone en `dashboardFinanceMetrics.js` con centavos y montos en Bs.
- **Zona horaria:** los límites de ambos períodos usan la zona fija de Bolivia (`-04:00`), igual que Finanzas.
- **Fallos financieros:** si falla cualquiera de las fuentes financieras se invalidan todos los importes y se muestra un banner persistente con acción de reintento.
- **Disponibilidad parcial:** si fallan `profiles`, `memberships` o la consulta de renovaciones, los importes financieros se conservan y solo las altas/bajas pasan a `—`, con un aviso específico.
- **Protección de respuestas fuera de orden:** cada refresco usa un identificador de petición; las respuestas antiguas se descartan.
- **`refresh` estable:** definido con `useCallback` para evitar ciclos de renderizado.
- **Tendencia y flujo de caja:** la tendencia solo dibuja barras con datos válidos; durante la carga muestra un estado de carga y ante error un mensaje informativo. El flujo de caja protege ingresos, egresos y neto con `financeAvailable && !loading`.
- **Indicadores preservados:** socios activos, membresías por vencer, reservas, clases, ranking, alertas, accesos directos, `incomeToday` y la vista de usuarios no administradores.

**Archivos creados en la Fase 4:**
- `frontend-web/src/lib/dashboardFinanceMetrics.js`
- `frontend-web/scripts/admin-dashboard-finance-logic.test.mjs`
- `frontend-web/scripts/admin-dashboard-finance-render.test.mjs`

**Archivos modificados en la Fase 4:**
- `frontend-web/src/hooks/useAdminFinance.js`
- `frontend-web/src/components/admin/AdminDashboard.jsx`
- `frontend-web/package.json` — solo se añadió el script `test:dashboard`.

**Evidencia de verificación (2026-11-16):**
- `npm run test:dashboard`: exit 0; **24/24** (14 de lógica pura + 10 de render con cliente simulado).
- `npm run test:finance`: exit 0; **27/27** (regresión preservada).
- `npm run test:reports`: exit 0; **16/16** (regresión preservada).
- `npm run build`: correcto; **2102 módulos** transformados.
- `npm run lint`: exit 0; cinco advertencias preexistentes en archivos ajenos a esta fase.

**Limitaciones de la Fase 4:**
- Sin validación real contra Supabase ni RLS en ejecución.
- Lectura paginada adicional de `payments` con `user_id` para conservar la fórmula de `churned`, porque `fetchFinanceRows` no incluye esa columna y `financeService.js` no se modificó.
- Fórmulas heredadas de `newMembers` (todos los perfiles del mes, incluido staff) y `churned` (renovado si existe cualquier pago completado entre el mes anterior y el actual) conservadas sin reinterpretación.
- Límite remoto de filas (`max_rows`) desconocido; la paginación asume bloques de 1000.
- Sin asociación de pagos con planes/clientes en el Dashboard.

**Pendientes fuera de la Fase 4:**
- **Indicadores de membresías y actividad:** `sociosActivos`, `porVencer`, clases y ranking siguen basados en `seedClients` y `weeklyClasses` de `useAdminDashboard.js`, que no se modificó en esta fase.
- **Refresco de métricas no financieras:** `refresh` de `useAdminDashboard.js` no alimenta el estado mostrado.
- **Validación en ejecución:** no realizada.

**Funcionalidades a conservar:**
- Socios activos/membresías por vencer/vencidas.
- Ingresos del mes con indicador de disponibilidad.
- Tendencia financiera mes a mes.
- Accesos directos (recepción).

**Propuesta de reorganización (pendiente, Fase 5):**
- Eliminar o ocultar funcionalidades exclusivas de clientes.
- Agrupar indicadores por categorías (Financieros, Socios, Operativos).
- Añadir enlaces claros a Reportes y Finanzas detalladas.

---

## 7. Organización de los paneles administrativo y de recepción

**Estado al 2026-11-16: pendiente (Fase 5). No se realizó el inventario completo ni la reorganización funcional por roles.**

**Hecho comprobado:** Se han identificado funcionalidades exclusivas de clientes que aparecen filtradas o visibles en paneles de administración y recepción, lo cual es incorrecto.

**Ejemplos identificados:**
- "Analizar mi comida" — funcionalidad cliente, no debe aparecer en admin/recepción.
- "Entrenar con cámara" — funcionalidad cliente, no debe aparecer en admin/recepción.
- Posiblemente otras en menús, rutas o componentes visibles.

**Acción requerida:**
- Realizar inventario completo de funcionalidades, rutas, menús y componentes visibles para cada rol.
- Clasificar cada funcionalidad:
  - Exclusiva de administración.
  - Exclusiva de recepción.
  - Exclusiva de entrenador.
  - Exclusiva de clientes.
  - Compartida entre determinados roles.

**Restricción clave:** "Ocultar un botón no sustituye la autorización real". La protección debe ser tanto en frontend (visibilidad) como en backend (permisos y rutas).

**A diferencia de Reportes**, donde ya se sustituyó seed por datos reales, aquí el problema es de **distribución de funcionalidades por rol**, no de origen de datos.

---

## 8. Separación de funcionalidades según los roles

**Clasificación propuesta:**

| Rol | Funcionalidades exclusivas |
|---|---|
| **Administrador** | Gestión de usuarios, configuración de planes, reportes financieros completos, configuración de sistema. |
| **Recepción** | Registro de ventas POS, control de inventario productos, registro de gastos operativos, asistencia de clientes, ventas de día a día. |
| **Entrenador** | Gestión de rutinas, seguimiento de clientes asignados, clases propias, disponibilidad. |
| **Cliente/Socio** | Perfil propio, reservas de clases, historial de asistencias, pagos de membresía, consultas personales. |

**Funcionalidades que NO deben aparecer en administración ni recepción:**
- "Analizar mi comida" — experiencia personal del cliente.
- "Entrenar con cámara" — flujo de trabajo del cliente.
- Cualquier otra opción cuya lógica de negocio esté atada a la experiencia individual del socio.

**Recomendación:** Revisar `RANGE_OPTIONS`, menú lateral, componentes de tarjetas y barras de progreso en ambos paneles para detectar y corregir visibilidades incorrectas.

---

## 9. Estrategia de datos precargados para pruebas

**Condiciones obligatorias:**
1. No insertar datos ficticios automáticamente en producción.
2. No mezclar datos de prueba con registros reales.
3. No sobrescribir ni eliminar datos existentes.
4. Identificar claramente los registros de prueba.
5. Evitar información personal real de socios para pruebas.

**Propuesta:**
- Utilizar **fixtures de prueba** en archivos controlados (ej. `test-payments.json`, `test-pos-sales.json`) **fuera** de la producción.
- O bien, un **entorno Supabase de desarrollo** aislado.
- **No ejecutar inserciones remotas** durante esta fase.

**Casos de prueba mínimos:**
- 3 pagos QR completados + 2 efectivo + 1 tarjeta = 1.320 Bs ingresos membresías.
- 1 venta POS de 150 Bs = 150 Bs ingresos POS.
- Total comercial: 1.470 Bs.
- Pagos no completados (pendiente/fallido/expirado) → no deben incrementar ingresos.
- Filtros temporal: hoy, semana, mes, rango.
- Ausencia de registros → mostrar 0 o mensaje, nunca datos ficticios.
- Error de consulta → mensaje explicativo, no cifras inventadas.

**Estrategia de inversión:**
- Documentar cómo se crearían, consultarían y limpiarían los datos de prueba de forma segura.
- Identificar si conviene utilizar fixtures automatizados o un entorno de desarrollo Supabase.
- Evitar información personal real.

**Avance al 2026-11-16:** se añadieron pruebas automatizadas para Reportes (`admin-reports-logic.test.mjs` y `admin-reports-render.test.mjs`) que cubren indicadores por persona, CSV y documento imprimible. En el cierre de Fase 3 se añadieron `admin-finance-logic.test.mjs` y `admin-finance-render.test.mjs`, con datos inyectados en memoria y sin escrituras remotas. En la Fase 4 se añadieron `admin-dashboard-finance-logic.test.mjs` y `admin-dashboard-finance-render.test.mjs`, con cliente simulado: cubren períodos, centavos, carga, error, sesión, disponibilidad parcial, reintento y preservación de indicadores no financieros. No se insertaron datos en Supabase ni se creó un entorno de desarrollo; la validación integral con datos controlados del resto del sistema sigue pendiente.

---

## 10. Plan de trabajo por fases

| Fase | Enfoque | Estado al 2026-11-16 |
|---|---|---|
| **Fase 1** | Auditoría funcional y técnica de Reportes. | **Realizada en código y pruebas automatizadas.** Se identificaron y corrigieron origen de datos, indicadores y manejo de errores (ver §3). |
| **Fase 2** | Diseño e implementación de exportaciones PDF y CSV. | **Parcial.** CSV de resumen y documento imprimible PDF implementados. Gráficos/tendencias del PDF pendientes; el CSV detallado de Finanzas se completó en la Fase 3. |
| **Fase 3** | Revisión y mejora del apartado de Finanzas. | **Realizada en código y pruebas automatizadas.** Paginación, fechas en servidor, centavos, estados honestos, egresos con método, separación del modo local, movimientos identificados y CSV de siete columnas (ver §5). Sin validación con producción. |
| **Fase 4** | Reorganización del Dashboard administrativo. | **Realizada en código y pruebas automatizadas.** Eliminación del fallback 24.850 Bs., estados de carga/error/sesión, consultas por período con paginación, centavos, zona de Bolivia, disponibilidad parcial y preservación de indicadores no financieros (ver §6). Sin validación con Supabase real ni RLS. |
| **Fase 5** | Separación y reorganización de paneles admin/recepción. | **Pendiente.** Sin inventario completo ni reorganización funcional por roles. |
| **Fase 6** | Verificación de permisos, roles y navegación. | **Parcial.** Se revisó la existencia y configuración de políticas RLS para las tablas relevantes (`profiles`, `memberships`, `payments`, `pos_sales`, `bookings`, `staff_accounts`). No se completó la validación funcional integral de rutas y acciones. |
| **Fase 7** | Implementación de datos controlados y pruebas funcionales/automatizadas. | **Parcial.** Pruebas automatizadas de Reportes, Finanzas y Dashboard ejecutadas (lógica, exportación y render). Validación integral con datos controlados y escenarios del resto del sistema, pendiente. |

**Detalle del estado por fase:**
- **Fase 1:** cerrada para Reportes. Quedan como limitaciones la validación con datos de producción y la dependencia de sesión de personal.
- **Fase 2:** el PDF contiene nombre, título, período, fecha, resumen de ingresos, métodos y estado de clientes; **no** contiene gráficos, tendencias ni asistencias. El CSV de Reportes cubre el resumen de ingresos, métodos y clientes; el CSV detallado de movimientos se completó en la Fase 3 (§5).
- **Fase 3:** cerrada en código y pruebas automatizadas. `AdminFinanceReports.jsx` usa un servicio exclusivo con paginación y fechas en servidor; los estados de carga/error/vacío/sesión son explícitos; los egresos guardan el método elegido; el modo local quedó separado y rotulado; el CSV detallado tiene siete columnas. En el cierre de la Fase 3 `useAdminFinance.js` seguía intacto y conservaba `MONTHLY_INCOME_FALLBACK = 24850`; la Fase 4 lo resolvió.
- **Fase 4:** cerrada en código y pruebas automatizadas. Se eliminó el fallback ficticio; el hook consulta mes actual y anterior con paginación, comprueba sesión, calcula en centavos con la zona de Bolivia y distingue carga, error, sesión y disponibilidad parcial. El Dashboard muestra `—` cuando no hay datos válidos, conserva el cero real y añade banners con reintento. No se modificó `useAdminDashboard.js`; sus métricas de socios y actividad siguen con datos semilla y quedan fuera de esta fase.
- **Fase 5:** sin avances verificables en esta actualización.
- **Fase 6:** las políticas RLS revisadas restringen `bookings` por usuario y permiten lectura de perfiles/membresías a staff; falta probar cada ruta y acción por rol.
- **Fase 7:** las pruebas de Reportes, Finanzas y Dashboard no constituyen una validación integral del sistema ni sustituyen una prueba con datos y sesiones reales.

**Dependencias:** Las fases pueden reordenarse después del reconocimiento, pero cualquier modificación debe justificarse.

---

## 11. Decisiones funcionales confirmadas

1. **Reportes:** Sustituidos `SEED_PAYMENTS` y los clientes semilla por consultas reales a `payments` (`estado_pago = 'completado'`), `pos_sales`, `memberships`, `profiles` y `staff_accounts`. Filtros sobre `created_at` real.
2. **Datos ficticios:** `SEED_PAYMENTS`, `seedClients` y `24.850 Bs.` ya no son fuente principal en Reportes.
3. **Métodos de pago:** `METHOD_KEYS` incluye `efectivo`, `qr`, `transferencia`, `tarjeta` y `yape_plin`. Nota histórica: en el diagnóstico previo se había retirado `yape_plin`; se reincorporó porque `pos_sales` lo admite. La migración `admin_operations` amplió después `payments` a los cinco métodos, por lo que el selector de Finanzas usa la misma lista que el esquema.
4. **Cálculo contable:** `ingresosComerciales = ingresosPorMembresias + ingresosPOS`. Gastos operativos = egresos, nunca ingresos.
5. **Error handling:** El sistema no debe presentar cantidades ficticias como si fueran reales. Un fallo de consulta se informa; no se convierte en cero. Un cero solo se muestra cuando la consulta fue exitosa y no hay registros.
6. **Clientes únicos:** el total se calcula desde `profiles`, incluyendo personas sin membresías. `profiles` no tiene columna `role`; el personal se excluye con `staff_accounts`, la sesión actual si es staff y los correos de respaldo que `current_gym_role()` clasifica como staff.
7. **Activos/vencidos:** clasificación por `user_id`, no por membresía. Si una persona tiene estados activos y vencidos, prevalece como activa. El cálculo es independiente del orden de los registros.
8. **Paginación:** todas las consultas de Reportes se paginan en bloques de 1000; un error en cualquier página cancela la carga en lugar de aceptar resultados parciales.
9. **Estados no disponibles:** se representan con `null` y se muestran como `—`; los exportadores escriben “No disponible”. No se inventan valores de respaldo.
10. **Exportaciones:** CSV mediante `downloadCsv` (Blob + `URL.createObjectURL`) y PDF mediante documento HTML imprimible con `window.print()`. Sin dependencias nuevas. El PDF no incluye gráficos ni tendencias.
11. **Reservas:** se identifican como reservas, no como asistencias. No se agregan en Reportes porque la política RLS de `bookings` solo permite leer las reservas propias.
12. **Finanzas — paginación:** las tres fuentes se leen con `.range()` en bloques de 1000; un error de página invalida la consulta completa. No se aceptan totales parciales.
13. **Finanzas — fechas:** el rango se aplica en Supabase con límites de Bolivia (`-04:00`) e incluye ambos extremos; el filtro en cliente solo verifica la coherencia.
14. **Finanzas — precisión:** los importes se normalizan a centavos enteros para sumar; los valores almacenados en la base no se modifican.
15. **Finanzas — estados:** carga, datos, vacío válido, error persistente y sesión no disponible son estados distintos. En carga/error se muestra `—`, nunca cero; no se muestran tablas vacías tras un error.
16. **Finanzas — egresos:** el método de pago es seleccionable entre los cinco admitidos por el esquema (`qr`, `efectivo`, `transferencia`, `tarjeta`, `yape_plin`); se guarda tal cual y se evita el doble envío.
17. **Finanzas — origen de datos:** con Supabase configurado y sin sesión no se leen ni escriben datos locales ni se presentan como reales. El modo local solo existe sin Supabase configurado y se rotula de forma visible.
18. **Finanzas — movimientos y CSV:** la lista combinada se ordena por fecha descendente, cada movimiento conserva su identificador y el CSV detallado tiene exactamente siete columnas, sin fila de neto mezclada. No se añaden acciones de edición o eliminación.
19. **Dashboard — sin datos ficticios:** se eliminó `MONTHLY_INCOME_FALLBACK = 24850`. Ningún importe de respaldo puede mostrarse como real. Un valor no disponible se representa con `null` y se muestra como `—`.
20. **Dashboard — estados:** `loading`, `available`, `financeAvailable`, `peopleAvailable`, `authRequired` y `error` son estados distintos. `available` significa disponibilidad conjunta; los importes y las personas se invalidan por separado.
21. **Dashboard — período y precisión:** se consultan el mes actual y el anterior con la zona fija de Bolivia (`-04:00`), paginación completa y suma en centavos mediante la lógica de Finanzas.
22. **Dashboard — sesión y errores:** sin sesión no se consultan datos financieros; un fallo financiero invalida todos los importes y muestra un banner persistente con reintento. Un fallo de personas no oculta los importes disponibles.
23. **Dashboard — fórmulas heredadas:** se conservan las definiciones existentes de `newMembers` y `churned`; no se introducen nuevas interpretaciones de negocio.
24. **Dashboard — preservación:** socios activos, membresías por vencer, reservas, clases, ranking, alertas, accesos directos, `incomeToday` y la vista de usuarios no administradores se mantienen sin cambios. `useAdminDashboard.js` no se modificó.
25. **Dashboard — pruebas:** se usa un cliente simulado en memoria; las pruebas no se conectan a Supabase real y cubren carga, error inicial, error posterior, sesión, cero válido, disponibilidad parcial, reintento y regresión de indicadores no financieros.

---

## 12. Problemas identificados y pendientes

| Área | Problema | Evidencia / estado al 2026-11-16 |
|---|---|---|
| **Reportes** | Indicadores de clientes calculados por membresía y no por persona | **Resuelto.** Total desde `profiles`; activos/vencidos por `user_id` con prioridad a estados activos. |
| **Reportes** | Resultados parciales silenciosos por límite de filas | **Resuelto.** Paginación en bloques de 1000 y aborto ante error. |
| **Reportes** | Cero mostrado cuando la consulta fallaba o aún cargaba | **Resuelto.** Estados `hasLoaded`/`unavailable`/`error`; `null` se muestra como `—`. |
| **Reportes** | Exportaciones inexistentes | **Implementado parcialmente.** CSV de resumen y PDF imprimible. El CSV detallado de Finanzas se completó en la Fase 3; siguen pendientes los gráficos/tendencias del PDF. |
| **Reportes** | Reservas presentadas como asistencias | **Resuelto en Reportes.** Sección rotulada “Reservas de clases”; sin agregación por RLS. |
| **Finanzas** | Límite fijo de 5000 filas y filtrado en cliente | **Resuelto (Fase 3).** Paginación por `.range()` en bloques de 1000 y rango de fechas aplicado en Supabase. |
| **Finanzas** | Ceros mostrados durante carga o error | **Resuelto (Fase 3).** Estados explícitos; `—` en indicadores no válidos; banner persistente de error. |
| **Finanzas** | Egresos guardados siempre como efectivo | **Resuelto (Fase 3).** Selector con los cinco métodos del esquema, incluido `yape_plin`. |
| **Finanzas** | Fallback silencioso a `localStorage` sin sesión | **Resuelto (Fase 3).** Con Supabase configurado y sin sesión se pide iniciar sesión; el modo local solo aplica sin Supabase y está rotulado. |
| **Finanzas** | CSV sin identificador y con resultado neto mezclado | **Resuelto (Fase 3).** CSV exacto de siete columnas, solo movimientos del período, sin fila de neto. |
| **Finanzas** | `MONTHLY_INCOME_FALLBACK = 24850` en `useAdminFinance.js` | **Resuelto (Fase 4).** El fallback fue eliminado; el hook no contiene importes ficticios. |
| **Dashboard** | Ingresos sin fuente real | **Resuelto en código (Fase 4).** El KPI usa `useAdminFinance` con consultas reales al mes actual; sin datos válidos muestra `—`. No validado con producción. |
| **Dashboard** | Carga, error y sesión indistinguibles | **Resuelto (Fase 4).** Estados `loading`/`authRequired`/`error`; banners persistentes con reintento; sin cifras obsoletas al refrescar o fallar. |
| **Dashboard** | Consultas sin paginación y zona horaria distinta | **Resuelto (Fase 4).** `fetchFinanceRows` pagina las fuentes; `fetchAllRows` pagina personas; ambos períodos usan `-04:00`. |
| **Dashboard** | Fallo de personas ocultaba los importes | **Resuelto (Fase 4).** `financeAvailable` y `peopleAvailable` se invalidan por separado; un fallo de personas solo deja altas/bajas en `—`. |
| **Dashboard** | Socios, clases y ranking basados en datos semilla | **Pendiente (fuera de la Fase 4).** `useAdminDashboard.js` no se modificó; `seedClients` y `weeklyClasses` siguen como fuente. |
| **Paneles** | Funcionalidades cliente en vistas admin/recepción | **Pendiente (Fase 5).** “Analizar mi comida”, “Entrenar con cámara”, entre otras. |
| **Permisos** | Validación funcional integral por rol | **Parcial (Fase 6).** Políticas RLS revisadas; falta probar rutas y acciones. |
| **Datos reales** | Validación contra producción | **Pendiente.** Solo se verificó build, lint, pruebas automatizadas y render local. |
| **Sesión** | Acceso a Reportes sin personal autenticado | **Limitación.** Las consultas dependen de una sesión con rol staff autorizado. |

---

## 13. Pruebas y criterios de aceptación

**Verificado al 2026-11-16 (Reportes):**
- **Build:** `npm run build` — exitoso; 2097 módulos transformados, sin errores.
- **Lint:** `npm run lint` — exit 0; cinco advertencias preexistentes en archivos ajenos al módulo, ninguna en Reportes.
- **Pruebas automatizadas:** `npm run test:reports` — exit 0; 16 pruebas de lógica/exportación y prueba de renderizado.
- **Sin datos:** se distingue cero válido (`0`) de dato no disponible (`—`); no se usa `24.850 Bs.` ni semilla en Reportes.
- **Error de consulta:** se muestra mensaje explicativo y se limpian los datos; no se presentan cifras inventadas.
- **Filtros período:** implementados sobre `created_at` de `payments` y `pos_sales` (hoy, semana, mes, rango).
- **Exportación PDF:** incluye nombre del gimnasio, título, período, fecha de generación, resumen de ingresos, desglose de métodos y estado de clientes. **No incluye gráficos ni tendencias.**
- **Exportación CSV:** incluye período, ingresos por membresías/POS/total, desglose por método, clientes activos/vencidos/total y fecha de generación. Es el CSV de Reportes, distinto del CSV detallado de Finanzas implementado en la Fase 3.
- **Clientes únicos:** total desde `profiles`; activos/vencidos por persona con prioridad a activos; orden independiente.

**Verificado al 2026-11-16 (Finanzas, Fase 3):**
- **Build:** `npm run build` — exitoso; 2101 módulos transformados, sin errores.
- **Lint:** `npm run lint` — exit 0; cinco advertencias preexistentes en archivos ajenos a Finanzas, ninguna en los archivos de esta fase.
- **Pruebas automatizadas:** `npm run test:finance` — exit 0; 27/27 (18 de lógica/paginación/CSV + 9 de render).
- **Regresión de Reportes:** `npm run test:reports` — exit 0; 16/16.
- **Paginación:** probada con más de 1000 filas y con fallo en la segunda página; la consulta completa se invalida y no devuelve resultados parciales.
- **Fechas:** límites inclusivos, cambio de mes y de año, y conversión a zona horaria de Bolivia.
- **Totales:** membresías + POS − egresos, con neto positivo, cero y negativo; suma en centavos sin error de coma flotante.
- **Estados:** carga, error persistente, vacío válido y sesión no disponible; exportación deshabilitada fuera del estado válido.
- **Egresos:** el método elegido (`yape_plin` en la prueba) se guarda y los totales se refrescan.
- **CSV:** cabecera exacta de siete columnas, identificadores, fechas `dd/mm/yyyy`, BOM y escape de comas/comillas.
- **Modo local:** se identifica explícitamente; sin sesión no se presentan datos locales como reales.

**Verificado al 2026-11-16 (Dashboard, Fase 4):**
- **Build:** `npm run build` — exitoso; 2102 módulos transformados, sin errores.
- **Lint:** `npm run lint` — exit 0; cinco advertencias preexistentes en archivos ajenos a esta fase, ninguna en los archivos modificados.
- **Pruebas automatizadas:** `npm run test:dashboard` — exit 0; 24/24 (14 de lógica pura + 10 de render con cliente simulado).
- **Regresión de Finanzas:** `npm run test:finance` — exit 0; 27/27.
- **Regresión de Reportes:** `npm run test:reports` — exit 0; 16/16.
- **Fallback eliminado:** ninguna prueba ni render muestra `24.850 Bs.`; el valor ya no existe en el hook.
- **Carga:** el KPI y el flujo de caja muestran `—`; no se presentan ceros definitivos.
- **Error inicial y error posterior:** banner persistente, importes `—`, sin conservar cifras de una carga exitosa anterior.
- **Sin sesión:** aviso de sesión y cero consultas financieras.
- **Cero válido:** un período vacío se muestra como `0 Bs.`, sin banner de error.
- **Totales:** ingresos actual/anterior, egresos y neto correctos; los pagos no completados no suman.
- **Disponibilidad parcial:** un fallo de `profiles` deja los importes visibles y las altas/bajas en `—`.
- **Reintento:** tras corregir el fallo simulado, los datos se recuperan.
- **Preservación:** socios activos, membresías por vencer, reservas, clases, ranking, alertas y accesos directos siguen visibles; un usuario no administrador conserva “Ingresos del Turno” y no ejecuta consultas financieras.

**Pendiente de verificación:**
- **Reportes con datos reales:** que `ingresosTotal = ingresosPorMembresias + ingresosPOS` coincida con `useAdminFinance.currentIncome` para el mismo período (no validado contra producción).
- **Finanzas con datos reales:** comparar totales y movimientos con registros productivos para el mismo período.
- **Dashboard con datos reales:** comprobar que los ingresos y egresos del Dashboard coincidan con la pantalla de Finanzas para el mismo período y que el comportamiento con sesión/RLS sea correcto.
- **Acceso con sesión de personal:** validar cada rol y política RLS en ejecución, incluidas las tres fuentes de Finanzas y las consultas del Dashboard.
- **Funcionalidades por rol:** que no aparezcan funcionalidades exclusivas de cliente en paneles admin/recepción.
- **Exportación detallada de Finanzas:** implementada y probada en local; falta validarla con datos reales.
- **Validación integral con datos controlados:** pendiente para el resto del sistema.

---

## 14. Registro de avances

| Fecha | Fase | Avance | Archivos modificados |
|---|---|---|---|
| 2026-11-16 | FASE 4 | Cierre del Dashboard financiero: eliminación del fallback 24.850 Bs., estados de carga/error/sesión, períodos actual y anterior con paginación, cálculo en centavos, zona de Bolivia, disponibilidad parcial y preservación de indicadores no financieros. | `useAdminFinance.js`, `AdminDashboard.jsx`, `dashboardFinanceMetrics.js` |
| 2026-11-16 | FASE 7 | Pruebas del Dashboard: 14 casos de lógica pura y 10 de render con cliente simulado; regresión de Finanzas y Reportes. `test:dashboard`, build y lint verificados. | `admin-dashboard-finance-logic.test.mjs`, `admin-dashboard-finance-render.test.mjs`, `package.json` |
| 2026-11-16 | Documentación | Actualización del documento maestro con el cierre de Fase 4, estado de las siete fases y limitaciones verificadas. | `docs/PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md` |
| 2026-11-16 | FASE 3 | Cierre de Finanzas: paginación por fuente, fechas en servidor, cálculo en centavos, estados honestos, egresos con método, separación del modo local, movimientos identificados y CSV de siete columnas. | `financeMetrics.js`, `financePagination.js`, `financeService.js`, `AdminFinanceView.jsx`, `AdminFinanceReports.jsx` |
| 2026-11-16 | FASE 7 | Pruebas de Finanzas: 18 casos de lógica/paginación/CSV y 9 de renderizado; regresión de Reportes. `test:finance`, build y lint verificados. | `admin-finance-logic.test.mjs`, `admin-finance-render.test.mjs`, `package.json` |
| 2026-11-16 | Documentación | Actualización del documento maestro con el cierre de Fase 3, estado de las siete fases y limitaciones verificadas. | `docs/PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md` |
| 2026-11-16 | FASE 1 | Auditoría de Reportes cerrada: origen de datos, indicadores por persona, paginación y manejo explícito de errores. | `useAdminReports.js`, `AdminReports.jsx`, `adminReportMetrics.js` |
| 2026-11-16 | FASE 2 | Implementación del CSV de resumen de Reportes y del documento imprimible para guardar como PDF (sin gráficos ni tendencias). | `reportExport.js`, `AdminReports.jsx`, `csv.js` (reutilizado) |
| 2026-11-16 | FASE 7 | Pruebas automatizadas de Reportes: 16 casos de lógica/exportación y prueba de renderizado. `test:reports`, build y lint verificados. | `admin-reports-logic.test.mjs`, `admin-reports-render.test.mjs`, `package.json` |
| 2026-11-16 | Documentación | Actualización del documento maestro con el cierre de Reportes, estado de las siete fases y limitaciones verificadas. | `docs/PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md` |
| 2026-11-16 | FASE 5 | Implementación inicial: queries reales, sustitución seed, desglose contable, build/lint. | `useAdminReports.js`, `AdminReports.jsx` |
| 2026-11-16 | Reconocimiento | Diagnóstico completo, identificación de problemas, plan de fases. | Documento `PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md` (creación) |

**Nota de orden:** las filas se listan de la más reciente a la más antigua; las dos últimas corresponden al trabajo previo conservado como historial.

**Próxima fase programada:** Fase 5 — Separación y reorganización de paneles admin/recepción.

---

## 15. Limitaciones conocidas al 2026-11-16

- **Sin validación contra datos reales de producción:** las pruebas de Reportes, Finanzas y Dashboard se ejecutaron en el entorno local; no se compararon cifras con registros productivos.
- **Acceso dependiente de sesión de personal:** las consultas de Reportes, las tres fuentes de Finanzas y los indicadores financieros del Dashboard requieren una sesión con rol staff autorizado por las políticas RLS. Sin sesión, Finanzas y Dashboard muestran “Sesión no disponible”; no se validó el comportamiento con cada rol en ejecución.
- **Reservas no incluidas:** `bookings` solo permite a cada usuario leer sus propias reservas, por lo que Reportes no puede agregarlas sin presentar datos parciales; la sección se declara no disponible.
- **PDF sin gráficos:** el PDF implementado es un documento HTML imprimible desde el navegador. Incluye texto, tablas y tarjetas de resumen; no contiene gráficos, tendencias ni comparativos históricos.
- **Dos CSV distintos:** el CSV de Reportes resume ingresos, métodos y clientes del período. El CSV de Finanzas es el registro detallado de movimientos con siete columnas (Fecha, Tipo, Concepto, Categoría, Método de pago, Monto, Identificador); ambos están implementados y no deben confundirse.
- **Dashboard financiero resuelto, métricas no financieras pendientes:** la Fase 4 eliminó el fallback y conectó los importes a consultas reales, pero `sociosActivos`, `porVencer`, clases y ranking siguen dependiendo de `seedClients` y `weeklyClasses` en `useAdminDashboard.js`, que no se modificó.
- **Fallback de Finanzas eliminado:** `useAdminFinance.js` ya no contiene `MONTHLY_INCOME_FALLBACK`; el Dashboard muestra `—` cuando no hay datos válidos.
- **Dashboard — lectura adicional de pagos:** para conservar la fórmula de `churned` se añadió una lectura paginada de `payments` con `user_id`, porque `fetchFinanceRows` no incluye esa columna. Se evitó modificar `financeService.js`.
- **Dashboard — fórmulas heredadas:** `newMembers` cuenta todos los perfiles del mes (incluido staff) y `churned` considera renovado a cualquier usuario con un pago completado entre el mes anterior y el actual. Se conservaron sin reinterpretación.
- **Dashboard — sin asociación de pagos con planes/clientes:** el Dashboard no relaciona `payments` con `profiles` o `plans`; no se inventaron relaciones.
- **Sin unión de pagos con clientes/planes:** las consultas de Finanzas no relacionan `payments` con `profiles` o `plans`, por lo que el concepto de membresía y el cliente no se muestran; no se inventaron relaciones.
- **Duplicación manual entre fuentes:** no hay detección automática si el mismo cobro se registra manualmente en `payments` y `pos_sales` con identificadores distintos; la deduplicación solo actúa por fuente + ID.
- **Paginación dependiente de la configuración remota:** el recorrido de Finanzas y del Dashboard asume el límite por defecto de 1000 filas por consulta. Si el proyecto remoto tuviera un `max_rows` menor, una página corta podría detener la lectura antes de agotar la tabla.
- **Métodos de pago:** la limitación anterior sobre `payments` (cuatro métodos, sin `yape_plin`) quedó superada por la migración `admin_operations`, que amplió la restricción a los cinco métodos. El selector de Finanzas usa `qr`, `efectivo`, `transferencia`, `tarjeta` y `yape_plin`, y el esquema es la referencia.
- **Pruebas no integrales:** las pruebas automatizadas cubren lógica, exportación y render de Reportes, Finanzas y Dashboard; no sustituyen una validación funcional del resto del sistema ni una prueba con datos y sesiones reales.

---

## Hechos comprobados vs. Hipótesis vs. Información proporcionada

| Categoría | Contenido |
|---|---|
| **Hechos comprobados** | Build de Reportes (2097 módulos), de Finanzas (2101) y del Dashboard (2102) correctos; lint exit 0; `test:reports` 16/16, `test:finance` 27/27 y `test:dashboard` 24/24; Reportes usa consultas reales paginadas; total de clientes desde `profiles`; activos/vencidos por persona con prioridad a activos; estados de error y `null` implementados; CSV de resumen y PDF imprimible implementados; flujo de caja ficticio eliminado; reservas rotuladas como reservas; Finanzas pagina por fuente, filtra fechas en servidor, calcula en centavos, distingue estados, separa el modo local, registra el método del egreso y exporta un CSV de siete columnas; el Dashboard eliminó el fallback 24.850 Bs., consulta ambos períodos con paginación y zona de Bolivia, distingue carga/error/sesión y conserva los indicadores no financieros. |
| **Hipótesis todavía no verificadas** | Coherencia de cifras Dashboard↔Finanzas↔Reportes contra datos productivos; comportamiento con datos y sesiones reales de producción; distribución exacta de funcionalidades por rol tras inventario completo; validación funcional de todas las rutas y acciones por rol; comportamiento del Dashboard con RLS real. |
| **Información proporcionada por el usuario** | Plan de 7 fases con entregables específicos; documento Markdown como canal de seguimiento; datos de prueba propuestos (1.320 + 150 Bs); identificaciones específicas de funcionalidades cliente en paneles equivocados. |
| **Propuestas técnicas** | Reutilizar `frontend-web/src/lib/csv.js` para exportaciones CSV y el diálogo de impresión para PDF (decisión aplicada); fixtures controlados fuera de producción; alinear fórmulas `ingresosComerciales = ingresosPorMembresias + ingresosPOS` en los 3 módulos; en Finanzas, aplicar el rango en Supabase, sumar en centavos y separar la vista presentacional del acceso a datos (decisiones aplicadas en Fase 3); en el Dashboard, reutilizar la lógica de Finanzas, eliminar el fallback y separar la disponibilidad financiera de la de personas (decisiones aplicadas en Fase 4).

---

## 5. Cierre del Lote 5A — Separación POS/catálogo y navegación (2026-11-17)

**Estado:** Cerrado tras implementación y validación automatizada.

**Matriz final de permisos por rol** (secciones visibles en la navegación principal):

| Sección | Admin | Recepción | Entrenador |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Control de Asistencia | ✅ | ✅ | ✅ |
| Gestión de Clientes | ✅ | ✅ | ❌ |
| Caja / POS operativo | ✅ | ✅ | ❌ |
| POS / Catálogo de Productos | ✅ | ❌ | ❌ |
| Reportes | ✅ | ❌ | ❌ |
| Finanzas | ✅ | ❌ | ❌ |
| Gestión de Planes | ✅ | ❌ | ❌ |
| Staff | ✅ | ❌ | ❌ |
| Configuración | ❌ (retirada) | ❌ (retirada) | ❌ (retirada) |

**Separación POS operativo y catálogo de productos** (Decisión aplicada):

- **Admin:** acceso tanto al POS operativo (tab `cash` → `CashRegister`) como al catálogo de productos (tab `products` → `PosProductsManagement` para agregar/editar/borrar productos).
- **Recepción:** acceso al POS operativo para registrar ventas (`CashRegister` vía `tab === 'cash' && !isTrainer`). **Sin** acceso al catálogo administrativo de productos (`PosProductsManagement` fuera de la navegación; la matriz `products` en `buildPanelSections` tiene `adminOnly: true`, `receptionOnly: false`).
- **Entrenador:** sin acceso al POS ni al catálogo. La navegación muestra solo Dashboard y Asistencia.

**Corrección de la navegación y del fallback de pestañas** (Decisiones D-01, D-02 y D-03):

- **D-01 (Aprobado):** El administrador dispone de Control de Asistencia y Gestión de Clientes, además de sus funciones administrativas. La matriz `buildPanelSections` incluye `attendance` y `clients` para admin.
- **D-02 (Aprobado):** Recepción conserva el acceso al historial de pagos; el LTV sigue siendo exclusivo del administrador. La navegación de recepción muestra sus funcionalidades actuales sin el catálogo de productos.
- **D-03 (Aprobado):** La pestaña Configuración se retira temporalmente de la navegación, sin borrar el módulo `GymSettings.jsx` ni la tabla `gym_settings`.

**Correcciones técnicas aplicadas:**

1. **Matriz centralizada:** Se creó `frontend-web/src/lib/panelSections.js` con la función `buildPanelSections({ isAdmin, isTrainer })` que devuelve la lista visible de secciones por rol. Ya no hay condicionales dispersos en `AdminPanel.jsx`.

2. **Restablecer pestaña al cambiar de rol:** Se añadió un `useEffect` en `AdminPanel.jsx` que observa `isAdmin` e `isTrainer` y restablece la pestaña a `Dashboard` cuando cambia la combinación de roles, evitando estados inconsistentes.

3. **Eliminar fallback inseguro:** Se removed the unsafe fallback that rendered `ClientsManagement` when the tab was unknown or unauthorized. El renderizado es ahora explícito: `tab === 'X' ? <Componente /> : null`. Cualquier tab no reconocido renderiza `null`.

4. **Navbar:** Se corrigieron las etiquetas: el entrenador ahora muestra "Panel Entrenador" en lugar de "Panel Recepción" (`Navbar.jsx`).

**Pruebas finales verificadas:**

- `npm run test:panel` (nueva suite): **6/6** passing — valida la matriz de permisos, títulos, separación POS/catálogo y configuración retirada.
- `npm run test:dashboard`: **24/24** passing — sin regressions.
- `npm run test:finance`: **27/27** passing — sin regressions.
- `npm run test:reports`: **16/16** passing — sin regressions.
- `node scripts/gym-roles.test.mjs`: **10/10** passing — roles y acceso intactos.

**Build y lint:**

- `npm run build`: correcto (2103+ módulos transformados).
- `npm run lint`: exit 0 — advertencias preexistentes en archivos ajenos al Lote 5A (sin errores nuevos).

**Limitaciones pendientes:**

- **Pruebas E2E del ciclo de vida:** No existen pruebas automatizadas que simulen abrir/cerrar el panel y cambiar de rol mientras está abierto. La validación de `setTab('dashboard')` al cambiar de rol está confirmida inspección de código y pruebas unitarias de la matriz, pero no cubre un escenario E2E completo.
- **Validación de pestañas desconocidas/no autorizadas:** Se verifica mediante inspección de strings en `AdminPanel.jsx` que el render usa bloques explícitos `tab === 'X' ? <Componente /> : null` y no hay fallback a `ClientsManagement`. Las pruebas unitarias del string check están en `admin-panel-sections.test.mjs`.
- Sin validación funcional contra Supabase/RLS en este cierre de Lote.
- Sin modificaciones al código fuente, pruebas, configuración, migraciones ni Supabase; sin cambios de rama, commits, merges ni push; se preservaron todos los cambios locales anteriores.

**Historial:** El Lote 5A se suma al historial de cierres de fases (Fase 1 Reportes cerrado, Fase 3 Finanzas cerrado, Fase 4 Dashboard financiero cerrado). Documento maestro actualizado con el cierre de Lote 5A, archivos, evidencia y limitaciones.

**Restricciones cumplidas en esta actualización:** Solo se modificó el documento `docs/PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md`. No se modificó código fuente, pruebas, configuración, migraciones ni Supabase; no se cambiaron ramas ni se ejecutaron reset, clean, commit, merge o push; se preservaron todos los cambios locales anteriores.

---

**Archivo creado y actualizado el 2026-11-17:** `docs/PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md`

---

**Archivo creado en el reconocimiento y actualizado el 2026-11-16:** `docs/PLAN_MEJORA_PANEL_ADMIN_RECEPCION.md`

**Resumen:** Documento de 15 secciones que recopila el reconocimiento técnico y funcional del proyecto IronForge Gym, el cierre verificado de los módulos de Reportes, Finanzas y el Dashboard financiero, el estado de las siete fases, las limitaciones conocidas, los problemas pendientes, las decisiones confirmadas, la estrategia de datos de prueba y el historial de avances. Es el documento central de seguimiento del trabajo.

**Restricciones cumplidas en esta actualización:** Solo se modificó el archivo Markdown indicado. No se modificó código fuente, pruebas, configuración, migraciones ni Supabase; no se cambiaron ramas ni se ejecutaron reset, clean, commit, merge o push; se preservaron todos los cambios locales.