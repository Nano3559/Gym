# Stack Tecnológico

Stack tecnológico real utilizado en el proyecto, verificado a partir de `package.json` y configuraciones del repositorio.

---

## Frontend Web (`frontend-web/`)

| Tecnología | Versión | Función |
|---|---|---|
| React | ^19.2.8 | Librería de UI (componentes, hooks, contexto) |
| Vite | ^8.2.0 | Bundler y servidor de desarrollo |
| Tailwind CSS | ^4.3.3 | Framework de utilidades CSS |
| @tailwindcss/vite | ^4.3.3 | Plugin de Tailwind para Vite |
| PostCSS | ^8.5.26 | Procesador de CSS |
| Autoprefixer | ^10.5.4 | Prefijos automáticos de CSS |
| lucide-react | ^1.32.0 | Iconos SVG como componentes React |
| @supabase/supabase-js | ^2.112.3 | Cliente oficial de Supabase (Auth, BD, Realtime) |
| oxlint | ^1.75.0 | Linter rápido (devDependency) |

### Configuración

- **Módulos ES** (`"type": "module"` en package.json).
- Plugin de React de Vite basado en **Oxc**.
- Tailwind v4 integrado vía plugin de Vite (sin `tailwind.config.js`).
- Linter: **oxlint** con reglas de React (`rules-of-hooks`, `only-export-components`).
- Variables de entorno con prefijo `VITE_` (accesibles en `import.meta.env`).

### Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo (HMR)
npm run build    # Build de producción (output: dist/)
npm run preview  # Vista previa del build
npm run lint     # Análisis de código con oxlint
```

---

## App Móvil (`mobile_app/`)

| Tecnología | Versión | Función |
|---|---|---|
| Flutter | SDK ^3.13.2 | Framework multiplataforma |
| Dart | (incluido en SDK) | Lenguaje de programación |
| Supabase (Flutter) | (ver pubspec.yaml) | Backend |

- Plataformas soportadas: Android, iOS, Linux, macOS, Web, Windows.
- Directorios de compilación generados por Flutter están ignorados por Git.

---

## Backend

| Tecnología | Función |
|---|---|
| Supabase | Backend como servicio (BaaS) |
| PostgreSQL | Base de datos relacional (a través de Supabase) |
| Supabase Auth | Autenticación con email/contraseña |
| Supabase Realtime | Sincronización en vivo de datos |
| Row Level Security (RLS) | Seguridad a nivel de fila en la base de datos |

- Las migraciones SQL están en `supabase/migrations/`.
- Las credenciales de Supabase se configuran en `frontend-web/.env` (nunca en el repositorio).

---

## Control de Versiones

| Herramienta | Función |
|---|---|
| Git | Control de versiones local |
| GitHub | Repositorio remoto y colaboración |

---

## Arquitectura general

```
Gym/
├── frontend-web/        → Página web principal (React + Vite)
├── mobile_app/          → Aplicación móvil (Flutter)
├── supabase/            → Migraciones SQL y configuración de BD
├── docs/                → Documentación del proyecto
└── README.md            → Documentación principal
```
