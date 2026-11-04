# Hito 4 — Sprint 7: evaluación real de IA

## Resultado y estado

**Evaluación offline completada el 22 de octubre de 2026. Decisión: conservar el método del sprint 6; no integrar el candidato de IA.** Se instaló el entorno, se consiguió el original y el diccionario, se ejecutó el protocolo predefinido con DIETFITS y pasaron las 27 pruebas sin omisiones. Esto no equivale a desplegar la aplicación ni a resolver su validación clínica o el uso comercial de los datos.

Los sprints 1–6 continúan implementados en la copia de trabajo, pendientes de aplicar al proyecto original y aceptar con Supabase y navegador reales. El sprint 8 no se inició porque el candidato no cumple el criterio de adopción.

## Adquisición, procedencia y alcance de uso

La terminal no pudo descargar por DNS. Se utilizó el navegador para descargar [All_outcomes_v4.csv](https://osf.io/kyiuj/files/ztysq) desde el proyecto de los investigadores y su [diccionario original](https://osf.io/kyiuj/files/mfsg4). Se conservaron los bytes, SHA-256 y procedencia en `data/raw`, sin modificar los originales. El CSV mide 975.168 bytes y su SHA-256 es `f1b8303b26c2ebfae47587997d493e4a1365289af64c871fa6ff435b86d42669`.

El diccionario confirma peso en kg, gasto en kcal/kg/día, calorías NDSR y los códigos de las visitas 0/3/6/12 meses. La [publicación original](https://jamanetwork.com/journals/jama/fullarticle/2673150) describe las entrevistas alimentarias y el cuestionario de gasto total; no son registros diarios ni mediciones exactas del metabolismo.

OSF sigue indicando [No License](https://osf.io/kyiuj/metadata/osf). La [declaración de los investigadores](https://onlinelibrary.wiley.com/doi/10.1002/oby.22389) anuncia reutilización de los datos anonimizados descritos en esa publicación. Se documentó una interpretación acotada para **análisis local exploratorio** de medidas públicas, apoyada en esa declaración y la procedencia del archivo. No se presenta como una licencia formal de todo el repositorio ni como autorización comercial, de redistribución o de producción; esos alcances siguen sin resolver. La revisión exacta y sus límites están en `evidence/research-use-review.json`. El borrador de consulta no fue enviado.

La entrega no redistribuye el CSV, el diccionario ni los coeficientes entrenados. Incluye únicamente código, evidencias agregadas y procedencia.

## Entorno instalado

Se instalaron en `.venv` scikit-learn 1.7.2, SciPy 1.16.2, joblib 1.5.2 y threadpoolctl 3.6.0. Se reutilizan NumPy 2.3.5 y pandas 3.0.1 del runtime base mediante `include-system-site-packages`; no se modificaron sus paquetes.

La creación inicial falló en ensurepip y la descarga por pip tampoco funcionó. Se obtuvieron los cuatro wheels desde las páginas oficiales de PyPI con el navegador y se instalaron offline mediante pip del runtime dirigido a `.venv` con `--no-index --no-deps --find-links .wheelhouse`. Los hashes, versiones y tamaño de cada distribución se conservan en `evidence/installation.json`. Ni el entorno ni los instaladores binarios se incluyen en el ZIP.

## Auditoría real

| Comprobación | Resultado |
|---|---:|
| Participantes distintos | 609 |
| Filas / visitas | 2.436 |
| Duplicados participante-visita | 0 |
| Identificadores o visitas desconocidos | 0 |
| Pesos ausentes | 391 |
| Ingestas ausentes | 339 |
| Gastos ausentes | 598 |
| Pares 0→3 con ambos pesos | 533 |
| Pares 0→3 con las tres entradas completas | 483 |
| Pares 3→6 con ambos pesos | 462 |

Los tres campos están presentes simultáneamente en 554 visitas iniciales, 473 del mes 3, 366 del mes 6 y 376 del mes 12. Los ceros y valores ausentes se distinguen. No se eliminaron valores para mejorar el resultado ni se inventaron pesajes o edades.

## Protocolo ejecutado

Entradas: peso inicial, calorías iniciales y gasto inicial (kcal/kg/día por el peso de esa misma visita). Objetivo: cambio de peso a la visita programada de tres meses. No se usan ingestas, actividad ni peso de la visita final como predictores. El gasto ya representa el total: no se vuelve a sumar metabolismo o ejercicio.

Asignación por participante antes de filtrar seguimiento disponible, con semilla 407. Quedaron 314 personas de entrenamiento, 86 de validación, 55 de calibración y 78 de test. Las transformaciones aprenden solo de entrenamiento, no se imputan resultados y una persona no cruza particiones.

Se evaluaron los cinco alpha de Ridge definidos previamente. Ridge alpha=1 tuvo el mejor MAE de validación. Superó allí el criterio para habilitar boosting; se probaron los dos tamaños de árbol predefinidos y ninguno superó a Ridge. La selección quedó congelada antes de calibrar o abrir el test. No se cambió el protocolo después de ver estos resultados.

## Resultados principales — 0→3 meses, 78 personas reservadas

| Método | MAE (kg) | Sesgo previsto − observado (kg) | RMSE (kg) |
|---|---:|---:|---:|
| Mantener el peso inicial | 6,065 | +5,835 | 7,031 |
| Aplicar el cambio medio de entrenamiento | 3,160 | +0,035 | 3,923 |
| Ridge seleccionado | 3,152 | +0,018 | 3,953 |

Ridge supera claramente a peso constante, pero su ventaja frente a la referencia de cambio medio es solo **0,008 kg**. No alcanza el umbral de 0,2 kg y 5% predefinido. El intervalo percentil bootstrap 95% de la mejora pareada frente a esa referencia va de **−0,251 a +0,254 kg** y cruza cero. No hay mejora verificable suficiente para adoptarlo.

El intervalo predictivo calibrado con nivel nominal 90% tuvo cobertura observada de **92,3%** en este test, pero anchura media de **14,36 kg** (radio 7,179 kg). No confundir ese intervalo de peso con el intervalo bootstrap de diferencia de errores ni presentarlo como precisión útil de una fecha de meta. No se presupone su cobertura en usuarios de la aplicación.

## Diagnóstico temporal — 3→6 meses, 70 personas de test

Sin reentrenar ni seleccionar de nuevo:

| Método | MAE (kg) |
|---|---:|
| Mantener el peso en el mes 3 | 2,376 |
| Ridge trasladado a esta fase | 4,819 |
| Extrapolación exploratoria entre visitas | 5,789 |

El sesgo de Ridge fue −4,496 kg y su cobertura bajó al 81,4%. Es un diagnóstico sobre otra fase de las mismas personas reservadas, no una cohorte externa independiente. Confirma que no debe suponerse una transferencia automática entre fases. Tampoco valida siete días: el método del sprint 6 no es comparable con estas visitas espaciadas, y no se extrapoló a largo plazo para fabricar una comparación.

## Pruebas y reproducción

Desde `research/hito4-ml`: `.venv/Scripts/python.exe run_tests.py --require-training-tests`.

Resultado: **27 correctas, 0 fallos y 0 omitidas**. Ahora sí se ejecutaron entrenamiento completo con datos sintéticos, ajuste de transformaciones y paridad scikit-learn/NumPy/JavaScript, además de auditoría, conservación del original, separación por persona, rechazo de datos futuros y controles de revisión. Esas pruebas sintéticas validan el software, no se mezclaron con DIETFITS.

La evaluación real se ejecutó con `dietfits_eval.py evaluate --csv data/raw/All_outcomes_v4.csv --review data-review.json --out runs/dietfits-v1`. Los resultados agregados están en `evidence/benchmark.json`, junto con hashes de fuente, revisión, código y particiones. La exportación local de Ridge reprodujo JavaScript con error máximo de 1,78×10⁻¹⁵; mantiene deployable=false y no se incluye en la aplicación ni en la entrega.

Joblib emitió una advertencia al no poder consultar núcleos físicos en este entorno y utilizó los lógicos; no hubo fallos de pruebas. No se cambiaron archivos del frontend ni migraciones respecto al sprint 6: se comprueban sus hashes en la entrega. No se repitieron pruebas de cámara o SQL para atribuirles una validación inexistente del evaluador.

## Decisión final y entrega

Se conserva el método del sprint 6. Con estas variables, este protocolo y este test, no se justifica integrar la regresión. Un nuevo experimento requiere una hipótesis y protocolo separados, evitando reutilizar el test observado para ajustar hasta obtener una mejora aparente. No se implementan predicciones semanales de IA a partir de estos datos ni un modelo a seis meses no predefinido.

`Hito4-sprints1a7-evaluado.zip` incluye los cambios acumulados, el evaluador, pruebas, resultados agregados, documentación e instalador con respaldo y control de conflictos. Excluye CSV, coeficientes entrenados, ruedas, dependencias, secretos y datos personales. No aplica migraciones ni despliega. La aceptación y migraciones 15–19 de la base funcional siguen pendientes en el proyecto activo.
