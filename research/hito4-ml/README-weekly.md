# Piloto semanal — Sprint 8 del agente nuevo

Estado: infraestructura y evaluador implementados; validación real y adopción pendientes. No hay un modelo semanal aprobado ni se ha sustituido `observed-weekly-v2`. DIETFITS mide visitas a meses y no autoriza predicciones semanales. `evidence/weekly-readiness.json` es la decisión actual, no un resultado experimental inventado.

## 1. Consentimiento y captura prospectiva

Aplicar la migración `20261106000024_weekly_research_consent.sql` por el procedimiento habitual. No se ha aplicado a Supabase desde esta implementación. El formulario opcional está en Mi diario → Proyección → Participación opcional en el piloto semanal. Primero consultar y autorizar cada finalidad; después emitir una proyección nueva y registrar su copia durante la primera hora. Autorizar una finalidad no autoriza la otra. Una emisión previa al consentimiento no se incorpora retrospectivamente. Participar no activa IA.

Las funciones usan `auth.uid()`, no aceptan un propietario externo y serializan consentimiento, captura, retirada y exportación. Las tablas tienen RLS y no permiten escrituras directas del cliente. La copia contiene una lista explícita de datos necesarios, sin la meta original, `user_id`, nombre, correo ni fecha de nacimiento. El seudónimo sigue siendo dato personal; fechas y pesos pueden permitir reidentificación. El hash SHA-256 permite comprobar integridad, **no demuestra autenticidad** de un archivo que alguien haya editado y vuelto a firmar localmente.

Retirar cualquiera de las finalidades elimina todas las copias prospectivas del piloto de esa cuenta, sin eliminar pesajes, comidas ni proyecciones originales. Conserva comprobantes. Reautorizar no reactiva las copias antiguas. Las descargas ya realizadas no se pueden retirar remotamente: el responsable debe excluirlas y borrarlas también de sus conjuntos de datos antes de reutilizarlos. No se implementa borrado selectivo de modelos ya entrenados. Por ello no hay entrenamiento automático ni carga a un servicio externo. Antes de recoger datos reales se deben acordar responsable, destino privado, plazo de conservación y procedimiento de retirada de exportaciones/modelos; **no basta con activar una casilla**.

Exportar individualmente para entrenamiento o evaluación después de madurar los resultados. Guardar solo en `private-weekly/exports` (ignorado por Git), con permisos del equipo de investigación. Conservar un único archivo vigente por persona y finalidad; nunca mezclar exportaciones antiguas para saltarse una retirada. El exportador no permite descargar datos de todos los usuarios desde el frontend. El ensamblado consentido del conjunto sigue siendo una tarea del responsable.

## 2. Ejemplos y algoritmo

`weekly_protocol.py` construye ventanas de 28 días cerrados, hasta ayer respecto a la **hora real** de emisión en su zona. Exige ingesta y gasto completos, tres días distintos con pesaje por semana, peso en los últimos tres días y población declarada de 19–59 años sin pausa de estimaciones. No convierte ausencias en cero ni rellena etiquetas.

Variables y unidades, en orden inmutable:

| Variable | Unidad | Cálculo |
|---|---|---|
| `weight_anchor_kg` | kg | Mediana de medianas diarias de la cuarta semana |
| `trend_kg_week` | kg/semana | Mediana de los tres cambios entre medianas semanales |
| `intake_mean_kcal` | kcal/día | Promedio de ingestas completas de los 28 días |
| `expenditure_mean_kcal` | kcal/día | Promedio de gastos ya calculados, incluida actividad |
| `weight_sd_kg` | kg | Desviación poblacional de medianas diarias |

No se inventan minutos de actividad que la instantánea no contiene ni se suma dos veces el ejercicio. Edad, sexo de fórmula y actividad cotidiana se conservan como alcance/subgrupos, no como nuevas variables ocultas.

Etiqueta: cambio desde el anclaje hasta la mediana de medianas diarias entre los días locales **6 y 8 posteriores a la emisión**, con al menos dos días distintos. Se espera hasta el comienzo del día 9 y hasta disponer de los registros/correcciones. Se conservan fechas reales de observación y disponibilidad. La proyección existente termina siete días después del corte de ayer; para la comparación semanal se calcula una referencia de tendencia alineada a la emisión +7. No se cambia silenciosamente la fecha mostrada por la aplicación.

Entrenamiento: cinco `Ridge` con alpha 0.1/1/10/100/1000, imputador de mediana y `StandardScaler`, aprendidos solo en entrenamiento. Comparación obligatoria con dos `HistGradientBoostingRegressor` de 3/7 hojas, 100 iteraciones, learning rate 0.05, mínimo 20 muestras/hoja, sin parada temprana. Semilla 407. Se selecciona por MAE de validación; split conformal nominal 90% con rango `ceil((n+1)*0.9)` y rechazo si no existe ese rango.

Personas asignadas por SHA-256 de semilla e identificador, 60/15/10/15%. Entrenamiento, validación y calibración deben tener etiquetas disponibles antes del corte de ajuste; las emisiones de prueba deben ser posteriores al inicio reservado. Se toma la emisión elegible más reciente por persona. Mínimos: 200/50/50/100 personas; la proporción implica que sumar 400 personas **no garantiza** cumplirlos. No mover personas entre grupos para completar cupos.

## 3. Ejecución reproducible, solo cuando haya datos reales autorizados

Desde `research/hito4-ml`, usando el entorno separado y `requirements.txt` existente:

```powershell
# Crear primero private-weekly/exports y colocar únicamente exportaciones vigentes autorizadas.
# Las fechas son ejemplos: el responsable debe fijarlas ANTES de evaluar el test.
.\.venv\Scripts\python.exe freeze_weekly.py --exports private-weekly/exports --fit-cutoff 2027-01-01T00:00:00Z --test-start 2027-01-02T00:00:00Z --manifest private-weekly/protocol.json
.\.venv\Scripts\python.exe weekly_protocol.py --exports private-weekly/exports --manifest private-weekly/protocol.json --output runs/weekly-001
```

El manifiesto congela fechas, hash de ejemplos y código. El directorio de salida debe ser nuevo; no se sobrescribe. Una marca se escribe antes de evaluar el test reservado. Un error tras abrirlo no autoriza modificar hiperparámetros y volver a evaluarlo como si fuera independiente. La protección de archivos evita sobrescrituras accidentales; no evita que un operador copie datos, edite código o cree otro directorio: el responsable debe controlar el registro de experimentos. `weekly_research_versions` permite registrar versiones, predecesor, hashes, protocolo, métricas y aprobación mediante el operador; el frontend no puede escribir ni activar modelos desde ese registro. No se ha insertado una aprobación ficticia.

Criterios: mejorar MAE al menos 0.2 kg y 5% frente a la mejor referencia comparable (persistencia, cambio medio aprendido y tendencia); bootstrap pareado 2000 por persona con límite inferior 95% positivo; sesgo absoluto ≤0.5 kg, cobertura ≥85%, anchura positiva ≤4 kg. Subgrupos conjuntos de década de edad/sexo/actividad con al menos 20 personas y revisión de sesgo/cobertura. Se informan todas las referencias, versiones y dependencias. Un resultado numérico favorable produce **revisión de investigación**, nunca `deployable=true`.

Ridge exporta variables, unidades, imputación, medias, escalas, coeficientes, intercepto y rangos de entrenamiento. `predict-weekly.mjs` es inferencia **exclusivamente de investigación**, con paridad Python/JS y rechazo de versiones, unidades, números inválidos y entradas fuera de rango. No se importa al frontend. Un candidato boosting requiere desarrollar y validar un servicio/formato compatible antes de cualquier despliegue: actualmente no existe ese servicio y queda bloqueado explícitamente.

## 4. Piloto, monitoreo y retorno

`features_at_issue` extrae variables sin leer resultados futuros; `shadow_predict` comprueba consentimiento de evaluación, contrato Ridge, fecha de creación y corte de entrenamiento anteriores a la emisión, subgrupo evaluado y rangos, y calcula la predicción de investigación. Mediante `register_shadow` guarda un comprobante local nuevo, entradas congeladas, hash del artefacto, versión, predicción e instante, con emisión fresca. El operador debe comprobar autenticidad del artefacto, consentimiento vigente y paridad antes de usar esa ruta. No constituye un servicio de producción aprobado ni un piloto realizado. Probarla con datos sintéticos no demuestra mejora real.

El monitoreo compara una observación madura reciente por persona, por versión y horizonte, con un mínimo de 30 personas; rechaza números inválidos, ignora otras versiones/resultados futuros y devuelve métricas e incertidumbre por bootstrap. Si falta evidencia, no mejora MAE, el sesgo supera 0.5 kg, cobertura cae de 85% o anchura supera 4 kg, indica retorno. Una recuperación tras suspensión requiere nueva aprobación; nunca reactiva sola. Los registros de monitoreo deben provenir de comprobantes congelados enlazados con el constructor de etiquetas; pasar filas manuales no demuestra su procedencia. La cobertura del intervalo no es la cobertura nutricional ni la tasa de seguimiento; esta última requiere contar también todas las emisiones elegibles sin resultado y se deberá informar en el piloto real.

La aplicación mantiene operacionalmente `observed-weekly-v2`; si tampoco cumple sus requisitos muestra datos insuficientes. No hay una ruta oculta para activar Ridge/boosting. El servicio de producción, la comprobación de alcance completo por subgrupo, el piloto prospectivo y la aprobación independiente se implementarán/revisarán solo tras obtener evidencia elegible. La revisión de reentrenamiento exige al menos 30 días, 30 personas con resultados nuevos y autorización explícita; no se entrena por comida.

## 5. Pruebas y límites

```powershell
.\.venv\Scripts\python.exe run_tests_weekly.py
cd ../../frontend-web
npm run test:ci
npm run coverage:ci
npm run lint
npm run build
```

Las pruebas Python incluyen fixtures sintéticos, ambos algoritmos, separación temporal/personas, consentimiento y retirada, etiquetas incompletas, paridad, adopción, monitoreo y recuperación; conservan las regresiones DIETFITS anteriores. No reejecutan el benchmark real ni modifican sus evidencias v1/v2. Resultado separado: `evidence/software-tests-weekly.json`.

El pipeline web de Jenkins descubre `scripts/weekly-research.test.mjs`: dobles de Supabase, renderizado e interacción sin navegador, protección de versiones/rangos y comprobación estática de migración. PostgreSQL no se simula como si sus políticas estuvieran probadas: `supabase/tests/weekly_research_security.sql` debe ejecutarse en una base local desechable con migraciones hasta 24. No se ejecutó aquí porque no hay `psql`/Docker disponibles. Esas comprobaciones básicas aún deben ampliarse/ejecutarse con capturas maduras reales del entorno de pruebas, concurrencia y retirada sobre copias no vacías antes de recoger datos reales.

Estado real: cero participantes semanales aportados; cero resultados de piloto real; ningún modelo aprobado. Lo implementado permite preparar y comprobar el proceso, pero **el sprint 8 no queda cerrado como validación científica o despliegue de IA**.
