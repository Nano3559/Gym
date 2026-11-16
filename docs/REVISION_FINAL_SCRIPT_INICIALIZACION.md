# Revisión Final: Script de Inicialización de Cuentas Internas

**Proyecto:** IronForge Gym  
**Fecha:** 2026-11-16  
**Alcance:** corrección local de `initialize-staff.mjs`, sus pruebas y la
documentación asociada

## Resumen ejecutivo

Se corrigió el script de inicialización de `admin@ironforge.com` y
`recepcion@ironforge.com` para que:

- valide el proyecto antes de cualquier escritura;
- oculte realmente la contraseña en una terminal interactiva;
- no reactive `disabled` ni modifique roles o contraseñas existentes;
- use paginación real y diferencie encontrado, inexistente y error;
- ejecute un preflight completo de Auth y `staff_accounts`;
- mantenga al administrador solo en Auth;
- cree o valide la fila de recepción sin reparar silenciosamente datos
  preexistentes;
- compense exclusivamente usuarios creados en la ejecución actual y verifique
  el rollback;
- compare los correos de `staff_accounts` sin distinguir mayúsculas y detecte
  filas duplicadas o en conflicto;
- revalide el estado justo antes de cada escritura y bloquee la cuenta si
  cambió;
- exija una confirmación explícita de que la operación **no es atómica** antes
  de ejecutar cualquier lectura o escritura;
- cierre el lector en `finally`;
- publique un resultado individual y no contenga éxitos falsos.

La implementación se convirtió en un módulo ESM exportable. Las pruebas
importan las mismas funciones que usa el CLI. El recorrido remoto está aislado
bajo una detección de invocación directa.

El resultado es un script preparado para una **futura ejecución administrativa
controlada**, con una confirmación explícita de no atomicidad. No se declara
aceptado para producción porque no se validó contra Supabase real ni en
staging y porque la ventana de concurrencia entre preflight y escritura no
puede eliminarse desde el script.

## Problemas encontrados

### Configuración

- `SUPABASE_PROJECT_REF` era opcional en la práctica.
- La URL podía apuntar a un proyecto distinto.
- Los secretos no tenían una ruta formal de validación y exposición.

### Contraseñas

- El mensaje anunciaba eco oculto, pero `readline` mostraba los caracteres.
- No había confirmación.
- La terminal no interactiva no se rechazaba de forma explícita.
- EOF podía dejar una solicitud de lectura pendiente.
- No existía una garantía explícita de cierre del modo raw.

### Cuentas existentes

- Podía reactivarse una cuenta con `gym_role='disabled'`.
- Existía una ruta de actualización de roles.
- Una cuenta existente podía recibir una contraseña aunque su rol ya fuera
  correcto.
- El script no protegía de forma explícita los IDs preexistentes durante una
  compensación.

### Consulta de usuarios

- El filtro de correo no era un filtro real de la API de administración.
- La suite no demostraba recorrido de páginas.
- Un error de consulta podía parecerse a “usuario inexistente”.
- No se detectaban totales contradictorios, páginas repetidas con distinto
  orden ni solapamientos parciales.
- Una paginación incompleta podía continuar hacia una escritura.

### Consistencia de personal

- El preflight no consultaba `staff_accounts` para todas las cuentas.
- Una fila con el correo del administrador podía producir un éxito `created`
  sin resolver el conflicto.
- La comparación de una fila de recepción no cubría inicialmente el correo.
- La búsqueda por correo podía ser sensible a mayúsculas y dejar pasar una
  segunda fila con la misma dirección y distinta capitalización.
- No se distinguía de forma suficiente un registro huérfano de una cuenta
  Auth válida.

### Concurrencia

- El preflight y la escritura no formaban una transacción; otro proceso podía
  modificar Auth o `staff_accounts` en medio de la ejecución.
- No existía una condición que impidiera una ejecución insegura cuando no se
  puede garantizar atomicidad.

### Compensación, cierre y resultados

- La protección del rollback dependía solo del flujo local.
- Un error de preflight no producía resultados por cuenta.
- El resumen podía carecer de información individual en fallos tempranos.
- Los tests anteriores reimplementaban la lógica y una prueba aceptaba la
  reactivación de `disabled`.

## Archivos modificados

| Archivo | Estado | Contenido |
|---|---|---|
| `supabase/scripts/initialize-staff.mjs` | MODIFICADO | Implementación ESM segura y testeable. |
| `supabase/scripts/initialize-staff.test.mjs` | REESCRITO | 61 pruebas sobre la implementación real con cliente simulado. |
| `docs/INFORME_CORRECCION_SCRIPT_AUTH.md` | ACTUALIZADO | Correcciones y protocolo de verificación local. |
| `docs/INFORME_RECUPERACION_AUTENTICACION.md` | ACTUALIZADO | Estado corregido del mecanismo de recuperación. |
| `docs/REVISION_FINAL_SCRIPT_INICIALIZACION.md` | NUEVO | Este informe final. |
| `docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md` | NUEVO | Registro acumulativo del problema de autenticación y del procedimiento administrativo. |

No se modificaron en esta revisión `AuthContext.jsx`, el registro público,
`adminAccess.js`, `receptionAccess.js`, `App.jsx`, RLS, migraciones ni la
versión antigua.

## Soluciones aplicadas

### 1. Módulo ESM y aislamiento del CLI

El archivo exporta la lógica usada por la ejecución:

- `validateConfiguration()`;
- `findUserByEmail()`;
- `findStaffRecord()`;
- `insertStaffRecord()`;
- `createAuthUser()`;
- `deleteAndVerifyAuthUser()`;
- `createHiddenPasswordReader()`;
- `promptPasswordWithConfirmation()`;
- `runInitialization()`;
- `runCli()`.

Al importar el módulo no se validan variables, no se crea un cliente y no se
abre la terminal. El CLI solo se activa al invocar directamente el archivo.

### 2. Validación estricta del entorno

Las tres variables son obligatorias. La URL debe ser HTTPS y su hostname debe
coincidir exactamente con `<SUPABASE_PROJECT_REF>.supabase.co`. Además, se
rechaza cualquier URL que incluya credenciales embebidas, un puerto explícito,
una ruta, parámetros de consulta o un fragmento. Una barra final en el origen
se acepta y se normaliza. La clave de servicio se conserva solo en memoria y
no aparece en la salida ni en los mensajes de error.

### 3. Entrada oculta verificada

El lector:

- exige TTY y `setRawMode`;
- usa `readline/promises` con `terminal: true`;
- envía el eco interno a un `Writable` descartado;
- muestra solo la indicación en la salida real;
- pide confirmación;
- exige ocho caracteres como mínimo;
- conserva espacios;
- rechaza entrada no interactiva;
- rechaza EOF sin dejar promesas pendientes;
- cierra la interfaz y restaura el modo de terminal.

Si una respuesta remota incluyera la contraseña por error, el mensaje la
redacta como `[REDACTED]`.

### 4. Roles y cuentas existentes

No existe una llamada de actualización de usuarios. Los estados de bloqueo son
explícitos:

- `blocked_disabled`;
- `blocked_role_mismatch`;
- `blocked_staff_conflict`;
- `blocked_staff_mismatch`;
- `blocked_staff_inactive`;
- `blocked_state_changed`;
- `blocked_concurrent_change`.

No se solicita contraseña para una cuenta existente válida ni para una cuenta
bloqueada.

### 5. Paginación segura

`findUserByEmail()` recorre páginas secuenciales y:

- normaliza correos;
- devuelve `found`, `not_found` o `error`;
- trata excepciones y respuestas de error como error, incluso si ocurren en
  una página intermedia;
- compara el total entre páginas;
- detecta repetición y solapamiento;
- detecta paginación incompleta;
- impone un límite máximo de páginas;
- solo declara `not_found` cuando la paginación terminó de forma coherente.

La presencia de `nextPage` se usa únicamente como evidencia de que existen más
páginas. Su valor numérico no se usa para calcular la página siguiente porque
el parser de `@supabase/auth-js@2.112.3` instalado trunca los números mayores
de nueve (`substring(0, 1)`). Por eso el recorrido es secuencial: `page += 1`.
Una página corta que anuncia otra página se trata como paginación incompleta,
no como ausencia del usuario.

### 5.1. Comparación de correo en `staff_accounts`

`staff_accounts.email` es `text unique` en
`supabase/migrations/20261006000007_admin_operations.sql`: la restricción es
sensible a mayúsculas y no existe un índice sobre `lower(email)`.

Por eso `findStaffRecord()`:

- consulta siempre por `user_id` (cuando existe Auth) **y** por correo;
- usa `ilike` con un patrón escapado para el correo normalizado, de modo que
  `Recepcion@IronForge.com` y `recepcion@ironforge.com` se detectan igual;
- informa `error` si la consulta por correo devuelve más de una fila;
- informa `error` si la fila del `user_id` y la del correo pertenecen a
  `user_id` distintos;
- nunca interpreta una fila ambigua como ausencia.

El script no crea restricciones nuevas. Una protección definitiva contra
duplicados por capitalización requeriría un índice único sobre
`lower(email)` en PostgreSQL, que no se aplicó en esta intervención.

### 6. Preflight completo

Para cada cuenta se consulta Auth y `staff_accounts` antes de solicitar
contraseñas o escribir. `staff_accounts` se busca por `user_id` cuando
corresponde y siempre por correo normalizado sin distinguir mayúsculas.

Un fallo genera un resumen con `error` para la cuenta afectada y
`not_processed` para las demás. La ejecución no escribe nada.

### 7. Reglas de consistencia

- Admin: solo Auth con `gym_role='admin'`; nunca una fila de personal.
- Recepción: Auth con `gym_role='reception'` y fila de personal.
- Fila existente: debe coincidir `user_id`, correo, rol y `activo=true`.
- Fila faltante: se crea solo para recepción y solo con Auth válido.
- Filas discrepantes o huérfanas: se bloquean sin reparación silenciosa.

### 8. Compensación protegida

Los IDs creados en la ejecución actual se guardan en un `Set`. El helper de
eliminación rechaza cualquier ID ajeno al conjunto. Cuando una inserción de
personal falla para recepción recién creada:

1. se elimina el usuario Auth;
2. se verifica su ausencia con `getUserById()`;
3. se informa `failed_rolled_back` solo si la verificación tuvo éxito;
4. se informa `failed_partial` si existe un estado que no pudo verificarse.

Las cuentas preexistentes quedan protegidas.

### 9. Concurrencia, revalidación y condición de ejecución

La inicialización escribe en dos sistemas distintos: Supabase Auth (GoTrue) y
PostgreSQL (`staff_accounts`). No existe una transacción distribuida entre
ambos y el SDK utilizado no ofrece control transaccional sobre PostgREST.

El script aplica tres medidas, ninguna de las cuales constituye atomicidad:

1. **Segunda lectura completa** después de solicitar todas las contraseñas y
   antes de la primera escritura. Si el estado relevante de Auth o de
   `staff_accounts` cambió, la cuenta se bloquea como `blocked_state_changed`.
2. **Relectura puntual inmediatamente antes de cada escritura**. Si aparece
   una cuenta o fila inesperada, la cuenta se bloquea como
   `blocked_concurrent_change`. Esta relectura reduce la ventana, pero no la
   elimina: entre la lectura y el `insert`/`createUser` todavía puede ocurrir
   un cambio.
3. **Condición de ejecución explícita**. `runInitialization()` exige
   `acknowledgeNonAtomic: true` y el CLI exige
   `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes`. Sin esa confirmación no se realizan
   lecturas ni escrituras. Así se impide una ejecución insegura por descuido,
   pero no se convierte la operación en atómica.

Riesgos residuales que el script no puede resolver:

- otra sesión podría crear el usuario Auth entre la relectura y `createUser`;
  la creación fallaría por correo duplicado y se informaría como `failed`;
- otra sesión podría insertar la fila de personal entre la relectura y el
  `insert`; la clave primaria `user_id` (y `email unique` si el texto coincide
  exactamente) haría fallar la inserción y se intentaría la compensación del
  usuario recién creado;
- `staff_accounts.email` no tiene índice único sobre `lower(email)`, por lo
  que dos procesos podrían insertar variantes de capitalización distintas si
  el correo difiere en mayúsculas y la consulta previa no las vio;
- la compensación elimina un usuario creado por esta ejecución, pero no puede
  deshacer un cambio que otro proceso haya hecho en paralelo.

Una solución definitiva requiere intervención en PostgreSQL: un índice único
sobre `lower(email)` y, preferiblemente, una función RPC que inserte la fila
de personal de forma transaccional y verifique el `user_id`. Esa intervención
no se aplicó porque implicaría modificar migraciones y RLS fuera del alcance
autorizado de esta revisión.

### 10. Resultados y cierre

- El lector se cierra en `finally`.
- Cada cuenta tiene un resultado individual.
- El resumen distingue éxitos, fallos, bloqueos y cuentas no procesadas.
- Solo cuatro estados configurados se consideran éxito.
- La ejecución devuelve código cero únicamente cuando todas las cuentas
  terminaron en un estado exitoso.

## Pruebas automatizadas

### Método

La suite importa directamente `initialize-staff.mjs`. El doble de Supabase
implementa el contrato de API utilizado por el script, pero no replica su
lógica de búsqueda, preflight, creación, compensación ni resultados.

No se usan credenciales, no se instancia el cliente real y no se permiten
peticiones de red.

### Casos cubiertos

| Grupo | Casos principales |
|---|---|
| Configuración | Ausencia individual de cada variable, discrepancia URL/ref, credenciales embebidas, puerto, ruta, parámetros, fragmento, barra final aceptada y ausencia de secretos en los mensajes. |
| Paginación | Correo en segunda página, normalización, inexistente, error, total contradictorio, paginación incompleta, solapamiento, más de nueve páginas, error y excepción en página intermedia y `nextPage` mayor de nueve con avance secuencial. |
| Preflight | Error de Auth, error de personal, cero escrituras, estados individuales y cuentas existentes. |
| Roles | Rol diferente y `disabled` sin reactivación ni cambio. |
| Admin | Ausencia de fila de personal y bloqueo de fila que usa el correo admin. |
| Recepción | Registro existente, registro faltante, `activo=false`, rol/correo discrepante, registro huérfano, error de consulta y doble fila con distinto uso de mayúsculas. |
| Concurrencia | Reconocimiento obligatorio de no atomicidad, cambio entre preflight y segunda lectura, cambio antes de `createUser` y fila de personal que aparece antes del `insert`. |
| Compensación | ID nuevo elegible, ID preexistente rechazado, eliminación verificada y estado parcial. |
| Contraseñas | Eco oculto, confirmación, mínimo exacto, espacios, EOF, terminal no interactiva y redacción. |
| CLI | Cierre del lector en éxito/fallo, resumen sin secretos, cliente no creado con configuración inválida y rechazo sin reconocimiento de no atomicidad. |

### Comandos

```bash
node --check supabase/scripts/initialize-staff.mjs
node --check supabase/scripts/initialize-staff.test.mjs
node supabase/scripts/initialize-staff.test.mjs
```

### Resultados

```text
node --check initialize-staff.mjs: OK
node --check initialize-staff.test.mjs: OK

tests 61
suites 9
pass 61
fail 0
cancelled 0
skipped 0
todo 0
```

### Verificaciones del repositorio

Ejecutadas desde `frontend-web/`:

```bash
npm run build
npm run lint
```

- Build de Vite: **aprobado**, sin errores.
- Lint de Oxlint: **aprobado con 5 advertencias** en archivos React no
  relacionados con esta intervención (`RoutineContext.jsx`,
  `ClientRoutines.jsx`, `useCamera.js`, `RoutineRunner.jsx` y
  `TrainerClients.jsx`). No se alteraron esos archivos porque están fuera del
  alcance.
- Oxlint limitado a los dos archivos del script: **aprobado sin
  advertencias**.

## Matriz de seguridad

| Regla | Implementación | Cobertura |
|---|---|---|
| Proyecto correcto | Comparación obligatoria URL/ref | Sí |
| Secreto no expuesto | Validación sin imprimir clave y redacción | Sí |
| Contraseña oculta | TTY + raw mode + sink de salida | Sí, con TTY simulada |
| Sin reactivación de `disabled` | Bloqueo explícito | Sí |
| Sin cambios de cuentas existentes | Sin API de actualización | Sí |
| Consulta sin falsos negativos | Estados discriminados y preflight | Sí |
| Escrituras tras error crítico | Ninguna escritura tras fallo de preflight | Sí |
| Admin solo Auth | Sin inserción ni tolerancia de fila admin | Sí |
| Recepción coherente | Comparación completa de fila | Sí |
| Rollback restringido | `Set` de IDs creados en la ejecución | Sí |
| Rollback verificado | `deleteUser()` + `getUserById()` | Sí |
| Correo sin falsos negativos | `ilike` escapado + detección de filas ambiguas | Sí |
| Cambio antes de escribir | Relectura puntual y `blocked_concurrent_change` | Sí, mitiga; no elimina la ventana |
| Ejecución no atómica | Reconocimiento obligatorio por API y variable de entorno | Sí |
| Cierre de recursos | `finally` del CLI | Sí |
| Resumen honesto | Resultado individual y estados exitosos explícitos | Sí |

## Procedimiento futuro controlado

Este procedimiento no se ejecutó durante la revisión. La versión detallada,
con verificación de acceso y resolución de fallos, está en
`docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md`, secciones 9 y 10.

1. Confirmar el `SUPABASE_PROJECT_REF` esperado por una vía administrativa
   independiente.
2. Preparar un archivo local no versionado con las tres variables de conexión
   y la confirmación explícita
   `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes`.
3. Evitar procesos concurrentes que modifiquen las mismas cuentas y revisar
   manualmente que no exista otra sesión administrativa activa.
4. Ejecutar en una terminal interactiva:

   ```bash
   node --env-file=supabase/.env.local supabase/scripts/initialize-staff.mjs
   ```

   Sin `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` el script termina con código 1
   antes de crear el cliente.

5. Revisar el resultado individual de cada cuenta.
6. Si aparece `failed_partial`, detener cualquier reintento automático y
   verificar manualmente el usuario afectado.
7. Verificar el estado final en Supabase Dashboard.

## Limitaciones pendientes

1. No se validó contra Supabase real, staging o producción.
2. Falta una prueba manual del eco en una terminal Windows real. La prueba
   automatizada usa una TTY simulada y no una consola física. El comando y los
   criterios de aceptación están en
   `docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md`, sección 7.5.
3. La compensación es por cuenta. Una cuenta ya creada correctamente puede
   permanecer aunque una cuenta posterior falle; el resumen lo refleja, pero
   no existe atomicidad distribuida entre Auth y Postgres.
4. La relectura previa a cada escritura reduce la ventana de concurrencia, pero
   no la elimina. El script solo puede ejecutarse con el reconocimiento
   explícito `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes`; esa condición impide una
   ejecución por descuido, no convierte la operación en atómica.
5. Para garantizar integridad frente a procesos concurrentes hace falta una
   intervención en PostgreSQL: índice único sobre `lower(email)` y, si se
   requiere atomicidad real, una función RPC transaccional. No se aplicó
   porque implicaría modificar migraciones y RLS fuera del alcance.
6. No se probó el comportamiento real de la cascada `ON DELETE` de
   `staff_accounts` durante una eliminación.
7. El escape de comodines en el patrón `ilike` no se validó contra un
   PostgREST real; si un correo contiene `_`, un escape no interpretado podría
   producir una coincidencia más amplia, que el script trataría como fila
   discrepante o ambigua (bloqueo), no como éxito.
8. El script solo admite el host canónico `<ref>.supabase.co`.
9. Los roles y estados de cuentas existentes requieren una intervención
   administrativa separada; el script solo bloquea y explica.
10. El archivo no se ejecuta automáticamente al importarse, pero su futura
    ejecución remota todavía requiere autorización administrativa explícita.

Por estas razones, el estado correcto es **preparado para una futura
ejecución administrativa controlada**, no “listo para producción”.

## Confirmación expresa de ausencia de operaciones remotas

Durante esta revisión final se declara expresamente que:

- **no se ejecutó el script contra Supabase**;
- **no se crearon usuarios remotos**;
- **no se modificaron usuarios remotos**;
- **no se eliminaron usuarios remotos**;
- **no se ejecutaron migraciones**;
- **no se modificaron políticas RLS**;
- **no se modificaron archivos de autenticación, acceso o registro fuera del
  alcance**;
- **no se introdujeron credenciales ni secretos**.

Las 61 pruebas se ejecutaron únicamente en local contra un cliente Supabase
simulado.
