# Integración continua web — IronForge Gym

## Alcance

El `Jenkinsfile` de la raíz comprueba únicamente `frontend-web`. Conserva los comandos anteriores y añade `test:ci`, `coverage:ci` y `test:ci:reporting`. No despliega, cobra pagos, aplica migraciones ni utiliza una cuenta del gimnasio.

## Preparar Jenkins

1. Instalar Jenkins y los complementos **Pipeline**, **Git**, **JUnit** y **HTML Publisher**.
2. Preparar un agente Windows o Linux con Git, Node.js **24.14 o superior dentro de 24.x** y npm. No necesita Chrome, Flutter, Python, Supabase CLI ni cámara. `npm ci --engine-strict` comprueba la versión declarada.
3. Crear un trabajo **Pipeline → Pipeline script from SCM → Git**, repositorio `https://github.com/Nano3559/Gym.git`, rama que contenga estos archivos (por ejemplo `*/main`), Script Path `Jenkinsfile`. Si el repositorio es privado, usar credenciales de lectura de GitHub en Jenkins; no credenciales de Supabase/IA.
4. Ejecutar **Build Now**. El checkout usa `checkout scm`, por lo que prueba la revisión seleccionada por Jenkins, también en trabajos multibranch.

El agente necesita acceso a GitHub y al registro npm para descargar código y dependencias. Durante las pruebas se bloquean fetch, HTTP/HTTPS y conexiones TCP, incluso a servicios locales. Los pipes internos del ejecutor sí se permiten. No es una barrera de seguridad contra código malicioso: el Jenkinsfile y las dependencias deben provenir de revisiones de confianza.

## Etapas y resultado

| Etapa | Acción |
| --- | --- |
| Descarga desde GitHub | Limpia el workspace dedicado al trabajo y descarga la revisión. No usar una carpeta de trabajo personal como workspace Jenkins. |
| Instalación | Dentro de `frontend-web`, `npm ci --engine-strict --no-audit --no-fund`, utilizando `package-lock.json`. |
| Análisis | `npm run lint`; los errores fallan la ejecución. Las advertencias existentes no son errores. |
| Pruebas | Verifica el ejecutor con una suite artificial fallida, elimina esos reportes y ejecuta `npm run test:ci`. |
| Cobertura | `npm run coverage:ci` transforma las mediciones V8 de esa misma ejecución en HTML, LCOV y resumen JSON. |
| Compilación | `npm run build`. No publica la aplicación. |

Un fallo en pruebas o cobertura marca **FAILURE** y permite continuar para generar más evidencia. Un error de instalación o lint detiene las etapas posteriores. El bloque `post/always` publica lo disponible en ambos casos. Los publicadores se protegen con `try/finally` para que un error de publicación no impida archivar los demás archivos. No se convierte un fallo de pruebas en SUCCESS.

JUnit muestra resultados aprobados, fallidos y omitidos. Los scripts heredados basados en `node:assert` se registran **por archivo**, sin inventar un resultado por cada mensaje `console.log`. Los nuevos casos `node:test` se registran individualmente. Un assert no capturado o un código de salida distinto de cero hace fallar el archivo. Un archivo fallido no impide ejecutar los restantes. No hay omisiones artificiales en la suite normal; los smoke tests excluidos no se cuentan como pruebas aprobadas ni omitidas.

## Ejecución local

Desde la raíz, en la terminal:

```text
cd frontend-web
npm ci --engine-strict --no-audit --no-fund
npm run lint
npm run test:ci:reporting
npm run test:ci
npm run coverage:ci
npm run build
```

`test:ci:reporting` es una comprobación deliberada del mecanismo: crea una prueba correcta, una fallida y una omitida; exige salida 1 y etiquetas JUnit de fallo/omisión, comprueba la limpieza de reportes antiguos y la cobertura después de un fallo. Al terminar elimina sus fixtures y reportes. Ejecutarla **antes** de la suite normal; nunca en paralelo con ella.

`test:ci` limpia `reports/` y selecciona todos los `scripts/*.test.mjs` ordenados, uno por proceso, con concurrencia 1 y límite de 90 segundos por archivo. Los nuevos archivos con ese sufijo entran automáticamente; deben respetar la regla de no depender de navegador o servicios externos. `reports/selection.json` conserva la selección exacta. Para diagnóstico se puede pasar un archivo explícito a `node scripts/ci/run.mjs scripts/gym-business.test.mjs`; Jenkins siempre usa la selección completa.

## Reportes

- `frontend-web/reports/junit.xml`: resultados del ejecutor Node.
- `frontend-web/reports/coverage/index.html`: abrir localmente o desde **Cobertura de código web** en Jenkins.
- `frontend-web/reports/coverage/lcov.info`: medición LCOV.
- `frontend-web/reports/coverage/coverage-summary.json`: resumen numérico.
- `frontend-web/reports/v8/`: mediciones crudas, también archivadas para diagnóstico.
- `frontend-web/reports/selection.json`: inventario de pruebas ejecutadas.
- `frontend-web/dist/`: compilación archivada cuando existe.

La cobertura mide líneas, funciones, ramas y sentencias realmente ejecutadas con V8 y c8. **No es la cobertura de alimentación o días completos que calcula la aplicación**. El denominador incluye JS/JSX de `src`, también archivos sin ejecutar; se excluyen datos estáticos, demo, punto de montaje y cliente de Supabase real. No hay un umbral porcentual arbitrario: se exige que existan mediciones, HTML y al menos una línea de producción ejecutada, además de que las pruebas pasen.

Los tests de servicios heredados que evalúan copias mediante `data:` no siempre se atribuyen al archivo original; no se les concede cobertura ficticia. Los nuevos tests cargan los módulos de producción con URL de archivo y mapas de fuentes para JSX. Los componentes no ejercitados aparecerán sin cobertura. Un porcentaje alto de ramas no equivale a validación completa de interfaz o backend.

El HTML Publisher y la política CSP de Jenkins pueden limitar estilos/scripts del reporte. Si ocurre, descargar el archivo HTML con sus recursos archivados; no es necesario desactivar globalmente la protección de Jenkins.

## Aislamiento y cobertura funcional nueva

Los tests nuevos usan correos `example.invalid`, identificadores y pagos ficticios. El loader de pruebas reemplaza el cliente Supabase; la configuración externa se vacía antes de cargar los módulos y los intentos de red no simulados fallan. Se conservan los dobles existentes. El loader no participa en el build ni cambia el código de la aplicación.

`gym-business.test.mjs` comprueba:

- Login correcto, credenciales inválidas, correo sin confirmar, error del proveedor, antigua cuenta demo sin bypass y cierre de sesión.
- Registro, confirmación pendiente, usuario duplicado, contraseña inválida y CI duplicado.
- Acceso de interfaz para administrador, recepción, entrenador, miembro y visitante.
- Reserva con propietario, falta de sesión, errores por cupo agotado, duplicados y clase no disponible; cancelación filtrada por propietario/estado y rechazo de permisos.
- Membresía activa por propietario, errores de lectura, fechas inválidas, vencimiento, frontera de cinco días y congelación vía RPC.
- Pago pendiente, resolución de plan, confirmación/renovación delegada a RPC, errores de permisos, QR y liberación de suscripción.
- Asistencia permitida/denegada y errores sin añadir falsos ingresos locales.

`ci-isolation.test.mjs` comprueba que las conexiones reales estén bloqueadas. Los tests de progreso existentes se ajustan a la consulta actual de fecha de nacimiento, cuyo propietario es `profiles.id`, no `user_id`.

**Límites:** simular un rechazo por falta de cupos comprueba cómo responde el frontend; no ejecuta el bloqueo SQL de cupos ni demuestra ausencia de carreras entre reservas. Simular pagos no prueba una pasarela, cobros reales ni atomicidad SQL. Los permisos de interfaz no prueban RLS. Esas verificaciones requieren una base de pruebas separada. También quedan fuera la precisión física del detector, cámara real y renderizado en navegador. El soporte de hooks sin navegador usa `react-test-renderer` (misma versión que React), actualmente deprecado por React; queda limitado a tests, sin dependencia en producción.

## Comprobaciones separadas, no ejecutadas por Jenkins web

### Navegador y servicios externos

Desde `frontend-web`, ejecutar bajo preparación específica:

```text
npm run test:camera
npm run test:mobile
npm run test:food
```

Revisar primero los encabezados de `scripts/camera-smoke.mjs`, `mobile-viewport-smoke.mjs` y `food-analysis-smoke.mjs`: necesitan Chrome/Edge y algunos requieren muestras, modelos o configuración de servicios. No deben apuntar a cuentas reales para pruebas automáticas. `camera-lifecycle.test.mjs` sí entra en CI porque simula cámara y permisos; `mobile-layout.test.mjs` es una revisión estática, no una prueba en teléfono.

### Flutter

En `mobile_app`, con Flutter SDK instalado:

```text
flutter pub get
flutter test
```

Se conserva `mobile_app/test/widget_test.dart`. No se ejecutó en esta validación web.

### SQL

Los archivos `supabase/tests/*_security.sql` requieren PostgreSQL/Supabase **local o desechable**, con las migraciones aplicadas previamente. Ejecutar cada archivo con `psql -v ON_ERROR_STOP=1 -f ruta/al/test.sql`, conectado exclusivamente a esa base de pruebas. Los scripts usan fixtures y transacciones revertidas; revisar cada uno antes de ejecutarlo. No ejecutar `db push --linked` ni usar producción como parte de este pipeline. Los controles SQL de reservas, pagos y concurrencia requieren ampliar esa suite; los dobles web no los sustituyen. No se ejecutaron aquí.

### Python

En `research/hito4-ml`, preparar un entorno virtual e instalar `requirements.txt`; ejecutar `python run_tests_v2.py` según `README-v2.md`. El evaluador trabaja con fixtures sintéticos para pruebas de software; esto no certifica un benchmark de datos reales. No se instaló ni ejecutó Python/DIETFITS como parte de Jenkins web.

## Referencias de las herramientas

- [Ejecutor y reporteros Node](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Cobertura c8](https://github.com/bcoe/c8).
- [Publicación JUnit](https://www.jenkins.io/doc/pipeline/steps/junit/).
- [Publicación HTML](https://www.jenkins.io/doc/pipeline/steps/htmlpublisher/).

## Validaci�n local realizada el 4 de noviembre de 2026

- `npm ci --engine-strict --no-audit --no-fund`: correcto con Node 24.14.1.
- `npm run test:ci:reporting`: correcto; comprob� salida de error y publicaci�n tras fallo deliberado.
- `npm run test:ci`: **33 archivos, 74 resultados aprobados, 0 fallidos, 0 omitidos**. Corresponden a 31 scripts heredados y 43 casos individuales nuevos, no a 74 escenarios heredados desglosados.
- JUnit XML analizado: 74 elementos testcase, sin failure/error/skipped.
- `npm run coverage:ci`: HTML generado; l�neas/sentencias **42,88 %**, funciones **78,05 %**, ramas **95,45 %**. Alcance y l�mites descritos arriba.
- `npm run lint`: salida 0; cinco advertencias preexistentes, sin advertencias nuevas.
- `npm run build`: correcto.
- No se ejecut� un servidor Jenkins, Chromium/c�mara f�sica, servicios reales, migraciones, Flutter, SQL ni los tests Python. La publicaci�n dentro de Jenkins debe comprobarse al crear y ejecutar el trabajo.
