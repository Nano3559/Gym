# Módulo 2 — Portal del Cliente y Reservas

Módulo de autenticación y sistema de reservas con **Supabase** (Auth + PostgreSQL + Realtime) para el sitio del gimnasio IronForge, integrado sobre la landing page existente del Módulo 1 (React + Vite + Tailwind).

---

## 1. Instalación

```bash
cd frontend-web
npm install
```

Dependencia nueva agregada en este módulo:

- `@supabase/supabase-js` — cliente oficial de Supabase.

No se agregó ninguna otra dependencia.

## 2. Variables de entorno

Copia `frontend-web/.env.example` como `frontend-web/.env` y completa:

```
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLISHABLE_ANON
```

- Las claves se leen en `frontend-web/src/lib/supabase.js`.
- **Nunca** uses la `service_role key` en el frontend.
- `.env` está ignorado por Git (ver `frontend-web/.gitignore`). Solo se versiona `.env.example`.
- Si las variables no están definidas, la aplicación funciona en **modo local** (datos estáticos del Módulo 1), de modo que el proyecto sigue compilando y funcionando sin credenciales.

## 3. Creación del proyecto en Supabase

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. Guarda la contraseña de la base de datos que te pida Supabase.
3. En **Project Settings → API** copia:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon / publishable key` → `VITE_SUPABASE_PUBLISHABLE_KEY`

## 4. Ejecución de migraciones

Los scripts SQL están en `supabase/migrations/` y son idempotentes/reproducibles. Ejecutarlos **en orden** desde el **SQL Editor** de Supabase:

| Orden | Archivo | Contenido |
|---|---|---|
| 1 | `20260820000001_init_schema.sql` | Tablas `plans`, `profiles`, `classes`, `bookings`, relaciones, índices, constraints y trigger `auth.users → profiles` |
| 2 | `20260820000002_rls_policies.sql` | Row Level Security y policies |
| 3 | `20260820000003_functions_realtime.sql` | RPC `reservar_clase()`, trigger de cupos (`reservas_count`) y publicación Realtime |
| 4 | `20260820000004_seed.sql` | Planes del Módulo 1 + función `generar_clases()` + calendario inicial de 6 semanas |

> La función `generar_clases(6)` crea las sesiones de clases de las próximas 6 semanas a partir de la plantilla semanal del Módulo 1 (`gymData.js`). Cuando el calendario se acabe, vuelve a ejecutar `select public.generar_clases(6);` en el SQL Editor.

## 5. Configuración de Auth

En el panel de Supabase:

1. **Authentication → Providers → Email**: habilitado (por defecto). El acceso es con correo + contraseña.
2. **Authentication → Sign In / Up → Email confirmation**:
   - Si dejas la confirmación por correo **activada**, tras registrarse el usuario recibirá un mail para confirmar su cuenta antes de poder iniciar sesión (la app muestra ese aviso).
   - Para probar rápido en desarrollo puedes desactivar la confirmación automática.
3. **Authentication → URL Configuration**: agrega `http://localhost:5173` a las URLs permitidas para desarrollo.

La sesión persiste tras recargar la página (Supabase la guarda en `localStorage`; ver `storageKey: 'ironforge-auth'` en `src/lib/supabase.js`).

## 6. Ejecución local

```bash
cd frontend-web
npm run dev      # http://localhost:5173
npm run build    # build de producción
npm run preview  # sirve el build
npm run lint     # oxlint
```

## 7. Estructura de base de datos

```
auth.users (Supabase)
   │ 1:1 (id)
   ▼
profiles ──► plans (plan_id)
   │ 1:N
   ▼
bookings ──► classes
```

### profiles
`id` (FK → auth.users), `nombre`, `apellido`, `ci` (único), `telefono`, `fecha_nacimiento`, `email`, `direccion`, `contacto_emergencia`, `plan_id` (FK → plans), `created_at`.

> Los campos `direccion`, `contacto_emergencia` y `plan_id` conservan toda la información que ya pedía el formulario de registro del Módulo 1.

### plans
`id`, `codigo` (`basico`/`completo`/`premium`, mapea los ids del Módulo 1), `nombre`, `descripcion`, `precio`, `duracion_dias`, `activo`, `created_at`.

### classes
`id`, `nombre`, `descripcion`, `fecha`, `hora_inicio`, `hora_fin`, `capacidad`, `entrenador`, `activo`, `reservas_count`, `created_at`. Única por `(nombre, fecha, hora_inicio)`.

### bookings
`id`, `user_id` (FK → auth.users), `class_id` (FK → classes), `estado` (`confirmada`/`cancelada`), `created_at`, `cancelled_at`. Índice único parcial `(user_id, class_id) WHERE estado='confirmada'` que impide reservar dos veces la misma clase.

## 8. Seguridad (RLS)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | solo el propio | solo el propio (`auth.uid() = id`) | solo el propio | ❌ nadie |
| `plans` | público (activos) | ❌ | ❌ | ❌ |
| `classes` | público | ❌ | ❌ | ❌ |
| `bookings` | solo propias | solo propias y `confirmada` | solo propias | ❌ (solo se cancela) |

- Cancelar una reserva hace `UPDATE estado='cancelada', cancelled_at=now()`; no se borra el historial.
- La validación de cupos y duplicados **no depende del frontend**: la hace la función `reservar_clase()` en la base de datos.

## 9. Cupos y condiciones de carrera

- `reservas_count` en `classes` se mantiene con triggers (`tg_bookings_maintain_count`) al insertar o cancelar reservas.
- `reservar_clase(p_class_id)`:
  1. exige sesión iniciada;
  2. bloquea la fila de la clase con `SELECT ... FOR UPDATE` (serializa reservas simultáneas);
  3. rechaza clases pasadas o inactivas;
  4. rechaza reservas duplicadas;
  5. cuenta las reservas confirmadas reales y rechaza si `ocupadas >= capacidad`.
- Ejemplo: capacidad 20, 17 reservas → la sección muestra `17/20` y `3 cupos disponibles`.

## 10. Realtime

Implementado. `useClasses` se suscribe a cambios en la tabla `classes` (`postgres_changes`). Cuando cualquier usuario reserva o cancela, el trigger actualiza `reservas_count` y todos los clientes conectados reciben el cambio y refrescan los cupos sin recargar. Configuración incluida en la migración 3 (`alter publication supabase_realtime ...`).

## 11. Funcionalidades implementadas

- **Registro**: el formulario existente (`RegisterModal.jsx`) ahora crea el usuario en Supabase Auth (se añadieron los campos Contraseña y Confirmar contraseña) y guarda el perfil completo en `profiles` (incluye CI, dirección, plan y contacto de emergencia del Módulo 1). CI duplicado y correo duplicado se manejan con mensajes claros.
- **Login / Logout**: nuevo `LoginModal.jsx` con el mismo estilo visual. Botones en la barra de navegación y chip de usuario con cierre de sesión.
- **Persistencia de sesión**: la sesión se restaura automáticamente al recargar (`AuthProvider`).
- **Reservas protegidas**: reservar y ver "Mis reservas" requieren sesión iniciada cuando Supabase está configurado.
- **Reservas reales**: se guardan en `bookings` vía RPC; cupos calculados desde datos reales; sin duplicados ni sobre-cupo.
- **Mis reservas**: lista desde Supabase con clase, fecha, horario, entrenador, estado y fecha de reserva; permite cancelar y libera el cupo.
- **Modo local (fallback)**: sin variables de entorno, la landing del Módulo 1 funciona exactamente igual que antes (reservas demo en memoria).

## 12. Limitaciones conocidas

- El botón "Reservar" de la sección **Servicios** (tarjetas informativas como Musculación/Cardio) mantiene el comportamiento demo del Módulo 1: no corresponde a una sesión con fecha en la base de datos, por lo que no se persiste en `bookings`. Las reservas persistentes son las de la sección **Horarios**.
- El calendario de clases depende del seed (`generar_clases`); si pasan las semanas hay que volver a ejecutarlo.
