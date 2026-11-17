# AUDITORÍA DE PAGOS SIMULADOS, DASHBOARD Y REPORTES
## IronForge Gym — Rama `integracion-roles-panel-admin` (commit `bfd6ce7`)

**Fecha:** 2026-11-16 · **Tipo de intervención:** Fase 3, solo lectura · **Sin modificaciones de código**, SQL, configuración ni escrituras remotas.

---

## 1. Verificación inicial

| Comprobación | Resultado |
|---|---|
| Rama actual | `integracion-roles-panel-admin` |
| Commit actual | `bfd6ce7 fix(auth): correct gym role identification and access control` |
| `main` | `e49d17d` (intacto, sin merge ni fast-forward) |
| Cambios sin confirmar | `docs/DIAGNOSTICO_PANEL_ADMIN.md` sin rastrear (solo artefacto de Fase 0) |
| Escrituras remotas | Ninguna (solo lectura local) |

---

## 2. Recorrido completo del pago simulado

### 2.1 Componentes involucrados

| Componente | Archivo | Rol |
|---|---|---|
| **Maquina de estados** | `frontend-web/src/hooks/usePaymentMVI.js` | Gestiona `PAYMENT_STATUS` (`IDLE → GENERATING_QR → AWAITING_PAYMENT → PROCESSING → SUCCESS/ERROR → RESET`). Transiciones estrictas; una vez en `PROCESSING`, las llamadas repetidas al simulador se bloquean (ref `processingRef`). |
| **Vista (Modal)** | `frontend-web/src/components/PaymentModal.jsx` | UI que muestra métodos de pago (`QR`, `Efectivo`, `Transferencia`, `Tarjeta`), cuenta regresiva, y estados `GENERATING_QR`, `AWAITING_PAYMENT`, `SUCCESS`, `ERROR`. |
| **Servicio RPC** | `frontend-web/src/services/paymentService.js` | `confirmarPagoExitoso()` → llama a la RPC `procesar_pago_exitoso(...)`. Si Supabase no está configurado, devuelve error controlado. |
| **RPC SQL** | `supabase/migrations/20260829000005_payments.sql` | `procesar_pago_exitoso(p_transaction_id, p_user_id, p_plan_id, p_monto, p_metodo_pago)`: valida el plan, insert/up-sert en `payments` con `estado_pago = 'completado'`, crea/renueva `memberships`, actualiza `profiles.plan_id`. `security definer`, solo `authenticated` puede ejecutar. |
| **Servicio auxiliar** | `frontend-web/src/services/paymentService.js` | `crearRegistroPagoPendiente()`: insert en `payments` con `estado_pago = 'pendiente'` y `qr_code_payload`. `generarTransactionId()`, `generarPayloadQR()`. |
| **Hook de consumidor** | `frontend-web/src/hooks/usePaymentMVI()` | Expone `simulatePaymentSuccess()`, `paymentCompleted()`, `reset()`, `status`, `canSimulate`. El `handleSimular` del modal llama a `mvi.simulatePaymentSuccess()` y luego a `confirmarPagoExitoso()`. |
| **Modal principal** | `frontend-web/src/components/PaymentModal.jsx` (línea 240-257) | `handleSimular`: si `status === AWAITING_PAYMENT` y `!processingRef.current`, marca `PROCESSING` y confirma vía RPC. Si `ok`, llama a `mvi.paymentCompleted(membership)` y `saveRegisteredClient()`. |
| **ID de transacción** | `paymentService.js:56-61` | `generarTransactionId()`: formato `txn-<uuid_corto>`. Usado como `UNIQUE` en `payments.transaction_id` y para idempotencia ( `on conflict (transaction_id) do update` en la RPC). |

### 2.2 Condiciones y flujo

1. **Abrir modal:** `PaymentModal` se abre con `plan` y `user`. Efecto `initPayment` dispara `GENERATING_QR`.
2. **QR generado:** `QR_GENERATED` → estado `AWAITING_PAYMENT`, se muestra el código QR y la cuenta regresiva (5 min).
3. **Simular pago:** El usuario hace clic en "Simular Pago Exitoso" (o "Pagar Bs. X" para tarjeta con datos válidos). Esto llama a `handleSimular()` → `mvi.simulatePaymentSuccess()` → `dispatch(SIMULATE_PAYMENT_SUCCESS)` → estado `PROCESSING`. Luego `confirmarPagoExitoso(RPC)`:
   - Valida plan UUID.
   - Ejecuta RPC `procesar_pago_exitoso`.
   - RPC hace `upsert` en `payments` (por `transaction_id`), crea/renueva `memberships`, actualiza `profiles.plan_id`.
   - Retorna `ok: true` y `membership`.
4. **Éxito:** `paymentCompleted(membership)` → estado `SUCCESS`. El modal muestra "Pago confirmado" y el socio ya tiene membresía activa.
5. **Fallo:** `setError(message)` → estado `ERROR`. El modal muestra el mensaje y permite reintentar (`RESET`).
6. **Idempotencia:** Si el mismo `transaction_id` se usa nuevamente, la RPC hace `on conflict (transaction_id) do update set estado_pago = 'completado'...`, por lo que **no hay doble cobro**.

### 2.3 Cuatro métodos de pago (simulados)

| Método | Descripción en UI | Validación frontal | Escritura en Supabase |
|---|---|---|---|
| `QR` | Mostra código QR simulado; se escanea en billetera. | Ninguna (solo visual). | `crearRegistroPagoPendiente` → `payments` con `metodo_pago = 'qr'`, `estado_pago = 'pendiente'`. |
| `Efectivo` | Indica "Realiza el pago en caja y confirma". | Ninguna. | Igual que QR; el pago se registra como `pendiente` y luego confirmado vía RPC. |
| `Transferencia` | Indica "Transfiere a la cuenta del gimnasio y usa tu ID". | Ninguna. | Igual que QR/efectivo. |
| `Tarjeta` | Campos Número, Nombre, Expiración, CVC. Se valida `isValidCardNumber`, `isValidExpiry`, `cardCVC.length >= 3`. | Sí: los campos deben pasar validación para habilitar el botón. | Igual; los datos no se guardan, solo se usa como disparador visual. |

**Importante:** El comportamiento de "éxito simulado" es **intencional**. Cuando la simulación resulta exitosa, el sistema registra la operación como completada y activa la membresía. No se requiere confirmación manual de recepción. No se incorpora pasarela bancaria real.

### 2.4 Activación de membresía

Al confirmar el pago exitoso mediante `confirmarPagoExitoso(RPC)`:

1. La RPC `procesar_pago_exitoso` **upsert** en `payments`: `estado_pago = 'completado'`, y asocia `membership_id`.
2. **Upsert** en `memberships`: si ya hay una membership activa por usuario, se renueva (nuevo `plan_id`, nuevas fechas). Si no, se crea una nueva.
3. **Actualización** en `profiles`: `plan_id` se asigna al UUID del plan activo.
4. **Retorno:** La RPC devuelve la fila de `memberships` (`returning * into v_membership`).
5. **Resultado:** El usuario tiene una membership `activa` con `fecha_vencimiento` calculada a partir de `plans.duracion_dias`. La membership es visible en `useAdminClients.js` y `AdminDashboard.jsx`.

### 2.5 Falla o cancelación

- **Cancelación:** El usuario hace clic en "Cancelar" mientras está en `AWAITING_PAYMENT`. Esto llama a `handleClose` → `mvi.reset()` → estado `IDLE`.
- **Expiración:** La cuenta regresiva llega a 0 → `mvi.setError('El tiempo para completar el pago ha expirado')` → estado `ERROR`.
- **Fallo RPC:** Si la RPC lanza error (plan inexistente, Supabase no configurado, etc.), `confirmarPagoExitoso` retorna `{ok: false, message}`. El modal muestra el error y permite `handleRetry` → `mvi.reset()` → `initPayment` para reiniciar el flujo.
- **Doble cobro:** Prevenido por la máquina de estados (`processingRef`) y la idempotencia por `transaction_id` en la RPC.

---

## 3. Tablas y columnas reales utilizadas

| Tabla | Columnas clave | Notas |
|---|---|---|
| `public.payments` | `id`, `user_id`, `plan_id`, `monto` (`numeric(10,2)`), `metodo_pago` (`qr`, `efectivo`, `transferencia`, `tarjeta`), `estado_pago` (`pendiente`, `completado`, `fallido`, `expirado`), `transaction_id` (UNIQUE), `qr_code_payload`, `created_at` | La RPC `procesar_pago_exitoso` usa `transaction_id` para idempotencia y `upsert`. |
| `public.memberships` | `id`, `user_id`, `plan_id`, `fecha_inicio`, `fecha_vencimiento`, `estado` (`activa`, `por_vencer`, `vencida`, `cancelada`) | Una membership activa por usuario (índice único `uq_memberships_activa_por_usuario`). |
| `public.profiles` | `id`, `plan_id` (FK a `plans.id`) | El plan activo del usuario se actualiza al confirmar pago. |
| `public.plans` | `id`, `codigo`, `nombre`, `precio`, `duracion_dias` | Se usa `duracion_dias` para calcular `fecha_vencimiento = now() + duracion_dias`. |
| `public.pos_sales` | `id`, `cashier_id`, `metodo_pago` (`qr`, `efectivo`, `transferencia`, `tarjeta`, `yape_plin`), `total`, `receipt_number` | Ventas POS independientes; no son pagos de membresía. |
| `public.operating_expenses` | `id`, `created_by`, `concepto`, `categoria`, `metodo_pago`, `monto` | Gastos operativos (sueldos, alquiler, etc.). No forman ingresos por membresía. |

**NOTA:** No existe tabla `gym_attendance` ni columna `role` en `profiles`. El rol funcional vive en `app_metadata.gym_role` de Supabase Auth.

---

## 4. Estados y métodos de pago encontrados

### Estados de pago en `payments`

| `estado_pago` | Significado | Cuándo se usa |
|---|---|---|
| `pendiente` | Registro inicial (al crear `crearRegistroPagoPendiente`). | Después de generar QR/efectivo/transferencia; antes de confirmar. |
| `completado` | Pago confirmado exitosamente. | Después de `procesar_pago_exitoso(RPC)`. |
| `fallido` | No se usa en el flujo actual; definido en `check` por si futuras RPCs lo lanzan. | — |
| `expirado` | No se usa en el flujo actual. | — |

### Métodos de pago en `payments` y `pos_sales`

| Tabla | `metodo_pago` permits |
|---|---|
| `payments` | `check (metodo_pago in ('qr', 'efectivo', 'transferencia', 'tarjeta'))` |
| `pos_sales` | `check (metodo_pago in ('qr', 'efectivo', 'transferencia', 'tarjeta', 'yape_plin'))` |

**Observación:** `pos_sales` incluye `'yape_plin'` que `payments` no tiene. Los pagos de membresía usan exclusivamente los 4 métodos de `payments`.

---

## 5. Funcionamiento de la activación de membresías

1. **Selección:** Usuario elige membresía en la landing o booking.
2. **Abrir modal:** `PaymentModal` se abre con el `plan` y `user`.
3. **Método:** Usuario selecciona `QR`, `Efectivo`, `Transferencia` o `Tarjeta`.
4. **QR/Previsualización:** Si `QR`, se muestra el código. Si `Tarjeta`, se piden los datos (aunque no se validan contra banco).
5. **Simular:** Usuario hace clic en "Simular Pago Exitoso".
6. **Máquina de estados:** `AWAITING_PAYMENT → PROCESSING → SUCCESS`.
7. **RPC `procesar_pago_exitoso`:** 
   - Valida plan.
   - `upsert` `payments` (por `transaction_id`).
   - `upsert`/`create` `memberships` (una por usuario, estado `activa`).
   - Actualiza `profiles.plan_id`.
8. **Membresía activa:** El usuario ya puede ver clases, reservar y tener acceso al gimnasio según su plan.
9. **Reflexión en UI:** `useAdminClients.js`, `AdminDashboard.jsx`, `useAdminReports.js` reflejan el nuevo `estado = 'activa'` y el `plan_id` actualizado al refrescar.

**Nota clave:** No hay paso de "confirmación manual de recepción". El flujo es automático: simular → RPC → membership activa. Esto es consistente con el diseño del módulo 5.

---

## 6. Origen de los datos ficticios del Dashboard

### 6.1 `24.850 Bs.` hardcodeado

| Archivo | Línea | Contenido |
|---|---|---|
| `frontend-web/src/hooks/useAdminFinance.js:4` | `const MONTHLY_INCOME_FALLBACK = 24850` | Constante de respaldo. |
| `frontend-web/src/hooks/useAdminFinance.js:27` | `currentIncome: MONTHLY_INCOME_FALLBACK` | Estado inicial `finance.currentIncome`. |
| `frontend-web/src/hooks/useAdminDashboard.js:11` | `const SEED_INCOME = 24850` | Importado para las métricas. |
| `frontend-web/src/hooks/useAdminDashboard.js:67` | `const ingresosMes = SEED_INCOME` | Cuando `includeMonthlyIncome` es true. |
| `frontend-web/src/components/admin/AdminDashboard.jsx:254` | `value={fmtMoney(financeAvailable ? currentIncome : ingresosMes)}` | En la tarjeta "Ingresos del Mes": si `financeAvailable` es `false` (Supabase no configurado o error), muestra `ingresosMes` (24.850 Bs.). |

** Flujo actual (main `e49d17d` / rama `integracion-roles-panel-admin`):**

1. `useAdminFinance()` se inicializa con `available: false` y `currentIncome: 24850`.
2. `useAdminDashboard()` lee `SEED_INCOME = 24850` y lo muestra en la KpiCard "Ingresos del Mes" cuando el usuario **no es admin** o cuando `financeAvailable` es `false`.
3. Cuando el usuario **es admin** y se hace refresh (`refreshFinance`), `useAdminFinance.refresh()` consulta Supabase (`payments`, `pos_sales`, `operating_expenses`, `profiles`, `memberships`) y:
   - Si los datos llegan bien: `available: true`, `currentIncome` = suma real de `payments.monto` + `pos_sales.total` del mes actual.
   - Si falla: se conserva el error y `available` sigue siendo `false` (el estado `available` es `true` solo si **todas** las consultas exitosas).
4. **Resultado visual:**
   - **Admin, con datos reales:** Tarjeta muestra el total real de pagos del mes.
   - **Admin, sin datos Supabase:** Tarjeta muestra `24.850 Bs.` (fallback).
   - **No admin:** Siempre muestra `24.850 Bs.` (aunque tenga datos reales, la KpiCard usa `ingresosMes` por diseño para roles no admin).

**¿Por qué 24.850?** Es un valor semilla que representa un ingreso mensual estimado para un gimnasio de este tamaño. No proviene de ninguna tabla; es un número de respaldo estático.

### 6.2 `SEED_PAYMENTS` en Reportes

| Archivo | Línea | Contenido |
|---|---|---|
| `frontend-web/src/hooks/useAdminReports.js:29-52` | `function buildSeedPayments()` | Genera 40 días de pagos distribuidos al azar usando `PLAN_PRICES = [180, 240, 300]` y `METHOD_KEYS`. |
| `frontend-web/src/hooks/useAdminReports.js:54` | `const SEED_PAYMENTS = buildSeedPayments()` | Instancia única usada en el retorno. |
| `frontend-web/src/hooks/useAdminReports.js:94-95` | `return { payments: SEED_PAYMENTS, ... }` | El reporte muestra estos pagos simulados cuando no hay Supabase. |
| `frontend-web/src/hooks/useAdminReports.js:104-109` | `refresh()`: intenta `supabase.from('pagos').select(...)` y `supabase.from('asistencia').select(...)` | Nota: consulta tablas `pagos` y `asistencia` que **no existen** en las migraciones actuales (son nombres legacy). El `catch` usa la semilla. |

**Flujo:** Al abrir Reportes, `useAdminReports()` devuelve `SEED_PAYMENTS` (40 registros inventados). Si el usuario hace refresh y Supabase está configurado, intenta consultar `from('pagos')` y `from('asistencia')`. Como esas tablas no existen, el error cae a la semilla nuevamente. **Los reportes muestran siempre datos simulados a menos que se reescriban las consultas a `payments`, `memberships`, `bookings` etc.**

---

## 7. Posibles duplicaciones contables

| Tabla | qué representa | Riesgo de doble conteo |
|---|---|---|
| `payments` | Pagos de membresía (método QR/efectivo/transferencia/tarjeta). | **No** se debe sumar con `pos_sales` ni `operating_expenses`. Cada uno tiene un `transaction_id`/`receipt_number` propio. |
| `pos_sales` | Ventas de productos POS (accesorios, ropa, etc.). | **No** confundir con pagos de membresía. `metodo_pago` incluye `yape_plin` adicional. |
| `operating_expenses` | Gastos operativos (sueldos, alquiler, insumos). | **No** formar parte de los ingresos por membresía. |
| `cash_register_sessions` | Sesiones de caja (no es tabla nueva; está en el código PHP/RPC viejo, no en migraciones actuales). | **No** es una tabla Supabase actual; el frontend no la consulta directamente. |

**Recomendación:** Al calcular ingresos totales, usar exclusivamente `payments.monto` + `pos_sales.total` (solo si se quiere incluir ventas de productos), y **nunca** `operating_expenses`. El campo `estado_pago = 'completado'` es el filtro clave para distinguir ingresos reales de registros pendientes.

---

## 8. Cambios mínimos recomendados

| # | Archivo | Cambio | Prioridad | Problema que corrige |
|---|---|---|---|---|
| 1 | `frontend-web/src/hooks/useAdminFinance.js` | Activar consulta real a `payments`; quitar `available: false` / `MONTHLY_INCOME_FALLBACK`; si hay registros, `available: true` y `currentIncome` = suma real; si no, `currentIncome: 0` y mostrar mensaje. | **Alta** | Corrige P-05 (ingreso ficticio `24.850 Bs.`). |
| 2 | `frontend-web/src/hooks/useAdminReports.js` | Reemplazar `SEED_PAYMENTS` por consulta real a `payments` con filtros de fecha y método; agregar agrupación por `metodo_pago`. | **Alta** | Corrige P-06 (reportes simulados). |
| 3 | `frontend-web/components/admin/AdminDashboard.jsx:254` | Atar la tarjeta "Ingresos del Mes" a `financeAvailable ? currentIncome : 0` en lugar de `ingresosMes`. | **Alta** | Evita mostrar `24.850 Bs.` cuando hay datos reales. |
| 3b | `AdminDashboard.jsx:132` | Atar `showReceptionActions` a `!isTrainer` en lugar de `true` fijo. | **Baja** | Mejora UX: los entrenadores no ven accesos de recepción. |
| 4 | `frontend-web/scripts/lib/csv.js` | Integrar botón en `AdminReports.jsx` que invoque a `csv.js` exportando datos filtrados de `payments`/`memberships`. | **Mediana** | Habilita exportación CSV real. |
| 5 | `frontend-web/src/hooks/useAdminDashboard.js` | Añadir parámetros `startDate`/`endDate` al `refresh` y pasarlos a las consultas Supabase por fecha. | **Mediana** | Permite rangos de fechas personalizados. |
| 6 | `frontend-web/src/hooks/useAdminClients.js` | Reutilizar lógica de `memberships` + `profiles` ya existente para Reportes. | **Baja** | Evita duplicación de consultas de clientes. |

**Notas:**
- Los cambios 1 y 2 son el mínimo indispensable: quitan los datos simulados y dejan que el sistema muestre información real de Supabase.
- El cambio 3 es necesario para que el Dashboard no muestre `24.850 Bs.` cuando el admin ya tiene datos reales.
- Los cambios 4-6 son mejoras graduales.

---

## 9. Archivos que deberían modificarse

| Archivo | Motivación |
|---|---|
| `frontend-web/src/hooks/useAdminFinance.js` | Activar consulta real a `payments`; quitar fallback `24.850 Bs.`. |
| `frontend-web/src/hooks/useAdminReports.js` | Reemplazar `SEED_PAYMENTS` por consulta real; agregar filtros y agrupación. |
| `frontend-web/components/admin/AdminDashboard.jsx` | Mostrar ingreso real; atar `showReceptionActions` a `isTrainer`. |
| `frontend-web/scripts/lib/csv.js` | Integrar en Reportes (opcional). |
| `frontend-web/src/hooks/useAdminDashboard.js` | Añadir filtros de fechas y consulta real de clases/reservas (opcional). |

**Ningún archivo de SQL, migraciones, `.env`, RLS o Supabase debe modificarse en esta Fase.** Todos los cambios sonfrontend-only.

---

## 10. Pruebas necesarias

| Test | Archivo | Objetivo |
|---|---|---|
| `npm run build` | — | Confirmar que los cambios no rompen el build. |
| `npm run lint` | — | Confirmar que no hay errores nuevos (solo las 5 preexistentes). |
| Manual: income fake → real | Dashboard | Verificar que deja de mostrar `24.850 Bs.` y muestra datos reales o "0 Bs." al conectar Supabase. |
| Manual: reports seed → real | Reports | Verificar que deja de mostrar pagos inventados y muestra totales reales agrupados por método. |
| Manual: CSV export | Reports + csv.js | Verificar que el botón descarga un archivo CSV con datos reales de `payments`. |
| Manual: trainer reception gating | AdminPanel + Navbar | Verificar que `isTrainer` oculta los accesos directos de recepción según corresponda. |
| Manual: pago simulado completo | PaymentModal → RPC | Verificar que el flujo ID: abrir modal → seleccionar método → simular → membership activa → reflejo en AdminDashboard. |

---

## Resumen ejecutivo

### Hechos confirmados

1. **P-01 y P-02 (roles):** Ya fueron corregidos en la rama actual (`integracion-roles-panel-admin`, commit `bfd6ce7`). `app_metadata.gym_role` ahora tiene prioridad sobre `user.role: 'authenticated'`.
2. **P-05 (ingreso ficticio):** **Sigue vigente.** El Dashboard muestra `24.850 Bs.` hardcodeado en `useAdminFinance.js:4` y `useAdminDashboard.js:11`. La consulta real a `payments` existe en `useAdminFinance.refresh()` pero está inactiva (`available: false` por defecto).
3. **P-06 (reportes simulados):** **Sigue vigente.** `useAdminReports.js` usa `SEED_PAYMENTS` (40 pagos inventados) y `seedClients`. La función `refresh()` intenta consultar `from('pagos')` y `from('asistencia')`, pero esas tablas no existen en las migraciones, por lo que siempre cae a la semilla.
4. **P-03 (semilla en Dashboard):** Algunos KPIs usan `seedClients` como fallback; no todos vienen de Supabase en tiempo real.
5. **P-08 (arqueo contaminado):** Los totales de caja no filtran por `cashier_id` ni `created_by`; la UI y el cierre RPC pueden mostrar números distintos.
6. **P-13 (stock mínimo sin alertas):** No hay consumidor ni tabla de alertas; solo `PosProductsManagement.jsx:90` con `stock_minimo`.
7. **P-16 (desactivación que no desactiva):** `manage-staff` cambia `gym_role` a `'disabled'`, pero el JWT conserva el rol anterior hasta expirar. Ninguna política consulta `staff_accounts.activo`.
8. **Comportamiento de pago simulado:** Es intencional y se conserva. Al simular éxito, la RPC `procesar_pago_exitoso` crea/renueva membership y actualiza profiles de forma atómica. No hay doble cobro por la idempotencia por `transaction_id`.
9. **No hay escrituras remotas ni modificaciones en esta Fase:** Solo se realizó auditoría de lectura.

### Problemas que necesitan comprobación adicional

1. **Valores reales de `app_metadata.gym_role` en cuentas confirmadas:** La corrección de roles funciona en pruebas locales con objetos sintéticos, pero no se verificaron los valores reales en las cuentas de admin/recepcion/entrenador del gimnasio. El propietario debe confirmar que esas cuentas tienen `gym_role` asignado correctamente.
2. **Consistencia de `showReceptionActions`:** Se detectó que `AdminDashboard.jsx:132` tiene `showReceptionActions = true` hardcodeado, lo que hace que todos los usuarios vean los accesos directos de recepción independientemente de su rol. Se recomienda atarlo a `!isTrainer`.
3. **Filtros de fechas en Reportes y Dashboard:** Las consultas a Supabase tienen rangos de fecha fijos (último mes). No hay parámetros UI para rangos personalizados. Si es necesario, requerría añadir estado y pasar fechas a las consultas.
4. **Ausencia de tabla `gym_attendance`:** El reporte de asistencia no está implementado; la tabla no existe en las migraciones. Está fuera del alcance actual.

### Estado de las ramas

- **`main` (`e49d17d`):** Diagnóstico original conservado; P-01/P-02 presentes; `24.850 Bs.` y `SEED_PAYMENTS` activos.
- **`integracion-roles-panel-admin` (`bfd6ce7`):** Corrección de roles integrada; P-01/P-02 ausentes; P-05/P-06/P-07/P-08/P-13/P-16/P-16 siguen presentes (son independientemente de la corrección de roles).
- **Sin merge a `main`:** El commit `bfd6ce7` está solo en la rama de integración; `main` no ha recibido cambios.

### Recomendación final

**Fase siguiente:** Aplicar los cambios mínimos de la Tabla 8, prioridad 1 (archivos `useAdminFinance.js` y `useAdminReports.js`). Esto corregirá P-05 y P-06, que son los problemas de datos ficticios más críticos. La corrección de roles (`bfd6ce7`) ya está lista y no necesita ser reimplementada.

---
*Fin de la auditoría. Documento creado sin modificar código, SQL, configuración ni Supabase.*