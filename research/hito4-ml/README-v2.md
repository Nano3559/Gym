# Sprint 7 del nuevo agente — Comparación exploratoria v2

Entrada principal: `dietfits_eval_v2.py`. Protocolo congelado: `protocol-v2.json`. El evaluador v1, sus evidencias y sus resultados no se sobrescriben. El módulo v2 reutiliza sus funciones de auditoría, particiones y métricas, conservando su hash.

Se entrenan siempre cinco Ridge y dos HistGradientBoostingRegressor. Se selecciona únicamente con validación, se calibra en otra partición y se informa prueba después de congelar la selección. Los mejores modelos de cada familia se eligen en validación; sus métricas de prueba adicionales son diagnósticas, no se usan para cambiar el ganador.

El test DIETFITS ya fue observado en un experimento anterior. Esta versión se identifica como **exploratoria sobre prueba reutilizada**, aunque mantenga participantes separados durante el ajuste. No es evidencia independiente ni autoriza integración. La decisión es conservar `observed-weekly-v2` en la aplicación.

## Entorno y ejecución

Se utiliza `.venv` dentro de esta carpeta, con paquetes fijados en `requirements.txt`. El entorno permite paquetes del runtime base; NumPy y pandas se reutilizan desde él y sus versiones se verifican. scikit-learn, SciPy, joblib y threadpoolctl se instalaron desde los wheels locales ya disponibles, sin descargas nuevas. Las versiones reales están en `evidence/provenance-v2.json`.

Desde esta carpeta, en PowerShell:

```powershell
$env:OMP_NUM_THREADS='1'
$env:OPENBLAS_NUM_THREADS='1'
.venv/Scripts/python.exe run_tests_v2.py
```

La suite ejecuta 44 pruebas con datos sintéticos y no omite las de entrenamiento. No ejecuta el benchmark real como parte de las pruebas.

El experimento real se ejecutó por separado:

```powershell
.venv/Scripts/python.exe dietfits_eval_v2.py --csv data/raw/All_outcomes_v4.csv --review data-review.json --out runs/dietfits-v2 --acknowledge-reused-test
```

El directorio de salida debe ser nuevo. El programa rechaza sobrescribirlo y exige reconocer la reutilización del test. No repitas el experimento para buscar parámetros que favorezcan sus resultados. Una corrección de código o una hipótesis nueva debe documentarse; no convierte el test observado en uno nuevo.

## Evidencias

- `evidence/benchmark-v2.json`: selección, errores, intervalos, comparación y decisión.
- `evidence/audit-v2.json`: calidad de datos.
- `evidence/protocol-v2.json`: copia del protocolo utilizado.
- `evidence/software-tests-v2.json`: pruebas del software.
- `evidence/provenance-v2.json`: hashes, entorno y alcance de la revisión reutilizada.
- `evidence/readiness-v2.json`: estado de la nueva evaluación, distinto del v1.

Los originales, diccionario, entorno y artefacto de coeficientes permanecen en carpetas locales ignoradas. No los incluyas en publicaciones o paquetes sin revisar su alcance de uso. La revisión de datos existente se limita a investigación local exploratoria; no se afirma autorización comercial o de producción.

Ridge exportado se comprueba con `predict-research-v2.mjs`, que reutiliza la aritmética del predictor de investigación v1 tras validar el esquema v2. El artefacto mantiene `deployable=false`. Boosting no se integra ni se presenta como inferencia compatible con la aplicación por haber sido entrenado.

No se modifican frontend, Supabase ni el método de proyección semanal. El detalle de resultados y límites se encuentra en `../../docs/hito4/sprint-7.md`.
