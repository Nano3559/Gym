# Informe de Recuperación: Autenticación y Roles Administrativos

**Proyecto:** IronForge Gym  
**Revisión final local:** 2026-11-16

## Propósito del informe

Este documento resume el estado corregido del mecanismo de inicialización de
las cuentas internas de IronForge Gym y separa:

- el diagnóstico histórico de autenticación;
- las correcciones verificables del script;
- las acciones que todavía requieren una ejecución administrativa controlada.

La revisión final fue exclusivamente local. No se consultó ni modificó el
proyecto Supabase.

## Diagnóstico histórico conservado

La investigación anterior dejó estos antecedentes:

1. Las credenciales demo anteriores no eran usuarios reales de Supabase Auth;
   el frontend fabricaba identidades en memoria mediante un bypass.
2. Ese bypass fue eliminado y el acceso actual usa
   `supabase.auth.signInWithPassword()`.
3. Las migraciones no insertan usuarios Auth; no existe una seed de personal
   administrativo equivalente.
4. La lógica de rol del frontend tuvo una precedencia defectuosa entre el rol
   genérico de Auth y `app_metadata.gym_role`. Esa corrección pertenece a los
   archivos de acceso frontend y no fue modificada otra vez durante esta
   revisión final del script.

Estos puntos son contexto del proyecto. Esta revisión no volvió a consultar
el estado remoto, por lo que no afirma que las cuentas existan o no existan
en Supabase.

## Estado final del script de inicialización

`supabase/scripts/initialize-staff.mjs` quedó como un módulo ESM con las
siguientes garantías:

### Configuración

Exige simultáneamente:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_REF
```

Comprueba que `SUPABASE_URL` use HTTPS y que su host sea exactamente
`<SUPABASE_PROJECT_REF>.supabase.co`. Rechaza credenciales embebidas, puertos,
rutas, parámetros y fragmentos. La clave de servicio no se muestra en la
salida.

### Contraseñas

- La entrada está oculta mediante una interfaz `readline` en modo terminal y
  una salida interna descartada.
- Se exige terminal interactiva con `setRawMode`; si no existe, el script se
  detiene antes de preguntar.
- Se solicita confirmación.
- El mínimo es de ocho caracteres.
- Los espacios no se recortan.
- EOF o cierre de entrada se informa como error.
- El lector se cierra en `finally`.
- Las contraseñas no se escriben en logs o archivos y se redactan si
  aparecieran accidentalmente en un mensaje remoto.

### Cuentas Auth existentes

- No se actualiza ningún usuario preexistente.
- No se cambia ninguna contraseña existente.
- `gym_role='disabled'` se bloquea y no se reactiva.
- Un rol distinto del esperado se bloquea como `blocked_role_mismatch`.
- Cuando el rol ya es correcto, no se solicita contraseña.

### Preflight y paginación

- `findUserByEmail()` recorre páginas reales y normaliza los correos.
- Diferencia `found`, `not_found` y `error`.
- Un error de red o API nunca se interpreta como usuario inexistente.
- Rechaza totales contradictorios, páginas repetidas o solapadas y paginación
  incompleta.
- Recorre más de nueve páginas sin confiar en el valor numérico de `nextPage`
  (el parser del SDK truncaría los números mayores de nueve).
- Antes de escribir, consulta Auth y `staff_accounts` para cada cuenta.
- Busca el correo de `staff_accounts` sin distinguir mayúsculas y bloquea
  filas duplicadas o en conflicto.
- Un fallo de preflight produce resultados `error`/`not_processed` y cero
  escrituras.

### Concurrencia

- Repite la lectura completa después de solicitar contraseñas.
- Relee el estado justo antes de cada escritura y bloquea la cuenta si cambió
  (`blocked_state_changed` o `blocked_concurrent_change`).
- Exige `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` en el CLI y
  `acknowledgeNonAtomic: true` en la API.
- No afirma atomicidad: entre la relectura y la escritura existe una ventana
  que solo puede cerrarse con una intervención transaccional en PostgreSQL.

### Admin y recepción

- El administrador se crea solo en Supabase Auth con
  `app_metadata.gym_role='admin'`.
- El administrador nunca se inserta en `staff_accounts`; una fila que use su
  correo bloquea la ejecución.
- Recepción requiere Auth con `app_metadata.gym_role='reception'` y una fila
  coherente en `staff_accounts`.
- Si la fila de recepción falta, se crea únicamente cuando la cuenta Auth
  previa es válida.
- Si la fila existe con otro `user_id`, correo, rol o `activo=false`, se
  bloquea sin modificarla.

### Compensación

Solo se considera compensable un ID que el script registró como creado en la
ejecución actual. Cuando falla la inserción de personal para una recepción
recién creada:

1. se elimina el usuario Auth;
2. se verifica su ausencia;
3. el resultado es `failed_rolled_back` únicamente si la eliminación quedó
   verificada;
4. si no puede verificarse, se informa `failed_partial`.

Las cuentas preexistentes nunca se eliminan como compensación.

### Resultados

Cada cuenta tiene un resultado individual. Solo estos estados son exitosos:

- `created`;
- `created_with_staff`;
- `existing_valid`;
- `existing_staff_created`.

Los fallos, bloqueos, errores de preflight y estados parciales no se contabilizan
como éxitos.

## Archivos de esta revisión final

| Archivo | Acción |
|---|---|
| `supabase/scripts/initialize-staff.mjs` | Corregido y reestructurado. |
| `supabase/scripts/initialize-staff.test.mjs` | Reescrito para probar la lógica real. |
| `docs/INFORME_CORRECCION_SCRIPT_AUTH.md` | Actualizado. |
| `docs/INFORME_RECUPERACION_AUTENTICACION.md` | Actualizado. |
| `docs/REVISION_FINAL_SCRIPT_INICIALIZACION.md` | Creado. |
| `docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md` | Creado como registro acumulativo y procedimiento definitivo. |

## Archivos que no se modificaron

Durante esta revisión final no se modificaron:

- `frontend-web/src/context/AuthContext.jsx`;
- el registro público de socios;
- `frontend-web/src/lib/adminAccess.js`;
- `frontend-web/src/lib/receptionAccess.js`;
- `frontend-web/src/App.jsx`;
- políticas RLS;
- migraciones;
- la versión antigua del proyecto;
- la Edge Function de gestión de personal.

## Mecanismo corregido

### Dependencia local

El script carga `@supabase/supabase-js` mediante `createRequire()` desde
`frontend-web/package.json`. La instalación está fijada por
`frontend-web/package-lock.json` en la versión `2.112.3`. No se descarga el
SDK desde una CDN.

### Variables de entorno

Las variables deben estar presentes en `process.env`. El script no carga por
sí mismo un archivo `.env.local`. Para una futura operación controlada puede
usarse el soporte de Node sin versionar secretos:

```bash
node --env-file=supabase/.env.local supabase/scripts/initialize-staff.mjs
```

El archivo local debe contener valores reales, pero nunca debe versionarse:

```text
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
SUPABASE_PROJECT_REF=TU_PROJECT_REF
STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes
```

La última variable no es un secreto: confirma que se entiende que la
inicialización no es atómica. Sin ella el CLI se detiene antes de crear el
cliente.

### Ejecución

1. Confirmar el proyecto y las variables localmente.
2. Ejecutar en una terminal interactiva y sin administradores concurrentes.
3. Revisar el resultado individual de cada cuenta.
4. Si aparece `failed_partial`, verificar manualmente el usuario afectado antes
   de cualquier reintento.
5. Verificar en el panel el estado final de Auth y `staff_accounts`.

Este procedimiento es una guía futura; **no se ejecutó durante esta
revisión**.

## Pruebas realizadas

Comando:

```bash
node supabase/scripts/initialize-staff.test.mjs
```

Resultado:

```text
tests 61
suites 9
pass 61
fail 0
```

La suite importa `initialize-staff.mjs` y usa un cliente Supabase simulado. No
se duplicó la lógica del script y no se realizaron peticiones de red.

Las verificaciones adicionales del repositorio también finalizaron sin
errores: `npm run build` aprobó y `npm run lint` terminó correctamente con
cinco advertencias React preexistentes en archivos ajenos a esta revisión.

## Acciones pendientes fuera de esta tarea

1. Validación de solo lectura del proyecto Supabase correcto.
2. Comprobación manual de la terminal Windows real, sin pulsar Enter ni
   realizar una escritura remota durante la prueba de eco.
3. Ejecución controlada en staging con una cuenta de prueba autorizada.
4. Verificación del Dashboard después de esa ejecución.
5. Resolución administrativa explícita de cualquier rol discrepante,
   `disabled` o `activo=false`; el script no los modifica.

## Limitaciones

- No hay evidencia de aceptación en producción.
- No se probó la integración real de Auth, PostgREST, RLS de servicio ni
  rollback en cascada de `staff_accounts`.
- La compensación es por cuenta y no constituye una transacción distribuida
  entre Auth y Postgres.
- La relectura antes de cada escritura reduce la ventana de concurrencia, pero
  no la elimina. La ejecución exige `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` y
  no se declara atómica.
- Cerrar esa ventana requeriría un índice único sobre `lower(email)` y,
  opcionalmente, una función RPC transaccional en PostgreSQL; no se aplicó
  porque implicaría modificar migraciones y RLS fuera del alcance.
- El script solo reconoce el host canónico de Supabase.
- Los cambios de rol o estado para cuentas existentes requieren una
  herramienta o intervención administrativa distinta y explícitamente
  autorizada.

## Confirmación expresa de restricciones

- No se ejecutó el script contra Supabase.
- No se crearon, modificaron ni eliminaron usuarios remotos.
- No se ejecutaron migraciones.
- No se modificaron RLS.
- No se modificaron los archivos frontend excluidos por el alcance.
- No se introdujeron credenciales ni secretos.

El script queda **preparado para una futura ejecución administrativa
controlada**, no declarado como aceptado para producción.
