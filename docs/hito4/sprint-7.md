# Sprint 7 del nuevo agente — Ridge y gradient boosting

Fecha: 3 de noviembre de 2026. Proyecto activo: `Gym-ultima-version`.

## Resultado

Se implementó y ejecutó el experimento `dietfits-comparison-v2`. Se entrenaron las cinco configuraciones de Ridge y las dos de HistGradientBoostingRegressor del agente. Ridge alpha=1 fue seleccionado por validación. No alcanzó la mejora mínima frente a la mejor referencia; no se integra IA y se mantiene `observed-weekly-v2` como proyección explicable de la aplicación.

La evaluación es **exploratoria**: el test de DIETFITS ya había sido observado en el experimento anterior. Conservar separación de personas durante el ajuste no convierte esa prueba reutilizada en evidencia independiente. No se cambió de semilla para presentar otras filas como un test nuevo ni se ajustó el protocolo después de esta ejecución real.

## Implementación y entorno

- `research/hito4-ml/dietfits_eval_v2.py`: comparación de ambas familias, calibración, evaluación y decisión explícita de no despliegue.
- `protocol-v2.json`: entradas, particiones, rejillas y reconocimiento de prueba ya observada.
- `predict-research-v2.mjs`: paridad de inferencia de Ridge, exclusivamente de investigación.
- `test_dietfits_v2.py` y `run_tests_v2.py`: nuevas pruebas y ejecución estricta junto con las suites previas.
- `README-v2.md`: reproducción, evidencias y límites. El README principal dirige a esta versión.

Se preparó `.venv` dentro de la última versión. Se instalaron desde wheels locales scikit-learn 1.7.2, SciPy 1.16.2, joblib 1.5.2 y threadpoolctl 3.6.0. Se reutilizaron NumPy 2.3.5 y pandas 3.0.1 del runtime base; todas las versiones se registraron. No se agregaron dependencias al frontend ni se modificó el evaluador v1.

## Datos y alcance de uso

Se reutilizaron el CSV original y su diccionario ya descargados, con verificación de hashes. SHA-256 del CSV: `f1b8303b26c2ebfae47587997d493e4a1365289af64c871fa6ff435b86d42669`.

Se conserva la revisión documentada del 22 de octubre para análisis local exploratorio, no comercial. Esa revisión señala ausencia de licencia formal en OSF y una declaración de reutilización de los investigadores. No se presenta como una autorización nueva, comercial, de redistribución o de producción. Los originales, diccionario, entorno y coeficientes quedan en carpetas locales ignoradas, fuera de los informes agregados.

La auditoría confirma 609 participantes y 2.436 visitas. No hay duplicados de participante-visita, identificadores ausentes ni visitas desconocidas. Existen 391 pesos, 339 ingestas y 598 gastos ausentes; se distinguen de ceros reales.

Para 0→3 meses hay 533 pares con ambos pesos, 483 de ellos con las tres entradas iniciales completas. Para 3→6 hay 462 pares, 417 con entradas completas. No se imputaron etiquetas ni peso inicial; solo entradas de energía con estadísticas de entrenamiento cuando correspondía.

## Protocolo ejecutado

Entradas: peso inicial, ingesta inicial y gasto total inicial. Se convirtió gasto de kcal/kg/día a kcal/día con el peso de la misma visita. La etiqueta fue cambio de peso a la visita programada de tres meses. No se usaron mediciones finales de alimentación o actividad como predictores.

Se asignaron participantes con semilla 407 y proporciones 60/15/10/15 antes de filtrar disponibilidad del seguimiento. Quedaron 314 personas de entrenamiento, 86 de validación, 55 de calibración y 78 de prueba, con un par principal por persona. Se verificó que los hashes de partición coinciden con la prueba ya observada; esto queda registrado como limitación, no se oculta.

Ridge utilizó imputación de mediana, escalado y regularización L2, con alpha 0,1; 1; 10; 100 y 1.000. Boosting utilizó imputación sin escalado, 3 o 7 hojas, 100 iteraciones, tasa 0,05, mínimo 20 muestras por hoja y sin early stopping. Ambas transformaciones se ajustaron solo con entrenamiento.

Se congeló el ganador con validación antes de calibrar y evaluar. Las métricas de prueba adicionales del mejor modelo de cada familia son diagnósticas; no se usaron para cambiar el ganador. El programa exige reconocer la reutilización del test y rechaza sobrescribir un directorio de resultados existente.

## Comparación

| Candidato | MAE de validación |
|---|---:|
| Ridge alpha 0,1 | 3,575 kg |
| Ridge alpha 1 | 3,575 kg |
| Ridge alpha 10 | 3,575 kg |
| Ridge alpha 100 | 3,594 kg |
| Ridge alpha 1.000 | 3,707 kg |
| Boosting de 3 hojas | 3,622 kg |
| Boosting de 7 hojas | 3,786 kg |

Los valores sin redondear del JSON distinguen los tres primeros; alpha=1 tuvo el menor error.

Resultados en las 78 personas de prueba ya observadas:

| Método | MAE | Sesgo previsto menos observado | RMSE |
|---|---:|---:|---:|
| Mantener peso inicial | 6,065 kg | +5,835 kg | 7,031 kg |
| Cambio medio de entrenamiento | 3,160 kg | +0,035 kg | 3,923 kg |
| Ridge alpha=1, seleccionado | 3,152 kg | +0,018 kg | 3,953 kg |
| Boosting de 3 hojas, diagnóstico | 3,234 kg | −0,125 kg | 4,016 kg |

La ventaja de Ridge frente al cambio medio fue 0,008 kg. No alcanza los mínimos de 0,2 kg y 5%. El intervalo bootstrap pareado del 95% de esa mejora fue de −0,251 a +0,254 kg y cruza cero. Incluso sin la limitación del test reutilizado, el criterio numérico no se cumple.

El intervalo predictivo split conformal nominal del 90% para Ridge tuvo cobertura observada de 92,3%, pero anchura media de 14,36 kg. No debe interpretarse como precisión útil de una fecha de meta ni trasladarse automáticamente a otra población.

En el diagnóstico temporal 3→6 meses, con 70 personas de la misma partición reservada, Ridge tuvo MAE 4,819 kg frente a 2,376 kg de mantener el peso. Su sesgo fue −4,496 kg y cobertura 81,4%. No hubo reentrenamiento ni selección posterior. No es una cohorte externa independiente ni un modelo entrenado a seis meses.

DIETFITS no permite comparar directamente con el método del sprint 6 a siete días porque sus visitas y horizonte son distintos. No se interpolaron pesos diarios para fabricar esa comparación.

## Pruebas y trazabilidad

Pasaron **44 pruebas, sin fallos ni omisiones**: 27 del evaluador original, 8 de controles de gobernanza y 9 nuevas de v2. Las pruebas usan casos sintéticos y no se mezclan con los datos reales. Cubren auditoría, separación por persona, ausencia de futuro, etiquetas no imputadas, entrenamiento de ambas familias aun sin mejora, transformaciones ajustadas solo con entrenamiento, protocolo no alterable silenciosamente y protección contra sobrescrituras.

Ridge reprodujo en JavaScript las predicciones de Python, incluido el tratamiento de entradas de energía ausentes; en datos reales el error máximo absoluto de paridad fue 1,78 × 10⁻¹⁵. El artefacto exportado permanece con `deployable=false`. No se construyó un servicio de inferencia de boosting ni se afirma compatibilidad productiva por haberlo entrenado.

Evidencias agregadas en `research/hito4-ml/evidence/`:

- `benchmark-v2.json`
- `audit-v2.json`
- `protocol-v2.json`
- `software-tests-v2.json`
- `provenance-v2.json`
- `readiness-v2.json`

Se verificaron hashes de código, protocolo, originales, diccionario y revisión. El código y las evidencias del experimento v1 permanecen conservados. No se ejecutó otra vez el benchmark real para modificar sus resultados.

## Decisión y aceptación

Sprint 7 completado como evaluación local reproducible: **no adoptar el candidato**. Un nuevo intento de demostrar generalización requiere evidencia verdaderamente reservada o externa y un protocolo nuevo. El eventual experimento semanal necesita historial autorizado de la aplicación, consentimiento y resultados posteriores al mismo horizonte.

No se modificó frontend ni SQL durante este sprint, por lo que no se repitieron compilación o pruebas móviles para atribuirles una validación inexistente del modelo. No hay migración nueva, despliegue o activación de IA. Las migraciones y aceptación remota pendientes hasta la 22 continúan pendientes. Los controles de gobernanza del sprint 8 deberán revisarse contra la versión vigente antes de una futura integración.
