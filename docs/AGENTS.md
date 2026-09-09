# Guía para Agentes de IA y Desarrolladores

Reglas que cualquier agente de IA o desarrollador debe seguir al trabajar en este proyecto.

---

## Antes de modificar código

1. **Leer el repositorio completo** antes de hacer cualquier cambio. Entender la arquitectura, los componentes existentes y las dependencias.
2. **Revisar `docs/REQUERIMIENTOS.md`** para entender el alcance del sistema.
3. **Revisar `docs/ARQUITECTURA.md`** para conocer el stack y patrones de diseño.
4. **Revisar `docs/STACK.md`** para las versiones exactas de las dependencias.
5. **Revisar `docs/GIT_CONVENTION.md`** para seguir las convenciones de commits.

---

## Reglas de trabajo

### Protección del trabajo existente

- **No eliminar** código funcional sin autorización explícita.
- **No reemplazar** archivos completos por versiones nuevas.
- **No refactorizar** globalmente el proyecto.
- **No renombrar** variables, componentes o funciones innecesariamente.
- **No cambiar** el estilo de código de archivos que ya funcionan.

### Cambios

- Hacer **cambios pequeños y específicos**.
- Crear **nuevos archivos** para funcionalidades nuevas en lugar de reescribir existentes.
- **Reutilizar** componentes, hooks y utilidades existentes siempre que sea posible.
- Mantener **compatibilidad** con el stack existente (React, Vite, Tailwind).

### Seguridad

- **Nunca** incluir claves, tokens ni credenciales en el código.
- **No subir** archivos `.env` al repositorio (solo `.env.example` versionado).
- Usar variables de entorno con prefijo `VITE_` para el frontend.
- No usar la `service_role key` de Supabase en el frontend.

### Calidad

- Ejecutar `npm run build` antes de dar por terminada una tarea.
- Ejecutar `npm run lint` si está configurado.
- Corregir errores producidos por los propios cambios.
- No introducir dependencias innecesarias (verificar primero si ya existe una equivalente).

### Git y documentación

- Hacer **commits pequeños y descriptivos** siguiendo `docs/GIT_CONVENTION.md`.
- No hacer `git push --force`.
- No modificar la autoría de commits existentes.
- No hacer squash ni rebase de ramas compartidas.
- Actualizar documentación cuando cambie la arquitectura o dependencias.

---

## Estructura del proyecto

```
Gym/
├── frontend-web/          → React + Vite (página web)
│   └── src/
│       ├── components/    → Componentes React
│       ├── context/       → React Context (estado global)
│       ├── hooks/         → Custom hooks
│       ├── lib/           → Utilidades (Supabase, permisos, etc.)
│       ├── data/          → Datos estáticos
│       └── services/      → Servicios (pagos, etc.)
├── mobile_app/            → Flutter (app móvil)
├── supabase/
│   └── migrations/        → Scripts SQL en orden cronológico
├── docs/                  → Documentación del proyecto
└── .env.example           → Variables de entorno (sin claves reales)
```

---

## Commits

- Formato: `tipo(álcance): descripción breve`
- Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Ejemplo: `feat(reservas): crear hook de reservas con Supabase`
- Ver `docs/GIT_CONVENTION.md` para detalles completos.
