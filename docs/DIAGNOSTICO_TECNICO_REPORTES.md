# DIAGNÓSTICO TÉCNICO DE REPORTES — IRONFORGE GYM

## 1. Verificación inicial del proyecto

| Comprobación | Resultado |
|---|---|
| Rama actual | `integracion-roles-panel-admin` |
| Commit actual | `bfd6ce7 fix(auth): correct gym role identification and access control` |
| `main` | `e49d17d` (intacto, sin merge ni fast-forward) |
| Archivos sin tracking | `docs/DIAGNOSTICO_PANEL_ADMIN.md`, `docs/AUDITORIA_PAGOS_DASHBOARD_REPORTES.md` |
| Cambios en código | Ninguno (auditoría de solo lectura) |

---

## 2. Estructura y funcionamiento actual del módulo

El módulo de Reportes se compone de dos archivos principales:

| Archivo | Propósito |
|---|---|
| `frontend-web/src/hooks/useAdminReports.js` | Hook que obtiene y formatea los datos de los reportes. Es la fuente única de lógica. |
| `frontend-web/src/components/admin/AdminReports.jsx` | Componente UI que consume el hook y muestra: tabla de pagos filtrados, barras por método de pago, ranking de clases, estado de clientes/membresías. |

### Flujo de datos

1. **Render inicial:** `useAdminReports()` se ejecuta con `useMemo` y retorna datos "seed" (simulados). El `refresh()` programado en `useEffect` se ejecuta después.
2. **Refresh manual:** El usuario clickea el botón "Actualizar", que llama a `refresh()`.
3. **`refresh()`:** Intenta consultar `supabase.from('pagos')` y `supabase.from('asistencia')`. Como esas tablas no existen en las migraciones actuales, el `catch` deja los datos seed intactos.
4. **Filtrado en el componente:** `AdminReports.jsx` filtra los pagos por período (`hoy`, `semana`, `mes`, `rango`) usando la función `inRange()` y las fechas `from`/`to`.
5. **Cálculos derivados:** `byMethod` (conteo y total por método), `ingresosTotal` (suma de todos los pagos filtrados), `classRanking`, `activeShare`, `vencidas`, etc.

---

## 3. Componentes y archivos involucrados

| Archivo | Rol | Datos que consume |
|---|---|---|
| `useAdminReports.js` | Hook fuente | `seedClients`, `weeklyClasses`, `METHOD_KEYS`, `METHOD_NAMES`, `PLAN_PRICES` |
| `AdminReports.jsx` | Consumidor UI | `payments`, `classRanking`, `activas`, `vencidas`, `totalClientes`, `refresh`, `METHOD_KEYS`, `METHOD_NAMES` |
| `lib/csv.js` | Utilidad CSV | No integrada en el componente (solo se usa en `PosProductsManagement`). |
| `data/adminData.js` | Datos semilla | `seedClients` (7 clientes), `shiftDate()`, `todayISO()`, `PLAN_NAMES`, `METODOS_PAGO` |
| `data/gymData.js` | Datos de clases | `weeklyClasses` (estructura semanal de clases) |
| `lib/membershipStatus.js` | Estado de membresía | `getMembershipStatus()` (usado por `useAdminReports.js:91-92`). |

### Flujo visual en AdminReports.jsx

1. **Filtros de período** (hoy/semana/mes/rango) seleccionan qué pagos mostrar.
2. **Tabla de pagos filtrados** muestra listado con método, monto, cliente y fecha.
3. **Barras por método** (accent/volt/amber) muestran `count` y `total` por método.
4. **Ingresos totales** (`ingresosTotal`) suma `monto` de todos los pagos filtrados.
5. **Ranking de clases** usa `weeklyClasses` local, no datos reales.
6. **Estado de clientes** usa `seedClients` + `getMembershipStatus()` para contar activas/vencidas.

---

## 4. Tablas y columnas reales identificadas

De las migraciones SQL verificadas:

| Tabla | Columnas clave | Estado en Reportes |
|---|---|---|
| `payments` | `id`, `user_id`, `plan_id`, `monto` (`numeric(10,2)`), `metodo_pago` (`qr/efectivo/transferencia/tarjeta`), `estado_pago` (`pendiente/completado/fallido/expirado`), `transaction_id`, `qr_code_payload`, `created_at` | **No se usa**. El hook consulta `from('pagos')` (nombre incorrecto) y usa `SEED_PAYMENTS`. |
| `memberships` | `id`, `user_id`, `plan_id`, `fecha_vencimiento`, `estado` (`activa/por_vencer/vencida/cancelada`) | **No se usa** directamente; solo indirectamente vía `getMembershipStatus()`. |
| `profiles` | `id`, `plan_id`, `nombre`, `apellido`, `ci`, `email`, `fecha_nacimiento` | **No se usa** en el hook actual. |
| `plans` | `id`, `codigo`, `nombre`, `precio`, `duracion_dias` | **No se usa** en el hook actual. |
| `pos_sales` | `id`, `cashier_id`, `metodo_pago` (`qr/efectivo/transferencia/tarjeta/yape_plin`), `total`, `receipt_number`, `created_at` | **No se usa** en el hook actual. |
| `operating_expenses` | `id`, `created_by`, `concepto`, `categoria` (`Sueldos/Alquiler/Servicios/Insumos/Mantenimiento/Otros`), `metodo_pago`, `monto`, `created_at` | **No se usa** en el hook actual. |
| `classes` | `id`, `nombre`, `descripcion`, `fecha`, `hora_inicio`, `hora_fin`, `capacidad`, `entrenador`, `activo`, `reservas_count` | **Usado solo localmente** en `weeklyClasses` para `classRanking`, sin conexión a Supabase. |
| `bookings` | `id`, `user_id`, `class_id`, `estado` (`confirmada/cancelada`), `created_at`, `cancelled_at` | **No consultado** en el hook actual. |
| `asistencia` | **No existe** en migraciones | El hook `refresh()` consulta `from('asistencia')` → error → datos seed. |
| `pagos` | **No existe** (tabla correcta es `payments`) | El hook `refresh()` consulta `from('pagos')` → error → datos seed. |

---

## 5. Fuentes de datos de cada indicador

| Indicador | Fuente actual | Es real? | Comentario |
|---|---|---|---|
| **Pagos por método** | `SEED_PAYMENTS` (40 inventados) | No | 2+ pagos por día × 40 días, distribuidos al azar entre 5 métodos |
| **Ingresos totales** | `SEED_PAYMENTS` sumados | No | `monto` toma valores de `PLAN_PRICES = [180, 240, 300]` |
| **Ranking de clases** | `weeklyClasses` local | Parcial | Usa `capacity` y `booked` del módulo 1, sin conexión a Supabase. |
| **Clientes activos/vencidos** | `seedClients` + `getMembershipStatus()` | Parcial | `seedClients` son 7 clientes fijos; `getMembershipStatus()` calcula estado por `fechaVencimiento`. |
| **Total de clientes** | `seedClients.length = 7` | No | Constante fija. |
| **Asistencias** | `supabase.from('asistencia')` (tabla inexistente) | No | Causa error en `refresh()`, cae a datos seed. |
| **Filtro por período** | `inRange()` sobre `p.fecha` del seed | No | Filtrado sobre fechas inventadas, no sobre datos reales. |

---

## 6. Datos semilla encontrados

### `SEED_PAYMENTS` (línea 54 de `useAdminReports.js`)

Generado por `buildSeedPayments()` (línea 30-52):

- **40 pagos** distribuidos en los últimos 40 días (`shiftDate(-d)`).
- **2 a 4 pagos por día** (fórmula: `2 + ((d * 7) % 4)`).
- **Método** aleatorio: `PAY_METHODS[(d + i) % PAY_METHODS.length]` → `qr`, `efectivo`, `yape_plin`, `transferencia`, `tarjeta`.
- **Monto** aleatorio: `PLAN_PRICES[(d + i) % PLAN_PRICES.length]` → `180`, `240`, o `300`.
- **Cliente** aleatorio: `CLIENT_NAMES[(d + i) % CLIENT_NAMES.length]` → 7 nombres fijos.
- **4 pagos "hoy"** añadidos al final (efectivo 240, QR 300, tarjeta 180, transferencia 240).

### `seedClients` (adminData.js línea 52-137)

- 7 clientes con `id`, `nombre`, `apellido`, `ci`, `telefono`, `plan`, `fechaVencimiento`, `photo`.
- Usados para contar `activas`, `vencidas`, `totalClientes`.

### `weeklyClasses` (gymData.js)

- Datos locales de clases con `nombre`, `capacidad`, `booked`/`reservas_count`.
- Usados para `classRanking` (las 5 clases más concurridas).

---

## 7. Análisis funcional de cada apartado

### 7.1 Indicadores principales

| Indicador | Funcionamiento actual | Datos | Correctitud |
|---|---|---|---|
| **Ingresos totales** | Suma de `monto` de `filtered` (pagos seed dentro del período) | Inventado | ❌ No refleja ingresos reales |
| **Pagos por método** | `byMethod[key].count` y `byMethod[key].total` calculados sobre `filtered` | Inventado | ❌ No refleja ventas reales |
| **Ingresos por método** | Misma que arriba, desglosado | Inventado | ❌ No refleja ventas reales |

### 7.2 Ingresos por membresías

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| No se calcula independientemente. Los `SEED_PAYMENTS` incluyen montos de planes (180/240/300) que simulan pagos de membresía, pero no hay filtro `estado_pago = 'completado'` ni consulta a la tabla `payments`. | Inventado | ❌ No distingue membresías completadas de otros pagos |

### 7.3 Ventas POS

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| **No aparece en la UI** del reporte. La tabla `pos_sales` no es consultada en ningún momento. | N/A | ❌ Datos inexistentes en el reporte |

### 7.4 Ingresos comerciales totales

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| `ingresosTotal = reduce suma sobre filtered` (todos los seed dentro del período). | Inventado | ❌ No distingue membresías de otros pagos, ni incluye POS. |

### 7.5 Gastos operativos

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| **No mostrado** en ningún momento en el componente AdminReports. | N/A | ❌ Ausente |

### 7.6 Métodos de pago

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| Los `SEED_PAYMENTS` incluyen los 4 métodos: `qr`, `efectivo`, `transferencia`, `tarjeta`. Adicionalmente `yape_plin` está en `METHOD_KEYS` pero no en los seed (porque `PLAN_PRICES` y `CLIENT_NAMES` tienen longitud 3 y 7 respectivamente, y el ciclo `(d+i) % length` distribuye). | Mixto | ⚠️ 4 métodos simulados, 1 adicional teórico sin datos. |

### 7.7 Evolución de ingresos por periodo

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| No hay historial comparativo. El filtro `rangeType` solo muestra el período seleccionado, no compara con anterioridad. | Inventado | ❌ No hay evolución histórica |

### 7.8 Clientes y membresías

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| `activas` = clientes de `seedClients` con `fechaVencimiento` no vencida. `vencidas` = lo contrario. `totalClientes` = 7 fijos. | Mixto (seed + fórmula) | ⚠️ Simulación lógica correcta, pero datos fijos. |

### 7.8 Asistencia

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| `refresh()` consulta `supabase.from('asistencia')` → error (tabla inexistente) → cae a seed vacío. No hay asistencias mostradas. | Inexistente | ❌ Tabla no existe en migraciones. |

### 7.9 Gráficos y tablas

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| Barras `Bar` con `value` y `maxMethod` sobre `byMethod.total`. Tabla de ranking con `c.booked` y `c.occupancy`. | Inventado | ❌ Datos simulados, no reales. |

### 7.10 Filtros

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| `RANGE_OPTIONS = ['hoy', 'semana', 'mes', 'rango']`. `inRange()` filtra `p.fecha` (cadena) contra el tipo seleccionado. El `from`/`to` manuales solo aplican a `rango`. | Simulado | ⚠️ Lógica presente pero sobre datos inventados. |

### 7.11 Exportación CSV

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| `lib/csv.js` existe pero **no está importado ni usado** en AdminReports.jsx. Solo se usa en `PosProductsManagement`. | N/A | ❌ Funcionalidad desconectada. |

### 7.12 Rangos de fecha personalizados

| Funcionamiento actual | Datos | Correctitud |
|---|---|---|
| Los inputs `from`/`to` están presentes pero solo aplican cuando `rangeType = 'rango'`. Sobre seed, el filtrado es sobre fechas inventadas. | Inventado | ⚠️ UI presente pero datos no reales. |

---

## 8. Coherencia con Dashboard y Finanzas

### 8.1 Comparación de criterios contables

| Concepto | Reportes | Dashboard | Finanzas | Coherencia |
|---|---|---|---|---|
| **Membresías: pagos completados** | No filtrado. Usa todos los `SEED_PAYMENTS` sin importar `estado_pago`. | No aplica (Dashboard muestra `ingresosMes` global). | `useAdminFinance.refresh()` filtra `estado_pago = 'completado'` ✅ | **Desconexión**: Reportes no aplica el filtro que sí usa Finanzas. |
| **Ventas POS** | No consultado (`pos_sales` inexistente en hook). | No mostrado en KPIs de ingresos. | `useAdminFinance.refresh()` consulta `pos_sales.total` ✅ | **Desconexión**: Reportes no incluye POS, Finanzas sí. |
| **Ingresos comerciales totales** | `ingresosTotal = suma seed filtrado` | `currentIncome` = `payments completados + pos_sales total` | Igual que Finanzas si Reportes consultara `payments` real. | **Desconexión**: Fórmula distinta por usar seed. |
| **Gastos operativos** | No mostrado. | No mostrado en KPIs de ingresos. | `useAdminFinance.refresh()` consulta `operating_expenses.monto` como egresos. | ✅ Ausente en ambos (correcto). |
| **Período de fechas** | `RANGE_OPTIONS` fijos + `from/hasta` manuales. | `useAdminFinance` usa `currentAndPreviousMonth()` (últimos 2 meses). | `useAdminDashboard` usa `todayISO()` y `filterByDate`. | **Diferente**: Reportes tiene más opciones, pero todas sobre seed. |
| **Métodos de pago** | `METHOD_KEYS = [qr/efectivo/yape_plin/transferencia/tarjeta]` | No mostrado desglosado. | `useAdminFinance` agrupa `payments.metodo_pago` y `pos_sales.metodo_pago`. | **Diferente**: Reportes tiene `yape_plin` sin datos reales. |
| **Suma de pagos pendientes** | No filtrado. Todos los seed cuentan. | `useAdminFinance` filtra `estado_pago = 'completado'`. | ✅ Finanzas tiene filtro correcto. | **Desconexión**: Reportes no filtra pendientes. |
| **Datos semilla** | `SEED_PAYMENTS` siempre presente. | `24.850 Bs.` fallback en Dashboard. | Sin seed (usa datos reales vía RPC). | **Igualdad de problemas**: Ambos usan fallback cuando no hay datos reales. |

### 8.2 Hallazgos de coherencia

1. **Mayor discrepancia:** Reportes no aplica el filtro `estado_pago = 'completado'` que sí usa Finanzas. Los seed payments no tienen este campo, por lo que todos cuentan como "completados" por defecto.
2. **POS ausente:** Reportes no muestra ventas POS, mientras que Finanzas sí las incluye en `currentIncome`. Esta disparidad existe desde el diseño original.
3. **Fallback idéntico:** Ambos módulos usan datos simulados cuando no hay conexión real, aunque con valores diferentes (`24.850 Bs.` vs `SEED_PAYMENTS`).
4. **Sin datos reales en ninguno:** Tanto Reportes como Finanzas (si no se ha hecho refresh) muestran datos inventados, no reales.

### 8.3 Consecuencia

El módulo de Reportes **no es coherente** con los criterios contables acordados (membresías = `estado_pago = 'completado'`; ingresos totales = membresías + POS). Usa una fuente de datos propia y simulada que no coincide con la lógica de Finanzas/Dashboard.

---

## 9. Matriz de diagnóstico

| Apartado | Funcionamiento actual | Fuente actual | Fuente real disponible | Problema comprobado | Mejora mínima propuesta | Prioridad |
|---|---|---|---|---|---|---|
| **Pagos por método** | `SEED_PAYMENTS` (40 inventados) | Datos semilla | `payments` (tabla real, requiere query) | Usa datos inventados, no reales | Query a `payments` con `metodo_pago`, sin filtro estado (aunque seed no tiene ese campo) | Alta |
| **Ingresos por membresías** | `SEED_PAYMENTS` sumados sin filtro | Datos semilla | `payments` con `estado_pago = 'completado'` | No distingue completados de pendientes | Aplicar filtro `estado_pago = 'completado'` sobre query a `payments` | Alta |
| **Ventas POS** | No mostrado en UI | No consultado | `pos_sales` (tabla real, sin columna estado) | Datos inexistentes en UI | Mostrar `pos_sales.total` desglosado; notas que no tiene columna estado | Alta |
| **Ingresos comerciales totales** | `ingresosTotal = suma seed filtrado` | Datos semilla | `payments completados + pos_sales total` | Fórmula distinta a Finanzas | Unificar fórmula: `payments (completados) + pos_sales total` | Alta |
| **Gastos operativos** | No mostrado | No aplicado | `operating_expenses` (egresos) | Ausente en UI | Opcional: agregar sección de egresos separada de ingresos | Baja |
| **Filtros de período** | `inRange()` sobre `p.fecha` seed | Datos semilla | `payments.created_at`, `pos_sales.created_at` con filtros reales | Filtro sobre fechas inventadas | Reemplazar `inRange` por query a Supabase con `gte/lte created_at` | Alta |
| **Métodos de pago** | 4 simulados + `yape_plin` sin datos | Mixto | `payments.metodo_pago` y `pos_sales.metodo_pago` reales | `yape_plin` sin datos en seed | Quitar `yape_plin` de `METHOD_KEYS` o añadir datos reales | Media |
| **Evolución de ingresos** | No existe historial comparativo | Sin datos | Posible con 2 consultas a `payments` por meses consecutivos | No implementado | Opcional: añadir comparativa mes-año en UI | Baja |
| **Clientes y membresías** | `seedClients` (7 fijos) + `getMembershipStatus()` | Mixto | `memberships` tabla real + `profiles.plan_id` | Datos fijos vs. reales | Reemplazar `seedClients` por query a `memberships` + `profiles` | Alta |
| **Asistencia** | `refresh()` a `from('asistencia')` → error | Tabla inexistente | No existe en migraciones | Tabla inexistente | Opcional: eliminar consulta o crear tabla (fuera de alcance) | Muy Baja |
| **Exportación CSV** | `lib/csv.js` desconectado | Sin uso | `payments`/`pos_sales` datos reales | Funcionalidad desconectada | Opcional: importar y conectar botón en UI | Muy Baja |
| **Ranking de clases** | `weeklyClasses` local | Datos locales | `classes` + `bookings` reales | Datos limitados a módulo 1 | Opcional: consultar `classes` y `bookings` reales | Media |

**Prioridad Alta:** 1, 2, 3, 4, 6, 8, 10 (afectan el núcleo contable y datos reales).
**Prioridad Media:** 5, 7, 9, 12 (mejoras opcionales pero interesantes).
**Prioridad Baja:** 11, 13 (mejoras estéticas o accesorias).

---

## 10. Propuestas de mejoras mínimas ordenadas por prioridad

### Prioridad 1 — Corregir datos ficticios en Reportes (crítico)

1. **Modificar `useAdminReports.js`:**
   - Reemplazar `SEED_PAYMENTS` por consulta a `supabase.from('payments')` con filtro `estado_pago = 'completado'` y rango `created_at`.
   - Mantener `seedClients` para `activas/vencidas` pero añadiendo query a `memberships` y `profiles` como fallback.
   - Actualizar `refresh()` para consultar `payments` y `memberships` (no `pagos`/`asistencia`).
   - Añadir cálculo de `ingresosPorMembresias` y `ingresosPOS` separados.

### Prioridad 2 — Consistencia contable con Finanzas (crítico)

1. Ajustar la fórmula de `ingresosTotal` en `AdminReports.jsx` para que coincida con la definición de Finanzas:
   - `ingresosPorMembresias` = suma de `payments.monto` donde `estado_pago = 'completado'`.
   - `ingresosPOS` = suma de `pos_sales.total`.
   - `ingresosTotal` = `ingresosPorMembresias + ingresosPOS`.
   - Mosttrar los tres valores desglosados en la UI.

### Prioridad 3 — Filtros de fecha reales (alta)

1. Reemplazar el `refresh()` actual por consultas a `payments` y `memberships` con parámetros `gte/lte created_at` basados en el `rangeType` seleccionado.
2. Implementar la lógica de `from/hasta` manuales usando las fechas reales de las consultas, no sobre `p.fecha` inventado.

### Prioridad 4 — Clientes y membresías reales (alta)

1. Sustituir `seedClients` por query a `memberships` (con estado `activa/por_vencer/vencida`) y `profiles` (para nombres y conteo total).
2. Usar `getMembershipStatus()` como auxiliar pero sobre datos reales de Supabase.

### Prioridad 5 — Mejoras opcionales

- **Ranking de clases:** Consultar `classes` y `bookings` reales en lugar de `weeklyClasses` local.
- **Gráficos de evolución:** Añadir comparación mes-año usando dos consultas a `payments` (mes actual + mes anterior).
- **Exportación CSV:** Importar `lib/csv.js` y crear botón que exporte `payments` y `pos_sales` filtrados por período.
- **Asistencia:** Dado que la tabla no existe, eliminar la consulta `refresh()` a `asistencia` o añadir nota informativa.

---

## 11. Archivos que probablemente necesitarían cambios durante una futura implementación

| Archivo | Tipo de cambio | Prioridad |
|---|---|---|
| `frontend-web/src/hooks/useAdminReports.js` | Modificar hook principal (lo más crítico) | Alta |
| `frontend-web/src/components/admin/AdminReports.jsx` | UI: filtros, desglose contable, mostrar POS | Alta |
| `frontend-web/src/hooks/useAdminFinance.js` | Validación cruzada; asegurar que fórmulas concuerden | Media |
| `frontend-web/src/components/admin/AdminDashboard.jsx` | Consistencia visual con los nuevos valores de Reportes | Media |
| `frontend-web/src/data/adminData.js` | Opcional: quitar o mantener `seedClients` como fallback | Baja |
| `frontend-web/scripts/lib/csv.js` | Opcional: importar y conectar en UI | Muy Baja |
| `supabase/migrations/20261005000006_reception_pos.sql` | No tocar (ya está definido) | — |

---

## 11. Pruebas que deberían realizarse después de implementar

| Test | Archivo | Objetivo |
|---|---|---|
| `npm run build` | — | Confirmar que los cambios no rompen el build. |
| `npm run lint` | — | Confirmar que no hay errores nuevos. |
| Manual: seed → real | Reportes | Verificar que deja de mostrar `SEED_PAYMENTS` y muestra totales reales de `payments` y `pos_sales`. |
| Manual: filtro por período | Reportes | Verificar que los filtros `hoy/semana/mes/rango` usan fechas reales de Supabase. |
| Manual: desglose contable | Reportes | Verificar que `ingresosPorMembresias`, `ingresosPOS` y `ingresosTotal` coinciden con Finanzas. |
| Manual: métodos de pago | Reportes | Verificar que los totales por método coinciden con los registros reales de `payments.metodo_pago`. |
| Manual: clientes | Reportes | Verificar que `activas`, `vencidas`, `totalClientes` provienen de `memberships`/`profiles` reales. |
| Manual: CSV export (opcional) | Reportes + csv.js | Verificar que el botón descarga archivo CSV con datos reales filtrados. |

---

## 12. Confirmación final

- **Solo se creó:** `docs/DIAGNOSTICO_TECNICO_REPORTES.md`.
- **Sin modificar código:** Los archivos fuente (`useAdminReports.js`, `AdminReports.jsx`, etc.) permanecen intactos.
- **Sin escrituras en Supabase:** Solo lecturas de migraciones y código.
- **Rama sin cambios:** `integracion-roles-panel-admin` en `bfd6ce7`, `main` en `e49d17d`.

---
*Diagnóstico técnico de Reportes concluido. El documento `docs/DIAGNOSTICO_TECNICO_REPORTES.md` ha sido creado con todos los hallazgos y propuestas de mejora.*