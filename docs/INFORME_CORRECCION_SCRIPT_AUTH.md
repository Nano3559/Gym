# Informe de Corrección: Script de Inicialización de Personal

**Proyecto:** IronForge Gym  
**Revisión final local:** 2026-11-16  
**Alcance:** `supabase/scripts/initialize-staff.mjs` y sus pruebas locales

## Dictamen

El script quedó reestructurado como un módulo ESM verificable y seguro para una
**futura ejecución administrativa controlada**. La lógica usada por el CLI se
exporta y las pruebas importan esa misma implementación; ya no existe una
suite que reimplemente reglas de negocio paralelas.

El estado verificado es **local y sin red**. No se ejecutó el CLI contra
Supabase ni se realizó ninguna operación remota. Por tanto, este informe no
declara una validación en staging ni una aceptación en producción.

## Archivos modificados en esta corrección

| Archivo | Estado | Descripción |
|---|---|---|
| `supabase/scripts/initialize-staff.mjs` | MODIFICADO | Módulo ESM con validación estricta, preflight, entrada oculta, compensación verificada y resultados individuales. |
| `supabase/scripts/initialize-staff.test.mjs` | REESCRITO | 61 pruebas que importan y ejercitan la lógica real mediante un cliente Supabase simulado. |
| `docs/INFORME_CORRECCION_SCRIPT_AUTH.md` | ACTUALIZADO | Informe corregido de la intervención. |
| `docs/INFORME_RECUPERACION_AUTENTICACION.md` | ACTUALIZADO | Estado corregido de recuperación y mecanismo de inicialización. |
| `docs/REVISION_FINAL_SCRIPT_INICIALIZACION.md` | NUEVO | Revisión final, pruebas, limitaciones y confirmación de ausencia de operaciones remotas. |
| `docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md` | NUEVO | Registro acumulativo del problema y procedimiento definitivo de inicialización. |

`.env.example` ya contenía la documentación de las tres variables necesarias;
no se modificó durante esta corrección final.

## Problemas encontrados

1. La validación del proyecto era opcional y una URL de otro proyecto podía
   aceptarse.
2. El prompt anunciaba ocultamiento, pero el eco de `readline` era visible.
3. No se exigía confirmación de contraseña ni se garantizaba una terminal
   interactiva.
4. Las cuentas `disabled` podían reactivarse automáticamente.
5. Existía una ruta capable de actualizar el rol de cuentas preexistentes.
6. Un error de `listUsers()` podía confundirse con la ausencia del usuario.
7. La búsqueda por correo no demostraba paginación real ni detectaba todas las
   incoherencias de paginación.
8. El preflight no consultaba `staff_accounts` para todas las cuentas.
9. Podía declararse `existing_valid` sin comparar todos los campos de la fila
   de personal.
10. Podía declararse `created` para un administrador pese a existir un
    conflicto de correo en `staff_accounts`.
11. La compensación no tenía una garantía explícita de que el ID eliminado
    hubiera sido creado en la ejecución actual.
12. El cierre del lector dependía del flujo normal y una entrada EOF podía
    dejar una promesa pendiente.
13. El resumen podía carecer de resultados individuales ante un fallo de
    preflight.
14. La suite anterior duplicaba helpers, probaba el mock en vez del script y
    aceptaba explícitamente la reactivación de `disabled`.

## Correcciones aplicadas

### 1. Configuración y proyecto obligatorios

`validateConfiguration()` exige:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_PROJECT_REF`.

La URL debe usar HTTPS y su hostname debe coincidir exactamente con
`<SUPABASE_PROJECT_REF>.supabase.co`. Se rechazan credenciales embebidas,
puertos explícitos, rutas, parámetros y fragmentos. La clave nunca se imprime
ni se incluye en un mensaje de error.

### 2. Entrada de contraseña realmente oculta

`createHiddenPasswordReader()`:

- exige `stdin.isTTY` y `setRawMode`;
- crea `readline` con `terminal: true`;
- descarta la salida interna de `readline` mediante un `Writable` sink;
- escribe únicamente la indicación en la salida real;
- solicita contraseña y confirmación;
- conserva espacios y exige al menos ocho caracteres;
- rechaza una entrada no interactiva antes de preguntar;
- rechaza EOF o cierre de entrada sin dejar una lectura pendiente;
- restaura el modo de terminal al cerrar la interfaz.

Si no puede garantizarse una terminal interactiva con soporte de entrada
oculta, la ejecución se detiene. La contraseña no se guarda en archivos ni se
imprime. Además, si un error remoto incluyera por error la contraseña en su
mensaje, el script la reemplaza por `[REDACTED]`.

### 3. Cuentas preexistentes protegidas

El script no contiene ninguna llamada de actualización de usuarios. Para una
cuenta existente:

- `gym_role='disabled'` produce `blocked_disabled` y no se reactiva;
- cualquier rol distinto del esperado produce `blocked_role_mismatch`;
- no se solicita contraseña;
- no se cambia el rol ni la contraseña.

Una cuenta existente con el rol esperado solo puede impedir una escritura
necesaria de `staff_accounts`; nunca se corrige silenciosamente.

### 4. Búsqueda paginada y fail-closed

`findUserByEmail()`:

- normaliza con `trim()` y `toLowerCase()`;
- recorre páginas secuenciales reales con `page` y `perPage`;
- devuelve estados discriminados `found`, `not_found` y `error`;
- nunca convierte un error de Supabase en ausencia;
- compara el total entre páginas y rechaza contradicciones;
- rechaza páginas repetidas o solapadas;
- usa `total` para detectar paginación incompleta;
- confirma la paginación completa antes de declarar `not_found`;
- aborta al superar el límite de páginas.

La presencia de `nextPage` se usa solo como evidencia de que quedan páginas.
El SDK local `@supabase/supabase-js@2.112.3` interpreta de forma incompleta
`nextPage` y `lastPage` para números de página mayores de nueve, por lo que el
recorrido avanza secuencialmente y no depende de esos valores.

### 4.1. Correo de `staff_accounts` sin distinción de mayúsculas

`staff_accounts.email` es `text unique` y esa restricción es sensible a
mayúsculas. `findStaffRecord()` consulta siempre por `user_id` (si existe Auth)
y por correo mediante `ilike` con patrón escapado. También detecta:

- varias filas que coinciden con el mismo correo;
- una fila de `user_id` y otra fila distinta con el mismo correo.

Ambos casos se informan como `error`, nunca como ausencia. El script no añade
un índice único sobre `lower(email)`; esa sería la protección definitiva en
PostgreSQL y queda documentada como intervención pendiente.

### 5. Preflight completo antes de escribir

Antes de solicitar contraseñas o realizar escrituras, el script consulta:

- todos los usuarios Auth necesarios;
- `staff_accounts` por `user_id` cuando existe Auth y siempre por correo.

Si una lectura falla, se genera un resumen no exitoso con `error` para la
cuenta afectada y `not_processed` para las demás. No se escribe nada.

### 6. Consistencia de `staff_accounts`

El administrador existe solo en Supabase Auth. Si cualquier fila de personal
usa su correo, la cuenta se bloquea.

Para recepción, una fila existente se considera coherente solo si coinciden:

- `user_id`;
- correo normalizado;
- `rol='reception'`;
- `activo=true`.

Un rol, `user_id`, correo o estado `activo` discrepante bloquea la cuenta sin
modificarla. Si la fila falta y la cuenta Auth es válida, se crea únicamente
la fila de recepción requerida.

### 7. Compensación restringida y verificada

El flujo registra en un `Set` los IDs de Auth creados durante la ejecución
actual. El helper de rollback rechaza cualquier ID que no pertenezca a ese
conjunto.

Cuando una cuenta de recepción recién creada no puede insertarse en
`staff_accounts`:

1. se elimina mediante `auth.admin.deleteUser()`;
2. se comprueba la ausencia con `auth.admin.getUserById()`;
3. `failed_rolled_back` solo se usa si la ausencia quedó verificada;
4. `failed_partial` se usa si la eliminación no pudo verificarse.

Nunca se elimina una cuenta preexistente como compensación.

### 8. Ciclo de vida y resultados

- El CLI se ejecuta solo cuando el módulo se invoca directamente; importarlo no
  valida variables, no crea clientes y no abre terminal.
- `runCli()` cierra el lector en `finally`.
- Cada cuenta produce un resultado individual.
- Solo cuentan como éxito: `created`, `created_with_staff`, `existing_valid` y
  `existing_staff_created`.
- Los estados `failed`, `failed_rolled_back`, `failed_partial`, `error`,
  `not_processed`, `blocked_state_changed`, `blocked_concurrent_change` y
  demás `blocked_*` no se presentan como éxitos.

### 9. Concurrencia y condición de ejecución

La escritura abarca Supabase Auth y PostgreSQL, sin transacción distribuida.
El script:

- hace una segunda lectura completa tras pedir las contraseñas;
- relee Auth y `staff_accounts` inmediatamente antes de cada escritura;
- bloquea la cuenta como `blocked_state_changed` o
  `blocked_concurrent_change` si detecta un cambio;
- exige `acknowledgeNonAtomic: true` en la API y
  `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` en el CLI. Sin ese reconocimiento no
  crea el cliente ni realiza lecturas.

Esto **reduce** la ventana de concurrencia y **evita** ejecuciones accidentales,
pero **no garantiza atomicidad**. Entre la relectura y la escritura sigue
existiendo un intervalo. La solución completa exige intervención en PostgreSQL
(índice único sobre `lower(email)` y, opcionalmente, una función RPC
transaccional), que no se aplicó por estar fuera del alcance autorizado.

## Pruebas ejecutadas

Comando:

```bash
node supabase/scripts/initialize-staff.test.mjs
```

Resultado final:

```text
tests 61
suites 9
pass 61
fail 0
cancelled 0
skipped 0
todo 0
```

Cobertura principal:

| Área | Casos comprobados |
|---|---|
| Configuración | Las tres variables obligatorias, coincidencia URL/ref, rechazo de credenciales embebidas, puerto, ruta, parámetros y fragmento, y ausencia de secretos en mensajes. |
| Paginación | Segunda página, normalización, inexistente, error, paginación incompleta, total contradictorio, solapamiento, más de nueve páginas, error y excepción en página intermedia y `nextPage` mayor de nueve. |
| Preflight | Error de Auth sin escrituras, error de personal sin escrituras, estados individuales y cuentas existentes. |
| Roles | Rol discrepante y `disabled` bloqueados sin reactivación ni actualización. |
| Personal | Admin sin fila, recepción existente/faltante, `activo=false`, rol/correo discrepantes, registros huérfanos y correos duplicados por capitalización. |
| Concurrencia | Reconocimiento obligatorio de no atomicidad, cambio entre lecturas y cambio antes de la escritura. |
| Compensación | Rollback solo de IDs nuevos, verificación, protección de preexistentes y estado parcial. |
| Contraseñas | Eco oculto, confirmación, mínimo de ocho, espacios, EOF, terminal no interactiva y redacción. |
| CLI | Cierre en éxito y fallo, ausencia de secretos en el resumen, no creación de cliente con configuración inválida y rechazo sin reconocimiento de no atomicidad. |

Las pruebas usan exclusivamente un cliente Supabase simulado. No hay llamadas
de red ni operaciones sobre usuarios reales.

### Verificaciones adicionales del repositorio

Desde `frontend-web/`:

```bash
npm run build
npm run lint
```

- `npm run build`: **aprobado**; Vite produjo el bundle sin errores.
- `npm run lint`: **aprobado con 5 advertencias** en
  `RoutineContext.jsx`, `ClientRoutines.jsx`, `useCamera.js`,
  `RoutineRunner.jsx` y `TrainerClients.jsx`. Son advertencias preexistentes
  de React fuera del alcance de esta corrección; no se modificaron esos
  archivos.
- Oxlint aplicado solo a `initialize-staff.mjs` y
  `initialize-staff.test.mjs`: **aprobado sin advertencias**.

## Uso futuro controlado

El script no carga por sí mismo `supabase/.env.local`. En una futura sesión
administrativa, las variables deben estar exportadas en el proceso o Node debe
cargar un archivo local no versionado, por ejemplo:

```bash
node --env-file=supabase/.env.local supabase/scripts/initialize-staff.mjs
```

El archivo local debe incluir además la confirmación explícita de no
atomicidad:

```text
STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes
```

Sin esa variable el CLI termina con código 1 antes de crear el cliente.

Antes de cualquier ejecución real se debe revisar el proyecto destino, las
cuentas existentes, los roles y las filas de `staff_accounts`. La ejecución
debe hacerse en una terminal interactiva y sin procesos administrativos
concurrentes sobre esas mismas cuentas.

## Limitaciones pendientes

1. No se validó contra Supabase real, staging ni producción.
2. El ocultamiento se verificó con una terminal TTY simulada; falta una
   comprobación manual en una terminal Windows real, sin conexión remota.
3. La compensación es por cuenta: si una cuenta anterior ya se creó
   correctamente y otra falla después, el resumen conserva el resultado
   exitoso anterior y el estado parcial de la fallida. No existe una
   transacción distribuida entre Auth y Postgres.
4. La segunda lectura y la relectura previa a cada escritura reducen la ventana
   de concurrencia, pero no la eliminan. El script exige
   `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` y no se declara atómico.
5. La protección definitiva contra duplicados de correo por capitalización y
   contra carreras entre Auth y `staff_accounts` requiere un índice único
   sobre `lower(email)` y, si se busca atomicidad real, una función RPC
   transaccional en PostgreSQL. No se aplicó en esta intervención.
6. El script no repara roles ni estados `activo`; esos casos requieren una
   intervención administrativa explícita y fuera de esta ejecución.
7. La validación de URL acepta deliberadamente únicamente el host canónico
   `<ref>.supabase.co`, no dominios personalizados.

Por estos puntos, el script queda preparado para una futura ejecución
administrativa controlada, pero **no se declara aceptado para producción**.

## Confirmación expresa de ausencia de operaciones remotas

Durante esta corrección final:

- **NO se ejecutó `initialize-staff.mjs` contra Supabase.**
- **NO se crearon usuarios remotos.**
- **NO se modificaron usuarios remotos.**
- **NO se eliminaron usuarios remotos.**
- **NO se ejecutaron migraciones.**
- **NO se modificaron políticas RLS.**
- **NO se modificaron archivos de autenticación, acceso o registro fuera del
  alcance permitido.**

Toda validación automatizada se ejecutó localmente contra un doble de
Supabase.
