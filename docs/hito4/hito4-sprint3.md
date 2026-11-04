# Hito 4 — Sprint 3: estimación de gasto energético

## Estado

Implementado en la copia de trabajo `hito4-work/Gym`. No aplicado al proyecto activo ni a Supabase. La migración nueva es `20261022000017_energy_estimates.sql`; requiere las migraciones 15 y 16. Pruebas locales aprobadas; aceptación en base de datos y navegador real pendiente.

## Función incorporada

En “Mi diario”, la sección “Gasto energético estimado” muestra reposo, incremento cotidiano, ejercicio adicional conocido y total. El usuario selecciona el movimiento cotidiano de ese día sin entrenamientos y revisa la categoría de cada sesión. Puede guardar una instantánea inmutable de la estimación y consultar las últimas cinco guardadas, con sus datos principales.

No se calcula el balance ingesta/gasto ni una proyección de peso: esas tareas corresponden a los siguientes sprints.

## Método y fuentes

Versión: `mifflin-met-replacement-v1`.

1. **Reposo por 24 horas:** `10 × peso_kg + 6,25 × estatura_cm − 5 × edad + constante`, con constante `5` para masculino y `−161` para femenino. Fuente original: [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/).
2. **Base cotidiana:** reposo multiplicado por un factor elegido explícitamente: 1,4, 1,6 o 1,8. Son supuestos operativos orientativos, no parámetros medidos ni calibrados para el usuario. [NIDDK](https://www.niddk.nih.gov/bwp) describe niveles generales de actividad entre 1,4 y 2,5; esto no valida nuestra correspondencia de etiquetas ni su aplicación excluyendo entrenamientos. La interfaz explica esa limitación y no reutiliza automáticamente el nivel habitual del perfil.
3. **Ejercicio bruto:** `MET × 3,5 × peso_kg / 200 × minutos`. Es la conversión convencional basada en consumo de oxígeno estándar y aproximadamente 5 kcal/L; no corrige el MET poblacional a una medición individual.
4. **Ejercicio adicional:** `máximo(0, bruto − base_por_minuto × minutos)`. La base ya incluye esas horas del día: se sustituye la parte correspondiente, en lugar de sumar de nuevo el gasto bruto o el reposo.
5. **Total:** base + ejercicio adicional, redondeados a kcal. En días con cambio horario se escala la base a la duración real de ese día local (23/24/25 horas).

Ejemplo comprobado en pruebas: 80 kg, 180 cm, masculino, 30 años: reposo 1.780 kcal; factor 1,4: base 2.492 kcal. Treinta minutos activos de pesas a 3,5 MET: bruto 147 kcal, aproximadamente 52 kcal ya incluidas en la base y 95 kcal adicionales. Total: 2.587 kcal. No se suman otras 147 kcal encima de las 2.492.

Catálogo inicial pequeño y explícito del [Compendio adulto 2024](https://pacompendium.com/adult-compendium/):

| Código | Actividad | MET | Fuente |
|---|---|---|---|
| 17190 | Caminar a 4,5–5,5 km/h en llano | 3,8 | https://pacompendium.com/walking/ |
| 02054 | Pesas, varios ejercicios, 8–15 repeticiones | 3,5 | https://pacompendium.com/conditioning-exercise/ |
| 02022 | Calistenia moderada | 3,8 | https://pacompendium.com/conditioning-exercise/ |
| 02024 | Calistenia ligera | 2,8 | https://pacompendium.com/conditioning-exercise/ |
| 01010 | Bicicleta recreativa a menos de 16 km/h | 4,0 | https://pacompendium.com/bicycling/ |
| 01200 | Bicicleta estática general | 6,8 | https://pacompendium.com/bicycling/ |

No se infiere la categoría por nombre, series o carga. Una rutina mixta representada por una sola categoría es una aproximación que el usuario debe revisar; si no corresponde al catálogo, puede dejarla sin especificar y no se publica un total completo. Los minutos proceden de la fase de ejercicio registrada, no de una medición metabólica; esto añade incertidumbre al usar valores MET de actividades poblacionales.

## Datos, límites y trazabilidad

- Alcance inicial: adultos de 19 a 59 años. Hace falta fecha de nacimiento, estatura, sexo para la fórmula y un pesaje de ese día o anterior. No se utiliza la meta como peso de cálculo.
- Se requiere un pesaje de los últimos 30 días, como criterio operativo conservador de esta versión, no como umbral clínico validado.
- Un perfil actualizado después del día consultado no se usa para reconstruir ese pasado. Las estimaciones ya guardadas conservan sus entradas; el perfil actual no proporciona un historial fisiológico que no existe.
- Se consultan también sesiones iniciadas el día anterior que terminen dentro del día. Una sesión que cruce medianoche requiere dividir/revisar registros antes de publicar el total; no se reparte su tiempo activo de forma inventada.
- Se bloquea el total ante duraciones/fechas inválidas, sesiones desconocidas, datos históricos insuficientes y horarios solapados. Una actividad desconocida no equivale a cero.
- Una misma sesión no se suma dos veces y las anuladas se excluyen.
- Si la actividad está incompleta o el día no ha terminado, el cálculo se identifica como provisional y de día entero. No equivale al gasto acumulado hasta la hora actual.
- Al cambiar datos del diario se vuelve a cargar el cálculo; mientras llegan las entradas actualizadas, no se permite guardar la estimación anterior como actual.

## Persistencia y seguridad

`energy_activity_annotations` relaciona una sesión propia con su categoría revisada. Permite cambiarla o quitarla; RLS impide clasificar sesiones ajenas.

`daily_energy_estimates` conserva instantáneas con día, zona, método, versión, entradas, componentes y advertencias. No se sobrescriben instantáneas antiguas. El UUID de operación permite reintentar sin duplicar.

El servidor valida propietario, zona, fecha, versión, formato y consistencia básica `total = base + ejercicio`. Las instantáneas se calculan en el cliente: no son resultados certificados ni una recomputación fisiológica del servidor. Un futuro cálculo de balance no debe tratarlas como una fuente autoritativa sin verificar sus entradas y vigencia.

No se guardan credenciales ni se añaden dependencias de IA. Los datos permanecen asociados al usuario autenticado.

## Pruebas realizadas

- `npm run test:energy`: fórmula de referencia, cumpleaños, campos ausentes, edad fuera de alcance, pesajes futuros/antiguos, perfil posterior al día, duplicados, anulaciones, datos desconocidos, solapamientos, límites entre días y horario de verano. Prueba explícita de sustitución de la base sin doble conteo.
- Servicios con doble de Supabase: consultas filtradas por propietario, paginación de 501 sesiones/anotaciones, búsqueda de peso sin datos futuros, inclusión de sesiones que cruzan días, edición de categorías e instantáneas idempotentes.
- Regresión: `test:tracking`, `test:progress`, `test:training` aprobadas.
- Lint y compilación aprobados con las advertencias previas del proyecto.

`supabase/tests/energy_security.sql` está preparado, pero NO ejecutado: comprueba aislamiento entre dos usuarios, anotaciones de sesiones propias e inmutabilidad. No se dispone de un PostgreSQL local operativo ni se ha validado el servidor remoto. Tampoco se ha completado aceptación visual móvil/escritorio.

## Entrega y aceptación pendiente

El paquete acumulado contiene sprints 1–3 y un instalador con respaldo y comprobación de hashes para no sobrescribir cambios posteriores. No contiene `.env`, dependencias ni datos de usuarios. El instalador solo aplica archivos: no ejecuta migraciones.

Antes de aceptar: aplicar los archivos al proyecto activo, revisar/aplicar las migraciones 15–17, ejecutar las pruebas SQL y verificar con dos cuentas reales el flujo perfil → pesaje → actividad → categoría → estimación → recarga. Evaluar la precisión con datos reales antes de presentar el resultado como personalizado o validado.
