# Diagnóstico técnico-funcional del Panel Administrativo

**Proyecto:** IronForge Gym — `frontend-web` + Supabase
**Rama / commit analizado:** `main` / `e49d17d` (2026-11-08)
**Fecha del diagnóstico:** 2026-11-16
**Naturaleza:** auditoría de **solo lectura**. No se modificó código fuente, no se borraron archivos, no se ejecutaron migraciones, no se escribió en Supabase, no se desplegaron Edge Functions y no se alteraron cuentas ni roles.

---

## 0. Cómo leer este documento

### 0.1 Estados usados

| Estado | Significado |
|---|---|
| **FUNCIONAL VERIFICADA** | El flujo completo (UI → componente → hook/servicio → backend → tabla) fue ejercitado con datos reales o con pruebas que ejecutan ese camino. |
| **IMPLEMENTADA NO VERIFICADA** | El código y el backend existen, son coherentes entre sí y no se encontró un defecto lógico, pero **no se ejecutó contra Supabase** en esta auditoría. |
| **PARCIAL** | Cubre solo una parte del flujo esperado; falta persistencia, filtrado, detalle o una operación clave. |
| **SIMULADA** | La interfaz muestra datos semilla o cálculos locales; no consulta ni escribe la fuente real. |
| **SIN IMPLEMENTAR** | No existe el flujo, solo el botón, la pestaña o el texto. |
| **CON PROBLEMAS** | Está implementada, pero tiene un defecto comprobado o inferido con alta confianza que altera el resultado. |

### 0.2 Regla de evidencia

Cada afirmación cita archivo y línea. Cuando la comprobación es estática (lectura de código, políticas RLS, RPC) se indica **inferido**; cuando se ejecutó una prueba local se indica **verificado localmente**. Ninguna conclusión de este documento depende de suponer que un botón existe.

### 0.3 Advertencia crítica sobre el acceso (P-01)

El árbol de código actual **no permite abrir el panel** con un usuario real de Supabase, por cómo se construye `currentUser.role` en `frontend-web/src/App.jsx:82` y por cómo lo evalúan `adminAccess.js` y `receptionAccess.js`. La comprobación local (Anexo A) devuelve `false` para admin y recepción.

Sin embargo, el usuario indica que el acceso con las cuentas administrativas ya fue verificado. Esa contradicción admite dos explicaciones y **debe resolverse antes de tocar código**:

1. El bundle desplegado no corresponde a este árbol (`main` / `e49d17d`), o
2. El acceso se obtuvo por una vía distinta de la que analiza este documento.

Por eso P-01 se registra como **bloqueante pendiente de confirmación en runtime**, no como un cambio a aplicar a ciegas.

> **Actualización (Fase 0, 2026-11-16):** la verificación posterior confirmó P-01 y P-02 en `main` (`e49d17d`) y encontró que ya existe una corrección en la rama `agregado-cuentas-admin-recepcion` (commit `b674e52`). Ver “Verificación posterior del estado de roles”.

---

## 1. Resumen ejecutivo

El Panel Administrativo tiene **nueve apartados** (Dashboard, Caja, Auditoría de Caja, Personal, Configuración, Productos POS, Finanzas, Reportes y Planes) y una base de datos notablemente más madura que la interfaz: las RPC de renovación, venta POS, congelamiento y cierre de caja son atómicas y están bien delimitadas; las políticas RLS separan en general admin, recepción y entrenador; y el esquema financiero (`payments`, `pos_sales`, `operating_expenses`) es real.

El problema principal no es la falta de backend, sino la **desconexión entre la UI y ese backend**:

- **Dashboard y Reportes son, en su mayoría, datos semilla.** `useAdminDashboard` ignora el resultado de sus consultas y `useAdminReports` consulta tablas inexistentes (`pagos`, `asistencia`). El Dashboard muestra **24.850 Bs.** como ingreso del mes aunque no haya ni un pago.
- **El control de acceso del frontend está roto con la forma real del usuario de Supabase**, porque `role: 'authenticated'` gana sobre `app_metadata.gym_role`. Además `staffRole` recibe `'authenticated'`, por lo que el rol entrenador nunca se reconoce.
- **Caja y POS funcionan sobre tablas reales, pero la lectura es incompleta**: no hay detalle de ventas/gastos por turno, el "Responsable" muestra un UUID y los totales del turno pueden mezclar operaciones de otros cajeros.
- **Planes y Configuración se guardan, pero casi no se consumen**: los planes nuevos no se pueden usar al renovar (lista hardcodeada), la landing pública sigue mostrando los planes semilla y `gym_settings` no alimenta ningún otro módulo.
- **Personal tiene un problema de seguridad real**: desactivar a un empleado cambia el JWT futuro, pero no invalida el token vigente ni consulta `staff_accounts.activo` en RLS.

Lo que **funciona y debe conservarse**: autenticación real sin bypass demo, RLS del lado servidor basada en `current_gym_role()`, RPC transaccionales (`procesar_pago_exitoso`, `register_pos_sale`, `open_cash_register`, `close_cash_register`, `freeze_membership`), historial de cajas, exportación CSV de finanzas, registro de egresos y el flujo de personal vía Edge Function con service role.

### 1.1 Veredicto por apartado

| Apartado | Veredicto | Motivo |
|---|---|---|
| Dashboard | **PARCIAL / SIMULADO** | KPIs de socios e ingresos son semilla; "Clases de hoy" siempre vacío. |
| Caja | **CON PROBLEMAS** | Apertura/cierre reales por RPC, pero totales del turno mal filtrados y sin detalle. |
| Auditoría de Caja | **PARCIAL** | Solo lectura de sesiones y totales; no hay detalle ni acciones de supervisión. |
| Personal | **CON PROBLEMAS** | Alta/edición/baja funcionan vía Edge, pero desactivación no corta el JWT vigente y el alta no es atómica. |
| Configuración | **CON PROBLEMAS** | El `upsert` probablemente falla por falta de política INSERT; además nadie consume la configuración. |
| Productos POS | **PARCIAL** | CRUD real y stock descontado por RPC; sin alertas de stock mínimo, movimientos ni compras. |
| Finanzas | **PARCIAL** | Datos reales y CSV, pero sin paginación, COGS, impuestos, cuentas por cobrar ni desglose por método/categoría. |
| Reportes | **SIMULADO** | Todo el contenido sale de semillas; el "refresco" apunta a tablas inexistentes. |
| Planes | **PARCIAL** | CRUD real sobre `plans`, pero los planes nuevos no se usan al renovar y la landing no los refleja sin sesión. |

### 1.2 Qué corregir primero

1. Confirmar en runtime P-01 y P-02 (acceso admin/recepción/entrenador).
2. Quitar los datos semilla de Dashboard y Reportes (P-03 a P-07).
3. Corregir la lectura de Caja (P-08) y la política de configuración (P-19).
4. Conectar Planes con renovaciones (P-21).
5. Endurecer Personal y perfiles (P-16, P-24, P-25).

---

## 2. Arquitectura y archivos

### 2.1 Capas reales del panel

```
Navbar (gate visual)
  └── App.jsx  currentUser = { id, email, role, app_metadata, ...profile }
        ├── isAdminUser(currentUser)  → lib/adminAccess.js
        ├── isReceptionUser(currentUser) → lib/receptionAccess.js
        └── <AdminPanel isAdminUser staffRole ... />
              ├── components/admin/AdminPanel.jsx  (pestañas + gating)
              ├── hooks/useAdminDashboard.js       (KPIs del Dashboard)
              ├── hooks/useAdminFinance.js         (ingresos/egresos del mes)
              ├── hooks/useAdminReports.js         (Reportes)
              ├── hooks/useAdminClients.js         (socios/asistencia; también recepción)
              └── hooks/useReceptionCommerce.js    (caja, POS, gastos, productos)
                    ├── supabase.rpc('register_pos_sale')
                    ├── supabase.rpc('open_cash_register')
                    ├── supabase.rpc('close_cash_register')
                    └── supabase.from('cash_register_sessions' | 'pos_products' | ...)
```

### 2.2 Archivos clave

| Archivo | Rol | Observación |
|---|---|---|
| `frontend-web/src/components/admin/AdminPanel.jsx` | Contenedor de las 9 pestañas y del gating | `isAdmin` y `isTrainer` en `:67-68`; pestañas en `:147-269`. |
| `frontend-web/src/components/admin/AdminDashboard.jsx` | Dashboard | Usa `useAdminDashboard` y `useAdminFinance` en paralelo (`:145-154`). |
| `frontend-web/src/components/admin/CashRegister.jsx` | Caja y Auditoría | `CashRegister` y `CashAudit` en el mismo archivo. |
| `frontend-web/src/components/admin/StaffManagement.jsx` | Personal | Invoca `manage-staff`; fallback a `localStorage`. |
| `frontend-web/src/components/admin/GymSettings.jsx` | Configuración | `upsert` sobre `gym_settings` (`:47`). |
| `frontend-web/src/components/admin/PosProductsManagement.jsx` | Catálogo POS | CRUD; `stock_minimo` solo se muestra. |
| `frontend-web/src/components/admin/AdminFinanceReports.jsx` | Finanzas | Consultas reales + CSV. |
| `frontend-web/src/components/admin/AdminReports.jsx` | Reportes | Consume `useAdminReports` (semillas). |
| `frontend-web/src/components/admin/PlanManagement.jsx` | Planes | Usa `PlansContext.savePlan`. |
| `frontend-web/src/components/admin/ReceptionTransactions.jsx` | POS y gasto (modales) | `PosModal` y `ExpenseModal`. |
| `frontend-web/src/context/PlansContext.jsx` | Fuente de planes | `upsert` por `codigo`; carga remota solo con sesión. |
| `frontend-web/src/lib/adminAccess.js` | Rol admin | `ADMIN_PASSWORD = '123456'` residual (`:5`). |
| `frontend-web/src/lib/receptionAccess.js` | Rol recepción/entrenador | Misma precedencia de `role`. |
| `supabase/functions/manage-staff/index.ts` | Alta/edición/baja de personal | Service role; no atómico. |
| `supabase/migrations/20261006000007_admin_operations.sql` | Caja, asistencia, staff, settings, planes, RLS | Núcleo del panel. |
| `supabase/migrations/20261005000006_reception_pos.sql` | POS, ventas, gastos | RPC de venta original. |

### 2.3 Tablas y RPC implicadas

| Objeto | Tipo | Uso en el panel |
|---|---|---|
| `profiles` | tabla | Socios, plan actual, foto. |
| `memberships` | tabla | Vigencia y congelamiento. |
| `payments` | tabla | Ingresos por membresías. |
| `pos_products` | tabla | Catálogo. |
| `pos_sales` / `pos_sale_items` | tablas | Ventas y detalle. |
| `operating_expenses` | tabla | Egresos. |
| `cash_register_sessions` | tabla | Turnos de caja. |
| `staff_accounts` | tabla | Personal no admin. |
| `gym_settings` | tabla singleton | Configuración global. |
| `plans` | tabla | Catálogo de planes. |
| `gym_attendance` | tabla | Asistencias (pestaña de recepción). |
| `procesar_pago_exitoso` | RPC | Renovación atómica. |
| `register_pos_sale` | RPC | Venta atómica con stock. |
| `open_cash_register` / `close_cash_register` | RPC | Apertura/cierre de caja. |
| `freeze_membership` | RPC | Congelamiento. |
| `current_gym_role` | función | Base de todas las políticas RLS. |

### 2.4 Modos de ejecución

Cada hook decide entre **Supabase** y **modo local** (`localStorage` + semillas):

- Con Supabase configurado y sesión activa: consultas reales (con excepciones: Dashboard y Reportes).
- Sin Supabase o sin sesión: datos semilla y `localStorage`.

Ese doble modo es útil para demo, pero es la causa de que varias pantallas **parezcan funcionar** sin estarlo: los datos semilla tienen la misma forma que los reales.

### 2.5 Gating de la interfaz

`AdminPanel` recibe `isAdminUser` y `staffRole` desde `App.jsx:492-493`. El panel decide:

- `isAdmin = isAdminUser` (`:67`).
- `isTrainer = staffRole === 'trainer' && !isAdmin` (`:68`).
- Pestañas de recepción (Asistencia, Socios, Caja) solo si `!isAdmin`; pestañas administrativas solo si `isAdmin` (`:157-269`).
- Renderizado defensivo adicional por pestaña (`:322-335`).

Ocultar pestañas **no es la única autorización** en la mayoría de módulos: las políticas RLS y las RPC validan `current_gym_role()` en el servidor. Las excepciones se detallan en la sección 6.

---

## 3. Análisis de los nueve apartados

### 3.1 Dashboard

**Flujo:** `AdminPanel` → `AdminDashboard` → `useAdminDashboard` + `useAdminFinance` → `memberships`, `bookings`, `payments`, `pos_sales`, `operating_expenses`, `profiles` (estas dos últimas solo en Finanzas).

**Qué se verificó leyendo el código**

- `useAdminDashboard` construye los KPIs con `seedClients` y `SEED_INCOME = 24850` (`useAdminDashboard.js:11,57-83`).
- `refresh()` consulta `memberships` y `bookings`, pero **descarta el resultado** (`:86-98`); no hay `setState`.
- `filterByDate` exige `c.date || c.fecha` (`:42-47`) y `weeklyClasses` no tiene esa propiedad (`data/gymData.js:218-220`), por lo que "Clases de hoy" siempre es `[]` y "Reservas del día" siempre `0`.
- `AdminDashboard.jsx:254` muestra `financeAvailable ? currentIncome : ingresosMes`; como `financeAvailable` inicia en `false` (`useAdminFinance.js:33`), se muestra **24.850 Bs.** hasta que Finanzas responde.
- Las alertas de cumpleaños sí usan `clients` reales (`AdminDashboard.jsx:170-178`), pero `clients` depende de `useAdminClients`, que a su vez cae a semillas si falla.
- Hay **doble fuente de ingresos**: `useAdminDashboard` (semilla) y `useAdminFinance` (real) en la misma pantalla.

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Socios activos y por vencer | SIMULADA | `useAdminDashboard.js:59-65` sobre `seedClients` | No refleja `profiles`/`memberships` | Calcular desde `memberships` + `profiles` o reutilizar `useAdminClients`. |
| Ingreso del mes | SIMULADA | `SEED_INCOME` en `useAdminDashboard.js:11,67,78` | Cifra ficticia mostrada como real | Eliminar el fallback o etiquetarlo como demo; usar `useAdminFinance`. |
| Clases de hoy | CON PROBLEMAS | `filterByDate` `:42-47`; `weeklyClasses` sin `date` en `gymData.js:218` | Siempre vacío | Leer `classes` por `fecha = today`. |
| Reservas del día | CON PROBLEMAS | `:70-72` | Siempre 0 por la misma causa | Sumar `classes.reservas_count` de hoy. |
| Ranking de clases | SIMULADA | `buildClassRanking(ALL_LOCAL_CLASSES)` `:71` | Estático | Calcular desde `bookings` confirmadas. |
| Alertas de cumpleaños | PARCIAL | `AdminDashboard.jsx:170-178` | Depende de `clients`, que puede ser semilla | Mantener, pero con datos reales garantizados. |
| Accesos directos (socio, POS, gasto) | FUNCIONAL VERIFICADA | `AdminDashboard.jsx:206-216`; `AdminPanel.jsx:284-303` | — | Conservar. |
| Refresco de métricas | CON PROBLEMAS | `useAdminDashboard.js:86-98` | No actualiza estado | Implementar `setState` o eliminar el botón. |

### 3.2 Caja

**Flujo:** `AdminPanel` → `CashRegister` → `useReceptionCommerce` → `open_cash_register` / `close_cash_register` → `cash_register_sessions`, `pos_sales`, `payments`, `operating_expenses`.

**Qué se verificó leyendo el código**

- Apertura y cierre usan RPC `security definer` con validación de rol (`admin_operations.sql:349-429`).
- El cierre calcula `efectivo_esperado` con ventas POS en efectivo, pagos de membresía en efectivo y gastos en efectivo del **mismo usuario** (`:396-417`).
- Solo permite cerrar la sesión propia (`:387-391`), lo que impide que un admin cierre el turno de un recepcionista.
- La UI calcula los totales del turno filtrando **solo por hora de inicio**, sin `cashier_id` (`CashRegister.jsx:43-56`), así que puede sumar ventas/gastos de otros cajeros.
- Hay un índice único de una caja abierta por `staff_id` (`admin_operations.sql:178-179`), correcto.
- La política de `UPDATE` permite escribir directamente `efectivo_esperado`, `diferencia` y `cierre` sin pasar por la RPC (`:232-243`). La UI no lo hace, pero el API sí lo permite.

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Abrir caja | IMPLEMENTADA NO VERIFICADA | `CashRegister.jsx:14-26`; RPC `:349-369` | — | Probar con un turno real. |
| Cerrar caja y calcular diferencia | IMPLEMENTADA NO VERIFICADA | `CashRegister.jsx:28-41`; RPC `:371-429` | Solo cierra el turno propio | Añadir cierre administrativo explícito (RPC aparte) si el negocio lo requiere. |
| Totales del turno | CON PROBLEMAS | `CashRegister.jsx:43-56` | Suma ventas/gastos de otros cajeros desde `sessionStart` | Filtrar por `cashier_id`/`created_by`. |
| Historial de turnos | PARCIAL | `CashRegister.jsx:149-153`; `CashAudit` `:156-205` | Solo totales; sin detalle | Ver 3.3. |
| Nombre del responsable | CON PROBLEMAS | `useReceptionCommerce.js:64-71,120` | Personal sin fila en `profiles` → muestra UUID | Ver P-12. |
| Una caja abierta por persona | IMPLEMENTADA NO VERIFICADA | Índice `uq_cash_register_open_by_staff` `:178` | — | Conservar. |

### 3.3 Auditoría de Caja

**Flujo:** `AdminPanel` → `CashAudit` → `cashSessions` de `useReceptionCommerce` → `cash_register_sessions` (y nombres vía `profiles`).

**Qué se verificó leyendo el código**

- `CashAudit` es **solo lectura**: recibe `sessions` y pinta apertura, cierre, esperado, declarado y diferencia (`CashRegister.jsx:156-205`).
- No hay detalle de ventas ni gastos por sesión, ni filtros por fecha/cajero, ni exportación, ni acción de supervisión.
- El backend impide modificar una sesión ya cerrada mediante la política `cierre is null`, pero **permite** que el dueño del turno altere los totales mientras está abierto (`admin_operations.sql:232-243`). Eso debilita la auditoría: el `efectivo_esperado` puede escribirse a mano antes de cerrar.
- La RPC sí es la vía correcta y recalcula todo; el problema es que la política no obliga a usarla.

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Listado de turnos con diferencias | PARCIAL | `CashRegister.jsx:178-197` | Sin detalle ni filtros | Añadir detalle por sesión y filtros. |
| Integridad del cierre | CON PROBLEMAS | Política `:232-243` vs RPC `:419-426` | Se puede escribir el cierre directo | Restringir `UPDATE` a columnas no sensibles o revocar y usar solo RPC. |
| Supervisión administrativa | SIN IMPLEMENTAR | `AdminPanel.jsx:322-323` | Solo lectura | Definir si el admin debe poder cerrar turnos ajenos. |
| Exportación de auditoría | SIN IMPLEMENTAR | No hay `downloadCsv` en `CashRegister.jsx` | — | Bajo costo: reutilizar `lib/csv.js`. |

### 3.4 Personal

**Flujo:** `AdminPanel` → `StaffManagement` → `supabase.functions.invoke('manage-staff')` → Edge Function con service role → `auth.users` + `staff_accounts`.

**Qué se verificó leyendo el código**

- El alta crea el usuario en Auth y luego hace `upsert` en `staff_accounts` (`manage-staff/index.ts:79-121`). Si el segundo paso falla, queda un usuario huérfano en Auth.
- La baja cambia `app_metadata.gym_role` a `'disabled'` y marca `activo: false` (`:90-109`).
- `current_gym_role()` lee **solo el JWT** (`admin_operations.sql:4-19`); ninguna política consulta `staff_accounts.activo`. Por tanto, un empleado desactivado conserva permisos hasta que su token expire o se refresque.
- La edición no permite cambiar contraseña: el body envía `password`, pero la Edge Function no lo usa en `update` (`index.ts:90-99`).
- Editar un empleado inactivo vuelve a poner `activo: true` por el `upsert` (`:112-120`); es una reactivación implícita, no un botón.
- El listado usa `staff_accounts` y cae a `localStorage` si no hay sesión (`StaffManagement.jsx:15-27`).

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Crear recepcionista/entrenador | IMPLEMENTADA NO VERIFICADA | `StaffManagement.jsx:63-75`; `index.ts:79-88` | Alta no atómica | Compensar el alta si falla el `upsert` o mover todo a una transacción/RPC. |
| Editar nombre, correo y rol | IMPLEMENTADA NO VERIFICADA | `StaffManagement.jsx:64-73`; `index.ts:90-99` | No cambia contraseña | Añadir acción `password` separada. |
| Desactivar | CON PROBLEMAS | `index.ts:90-109`; `current_gym_role` `:4-19` | El JWT vigente sigue autorizando | Invalidar sesiones o validar `staff_accounts.activo` en RLS. |
| Reactivar | PARCIAL | `upsert` con `activo: true` `:112-120` | No hay botón explícito | Añadir acción y confirmación. |
| Roles permitidos | FUNCIONAL VERIFICADA | `staff_accounts.rol` check; `index.ts:63` | — | Conservar la restricción a `reception`/`trainer`. |

### 3.5 Configuración

**Flujo:** `AdminPanel` → `GymSettings` → `supabase.from('gym_settings').upsert(...)` → `gym_settings`.

**Qué se verificó leyendo el código**

- `GymSettings` carga la fila `id = true` y guarda con `upsert` (`GymSettings.jsx:26,47`).
- La tabla tiene una sola fila sembrada (`admin_operations.sql:192-202`).
- Políticas: `SELECT` para staff y `UPDATE` solo admin (`:250-258`). **No existe política `INSERT`.**
- PostgREST implementa `upsert` como `INSERT ... ON CONFLICT DO UPDATE`; PostgreSQL evalúa la política de `INSERT` sobre la fila propuesta. Sin política `INSERT`, el guardado debe fallar con error de RLS aunque la fila exista. **Inferido, pendiente de prueba remota.**
- No hay trigger que actualice `updated_at` (`:200`), así que la marca temporal no cambia.
- Búsqueda global: `gym_settings` solo aparece en `GymSettings.jsx` y en la migración; **ningún otro módulo consume** el nombre, teléfono, horario ni términos.

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Cargar configuración | IMPLEMENTADA NO VERIFICADA | `GymSettings.jsx:26-28`; política `:250-253` | — | Conservar. |
| Guardar configuración | CON PROBLEMAS | `GymSettings.jsx:47`; falta política INSERT `:250-258` | Probable error RLS en cada guardado | Añadir política `INSERT` admin o usar `.update().eq('id', true)`. |
| `updated_at` | CON PROBLEMAS | `admin_operations.sql:200`; sin trigger | Nunca se actualiza | Trigger `set_updated_at` o set explícito. |
| Uso de la configuración | SIN IMPLEMENTAR | Sin consumidores en `src/` | Los cambios no tienen efecto | Definir qué módulos deben leerla (landing, comprobantes, términos). |

### 3.6 Productos POS

**Flujo:** `AdminPanel` → `PosProductsManagement` → `useReceptionCommerce.saveProduct/deleteProduct` → `pos_products`.

**Qué se verificó leyendo el código**

- CRUD real: insert/update (`useReceptionCommerce.js:155-172`), borrado bloqueado si hay ventas (`:192-205`), activación/desactivación.
- `stock` se descuenta dentro de `register_pos_sale` con bloqueo `for update` y validación de stock agregado por producto (`admin_operations.sql:501-544`).
- `stock_minimo` se guarda y se muestra (`PosProductsManagement.jsx:90`), pero **ningún código lo compara** con el stock real. Búsqueda global: solo aparece en el formulario y en el mapeo.
- No hay movimientos de inventario, compras, proveedores ni costo de venta (COGS); `costo_compra` se guarda pero no se usa en reportes.
- Error menor: el estado vacío usa `colSpan={7}` (`:135`) y la tabla tiene 6 columnas.

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Listar productos | FUNCIONAL VERIFICADA | `useReceptionCommerce.js:79`; `PosProductsManagement.jsx:90` | — | Conservar. |
| Crear/editar producto | IMPLEMENTADA NO VERIFICADA | `useReceptionCommerce.js:155-172` | — | Probar con catálogo real. |
| Eliminar producto con ventas | IMPLEMENTADA NO VERIFICADA | `:197-205` | — | Conservar el bloqueo. |
| Stock mínimo / alertas | PARCIAL | `PosProductsManagement.jsx:90,192`; sin consumidor | No alerta | Calcular `stock <= stock_minimo` en el Dashboard o en el catálogo. |
| Movimientos e historial de stock | SIN IMPLEMENTAR | Sin tabla ni hook | No hay trazabilidad | Diseñar `stock_movements` si el negocio lo necesita. |
| Costo de venta (COGS) | SIN IMPLEMENTAR | `costo_compra` sin uso | Margen desconocido | Cruzar `pos_sale_items` con `costo_compra`. |
| Estado vacío | CON PROBLEMAS | `PosProductsManagement.jsx:135` | `colSpan` incorrecto | Cambiar a 6. |

### 3.7 Finanzas

**Flujo:** `AdminPanel` → `AdminFinanceReports` → consultas directas a `payments`, `pos_sales`, `operating_expenses` → tablas; egresos por `insert`.

**Qué se verificó leyendo el código**

- Consultas reales con `limit(5000)` y sin paginación (`AdminFinanceReports.jsx:44,47,50`).
- Ingresos = pagos completados + ventas POS; egresos = `operating_expenses` (`:54-64`).
- Filtro por rango de fechas y exportación CSV con `lib/csv.js` (`:132-137`).
- Registro de egresos reales (`:108-111`); `created_by` tiene `default auth.uid()` (`reception_pos.sql:42`), así que la política de inserción se cumple.
- No hay `UPDATE`/`DELETE` de egresos: un monto mal cargado no se puede corregir desde la UI ni por API.
- No hay desglose agregado por método de pago ni por categoría; solo filas y totales.
- No hay COGS, impuestos, cuentas por cobrar ni conciliación con `cash_register_sessions`.

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Ingresos y egresos del período | FUNCIONAL VERIFICADA (lógica) | `AdminFinanceReports.jsx:36-64` | — | Conservar. |
| Registrar egreso | IMPLEMENTADA NO VERIFICADA | `:96-130`; RLS `:341-347` | Sin edición/borrado | Añadir corrección con auditoría. |
| Exportar CSV | FUNCIONAL VERIFICADA | `:132-137`; `lib/csv.js` | — | Conservar. |
| Paginación | SIN IMPLEMENTAR | `limit(5000)` `:44,47,50` | Corte silencioso a 5.000 filas | Paginar o agrupar en el servidor. |
| Desglose por método/categoría | PARCIAL | Solo filas `:201-227` | Sin agregados | Añadir tarjetas/tabla resumen. |
| COGS e impuestos | SIN IMPLEMENTAR | `costo_compra` no se usa | Resultado no fiel | Fase posterior. |
| Conciliación con caja | SIN IMPLEMENTAR | No hay cruce con sesiones | Descuadres invisibles | Reporte de conciliación por turno. |

### 3.8 Reportes

**Flujo:** `AdminPanel` → `AdminReports` → `useAdminReports` → datos semilla + intento de `pagos`/`asistencia`.

**Qué se verificó leyendo el código**

- `useAdminReports` devuelve `SEED_PAYMENTS`, `seedClients` y un ranking de `weeklyClasses` (`useAdminReports.js:30-102`).
- `refresh()` consulta `supabase.from('pagos')` y `supabase.from('asistencia')` (`:107-108`). **Esas tablas no existen**; las reales son `payments` y `gym_attendance`. Además el resultado se ignora.
- El filtro de período solo se aplica a `payments` (`AdminReports.jsx:95-98`); el ranking de clases no cambia al cambiar de rango (`:114,222`).
- No hay exportación en Reportes, aunque `lib/csv.js` ya existe.
- `refresh().then(() => setRefreshing(false))` no refleja ningún cambio porque el hook no actualiza estado (`AdminReports.jsx:89-93`).

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Ingresos por método | SIMULADA | `SEED_PAYMENTS` `:30-102` | No usa `payments` | Reescribir el hook sobre `payments` reales. |
| Ranking de clases | SIMULADA | `weeklyClasses` `:80-88` | No usa `bookings` | Calcular desde `bookings` por rango. |
| Estado de socios | SIMULADA | `seedClients` `:91-100` | No usa `profiles`/`memberships` | Reutilizar `useAdminClients` o una RPC de agregados. |
| Filtro por período | PARCIAL | `AdminReports.jsx:95-98` | No afecta al ranking | Aplicar el rango a todas las secciones. |
| Exportar reporte | SIN IMPLEMENTAR | Sin `downloadCsv` en el componente | — | Añadir con el helper existente. |
| Refresco | CON PROBLEMAS | `useAdminReports.js:104-110` | Tablas inexistentes y resultado ignorado | Corregir nombres y estado. |

### 3.9 Planes

**Flujo:** `AdminPanel` → `PlanManagement` → `PlansContext.savePlan/togglePlan` → `plans` (upsert por `codigo`); consumo en landing, registro y renovación.

**Qué se verificó leyendo el código**

- `savePlan` hace `upsert` sobre `plans` con `onConflict: 'codigo'` (`PlansContext.jsx:74-90`); la política `"Admin gestiona planes"` permite `ALL` a admin (`admin_operations.sql:277-281`).
- Un plan nuevo recibe `id = plan-${Date.now()}` (`PlanManagement.jsx:54`), que se guarda como `codigo`.
- La renovación en recepción usa `PLAN_LIST` hardcodeado (`ClientsManagement.jsx:5,60,98,304`) con solo `basico`, `completo`, `premium` (`data/adminData.js:11-15`), y busca el plan por `codigo` (`useAdminClients.js:302-312`). **Un plan creado en el panel no se puede elegir al renovar.**
- La carga remota de planes solo ocurre si hay sesión (`PlansContext.jsx:44-46`). La landing pública muestra `seedPlans` (`:31-38`), así que los cambios de precio no se ven sin iniciar sesión.
- No hay eliminación de planes; solo activar/desactivar.
- Los cambios de precio no alteran pagos ni membresías ya registrados (correcto desde el punto de vista histórico).

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Listar planes | FUNCIONAL VERIFICADA | `PlansContext.jsx:41-58` | — | Conservar. |
| Crear plan | IMPLEMENTADA NO VERIFICADA | `PlanManagement.jsx:54`; upsert `:74-90` | `codigo` generado por timestamp | Generar slug estable o pedir código. |
| Editar plan | IMPLEMENTADA NO VERIFICADA | `PlansContext.jsx:74-90` | — | Conservar. |
| Activar/desactivar | IMPLEMENTADA NO VERIFICADA | `PlansContext.jsx:114-120` | Sin confirmación | Añadir confirmación. |
| Eliminar plan | SIN IMPLEMENTAR | No hay `deletePlan` | — | Evaluar borrado lógico. |
| Usar plan nuevo en renovación | CON PROBLEMAS | `ClientsManagement.jsx:304`; `useAdminClients.js:302-312` | Lista hardcodeada | Cargar planes activos desde `PlansContext`/`plans`. |
| Reflejar precios en la landing | PARCIAL | `PlansContext.jsx:44-46` | Sin sesión se muestran semillas | Cargar planes públicos sin sesión. |

---

## 4. Estado de cada funcionalidad (consolidado)

| Funcionalidad | Estado | Evidencia técnica | Problema | Recomendación |
|---|---|---|---|---|
| Dashboard · socios activos | SIMULADA | `useAdminDashboard.js:59-65` | Semilla | Datos reales. |
| Dashboard · por vencer | SIMULADA | `:64` | Semilla | Datos reales. |
| Dashboard · ingreso del mes | SIMULADA | `:11,67`; `AdminDashboard.jsx:254` | 24.850 Bs. ficticios | Quitar fallback. |
| Dashboard · clases de hoy | CON PROBLEMAS | `:42-47,70` | Siempre vacío | Consultar `classes`. |
| Dashboard · reservas del día | CON PROBLEMAS | `:70-72` | Siempre 0 | Consultar `bookings`/`classes`. |
| Dashboard · ranking | SIMULADA | `:23-39,71` | Estático | `bookings`. |
| Dashboard · alertas de cumpleaños | PARCIAL | `AdminDashboard.jsx:170-178` | Depende de datos que pueden ser semilla | Garantizar fuente real. |
| Dashboard · accesos directos | FUNCIONAL VERIFICADA | `AdminDashboard.jsx:206-216` | — | Conservar. |
| Dashboard · refrescar | CON PROBLEMAS | `useAdminDashboard.js:86-98` | No actualiza | Implementar o quitar. |
| Caja · abrir | IMPLEMENTADA NO VERIFICADA | `CashRegister.jsx:14-26`; RPC `:349-369` | — | Probar. |
| Caja · cerrar | IMPLEMENTADA NO VERIFICADA | `CashRegister.jsx:28-41`; RPC `:371-429` | Solo turno propio | Definir cierre admin. |
| Caja · totales del turno | CON PROBLEMAS | `CashRegister.jsx:43-56` | Mezcla cajeros | Filtrar por usuario. |
| Caja · historial | PARCIAL | `CashRegister.jsx:149-153` | Solo conteo | Ver Auditoría. |
| Caja · responsable | CON PROBLEMAS | `useReceptionCommerce.js:64-71,120` | UUID | Ver P-12. |
| Auditoría · listado | PARCIAL | `CashRegister.jsx:156-205` | Sin detalle | Añadir detalle. |
| Auditoría · integridad | CON PROBLEMAS | RLS `:232-243` | Update directo | Endurecer. |
| Auditoría · supervisión | SIN IMPLEMENTAR | `AdminPanel.jsx:322-323` | Solo lectura | Definir alcance. |
| Personal · crear | IMPLEMENTADA NO VERIFICADA | `index.ts:79-88` | No atómico | Compensar. |
| Personal · editar | IMPLEMENTADA NO VERIFICADA | `index.ts:90-99` | Sin contraseña | Acción aparte. |
| Personal · desactivar | CON PROBLEMAS | `index.ts:90-109`; RLS por JWT | Token vigente válido | Invalidar o validar `activo`. |
| Personal · reactivar | PARCIAL | `upsert` `:112-120` | Implícito | Botón explícito. |
| Personal · roles | FUNCIONAL VERIFICADA | check `staff_accounts.rol` | — | Conservar. |
| Configuración · cargar | IMPLEMENTADA NO VERIFICADA | `GymSettings.jsx:26-28` | — | Conservar. |
| Configuración · guardar | CON PROBLEMAS | `GymSettings.jsx:47`; falta INSERT | Falla RLS (inferido) | Política o `update`. |
| Configuración · `updated_at` | CON PROBLEMAS | `:200` sin trigger | No cambia | Trigger. |
| Configuración · efecto | SIN IMPLEMENTAR | Sin consumidores | No aplica | Definir consumidores. |
| POS · listar | FUNCIONAL VERIFICADA | `useReceptionCommerce.js:79` | — | Conservar. |
| POS · crear/editar | IMPLEMENTADA NO VERIFICADA | `:155-172` | — | Probar. |
| POS · borrar con ventas | IMPLEMENTADA NO VERIFICADA | `:197-205` | — | Conservar. |
| POS · stock mínimo | PARCIAL | `PosProductsManagement.jsx:90` | Sin alertas | Implementar alerta. |
| POS · movimientos | SIN IMPLEMENTAR | Sin tabla | Sin trazabilidad | Diseñar. |
| POS · COGS | SIN IMPLEMENTAR | `costo_compra` sin uso | Margen desconocido | Fase posterior. |
| POS · estado vacío | CON PROBLEMAS | `PosProductsManagement.jsx:135` | `colSpan` 7 vs 6 | Corregir. |
| Finanzas · ingresos | FUNCIONAL VERIFICADA (lógica) | `AdminFinanceReports.jsx:36-64` | — | Conservar. |
| Finanzas · egresos | IMPLEMENTADA NO VERIFICADA | `:96-130` | Sin corrección | Añadir edición auditada. |
| Finanzas · CSV | FUNCIONAL VERIFICADA | `:132-137` | — | Conservar. |
| Finanzas · paginación | SIN IMPLEMENTAR | `limit(5000)` | Corte silencioso | Paginar. |
| Finanzas · desglose | PARCIAL | Solo filas | Sin agregados | Añadir resumen. |
| Finanzas · COGS/impuestos | SIN IMPLEMENTAR | — | Resultado incompleto | Fase posterior. |
| Reportes · ingresos | SIMULADA | `useAdminReports.js:30-102` | Semilla | Reescribir. |
| Reportes · ranking | SIMULADA | `:80-88` | Semilla | `bookings`. |
| Reportes · socios | SIMULADA | `:91-100` | Semilla | Datos reales. |
| Reportes · período | PARCIAL | `AdminReports.jsx:95-98` | No aplica al ranking | Unificar. |
| Reportes · exportar | SIN IMPLEMENTAR | — | — | CSV existente. |
| Reportes · refresco | CON PROBLEMAS | `:104-110` | Tablas inexistentes | Corregir. |
| Planes · listar | FUNCIONAL VERIFICADA | `PlansContext.jsx:41-58` | — | Conservar. |
| Planes · crear | IMPLEMENTADA NO VERIFICADA | `PlanManagement.jsx:54` | Código timestamp | Slug estable. |
| Planes · editar | IMPLEMENTADA NO VERIFICADA | `PlansContext.jsx:74-90` | — | Conservar. |
| Planes · activar/desactivar | IMPLEMENTADA NO VERIFICADA | `:114-120` | — | Confirmación. |
| Planes · eliminar | SIN IMPLEMENTAR | Sin `deletePlan` | — | Evaluar. |
| Planes · renovación | CON PROBLEMAS | `ClientsManagement.jsx:304` | Lista fija | Cargar planes reales. |
| Planes · landing | PARCIAL | `PlansContext.jsx:44-46` | Semillas sin sesión | Carga pública. |
| Acceso · admin/recepción | CON PROBLEMAS | `App.jsx:82,371-372,492` | `role` gana | Corregir precedencia. |
| Acceso · entrenador | CON PROBLEMAS | `AdminPanel.jsx:68`; `App.jsx:493` | `staffRole` es `'authenticated'` | Derivar de `gym_role`. |

---

## 5. Relaciones entre módulos

### 5.1 Matriz de relaciones

| Relación | Estado | Evidencia | Lectura |
|---|---|---|---|
| Dashboard ↔ Reportes | **Duplicación real** | Ambos usan `seedClients` y `weeklyClasses` (`useAdminDashboard.js:3-4`; `useAdminReports.js:3-4`) | Dos copias de los mismos datos ficticios con cálculos distintos. |
| Dashboard ↔ Finanzas | **Duplicación parcial** | `useAdminDashboard` (`SEED_INCOME`) y `useAdminFinance` (`payments`+`pos_sales`) en la misma pantalla (`AdminDashboard.jsx:145-154`) | Debe quedar **una** fuente de ingresos. |
| Caja ↔ Auditoría | **Dependencia legítima** | `CashAudit` consume `cashSessions` (`AdminPanel.jsx:323`) | Responsabilidades distintas: operar vs supervisar. No fusionar. |
| Caja ↔ Finanzas | **Complementarias** | Caja mide efectivo esperado/declarado; Finanzas mide ingresos/egresos del período | No son lo mismo; falta conciliación explícita. |
| POS ↔ Caja | **Dependencia fuerte** | `register_pos_sale` exige caja abierta (`admin_operations.sql:494-499`); el cierre suma ventas POS (`:396-401`) | Correcto; el problema es el filtrado de lectura (P-08). |
| POS ↔ Finanzas | **Dependencia real** | `pos_sales` se suma a ingresos (`useAdminFinance.js:79-80`; `AdminFinanceReports.jsx:54-63`) | Correcto; falta COGS. |
| Personal ↔ Auth | **Dependencia real** | `manage-staff` escribe `auth.users` y `staff_accounts` (`index.ts:79-121`) | El rol efectivo vive en el JWT, no en `staff_accounts.activo`. |
| Planes ↔ membresías | **Parcial** | `procesar_pago_exitoso` lee `plans.duracion_dias` (`admin_operations.sql:70-73`) | El backend está bien; la UI de renovación no ofrece planes nuevos. |
| Configuración ↔ todos | **Sin relación** | `gym_settings` sin consumidores | Módulo aislado. |
| Asistencia ↔ Dashboard | **Parcial** | `gym_attendance` alimenta alertas de acceso (`AdminPanel` `accessAlerts`), no los KPIs | El Dashboard no cuenta asistencias. |

### 5.2 Duplicaciones que conviene eliminar

1. **Ingresos del mes:** `SEED_INCOME` en `useAdminDashboard` vs `useAdminFinance`. Una sola fuente.
2. **Socios y vencimientos:** `useAdminDashboard`, `useAdminReports` y `useAdminClients` calculan lo mismo por separado. Debe quedar una consulta compartida o una RPC de agregados.
3. **Registro de egresos:** `AdminFinanceReports.addExpense` y `ExpenseModal`/`useReceptionCommerce.registerExpense` insertan en `operating_expenses` con formularios distintos. Unificar el formulario, no necesariamente el punto de entrada.
4. **Clases:** `weeklyClasses` (semilla) vs `classes` (BD). El panel debería usar solo `classes`.

### 5.3 Responsabilidades que NO deben fusionarse

- **Caja** (operación del turno) y **Auditoría de Caja** (supervisión) son funciones distintas aunque compartan tabla.
- **Finanzas** (resultado del período) y **Caja** (efectivo físico) miden cosas distintas; fusionarlas ocultaría descuadres.
- **Personal** (cuentas de staff) y **Socios** (clientes) son entidades distintas; `staff_accounts` no debe mezclarse con `profiles`.
- **Reportes** (analítica histórica) y **Dashboard** (resumen operativo) pueden compartir consultas, pero no deben ser el mismo componente.

---

## 6. Problemas con evidencia

### 6.1 Tabla de problemas

| ID | Severidad | Problema | Evidencia | Impacto | Verificación |
|---|---|---|---|---|---|
| P-01 | **Crítica / bloqueante** | El panel no se abre con un usuario real de Supabase | `App.jsx:82` pone `role: 'authenticated'`; `adminAccess.js:11-12` y `receptionAccess.js:10-11` evalúan `role` primero | Admin y recepción quedan fuera | **Verificado localmente** (Anexo A) |
| P-02 | **Alta** | El rol entrenador nunca se reconoce | `App.jsx:493` pasa `staffRole='authenticated'`; `AdminPanel.jsx:68` compara con `'trainer'` | Entrenador ve pestañas de recepción | **Verificado por lectura** |
| P-03 | **Alta** | KPIs del Dashboard son semilla | `useAdminDashboard.js:57-83` | Decisiones sobre datos falsos | Verificado por lectura |
| P-04 | **Media** | "Clases de hoy" siempre vacío | `useAdminDashboard.js:42-47,70`; `gymData.js:218` sin `date` | Indicador inútil | Verificado por lectura |
| P-05 | **Alta** | Se muestra 24.850 Bs. como ingreso real | `useAdminDashboard.js:11,67,78`; `AdminDashboard.jsx:254`; `useAdminFinance.js:27,33` | Cifra engañosa | Verificado por lectura |
| P-06 | **Alta** | Reportes completamente simulados y con tablas inexistentes | `useAdminReports.js:30-102,107-108` | Módulo decorativo | Verificado por lectura |
| P-07 | **Media** | El rango de Reportes no afecta al ranking y no hay exportación | `AdminReports.jsx:95-98,114,222` | Reporte inconsistente | Verificado por lectura |
| P-08 | **Media/Alta** | Totales de caja mezclan operaciones de otros cajeros | `CashRegister.jsx:43-56` | Arqueo incorrecto | Verificado por lectura |
| P-09 | **Media** | No se puede cerrar el turno de otra persona | RPC `admin_operations.sql:387-391` | Turnos huérfanos | Verificado por lectura |
| P-10 | **Media** | RLS permite alterar totales/cierre sin RPC | `admin_operations.sql:232-243` | Auditoría debilitada | Inferido de políticas |
| P-11 | **Media** | Auditoría sin detalle por turno | `CashRegister.jsx:156-205` | No permite investigar descuadres | Verificado por lectura |
| P-12 | **Baja/Media** | "Responsable" muestra UUID | `useReceptionCommerce.js:64-71,120`; staff sin `profiles` (`index.ts:112-121`) | UI confusa | Verificado por lectura |
| P-13 | **Media** | `stock_minimo` sin alertas ni consumidor | `PosProductsManagement.jsx:90`; búsqueda global | Sin control de reposición | Verificado por lectura |
| P-14 | **Baja** | `colSpan` incorrecto en estado vacío | `PosProductsManagement.jsx:135` | Cosmético | Verificado por lectura |
| P-15 | **Media** | Alta de personal no atómica | `index.ts:79-121` | Usuario huérfano en Auth | Verificado por lectura |
| P-16 | **Alta (seguridad)** | Empleado desactivado conserva permisos hasta refrescar token | `index.ts:90-109`; `current_gym_role` `:4-19`; RLS no lee `activo` | Acceso indebido | Inferido |
| P-17 | **Baja/Media** | No se puede cambiar la contraseña de un empleado | `StaffManagement.jsx:64-73`; `index.ts:90-99` | Operación manual | Verificado por lectura |
| P-18 | **Media** | Reactivación implícita al editar | `index.ts:112-120` | Cambio de estado no intencional | Verificado por lectura |
| P-19 | **Alta** | Guardar configuración falla por falta de política INSERT | `GymSettings.jsx:47`; políticas `admin_operations.sql:250-258` | Configuración no persiste | Inferido de PostgREST/RLS |
| P-20 | **Media** | `gym_settings` no lo consume nadie | Búsqueda global | Cambios sin efecto | Verificado por lectura |
| P-21 | **Alta** | Planes nuevos no se pueden usar al renovar | `ClientsManagement.jsx:304`; `useAdminClients.js:302-312` | Catálogo desconectado | Verificado por lectura |
| P-22 | **Media** | Landing muestra planes semilla sin sesión | `PlansContext.jsx:31-38,44-46` | Precios desactualizados | Verificado por lectura |
| P-23 | **Media** | Finanzas sin paginación | `AdminFinanceReports.jsx:44,47,50` | Corte a 5.000 filas | Verificado por lectura |
| P-24 | **Alta (seguridad)** | Recepción puede actualizar cualquier columna de cualquier perfil | `admin_operations.sql:282-286` | Manipulación de `plan_id`/datos sin pago | Inferido de políticas |
| P-25 | **Media/Alta (integridad)** | Un socio puede insertar un pago propio como `completado` | `payments.sql:72-76`; check `:43` | Infla Finanzas sin membresía | Inferido |
| P-26 | **Baja** | `ADMIN_PASSWORD` residual en el bundle | `adminAccess.js:5` | Secreto expuesto innecesariamente | Verificado por lectura |
| P-27 | **Baja** | Egresos sin edición/borrado | RLS `operating_expenses` `:337-347` | Errores no corregibles | Verificado por lectura |

### 6.2 Detalle de los cinco problemas que más impactan

**P-01 — Bloqueo de acceso en el frontend.**
`App.jsx:82` construye `role: authUser.role || authUser.app_metadata?.gym_role || ...`. Un `User` de Supabase siempre trae `role: 'authenticated'`, así que la expresión nunca llega al `gym_role`. Luego `isAdminUser` hace `if (role) return role === 'admin'` y devuelve `false`. La prueba local del Anexo A lo confirma. El backend **no** está afectado porque `current_gym_role()` lee el JWT directamente, pero la UI nunca llega a abrir el panel. Es el primer punto a verificar en runtime.

**P-05 — Ingreso ficticio.**
El Dashboard arranca con `available: false` y `currentIncome: 24850` (`useAdminFinance.js:27,33`), y la tarjeta usa `ingresosMes` cuando Finanzas no está disponible (`AdminDashboard.jsx:254`). El resultado es que un gimnasio sin pagos ve "24.850 Bs." como ingreso del mes. No es un placeholder visual: está formateado como dato real.

**P-06 — Reportes decorativos.**
El hook devuelve `SEED_PAYMENTS` y `seedClients` (`useAdminReports.js:94-101`) y su `refresh()` consulta `pagos` y `asistencia` (`:107-108`), tablas que no existen en ninguna migración. Aunque las consultas funcionaran, el resultado se descarta. Cualquier decisión basada en Reportes es una decisión sobre datos inventados.

**P-08 — Arqueo de caja contaminado.**
`CashRegister` filtra ventas y gastos por `created_at >= sessionStart` (`:43-56`), sin `cashier_id` ni `created_by`. Si dos personas trabajan en paralelo, el turno de una muestra el efectivo de la otra. La RPC de cierre sí filtra por `auth.uid()` (`admin_operations.sql:396-416`), por lo que **la UI y el cierre pueden mostrar números distintos**.

**P-16 — Desactivación que no desactiva.**
`manage-staff` cambia `app_metadata.gym_role` a `'disabled'` (`:91`), pero el JWT ya emitido conserva el rol anterior hasta que expire o se refresque. Ninguna política consulta `staff_accounts.activo`. En la práctica, un empleado dado de baja puede seguir vendiendo, cobrando o registrando asistencias con el token que ya tenía.

---

## 7. Mejoras recomendadas

Ordenadas por relación impacto/esfuerzo, **sin implementar en esta intervención**:

1. **Una sola fuente de métricas.** Crear una capa de lectura (hook o RPC) que entregue socios activos, vencimientos, ingresos del mes, clases de hoy y reservas. Reutilizarla en Dashboard y Reportes.
2. **Eliminar semillas de producción.** Mantener los datos demo solo detrás de una bandera explícita (`?demo=1` o `import.meta.env`), nunca como fallback silencioso.
3. **Estado de carga/error visible.** Si una consulta falla, mostrar "sin datos" con el error, no una cifra semilla.
4. **Detalle de caja.** Añadir a Auditoría el desglose de ventas y gastos por sesión, con filtros por fecha y responsable.
5. **Catálogo de planes único.** Que `ClientsManagement` lea los planes activos de `PlansContext` y que la landing cargue planes públicos sin requerir sesión.
6. **Configuración con efecto real.** Definir consumidores (nombre del gimnasio en la landing, horario en la sección de clases, términos en el registro) antes de seguir ampliando el formulario.
7. **Inventario mínimo viable.** Alerta de `stock <= stock_minimo` y un historial simple de movimientos.
8. **Finanzas con agregados.** Resumen por método y categoría, y conciliación con caja.
9. **Personal seguro.** Invalidar sesiones al desactivar o validar `staff_accounts.activo` en una función de rol; separar el cambio de contraseña.
10. **Limpieza de secretos.** Eliminar `ADMIN_PASSWORD` y cualquier credencial de demo del bundle.

---

## 8. Cambios estrictamente necesarios

Lista mínima para que el panel sea confiable. **Ninguno se aplicó.**

| # | Archivo | Cambio mínimo | Motivo |
|---|---|---|---|
| 1 | `frontend-web/src/App.jsx:82` | Priorizar `app_metadata.gym_role` sobre `authUser.role` | Desbloquea P-01 sin cambiar autenticación. |
| 2 | `frontend-web/src/App.jsx:493` | Pasar `staffRole` desde `app_metadata.gym_role` (con respaldo equivalente) | Corrige P-02. |
| 3 | `frontend-web/src/hooks/useAdminReports.js:107-108` | Usar `payments` y `gym_attendance` (o eliminar el refresco muerto) | Evita errores y falsa sensación de actualización. |
| 4 | `frontend-web/src/hooks/useAdminDashboard.js:11,67,78` | Quitar `SEED_INCOME` del valor mostrado | Elimina P-05. |
| 5 | `supabase/migrations/*` (nueva) | Política `INSERT` admin para `gym_settings` **o** cambiar `GymSettings.jsx:47` a `update().eq('id', true)` | Desbloquea el guardado (P-19). |
| 6 | `frontend-web/src/components/admin/CashRegister.jsx:43-56` | Filtrar por `cashier_id` / `created_by` | Corrige el arqueo (P-08). |
| 7 | `frontend-web/src/components/admin/PosProductsManagement.jsx:135` | `colSpan={6}` | Error visual verificable. |
| 8 | `frontend-web/src/context/PlansContext.jsx:44-46` | Cargar planes públicos sin sesión | Alinea landing y panel (P-22). |

Todo lo demás (COGS, movimientos de stock, conciliación, paginación) es mejora, no requisito para que lo existente sea honesto.

---

## 9. Funcionalidades a conservar

- **Autenticación real** con `signInWithPassword`, sin bypass ni credenciales demo en el flujo (`AuthContext.jsx`).
- **Autorización de servidor** basada en `current_gym_role()` y RLS por rol; es la defensa correcta y debe permanecer.
- **RPC atómicas**: `procesar_pago_exitoso`, `register_pos_sale`, `open_cash_register`, `close_cash_register`, `freeze_membership`.
- **Venta POS con control de stock** y bloqueo por fila.
- **Cierre de caja con cálculo de esperado/declarado/diferencia.**
- **Historial de turnos** y una caja abierta por persona (índice único).
- **CRUD de productos** con baja lógica cuando hay ventas.
- **Finanzas sobre tablas reales** y exportación CSV.
- **Registro de egresos** con categoría y método de pago.
- **Personal vía Edge Function** con service role y roles limitados a recepción/entrenador.
- **Planes editables** con activación/desactivación y precio por plan.
- **Separación visual admin/recepción/entrenador** (aunque deba corregirse la detección del rol).

---

## 10. Riesgos de modificar

| Cambio | Riesgo | Mitigación |
|---|---|---|
| Alterar la precedencia de `role` | Si alguna cuenta no tiene `app_metadata.gym_role`, quedaría sin panel | Mantener el fallback por correo y probar las tres cuentas antes de desplegar. |
| Reemplazar semillas por datos reales | Pantallas vacías si la BD no tiene datos | Estado vacío explícito y datos de prueba en staging. |
| Endurecer RLS de caja | La UI actual podría dejar de guardar si dependía del `UPDATE` directo | Confirmar que todo pasa por RPC antes de revocar. |
| Añadir política `INSERT` a `gym_settings` | Permite crear filas si se borra la sembrada | Restringir `id = true` en el `with check`. |
| Invalidar sesiones al desactivar personal | El empleado pierde sesión de inmediato (esperado, pero disruptivo) | Comunicar y hacerlo en horario de baja operación. |
| Conectar planes nuevos a renovaciones | Un `codigo` inestable (`plan-<timestamp>`) puede quedar huérfano | Migrar a slugs estables antes de exponerlos. |
| Cambiar el filtro de caja | Los totales históricos pueden cambiar de interpretación | No reescribir sesiones cerradas; solo corregir la lectura futura. |
| Eliminar `ADMIN_PASSWORD` | Ningún flujo lo usa, pero alguna prueba podría importarlo | Buscar referencias antes (hoy solo existe en `adminAccess.js`). |

---

## 11. Pruebas realizadas

### 11.1 Pruebas automatizadas

Comando (desde `frontend-web/`):

```powershell
node --import ./scripts/ci/offline.mjs --import ./scripts/ci/register.mjs --test scripts/gym-business.test.mjs
```

Resultado exacto:

```
ℹ tests 41
ℹ suites 0
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 974.9008
```

Cobertura relevante: roles (`admin`, `reception`, `trainer`, `member`, `unknown`), membresías, pagos, asistencia. **Limitación importante:** las pruebas de rol usan cuentas sin `role: 'authenticated'` (`scripts/gym-business.test.mjs:64-68`), por lo que **no detectan P-01**. Esa es la causa de que la suite pase mientras el panel real no abriría.

### 11.2 Build

```powershell
npm run build
```

Resultado: `✓ built in 2.07s`. Chunks principales: `App-C-11FRHq.js` 426,74 kB, `supabase-Bj-kCXtF.js` 208,35 kB, `index-BC8zGj42.js` 192,36 kB, `vision_bundle-Cujuwe0I.js` 153,61 kB.

### 11.3 Lint

```powershell
npm run lint
```

Resultado: **0 errores**, 5 advertencias preexistentes, ninguna en el panel administrativo:

- `src/context/RoutineContext.jsx:129`
- `src/components/ClientRoutines.jsx:54`
- `src/hooks/useCamera.js:156`
- `src/components/TrainerClients.jsx:54`
- `src/components/RoutineRunner.jsx:121`

### 11.4 Comprobación de roles

Script local (Anexo A). Resultado:

```
admin -> false
reception -> false
admin sin user.role -> true
```

### 11.5 Búsquedas de evidencia

- `grep` de `stock_minimo|stockMinimo` en `src/`: solo formulario, mapeo y visualización; sin lógica de alerta.
- `grep` de `gym_settings` en `src/`: solo `GymSettings.jsx`; sin consumidores.
- `grep` de `AdminPanel|AdminDashboard|...` en `scripts/`: sin pruebas específicas del panel.
- `git status --short`: árbol limpio; no hay cambios locales en `App.jsx`, `adminAccess.js` ni `receptionAccess.js`.

### 11.6 Pruebas no realizadas

No se ejecutó nada contra Supabase: ni consultas, ni RLS, ni RPC, ni Edge Functions, ni creación de usuarios. Todo lo que depende de datos remotos queda como **inferido** y se lista en la sección 12.

---

## 12. Comprobaciones pendientes

| # | Comprobación | Método sugerido | Qué confirma |
|---|---|---|---|
| 1 | Abrir el panel con la cuenta admin real | Login en el bundle desplegado y en `npm run dev` | P-01: si difiere, el bundle no coincide con el árbol. |
| 2 | Abrir el panel con recepción | Igual | P-01 y pestañas visibles. |
| 3 | Entrar con un entrenador creado por Personal | Login y observar pestañas | P-02. |
| 4 | Guardar Configuración | Editar nombre y guardar; revisar error/toast | P-19 (política INSERT). |
| 5 | Verificar `updated_at` tras guardar | `select updated_at from gym_settings` | P-20. |
| 6 | Abrir caja, vender y cerrar | Turno completo con dos usuarios en paralelo | P-08/P-09. |
| 7 | Leer totales de caja con ventas de otro cajero | Comparar UI vs RPC | P-08. |
| 8 | Editar una sesión abierta por API | `update cash_register_sessions set efectivo_esperado=...` | P-10. |
| 9 | Desactivar un empleado y usarlo sin cerrar sesión | Login previo, baja, luego operar | P-16. |
| 10 | Insertar un pago propio `completado` | Cliente autenticado con `insert` | P-25. |
| 11 | Actualizar `plan_id` de un socio como recepción | `update profiles set plan_id=...` | P-24. |
| 12 | Crear plan nuevo y renovar | Panel → Planes → Socios → Renovar | P-21. |
| 13 | Ver la landing sin sesión tras cambiar precios | Navegador anónimo | P-22. |
| 14 | Cerrar turno de otro usuario como admin | Intentar desde la UI/API | P-09. |
| 15 | Confirmar que `pagos`/`asistencia` no existen | `information_schema.tables` | P-06. |
| 16 | Revisar si el deploy usa este commit | Comparar hash del bundle o `git log` del entorno | P-01. |
| 17 | Probar el flujo "Nuevo Socio" desde recepción | Abrir registro y completar | Riesgo de que la sesión cambie al nuevo usuario (`AuthContext.jsx:119-166`). |
| 18 | Verificar límite de 5.000 en Finanzas | Contar filas y comparar | P-23. |

---

## 13. Orden recomendado de corrección

**Fase 0 — Verificación (sin cambios)**
Confirmar P-01/P-02 en el entorno real y aclarar si el bundle desplegado corresponde a `e49d17d`. Sin esta respuesta, cualquier cambio de rol es a ciegas.

**Fase 1 — Acceso y roles**
Corregir la precedencia de `role` y `staffRole`; añadir una prueba que use un `User` realista con `role: 'authenticated'`. Validar las tres cuentas.

**Fase 2 — Honestidad de datos**
Quitar semillas de Dashboard (P-03/P-05) y reescribir Reportes sobre `payments`, `bookings`, `memberships` y `gym_attendance` (P-06/P-07). Añadir estados vacíos.

**Fase 3 — Caja y auditoría**
Filtrar totales por cajero (P-08), añadir detalle por sesión (P-11), decidir el cierre administrativo (P-09) y endurecer el `UPDATE` directo (P-10).

**Fase 4 — Planes y configuración**
Cargar planes activos en renovaciones (P-21), cargar planes públicos en la landing (P-22), resolver la política de `gym_settings` (P-19) y definir consumidores (P-20).

**Fase 5 — Personal y seguridad**
Hacer atómica el alta (P-15), invalidar sesiones o validar `activo` (P-16), separar cambio de contraseña (P-17), restringir la actualización de perfiles (P-24) y revisar la inserción de pagos propios (P-25).

**Fase 6 — Inventario y finanzas**
Alertas de stock mínimo (P-13), movimientos (si se decide), COGS, paginación (P-23), agregados y conciliación con caja.

**Fase 7 — Limpieza**
`colSpan` (P-14), `ADMIN_PASSWORD` (P-26), edición auditada de egresos (P-27), pruebas del panel.

---

## Verificación posterior del estado de roles

**Fecha:** 2026-11-16 · **Tipo de intervención:** Fase 0, solo lectura · **Resultado:** P-01 y P-02 **se confirman en `main` (`e49d17d`)** y **ya estaban corregidos en la rama `agregado-cuentas-admin-recepcion` (`b674e52`)**.

Esta sección no sustituye el diagnóstico anterior: lo valida para el commit auditado y añade la comparación con la rama que explica el comportamiento observado por el propietario.

### V.1 Alcance y método

- No se modificó código, autenticación, roles, migraciones, RLS ni `.env`.
- No se escribió en Supabase, no se crearon ni modificaron usuarios y no se desplegaron funciones.
- No se usaron credenciales ni tokens reales. Las pruebas se ejecutaron con objetos sintéticos que reproducen la forma de un `User` de Supabase (`role: 'authenticated'` + `app_metadata.gym_role`).
- Los scripts de prueba se ejecutaron fuera del repositorio, en el directorio temporal del sistema, para no dejar artefactos versionables.

### V.2 Rama, commit y estado del árbol

| Dato | Valor |
|---|---|
| Rama actual | `main` |
| Commit actual | `e49d17d` — “avance ejercicios” (2026-11-08) |
| `git status` | limpio, salvo `docs/DIAGNOSTICO_PANEL_ADMIN.md` sin rastrear (este documento) |
| Diferencias de `App.jsx`, `adminAccess.js`, `receptionAccess.js`, `AdminPanel.jsx` respecto de `e49d17d` | ninguna |
| Rama con la corrección | `agregado-cuentas-admin-recepcion` → `b674e52` — “Agregado cuentas admin y recepcion” |
| Relación entre commits | `b674e52` es hijo directo de `e49d17d`; **no es ancestro de `main`** (`main..rama` = 1 commit) |

El reflog local permite reconstruir la secuencia que originó la discrepancia:

| Hora (2026-11-16) | Evento |
|---|---|
| 13:02:48 | `checkout` de `main` a `agregado-cuentas-admin-recepcion` |
| 13:03:29 | commit `b674e52` “Agregado cuentas admin y recepcion” |
| 13:50:35 | `checkout` de `agregado-cuentas-admin-recepcion` a `main` |
| 14:25 | `frontend-web/dist/assets/*` reconstruido desde `main` |

### V.3 Archivos relevantes y diferencias

| Archivo | En `main` (`e49d17d`) | En `b674e52` | Efecto |
|---|---|---|---|
| `frontend-web/src/App.jsx` | `:82` toma `authUser.role` antes de `gym_role`; `:493` usa `currentUser?.role` con fallback `'reception'` | `:84-88` prioriza `gym_role` e ignora `user.role`; `:499` usa fallback `'member'` | El claim JWT `authenticated` deja de contaminar el rol funcional y `staffRole` deja de tener un valor por defecto incorrecto |
| `frontend-web/src/lib/adminAccess.js` | `:9-13` evalúa `user.role` antes que `app_metadata.gym_role`; conserva `ADMIN_PASSWORD` | `:15-31` prioriza `gym_role`, solo usa el correo si no hay rol explícito; elimina `ADMIN_PASSWORD` | `isAdminUser` funciona con usuarios reales y un rol explícito distinto de `admin` ya no cae al fallback por correo |
| `frontend-web/src/lib/receptionAccess.js` | `:8-13` mismo orden incorrecto | `:17-31` prioriza `gym_role`; acepta `reception` y `trainer`; correo solo como compatibilidad | `isReceptionUser` funciona con recepción y entrenador reales |
| `frontend-web/src/components/admin/AdminPanel.jsx` | `:67-68` → `isAdmin = isAdminUser`; `isTrainer = staffRole === 'trainer' && !isAdmin` | sin cambios | No era el origen del fallo; depende por completo de lo que recibe |

La rama también incluye cambios ajenos al arreglo de roles (`docs/`, `supabase/scripts/initialize-staff.mjs`, `.env.example`, `.gitignore`, `supabase/.temp/*`). Solo los tres archivos de frontend de la tabla anterior constituyen la corrección funcional.

### V.4 Recorrido completo del rol

1. **Supabase Auth** devuelve un usuario con `role: 'authenticated'` (claim JWT genérico) y, si la cuenta es de personal, `app_metadata.gym_role` con el rol funcional (`admin`, `reception`, `trainer`, `member`, `disabled`).
2. **`AuthContext.jsx:38`** guarda el usuario crudo de Supabase sin transformar el rol. El `profile` se consulta aparte en `profiles`, cuyas migraciones **no definen ninguna columna `role`**.
3. **`App.jsx`** construye `currentUser`. En `main`, `role` toma primero `authUser.role`, por lo que vale `'authenticated'`. Además, `...(profile || {})` se aplica después de `role`.
4. **`isAdminUser` / `isReceptionUser`** reciben ese objeto. En `main` leen `user.role` primero y comparan `'authenticated'` contra `'admin'` / `'reception'`, devolviendo siempre `false` para cuentas reales.
5. **`AdminPanel`** recibe `isAdminUser` y `staffRole`; como `staffRole` es `'authenticated'`, `isTrainer` también es `false`. **`Navbar.jsx:80-99`** ni siquiera muestra los botones de “Panel Admin” / “Recepción”.

Conclusión del recorrido: en `main` no existe una ruta alternativa de autorización en el frontend; el único camino es el fallback por correo, que solo se alcanza si el objeto no trae ningún `role`.

### V.5 Pruebas de roles

Se evaluaron 11 casos con la misma lógica de `App.jsx`, las funciones de acceso y la fórmula de `AdminPanel` (`isTrainer = staffRole === 'trainer' && !isAdmin`). `staffRole` refleja el valor que recibe el panel (`user.role || fallback`).

**Código actual — `main` (`e49d17d`)**

| Caso | `isAdminUser` | `isReceptionUser` | `staffRole` | `isTrainer` |
|---|---|---|---|---|
| admin real (`role: authenticated`, `gym_role: admin`) | `false` | `false` | `authenticated` | `false` |
| recepción real (`role: authenticated`, `gym_role: reception`) | `false` | `false` | `authenticated` | `false` |
| entrenador real (`role: authenticated`, `gym_role: trainer`) | `false` | `false` | `authenticated` | `false` |
| socio (`gym_role: member`) | `false` | `false` | `authenticated` | `false` |
| usuario sin `gym_role` | `false` | `false` | `authenticated` | `false` |
| sin `user.role` (forma antigua) | `true` | `false` | `admin` | `false` |
| solo correo admin, sin ningún rol | `true` | `false` | `reception` | `false` |
| `profiles.role = admin` + `gym_role = member` (hipótesis) | `true` | `false` | `admin` | `false` |
| `profiles.role = reception` + `gym_role = member` (hipótesis) | `false` | `true` | `reception` | `false` |
| `profiles.role = trainer` + `gym_role = member` (hipótesis) | `false` | `true` | `trainer` | `true` |
| cuenta desactivada (`gym_role: disabled`) | `false` | `false` | `authenticated` | `false` |

**Rama `b674e52` (corrección previa)**

| Caso | `isAdminUser` | `isReceptionUser` | `staffRole` | `isTrainer` |
|---|---|---|---|---|
| admin real | `true` | `false` | `admin` | `false` |
| recepción real | `false` | `true` | `reception` | `false` |
| entrenador real | `false` | `true` | `trainer` | `true` |
| socio (`gym_role: member`) | `false` | `false` | `member` | `false` |
| usuario sin `gym_role` | `false` | `false` | `member` | `false` |
| sin `user.role` (forma antigua) | `true` | `false` | `admin` | `false` |
| solo correo admin, sin ningún rol | `true` | `false` | `member` | `false` |
| `profiles.role = admin` + `gym_role = member` (hipótesis) | `false` | `false` | `admin` | `false` |
| `profiles.role = reception` + `gym_role = member` (hipótesis) | `false` | `false` | `reception` | `false` |
| `profiles.role = trainer` + `gym_role = member` (hipótesis) | `false` | `false` | `trainer` | `true` |
| cuenta desactivada (`gym_role: disabled`) | `false` | `false` | `disabled` | `false` |

Lectura de los resultados:

- Las tres cuentas operativas **fallan en `main`** exactamente por el mismo motivo (P-01/P-02) y **funcionan en `b674e52`**.
- Que `isReceptionUser` sea `true` para el entrenador en la rama es intencional: el modelo de acceso permite al entrenador usar el panel de recepción, pero `isTrainer` lo distingue para mostrar sus pestañas.
- El caso “solo correo admin” sigue funcionando en ambas versiones por compatibilidad histórica, pero no representa a un usuario real de Supabase.
- Los casos con `profiles.role` demuestran la hipótesis secundaria: si la tabla `profiles` tuviera una columna `role`, en `main` podría conceder acceso por accidente. Ninguna migración la define, así que no se considera la causa.

### V.6 Estado definitivo de P-01 y P-02

| ID | En `main` (`e49d17d`) | En `b674e52` | Estado definitivo |
|---|---|---|---|
| **P-01** — `authenticated` prevalece sobre `gym_role` | presente y reproducible | ausente | **CONFIRMADO en `main`**, **CORREGIDO PREVIAMENTE en `b674e52`**, **NO REPRODUCIDO en la rama** |
| **P-02** — `staffRole` recibe un valor incorrecto | presente y reproducible | ausente | **CONFIRMADO en `main`**, **CORREGIDO PREVIAMENTE en `b674e52`**, **NO REPRODUCIDO en la rama** |

P-26 (`ADMIN_PASSWORD` residual) también queda resuelto en `b674e52`, aunque no forma parte del bloqueo de acceso.

### V.7 Explicación de la discrepancia

La observación del propietario **no es falsa ni contradictoria**: lo más probable es que probara la aplicación con la rama `agregado-cuentas-admin-recepcion` activa, que estuvo en `checkout` entre las 13:02 y las 13:50 del 2026-11-16. El reflog, el commit `b674e52` y la documentación incluida en esa rama (`docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md`) coinciden en el mismo diagnóstico y en la misma corrección.

La auditoría original siguió siendo correcta porque se hizo sobre `e49d17d`, y `main` sigue exactamente en ese commit. El `dist` reconstruido a las 14:25 ya se generó desde `main`, por lo que **el artefacto actual vuelve a estar roto** aunque la prueba manual anterior haya funcionado.

La hipótesis secundaria (una columna `role` en `profiles` que, por el orden del spread, hiciera funcionar `main` por accidente) no se confirma: ninguna migración crea esa columna. Además, no explicaría P-02, porque `staffRole` seguiría recibiendo `'authenticated'` en el caso de un entrenador.

### V.8 Riesgos pendientes

1. **La corrección no está integrada en `main`.** Cualquier build o despliegue desde `main` mantiene P-01/P-02.
2. **`b674e52` mezcla el arreglo con archivos ajenos** (`docs/`, `initialize-staff.mjs`, `.env.example`, `.gitignore`, `supabase/.temp/*`). Integrar el commit completo arrastraría ruido y archivos específicos de la máquina.
3. **`supabase/.temp/*` no debería versionarse.** Son artefactos locales de CLI.
4. **`profile` sigue aplicándose después de `role` en ambas versiones.** Si en el futuro se añade `profiles.role`, podría sobrescribir `staffRole` y desincronizarlo de `isAdminUser`/`isReceptionUser` (se observa en los casos 7-9 de la tabla de la rama: el acceso se deniega correctamente, pero `staffRole` muestra el valor del perfil).
5. **No se verificó `app_metadata.gym_role` en las cuentas reales.** Sin acceso remoto no se puede confirmar que las tres cuentas tengan el valor esperado; la lógica de la rama solo funciona si ese valor existe y es correcto.
6. **P-16 sigue abierto:** una cuenta desactivada conserva el JWT anterior hasta que se refresque.
7. **El `dist` actual proviene de `main`.** Si se sirve ese artefacto, el panel seguirá sin abrirse aunque el código de la rama sea correcto.

### V.9 Respuestas directas

1. **¿El administrador funciona correctamente en el código actual?** No en `main` (`e49d17d`): `isAdminUser` devuelve `false` para un administrador real. Sí en `b674e52`.
2. **¿Recepción funciona correctamente?** No en `main`; sí en `b674e52`.
3. **¿El entrenador se identifica correctamente?** No en `main`: `staffRole` es `'authenticated'` e `isTrainer` es `false`. Sí en `b674e52`: `staffRole` es `'trainer'` e `isTrainer` es `true`.
4. **¿P-01 y P-02 siguen presentes?** Sí, ambos persisten en `main` (`e49d17d`). En la rama están corregidos previamente y no se reproducen.
5. **¿Qué cambios posteriores explican la diferencia?** El commit `b674e52` de la rama `agregado-cuentas-admin-recepcion`, que corrige los tres archivos de frontend y fue la versión probada por el propietario.
6. **¿Es seguro pasar a la siguiente fase?** **No directamente sobre `main`.** Antes de Fase 1 hay que revisar e integrar la corrección ya existente (solo `App.jsx`, `adminAccess.js` y `receptionAccess.js`), verificar `app_metadata.gym_role` en las cuentas reales y añadir una prueba de regresión con `role: 'authenticated'`. No hace falta reimplementar el arreglo.

**Recomendación para Fase 1:** partir de `b674e52` para los tres archivos de rol, descartar el resto de cambios no relacionados, validar las tres cuentas y solo entonces continuar con las fases siguientes.

> `docs/ESTADO_PROYECTO.md` no existe en el repositorio, por lo que no se creó ni se modificó.

## Preparación de la integración de la corrección de roles (Fase 1)

**Fecha:** 2026-11-16 · **Intervención:** Fase 1, inspección y preparación · **No se ejecutó** `merge`, `rebase`, `reset`, `checkout` de rama, ni se modificó código, `.env`, Supabase o RLS.

Esta sección documenta cómo integrar de forma segura la corrección que ya existe en `agregado-cuentas-admin-recepcion`, sin reimplementarla.

### F1.1 Estado actual del repositorio

| Comprobación | Resultado |
|---|---|
| Rama actual | `main` |
| Commit actual | `e49d17d` — “avance ejercicios” |
| `git status --short` | solo `?? docs/DIAGNOSTICO_PANEL_ADMIN.md` |
| Cambios tracked sin confirmar | ninguno |
| Rama a integrar | `agregado-cuentas-admin-recepcion` → `b674e52` |
| `origin/agregado-cuentas-admin-recepcion` | `b674e52` (sincronizada con la local) |
| Commits por delante de `main` | 1 |
| Merge base | `e49d17d`, que es exactamente el HEAD de `main` |
| Fast-forward posible | **sí** (`main` es ancestro de la rama) |
| Riesgo de perder cambios locales | **nulo**: no hay cambios tracked y el único archivo sin rastrear no existe en la rama |

El único archivo sin rastrear es este mismo documento. La rama incorpora otros informes bajo `docs/`, pero **no** incorpora `docs/DIAGNOSTICO_PANEL_ADMIN.md`, por lo que el fast-forward no lo sobrescribiría.

### F1.2 Diferencias exactas entre ambas ramas

`git diff --stat main...agregado-cuentas-admin-recepcion` reporta **18 archivos, 4.858 inserciones y 20 eliminaciones**:

| Grupo | Archivos | Tipo de cambio |
|---|---|---|
| **Corrección de roles** | `frontend-web/src/App.jsx`, `frontend-web/src/lib/adminAccess.js`, `frontend-web/src/lib/receptionAccess.js` | modificados (10, 30 y 30 líneas respectivamente) |
| **Sin cambios** | `frontend-web/src/components/admin/AdminPanel.jsx` | no aparece en el diff; sigue leyendo `isAdminUser` y `staffRole` |
| **Scripts operativos** | `supabase/scripts/initialize-staff.mjs`, `supabase/scripts/initialize-staff.test.mjs` | nuevos (1.228 y 1.757 líneas) |
| **Documentación** | `docs/INFORME_CORRECCION_SCRIPT_AUTH.md`, `docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md`, `docs/INFORME_RECUPERACION_AUTENTICACION.md`, `docs/REVISION_FINAL_SCRIPT_INICIALIZACION.md` | nuevos (327, 722, 274 y 465 líneas) |
| **Configuración** | `.env.example`, `.gitignore` | modificados (20 y 1 líneas; solo marcadores y una exclusión) |
| **Estado local de Supabase CLI** | `supabase/.temp/linked-project.json`, `pooler-url`, `postgres-version`, `project-ref`, `rest-version`, `storage-migration`, `storage-version` | modificados (7 archivos, 1 línea cada uno) |

Los siete archivos de `supabase/.temp/` cambian las referencias del proyecto `bqdokhumlqyeupreyarg` por `dbpmczzqupxvsgoqzwkv`. Son estado local de la CLI, no configuración funcional del repositorio.

### F1.3 Qué hace cada cambio y por qué corrige P-01 y P-02

**`App.jsx` (P-01 y P-02).** Antes construía `role: authUser.role || app_metadata.gym_role || ...`; como todo usuario real de Supabase trae `role: 'authenticated'`, ese valor ganaba siempre. Ahora calcula primero `gymRole = app_metadata.gym_role || app_metadata.role` y asigna `role: gymRole || undefined`, de modo que el claim genérico nunca sustituye al rol del gimnasio. Además cambia el fallback de `staffRole` de `'reception'` a `'member'` (`:499`), que es lo que corrige P-02: un entrenador ya no recibe un rol de recepción por defecto.

**`adminAccess.js` (P-01).** Antes evaluaba `user.role` antes que `app_metadata.gym_role`. Ahora (`:16-21`) devuelve `true` solo si `gym_role === 'admin'`; si existe cualquier rol explícito distinto, devuelve `false` y **no** cae al fallback por correo. El correo `admin@ironforge.com` queda solo como compatibilidad para objetos sin rol explícito. También elimina `ADMIN_EMAIL` y `ADMIN_PASSWORD` (P-26). Se verificó que ningún archivo del repositorio importa esos dos símbolos; la única referencia restante es un reemplazo de texto dentro de `frontend-web/improve_progress_flow.py`, que no se ejecuta en runtime.

**`receptionAccess.js` (P-01).** Aplica la misma prioridad (`:16-22`) y define `RECEPTION_ROLES = ['reception', 'trainer']`. Un rol explícito que no sea de recepción/entrenador ya no cae al fallback por correo. El entrenador sigue pudiendo abrir el panel de recepción de forma intencional.

**`AdminPanel.jsx`.** No se modifica. Su lógica era correcta (`isTrainer = staffRole === 'trainer' && !isAdmin`); el fallo estaba en el valor que recibía.

### F1.4 Estado y cobertura de las pruebas

Pruebas ejecutadas en esta fase, todas locales y sin red:

| Suite | Origen | Resultado | Naturaleza |
|---|---|---|---|
| `frontend-web/scripts/gym-business.test.mjs` | `main` (idéntico en la rama) | **41/41 OK** | Unitarias con dobles de Supabase; se ejecutó con los preloads `offline.mjs` + `register.mjs`, que bloquean red |
| `supabase/scripts/initialize-staff.test.mjs` | `b674e52` (extraído a un directorio temporal) | **61/61 OK** | Unitarias con cliente Supabase simulado; no crea cliente real ni hace peticiones |

Cobertura frente a los seis escenarios solicitados:

| Escenario | ¿Cubierto hoy? | Observación |
|---|---|---|
| Admin con `role: 'authenticated'` + `gym_role: 'admin'` | **no** | El test de roles usa `{ email, app_metadata: { gym_role } }`, sin la propiedad `role: 'authenticated'`; por eso pasaba en `main` |
| Recepción con `role: 'authenticated'` + `gym_role: 'reception'` | **no** | Mismo caso: el objeto de prueba omite el claim JWT que causa P-01 |
| Entrenador con `role: 'authenticated'` + `gym_role: 'trainer'` | **no** | `isReceptionUser` sí se prueba, pero no `staffRole` ni `isTrainer` |
| Socio sin rol privilegiado | parcial | Se prueba `member`, pero sin `role: 'authenticated'` |
| Usuario sin rol válido | parcial | Se prueba `unknown` y objetos vacíos; no se prueba el `staffRole` resultante |
| Empleado desactivado | **no en el frontend** | `initialize-staff.test.mjs` cubre `disabled` en el script de cuentas, no en `isAdminUser`/`isReceptionUser`/`AdminPanel` |

Conclusión: **la rama no añade pruebas de regresión para P-01/P-02 en la capa de frontend.** Las 61 pruebas nuevas validan el script de inicialización de cuentas (alta, consistencia con `staff_accounts`, cuentas deshabilitadas, paginación, errores), no la construcción de `currentUser` ni el valor de `staffRole`. Las 41 existentes siguen sin usar objetos realistas con `role: 'authenticated'`, que es exactamente el punto ciego que dejó pasar P-01. Añadir esa regresión debe ser una tarea posterior a la integración, no parte de esta fase.

### F1.5 Evaluación del fast-forward

**Sí es técnicamente seguro** ejecutar `git merge --ff-only agregado-cuentas-admin-recepcion`:

- El merge base es el HEAD actual (`e49d17d`), así que no puede haber conflictos.
- No hay cambios tracked sin confirmar ni archivos locales que el merge pueda pisar.
- El único archivo sin rastrear (`docs/DIAGNOSTICO_PANEL_ADMIN.md`) no existe en la rama.
- La rama local coincide con `origin/agregado-cuentas-admin-recepcion` (`b674e52`), por lo que el resultado es reproducible.

Salvedades que el propietario debe conocer antes de ejecutarlo:

1. **Arrastra 15 archivos ajenos al arreglo de roles**: 4 informes, 2 scripts, 2 archivos de configuración y 7 archivos de `supabase/.temp/`.
2. **Los `supabase/.temp/*` son específicos de la máquina.** El merge cambiará el proyecto vinculado de la CLI de `bqdokhumlqyeupreyarg` a `dbpmczzqupxvsgoqzwkv`; conviene sacarlos del control de versiones en un commit posterior.
3. **`.env.example` solo contiene marcadores**, no claves reales; `.gitignore` añade `supabase/.env.local`, que es correcto.
4. **El `dist` actual seguirá siendo el de `main`** hasta que se reconstruya después del merge.
5. **La cobertura de regresión sigue siendo insuficiente** (ver F1.4); el merge no la mejora por sí solo.

Recomendación: **usar el fast-forward** si el objetivo es preservar el commit existente y su historial. Si el propietario prefiere un cambio mínimo, la alternativa es incorporar solo los tres archivos de rol con `git checkout b674e52 -- <archivos>` y un commit nuevo; el contenido funcional sería idéntico, pero se perdería la autoría/historial del commit original.

### F1.6 Comandos que debe ejecutar el propietario

Desde la raíz del repositorio, ya en `main`:

```powershell
# 1. Comprobar el punto de partida (debe estar limpio salvo el diagnóstico)
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD

# 2. Confirmar que solo hay un commit por delante
git log --oneline main..agregado-cuentas-admin-recepcion

# 3. Integrar la corrección existente (fast-forward, sin commit nuevo)
git merge --ff-only agregado-cuentas-admin-recepcion

# 4. Verificar el resultado: HEAD debe ser b674e52
git rev-parse --short HEAD
git show --stat --oneline HEAD
```

Validación posterior:

```powershell
cd frontend-web
npm run build
npm run lint
node --import ./scripts/ci/offline.mjs --import ./scripts/ci/register.mjs --test --test-concurrency=1 scripts/gym-business.test.mjs
cd ..
node supabase/scripts/initialize-staff.test.mjs
```

Resultados esperados: build sin errores, lint sin errores nuevos, **41/41** en `gym-business`, **61/61** en `initialize-staff`. Después, el propietario debe reconstruir `dist` y probar manualmente el inicio de sesión con las tres cuentas reales para confirmar que `app_metadata.gym_role` está correctamente asignado.

Commit esperado tras la integración: **`b674e52`**. Archivos incorporados: los 18 de F1.2. `origin/main` no cambia hasta que se haga `push`; eso queda fuera de esta fase.

Alternativa mínima (solo si no se quiere arrastrar el resto de la rama):

```powershell
git checkout b674e52 -- frontend-web/src/App.jsx frontend-web/src/lib/adminAccess.js frontend-web/src/lib/receptionAccess.js
git status --short
git commit -m "fix(auth): priorizar gym_role y corregir staffRole"
```

Esta alternativa no cambia de rama ni reescribe historia, pero crea un commit nuevo en lugar de integrar `b674e52`.

### F1.7 Respuestas directas

1. **Estado actual del repositorio:** `main` en `e49d17d`, árbol limpio salvo este documento sin rastrear; la rama corregida está un commit por delante y sincronizada con su remoto.
2. **Diferencias exactas:** 18 archivos; solo tres son la corrección de roles, `AdminPanel.jsx` no cambia y los otros 15 son scripts, documentación, configuración o estado local de la CLI.
3. **Cambios que corrigen los problemas:** prioridad de `app_metadata.gym_role` en `App.jsx`, `adminAccess.js` y `receptionAccess.js`, más `staffRole` con fallback `'member'`.
4. **Estado de las pruebas:** 41/41 y 61/61 pasan, pero ninguna suite cubre los escenarios con `role: 'authenticated'` ni el `staffRole` del panel; no hay regresión automática de P-01/P-02.
5. **¿Se recomienda el fast-forward?** Sí, es seguro y preserva el commit existente; con la salvedad de limpiar después los `supabase/.temp/*`.
6. **Comandos:** los de F1.6, ejecutados por el propietario. Esta intervención se detiene antes de integrar o modificar código.

## Anexo A. Comprobación local de roles

Ejecutado desde la raíz del repositorio:

```powershell
node --input-type=module -e "import { isAdminUser } from './frontend-web/src/lib/adminAccess.js'; import { isReceptionUser } from './frontend-web/src/lib/receptionAccess.js'; const admin={email:'admin@ironforge.com',role:'authenticated',app_metadata:{gym_role:'admin'}}; const reception={email:'recepcion@ironforge.com',role:'authenticated',app_metadata:{gym_role:'reception'}}; console.log('admin ->', isAdminUser(admin)); console.log('reception ->', isReceptionUser(reception)); const adminNoJwtRole={email:'admin@ironforge.com',app_metadata:{gym_role:'admin'}}; console.log('admin sin user.role ->', isAdminUser(adminNoJwtRole));"
```

Salida:

```
admin -> false
reception -> false
admin sin user.role -> true
```

Conclusión: el fallo está en la combinación `App.jsx:82` + `adminAccess.js:11-12` + `receptionAccess.js:10-11`, no en la base de datos. La forma del usuario real de Supabase incluye `role`, y ese valor gana sobre `app_metadata.gym_role`.

## Anexo B. Glosario de tablas reales

| Nombre usado en la UI/hook | Tabla real | Nota |
|---|---|---|
| "pagos" (Reportes) | `payments` | El hook usa `pagos`, que no existe. |
| "asistencia" (Reportes) | `gym_attendance` | El hook usa `asistencia`, que no existe. |
| Ventas | `pos_sales` + `pos_sale_items` | Correcto en Caja/Finanzas. |
| Gastos | `operating_expenses` | Correcto. |
| Cajas | `cash_register_sessions` | Correcto. |
| Personal | `staff_accounts` | Correcto; el rol efectivo está en el JWT. |
| Configuración | `gym_settings` | Correcto; sin consumidores. |
| Planes | `plans` | Correcto; `codigo` es la clave lógica. |
| Socios | `profiles` | Correcto. |
| Membresías | `memberships` | Correcto. |
| Asistencias | `gym_attendance` | Correcto fuera de Reportes. |
