# Convenciones de Git

## Formato de commits

Utilizamos **Conventional Commits** en su forma básica.

### Estructura

```
tipo(álcance): descripción breve
```

### Tipos de commit

| Tipo | Uso | Ejemplo |
|---|---|---|
| `feat` | Nueva funcionalidad | `feat(reservas): crear flujo de reserva con Supabase` |
| `fix` | Corrección de error | `fix(cupos): corregir cálculo de disponibilidad` |
| `docs` | Documentación | `docs(readme): documentar instalación` |
| `style` | Cambios visuales sin afectar lógica | `style(hero): mejorar diseño responsive` |
| `refactor` | Reorganización sin cambiar funcionalidad | `refactor(auth): extraer hooks de autenticación` |
| `test` | Pruebas | `test(reservas): agregar test de validación` |
| `chore` | Configuración y mantenimiento | `chore(git): actualizar .gitignore` |

### Reglas

- Usar **minúsculas** siempre.
- Punto y coma o nada al final, no punto.
- Máximo **72 caracteres** en la primera línea.
- Describir qué hace el cambio, no qué se hizo (presente, no pasado).

### Álcances comunes del proyecto

| Álcance | Módulo |
|---|---|
| `home` | Página principal |
| `reservas` | Sistema de reservas de clases |
| `auth` | Autenticación y sesiones |
| `admin` | Panel administrativo |
| `pagos` | Registro de pagos |
| `mobile` | Aplicación móvil Flutter |
| `docs` | Documentación |
| `git` | Configuración de Git |
| `db` | Base de datos / migraciones |

---

## Ramas

### Convención de nombres

```
avance-N/nombre-integrante
```

### Ejemplo

```
avance-1/alejandro
avance-2/carlos
avance-3/maria
avance-4/pedro
```

### Reglas

- Trabajar **siempre** en la rama del avance correspondiente.
- **Nunca** hacer push directo a `main`.
- Usar pull request o merge controlado para integrar a `main`.
- **No** usar `git push --force`.
- **No** hacer `git rebase` o `git reset --hard` sobre ramas compartidas.
- **No** modificar commits de otros integrantes.
- **No** hacer squash de commits ajenos.
- Mantener la rama actualizada con `git pull --ff-only origin main` antes de trabajar.

---

## Revisión del trabajo

El docente revisará el historial de Git y puede usar `git blame` para identificar qué integrante realizó cada parte. Por eso es fundamental:

- Commits pequeños y descriptivos.
- Cada commit representa un cambio claro y justificable.
- No commitear código que no es propio disfrazado con otra identidad.
- No alterar la configuración de `user.name` o `user.email` para simular a otro compañero.
