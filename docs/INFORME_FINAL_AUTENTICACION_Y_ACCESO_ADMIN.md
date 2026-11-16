# Informe Final: Autenticación y Acceso Administrativo

**Proyecto:** IronForge Gym — versión actual (`Proyecto_gymnasio`)  
**Documento acumulativo:** registra el problema de autenticación, las
correcciones realizadas y el procedimiento pendiente para crear la cuenta
administrativa.  
**Última actualización:** 2026-11-16  
**Estado:** código y procedimiento preparados; la cuenta administrativa **no
ha sido creada** durante esta intervención.

> Este documento no sustituye a los informes detallados
> `INFORME_CORRECCION_SCRIPT_AUTH.md`, `INFORME_RECUPERACION_AUTENTICACION.md`
> y `REVISION_FINAL_SCRIPT_INICIALIZACION.md`. Los complementa y conserva la
> historia completa del problema.

---

## 1. Introducción

La versión actual de IronForge Gym no dispone de una cuenta administrativa
creada mediante el flujo real de Supabase Auth. Durante las primeras etapas del
proyecto se usaron credenciales demo simuladas en memoria, que permitían abrir
el panel administrativo sin que existiera un usuario real autenticado.

El objetivo de este trabajo es:

1. eliminar cualquier dependencia de credenciales ficticias;
2. garantizar que el administrador sea un usuario real de Supabase Auth con el
   rol correcto;
3. asegurar que la cuenta de recepción también sea real y tenga su fila en
   `public.staff_accounts`;
4. dejar un procedimiento administrativo controlado, verificable y reversible
   en lo posible, sin ejecutarlo durante las revisiones.

Este informe distingue expresamente entre:

- **hechos comprobados en el repositorio local**;
- **resultados de pruebas locales**;
- **hipótesis o cuestiones no verificadas** por no haberse realizado
  operaciones remotas.

---

## 2. Descripción del sistema

### 2.1. Componentes relevantes

| Componente | Descripción |
|---|---|
| Frontend | Aplicación React + Vite en `frontend-web/`. Usa `@supabase/supabase-js` para autenticación y datos. |
| Supabase Auth | Servicio de identidad (GoTrue). Los usuarios viven en `auth.users`. |
| PostgreSQL | Base de datos del proyecto, gestionada mediante migraciones en `supabase/migrations/`. |
| `public.staff_accounts` | Registro de personal operativo (recepción y entrenadores). |
| `public.profiles` | Perfil de socios/clientes, con `id` que referencia `auth.users(id)`. |
| Edge Function `manage-staff` | Gestión de personal por parte de un administrador autenticado. |
| App móvil | Aplicación Flutter en `mobile_app/`, fuera del alcance de esta corrección. |
| Script administrativo | `supabase/scripts/initialize-staff.mjs`, ejecutado con Node.js. |

El repositorio no contiene un servidor Express independiente identificable;
los scripts administrativos se ejecutan directamente con Node.js. Si existiera
un backend adicional en otra ubicación, no participa en este flujo de
inicialización.

### 2.2. Arquitectura de autenticación

1. El usuario inicia sesión con `supabase.auth.signInWithPassword()`.
2. El rol operativo se lee de `app_metadata.gym_role` del usuario Auth.
3. El frontend decide el acceso con `isAdminUser()` y `isReceptionUser()`
   (`frontend-web/src/lib/adminAccess.js` y `receptionAccess.js`).
4. `staff_accounts` aporta el registro operativo del personal, pero **no
   sustituye** al usuario de Auth.
5. `profiles` es el perfil de socio; no se crea para cuentas de personal.

### 2.3. Roles

| Rol | Dónde vive | Requisitos |
|---|---|---|
| `admin` | `auth.users.app_metadata.gym_role` | Usuario Auth real. No debe tener fila en `staff_accounts`. |
| `reception` | Auth + `staff_accounts` | Usuario Auth real con rol `reception` y fila coherente en `staff_accounts`. |
| `trainer` | Auth + `staff_accounts` | Se conserva; no se modifica en esta intervención. |
| `member` | Auth + `profiles` | Registro público de socios; fuera del alcance. |
| `disabled` | `app_metadata.gym_role` | Cuenta bloqueada. El script no la reactiva. |

`staff_accounts.rol` solo admite `reception` o `trainer`; el administrador
nunca se inserta en esa tabla.

---

## 3. Problema original

La versión antigua del proyecto utilizaba credenciales demo simuladas en
memoria. El frontend fabricaba una identidad y un rol sin que existiera un
usuario real en Supabase Auth. Esto producía varios problemas:

- el panel administrativo podía abrirse sin autenticación real;
- las credenciales no correspondían a ninguna cuenta de Supabase;
- las políticas RLS no podían evaluar correctamente a un usuario inexistente;
- el personal no tenía registros reales en `staff_accounts`;
- cualquier prueba de acceso administrativo carecía de validez.

Ese bypass fue eliminado y el acceso actual usa
`supabase.auth.signInWithPassword()`. Sin embargo, la versión actual seguía sin
una cuenta administrativa real creada, por lo que el acceso al panel no podía
completarse de extremo a extremo.

**Importante:** este informe no afirma que la cuenta administrativa exista o
deje de existir en el proyecto remoto. Esa comprobación no se realizó en esta
intervención.

---

## 4. Diagnóstico

### 4.1. Hechos comprobados en el repositorio

1. Las migraciones no insertan usuarios en `auth.users`. No existe una seed de
   personal administrativo.
2. La autenticación del frontend usa el flujo real de Supabase Auth, no un
   bypass en memoria.
3. `adminAccess.js` y `receptionAccess.js` priorizan
   `app_metadata.gym_role`; ignoran el rol JWT genérico `authenticated` y solo
   usan el correo como compatibilidad cuando no hay rol explícito.
4. `staff_accounts` define `user_id uuid primary key references auth.users(id)
   on delete cascade`, `email text not null unique`, `rol text not null check
   (rol in ('reception','trainer'))` y `activo boolean not null default true`.
5. `profiles.id` referencia `auth.users(id)`; es el perfil de socios, no de
   personal.
6. La Edge Function `manage-staff` exige un llamador autenticado con
   `app_metadata.gym_role === 'admin'` (o el correo administrativo histórico) y
   solo admite roles `reception`/`trainer`. No permite autoasignación pública
   de roles privilegiados.
7. Existe una única versión del proyecto dentro de este repositorio. La
   versión antigua, vinculada según el propietario a `Prueba_credenciales`, no
   está incluida en esta carpeta y no fue modificada.
8. El script administrativo no contiene referencias codificadas a un proyecto
   concreto: obtiene la URL y la referencia de variables de entorno y exige que
   coincidan entre sí.
9. El archivo local `supabase/.temp/linked-project.json` identifica el proyecto
   vinculado como **`Proyecto_gymnasio`**. La identidad del proyecto actual
   queda así confirmada sin realizar ninguna consulta remota. La referencia
   concreta no se transcribe en este documento; debe tomarse de ese archivo o
   del panel de Supabase.

### 4.2. Hechos no verificados en esta intervención

- La existencia o ausencia real de `admin@ironforge.com` y
  `recepcion@ironforge.com` en Supabase Auth de `Proyecto_gymnasio`.
- El contenido real de `staff_accounts` en el proyecto remoto.
- El comportamiento de RLS y de las políticas en tiempo de ejecución remoto.

No se realizó ninguna consulta remota, por lo que estas cuestiones quedan
explícitamente pendientes.

### 4.3. Relación entre Auth, `app_metadata`, `staff_accounts` y `profiles`

- **Auth** es la fuente de identidad. Sin usuario Auth no hay sesión.
- **`app_metadata.gym_role`** es la fuente de rol operativo. Se asigna desde el
  servidor (script administrativo o Edge Function), nunca desde el registro
  público.
- **`staff_accounts`** describe al personal operativo y habilita funciones de
  recepción/entrenador. Su `user_id` debe coincidir con el usuario Auth.
- **`profiles`** describe a los socios. No se usa para autorizar al personal.

Un desajuste entre estas capas produce accesos denegados o incoherencias. Por
eso el script compara `user_id`, correo normalizado, rol y `activo` antes de
considerar válida una cuenta.

### 4.4. Riesgos de crear usuarios sin comprobar previamente su estado

- Crear un usuario que ya existe produce un error de correo duplicado.
- Reactivar implícitamente una cuenta `disabled` anularía una decisión
  administrativa.
- Cambiar el rol de una cuenta existente podría escalar privilegios.
- Crear una fila de personal para el administrador rompería la separación de
  roles.
- Declarar éxito sin comprobar `staff_accounts` dejaría una recepción sin
  acceso operativo.
- Un error de consulta interpretado como "no existe" podría duplicar cuentas.

El script actual bloquea estos casos en lugar de repararlos silenciosamente.

---

## 5. Decisiones de diseño

### 5.1. Inicialización administrativa controlada, no cuentas demo

Se descartó volver a crear credenciales demo porque:

- no son usuarios reales de Auth;
- no permiten validar RLS ni permisos reales;
- ocultan fallos de configuración;
- introducen una puerta trasera de acceso privilegiado.

En su lugar se creó un script administrativo que exige credenciales de servicio
locales, valida el proyecto y crea usuarios reales con rol en
`app_metadata`.

### 5.2. Administrador frente a recepción

| Aspecto | Administrador | Recepción |
|---|---|---|
| Usuario Auth | Obligatorio | Obligatorio |
| `app_metadata.gym_role` | `admin` | `reception` |
| `staff_accounts` | Prohibido | Obligatorio y coherente |
| Contraseña | Introducida por el operador | Introducida por el operador |
| Acceso al panel admin | Sí, por rol | No |
| Acceso a recepción | No aplica | Sí, por rol y registro |

Esta separación evita que una cuenta de recepción pueda administrar personal o
configuración.

### 5.3. Sin autoasignación pública de roles

El registro público de socios no asigna `gym_role` privilegiado. Los roles de
personal se asignan únicamente desde el script administrativo o la Edge
Function protegida. Tampoco se desactiva la confirmación de correo de forma
global: el script usa `email_confirm: true` solo para las cuentas internas que
crea, sin cambiar la configuración del proyecto.

---

## 6. Correcciones implementadas

Las intervenciones se registran en orden cronológico. Todas las afirmaciones
siguientes están respaldadas por el contenido actual del repositorio y por la
suite ejecutada.

### 6.1. Reestructuración del script (primera intervención)

- `initialize-staff.mjs` pasó de script monolítico a módulo ESM exportable.
- El CLI solo se ejecuta mediante detección de invocación directa; importarlo
  no valida variables, no crea cliente y no abre terminal.
- La suite importa la implementación real en lugar de duplicar reglas de
  negocio.
- Se implementó entrada oculta de contraseñas con `readline/promises`, salida
  interna descartada, confirmación y mínimo de ocho caracteres.
- Se añadieron resultados individuales por cuenta y estados discriminados.

### 6.2. Validación de configuración

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_PROJECT_REF` son
  obligatorias.
- La URL debe usar HTTPS.
- El hostname debe ser exactamente `<SUPABASE_PROJECT_REF>.supabase.co`.
- Se rechazan credenciales embebidas, puertos explícitos, rutas, parámetros y
  fragmentos.
- Se acepta una barra final en el origen y se normaliza.
- Los mensajes de error no incluyen la clave de servicio ni las credenciales
  embebidas.

### 6.3. Paginación de Supabase Auth

- `findUserByEmail()` recorre páginas secuenciales con `page`/`perPage`.
- Devuelve `found`, `not_found` o `error`.
- Un error de API o una excepción nunca se interpretan como ausencia.
- Detecta totales contradictorios, páginas repetidas, solapamientos y
  paginación incompleta.
- Recorre más de nueve páginas sin confiar en el valor numérico de `nextPage`
  (el SDK instalado trunca números mayores de nueve).
- Solo declara `not_found` cuando la paginación terminó de forma coherente.

### 6.4. Detección de conflictos con `staff_accounts`

- Búsqueda por `user_id` y siempre por correo normalizado.
- Comparación de correo sin distinguir mayúsculas (`ilike` con patrón
  escapado), porque `email text unique` es sensible a mayúsculas.
- Detección de múltiples filas con el mismo correo.
- Detección de conflicto entre la fila del `user_id` y otra fila con el mismo
  correo.
- Bloqueo de filas huérfanas o discrepantes sin reparación silenciosa.
- El administrador no se inserta nunca en `staff_accounts`.

### 6.5. Cuentas desactivadas y roles incompatibles

- `gym_role='disabled'` produce `blocked_disabled` y no se reactiva.
- Cualquier rol distinto del esperado produce `blocked_role_mismatch`.
- No existe ninguna llamada de actualización de usuarios existentes.
- No se solicita contraseña para cuentas existentes válidas o bloqueadas.

### 6.6. Compensación y rollback

- Solo se compensan IDs registrados como creados en la ejecución actual.
- La eliminación se verifica con `getUserById()`; solo un 404 explícito
  confirma la ausencia.
- `failed_rolled_back` solo se informa si la ausencia quedó verificada;
  `failed_partial` si no pudo verificarse.
- Las cuentas preexistentes nunca se eliminan.

### 6.7. Protección frente a concurrencia

- Segunda lectura completa tras solicitar las contraseñas, antes de escribir.
- Relectura puntual inmediatamente antes de cada escritura.
- Bloqueo como `blocked_state_changed` o `blocked_concurrent_change` si el
  estado cambió.
- Confirmación explícita obligatoria de la operación no atómica:
  `acknowledgeNonAtomic: true` en la API y
  `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` en el CLI.

Estas medidas **reducen** la ventana de concurrencia, pero **no garantizan
atomicidad**. La sección 8 lo detalla.

### 6.8. Pruebas automatizadas

- Suite reescrita sobre la implementación real con un doble de Supabase.
- Cobertura de configuración, paginación extensa, preflight, roles, personal,
  concurrencia, compensación, contraseñas y CLI.
- Resultado actual: **61 pruebas aprobadas, 0 fallos**.

---

## 7. Pruebas y verificaciones

### 7.1. Comandos ejecutados y resultados reales

Ejecutados desde la raíz del repositorio:

```bash
node --check supabase/scripts/initialize-staff.mjs
node --check supabase/scripts/initialize-staff.test.mjs
node supabase/scripts/initialize-staff.test.mjs
```

Resultado real de la última ejecución:

```text
tests 61
suites 9
pass 61
fail 0
cancelled 0
skipped 0
todo 0
```

Lint específico de los scripts (Oxlint):

```bash
./frontend-web/node_modules/.bin/oxlint.cmd \
  supabase/scripts/initialize-staff.mjs \
  supabase/scripts/initialize-staff.test.mjs
```

Resultado: **sin advertencias**.

Verificaciones del frontend (no se modificó código del frontend en esta
intervención):

```bash
cd frontend-web
npm run build
npm run lint
```

Resultados reales:

- `npm run build`: **aprobado**, bundle generado sin errores.
- `npm run lint`: **aprobado con 5 advertencias** React preexistentes en
  `RoutineContext.jsx`, `ClientRoutines.jsx`, `useCamera.js`,
  `RoutineRunner.jsx` y `TrainerClients.jsx`. Son ajenas a esta intervención y
  no se corrigieron.

### 7.2. Pruebas simuladas

La suite usa un cliente Supabase simulado. No hay red, credenciales reales ni
operaciones remotas. Cubre, entre otros:

- validación de URL y ausencia de secretos en mensajes;
- paginación de más de nueve páginas;
- errores intermedios de paginación;
- conflicto de correo y `user_id`;
- cuentas `disabled` sin reactivación;
- administrador sin fila en `staff_accounts`;
- recepción con y sin fila;
- rollback y protección de preexistentes;
- obligatoriedad del reconocimiento de no atomicidad.

### 7.3. Verificaciones locales no interactivas

- `node --check` sobre ambos archivos: aprobado.
- La sesión automatizada en la que se trabajó **no es una terminal
  interactiva** (`process.stdin.isTTY === false`). Por tanto, la captura oculta
  de contraseñas no pudo comprobarse aquí en una consola Windows real.

### 7.4. Verificaciones reales contra Supabase

**Ninguna.** No se ejecutó el script contra Supabase, no se consultaron tablas
remotas y no se crearon usuarios. La integración real permanece pendiente y
requiere autorización explícita del propietario.

### 7.5. Comprobación manual pendiente en Windows

Debe realizarse en una consola real (Windows Terminal, PowerShell o CMD), desde
la raíz del repositorio. Este comando **no usa red** y no crea usuarios:

```powershell
@'
import { createHiddenPasswordReader, promptPasswordWithConfirmation } from './supabase/scripts/initialize-staff.mjs'
const reader = createHiddenPasswordReader()
try {
  const value = await promptPasswordWithConfirmation(reader, { displayName: 'Prueba local' })
  console.log(`OK: ${value.length} caracteres capturados sin eco`)
} finally {
  reader.close()
}
'@ | node --input-type=module
```

Criterios de aceptación:

1. Al escribir la contraseña, ningún carácter aparece en pantalla.
2. Al escribir la confirmación, tampoco aparece.
3. Si ambas coinciden y tienen al menos ocho caracteres, se imprime la longitud.
4. Si no coinciden, se informa el error sin mostrar la contraseña.
5. Al terminar, el cursor y el modo de terminal quedan normales.

Mientras esta prueba no se ejecute, no debe afirmarse que la entrada oculta
funciona en Windows real.

---

## 8. Limitaciones conocidas

### 8.1. Atomicidad no garantizada

La creación del usuario en Supabase Auth (GoTrue) y la inserción en
`staff_accounts` (PostgreSQL) son operaciones de sistemas distintos. No existe
transacción distribuida ni control transaccional desde el SDK. La compensación
es por cuenta y solo cubre usuarios creados en la ejecución actual.

### 8.2. Riesgo residual de concurrencia

Las relecturas reducen la ventana, pero no la eliminan. Entre la última lectura
y el `createUser`/`insert` otro proceso podría modificar el estado. Los casos
posibles se resuelven como error o bloqueo, nunca como éxito silencioso, pero
la operación no es atómica. La confirmación
`STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes` obliga a aceptar esta limitación; no la
resuelve.

### 8.3. Protección de base de datos no aplicada

`staff_accounts.email` es `text unique` sensible a mayúsculas. Un índice único
sobre `lower(email)` y, si se requiere atomicidad real, una función RPC
transaccional cerrarían parte del riesgo. **No se aplicaron**: implican cambios
en migraciones y RLS, fuera del alcance autorizado. Requieren autorización
explícita.

### 8.4. Terminal Windows pendiente

La captura oculta se verificó con una TTY simulada, no con una consola física.
La comprobación manual de la sección 7.5 está pendiente.

### 8.5. Integración real pendiente

No se ha verificado el comportamiento del script contra Supabase real: ni
listado de usuarios, ni PostgREST, ni RLS, ni cascada `ON DELETE`, ni la
creación efectiva de la cuenta administrativa.

### 8.6. Estados administrativos existentes

Roles discrepantes, `disabled` o `activo=false` requieren intervención
administrativa separada. El script los bloquea y explica; no los repara.

### 8.7. Escape de comodines en `ilike`

El patrón se escapa con barra invertida y no se validó contra un PostgREST
real. Si un correo contiene `_`, un escape no interpretado podría ampliar la
coincidencia; el resultado sería un bloqueo por discrepancia o ambigüedad, no
un éxito silencioso.

---

## 9. Procedimiento de inicialización administrativa

Este procedimiento **no se ejecutó** durante la revisión. Requiere autorización
explícita del propietario y debe realizarse en el proyecto `Proyecto_gymnasio`.

### 9.1. Requisitos previos

1. Node.js 20.6 o superior (probado con v24.21.0).
2. Acceso al panel de Supabase del proyecto `Proyecto_gymnasio` para confirmar
   la referencia del proyecto (el repo está vinculado localmente a ese nombre;
   la referencia puede leerse en `supabase/.temp/linked-project.json`, sin
   transcribirla a documentos).
3. Rol propietario/administrador en Supabase para obtener la `service_role`
   key.
4. Terminal interactiva real (Windows Terminal, PowerShell o CMD).
5. Ningún otro proceso administrativo operando sobre las mismas cuentas.
6. Decisión sobre las contraseñas: deben tener al menos ocho caracteres y no
   deben registrarse en archivos versionados.

### 9.2. Variables necesarias

| Variable | Contenido | Origen |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` del proyecto actual | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` del proyecto actual | Supabase → Project Settings → API |
| `SUPABASE_PROJECT_REF` | Referencia exacta del proyecto actual | Supabase → Project Settings → General |
| `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC` | `yes` | Decisión explícita del operador |

Reglas:

- La URL y la referencia deben corresponder al mismo proyecto; el script lo
  valida y aborta si no coinciden.
- La `service_role` key no debe copiarse al frontend ni a Git.
- No se debe reutilizar ninguna credencial demo antigua.
- Las variables pueden exportarse en la sesión o cargarse con
  `node --env-file`.

### 9.3. Archivo local de entorno (no versionado)

Crear `supabase/.env.local` (incluido en `.gitignore`; verificar antes de
escribir) con:

```text
SUPABASE_URL=https://<ref-del-proyecto-actual>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role-del-proyecto-actual>
SUPABASE_PROJECT_REF=<ref-del-proyecto-actual>
STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes
```

No pegar estos valores en documentos, tickets, capturas ni mensajes.

### 9.4. Qué significa `STAFF_INIT_ACKNOWLEDGE_NON_ATOMIC=yes`

Significa que el operador reconoce que:

- la creación en Auth y la inserción en `staff_accounts` **no son atómicas**;
- las comprobaciones previas reducen, pero no eliminan, el riesgo de
  concurrencia;
- si el proceso se interrumpe entre ambos pasos, puede requerir una
  verificación y limpieza manual;
- la ejecución debe hacerse en una ventana sin otros procesos
  administrativos.

No es una confirmación de que la operación sea segura frente a concurrencia.
Sin esta variable, el CLI termina con código 1 **antes de crear el cliente** y
no realiza lecturas ni escrituras.

### 9.5. Comando exacto de ejecución

Desde la raíz del repositorio:

```bash
node --env-file=supabase/.env.local supabase/scripts/initialize-staff.mjs
```

Si las variables ya están exportadas en la sesión, puede ejecutarse sin
`--env-file`:

```bash
node supabase/scripts/initialize-staff.mjs
```

### 9.6. Información que introduce el operador

1. Contraseña del administrador (`admin@ironforge.com`) y su confirmación.
2. Contraseña de recepción (`recepcion@ironforge.com`) y su confirmación.

Las contraseñas se solicitan solo si la cuenta no existe. No se muestran en
pantalla, no se guardan en archivos y se eliminan de memoria al terminar. Si un
error remoto las incluyera, se sustituyen por `[REDACTED]`.

### 9.7. Resultados esperados

Código de salida 0 y estados de éxito:

| Estado | Significado |
|---|---|
| `created` | Administrador creado en Auth; sin fila en `staff_accounts`. |
| `created_with_staff` | Recepción creada en Auth y en `staff_accounts`. |
| `existing_valid` | La cuenta ya existía y es coherente. |
| `existing_staff_created` | La cuenta Auth de recepción ya existía y se creó su fila faltante. |

Estados que requieren atención:

| Estado | Acción |
|---|---|
| `blocked_disabled` | No reactivar automáticamente; revisar decisión administrativa. |
| `blocked_role_mismatch` | Revisar el rol real antes de cualquier cambio manual. |
| `blocked_staff_conflict` | Hay una fila de personal incompatible; resolver manualmente. |
| `blocked_staff_mismatch` | La fila no coincide con Auth; no continuar sin auditar. |
| `blocked_staff_inactive` | La fila está inactiva; decidir si debe reactivarse. |
| `blocked_state_changed` | El estado cambió durante la ejecución; volver a ejecutar. |
| `blocked_concurrent_change` | Cambio justo antes de escribir; volver a revisar. |
| `failed` | Error remoto; leer el mensaje y no reintentar a ciegas. |
| `failed_rolled_back` | Falló la inserción y el usuario creado fue eliminado y verificado. |
| `failed_partial` | No se pudo verificar el rollback; revisar manualmente **antes** de reintentar. |

### 9.8. Si el procedimiento se detiene o falla

1. **No repetir automáticamente.** Un reintento a ciegas puede duplicar
   intentos o dejar estados parciales.
2. Copiar el resumen mostrado (sin contraseñas) y revisar el estado de la
   cuenta en Supabase Auth y `staff_accounts`.
3. Si aparece `failed_partial`, comprobar si el usuario Auth sigue existiendo
   antes de cualquier limpieza manual.
4. Si el error es de configuración, corregir las variables y volver a ejecutar;
   no se habrá creado nada.
5. Si el error es de concurrencia, cerrar otras sesiones administrativas y
   repetir el procedimiento completo.
6. Cualquier eliminación manual de usuarios o filas debe ser autorizada y
   verificada por el propietario.

---

## 10. Verificación del acceso administrativo

Todo lo siguiente se realiza **después** de una ejecución autorizada del
procedimiento. No se ejecutó en esta intervención.

### 10.1. Existencia del usuario en Supabase Auth

En Supabase → Authentication → Users, buscar `admin@ironforge.com` y
`recepcion@ironforge.com`. Deben existir con correo confirmado.

Verificación SQL de solo lectura (opcional, desde el SQL Editor del proyecto
correcto):

```sql
select id, email, raw_app_meta_data ->> 'gym_role' as gym_role, email_confirmed_at
from auth.users
where lower(email) in ('admin@ironforge.com', 'recepcion@ironforge.com');
```

Esta consulta solo lee; no modifica datos. No debe ejecutarse sin confirmar el
proyecto.

### 10.2. Rol administrativo correcto

`raw_app_meta_data->>'gym_role'` debe ser `admin` para la cuenta administrativa
y `reception` para recepción. Un valor `authenticated` en el rol JWT no es
suficiente ni sustituye a `gym_role`.

### 10.3. Ausencia de fila administrativa en `staff_accounts`

```sql
select user_id, email, rol, activo
from public.staff_accounts
where lower(email) = 'admin@ironforge.com';
```

El resultado esperado es **cero filas** para el administrador. Para recepción
debe existir exactamente una fila con `rol='reception'` y `activo=true`.

### 10.4. Inicio de sesión

1. Abrir la aplicación actual (no la versión antigua).
2. Iniciar sesión con `admin@ironforge.com` y la contraseña definida.
3. Confirmar que no aparece ningún error de credenciales.

### 10.5. Acceso al panel administrativo

1. Verificar que la interfaz muestra el panel de administración.
2. Comprobar que las rutas protegidas no redirigen al inicio.
3. Abrir una sección administrativa (por ejemplo, gestión de personal) y
   confirmar que las consultas no fallan por permisos.
4. Repetir el inicio de sesión con recepción y confirmar que **no** accede al
   panel administrativo, pero sí a las funciones de recepción.

Si el inicio de sesión funciona pero el panel no aparece, revisar
`app_metadata.gym_role` y la lógica de `isAdminUser()` antes de cambiar código.

---

## 11. Estado final del trabajo

### Terminado

- Script reestructurado, endurecido y con validación estricta de proyecto.
- Suite de **61 pruebas** aprobadas, con cobertura de paginación, conflictos,
  roles, rollback, concurrencia y configuración.
- Documentación de correcciones, revisión y recuperación actualizada.
- Procedimiento administrativo definido y verificable.

### Preparado pero no ejecutado

- Creación real de `admin@ironforge.com` y `recepcion@ironforge.com` en
  `Proyecto_gymnasio`.
- Verificación remota de Auth, `staff_accounts` y acceso al panel.

### Pendiente

- Confirmación del propietario para ejecutar el procedimiento.
- Prueba manual de entrada oculta en una terminal Windows real.
- Verificación de integración real contra Supabase.
- Decisión sobre índices/RPC de integridad en PostgreSQL (requiere
  autorización).
- Comprobación de acceso al panel administrativo.

**No se declara que el administrador exista ni que el panel funcione.** Esa
afirmación solo podrá hacerse después de la ejecución autorizada y su
verificación.

---

## 12. Historial de cambios

| Fecha | Intervención | Archivos afectados | Resultado |
|---|---|---|---|
| 2026-11-16 | Reestructuración del script y suite (fase inicial) | `supabase/scripts/initialize-staff.mjs`, `supabase/scripts/initialize-staff.test.mjs` | Módulo ESM, entrada oculta, preflight, rollback y pruebas sobre la implementación real. |
| 2026-11-16 | Corrección de paginación, correo y concurrencia (fase de revisión) | Los mismos archivos y los tres informes previos | `ilike` sin distinción de mayúsculas, evidencia de `nextPage`, segunda lectura y relectura previa a escritura. |
| 2026-11-16 | Endurecimiento final de la URL y del lector | `initialize-staff.mjs`, `initialize-staff.test.mjs` | Rechazo de credenciales, puertos, rutas y parámetros; prueba de cierre con lectura pendiente; 61 pruebas aprobadas. |
| 2026-11-16 | Documentación acumulativa y procedimiento administrativo | `docs/INFORME_FINAL_AUTENTICACION_Y_ACCESO_ADMIN.md` y actualización de los informes previos | Procedimiento definitivo documentado; ejecución remota pendiente de autorización. |

---

## Confirmación expresa de ausencia de operaciones remotas

Durante todas las intervenciones registradas en este documento:

- **no se ejecutó** el script contra Supabase;
- **no se crearon, modificaron ni eliminaron** usuarios remotos;
- **no se desplegaron** Edge Functions;
- **no se ejecutaron** migraciones;
- **no se modificaron** políticas RLS;
- **no se usó** la `service_role` key para operaciones remotas;
- **no se modificó** la versión antigua del proyecto;
- **no se introdujeron** credenciales ni secretos en el repositorio.

Las únicas verificaciones fueron locales: análisis de código, pruebas con un
doble de Supabase, `node --check`, Oxlint, build y lint del frontend.
