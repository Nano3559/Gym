# Habilidades Técnicas Requeridas

Capacidades técnicas que un integrante o agente necesita para trabajar en este proyecto.

---

## Habilidades esenciales

| Habilidad | Contexto del proyecto |
|---|---|
| **Git y GitHub** | Control de versiones, ramas por avance, commits convencionales, pull requests |
| **JavaScript / ES Modules** | Lenguaje principal del frontend (`"type": "module"`) |
| **React** | Componentes funcionales, hooks (`useState`, `useEffect`, `useCallback`, `useMemo`), contexto (`React.createContext`) |
| **HTML semántico** | Estructura base en `index.html`, contenido accesible |
| **CSS / Tailwind CSS** | Estilos mediante utilidades, tema personalizado con variables CSS |
| **Responsive Design** | Diseño adaptable a computadora y móvil (breakpoints de Tailwind) |
| **Componentización** | Componentes reutilizables en `src/components/`, separación de responsabilidades |
| **Manejo de formularios** | Formularios de registro, login, contacto con validación |
| **Vite** | Configuración, variables de entorno `VITE_*`, scripts `dev`/`build`/`lint` |
| **Consumo de APIs** | Conexión con Supabase (REST/Auth/Realtime) |

---

## Habilidades según módulo

### Frontend Web

- **React Context API**: manejo de estado global (autenticación, planes, pagos).
- **Custom Hooks**: extracción de lógica reutilizable (`useClasses`, `useBookings`, etc.).
- **lucide-react**: uso de iconos como componentes SVG.
- **oxlint**: análisis estático de código, configuración en `.oxlintrc.json`.

### Backend / Base de datos

- **Supabase**: autenticación, consultas, RPC, Realtime, Row Level Security.
- **PostgreSQL**: diseño de tablas, relaciones, índices, funciones PL/pgSQL.
- **Migraciones SQL**: scripts reproducibles en `supabase/migrations/`.
- **RLS (Row Level Security)**: políticas de acceso a nivel de fila.

### App Móvil

- **Flutter / Dart**: desarrollo multiplataforma (Android, iOS, Web).
- **Supabase (Flutter)**: conexión desde la app móvil.

---

## Buenas prácticas

- **No inventar tecnologías**: documentar solo las que realmente existen en el proyecto.
- **Verificar `package.json`** antes de afirmar una dependencia.
- **Leer código existente** antes de implementar algo similar.
- **Commits pequeños**: un cambio claro por commit.
- **No subir secretos**: verificar que `.env` esté en `.gitignore` antes de commitear.
- **Probar antes de entregar**: ejecutar `npm run build` y verificar que no haya errores.
