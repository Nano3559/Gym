# Nueva evaluación del agente actualizado

Para el sprint 7 nuevo utiliza [README-v2.md](README-v2.md). Su evaluación es exploratoria porque reutiliza un test ya observado. Las secciones siguientes corresponden al experimento v1 y se conservan como historial; no deben interpretarse como resultados de v2.

---

# Evaluación offline de IA — Hito 4, sprint 7

Estado: **DIETFITS descargado, auditado y evaluado; 27 pruebas correctas y ninguna omitida**. La decisión es conservar el método actual: el candidato no supera las referencias de forma relevante y falla al trasladarlo a otra fase. No se modifica el frontend, Supabase ni el método del sprint 6. Este directorio no es un servicio de predicción y nunca se incluye en el bundle del navegador.

## Preparar el entorno separado

Se recomienda Python 3.12 y Node para comprobar paridad del exportador. Las dependencias no se añaden al frontend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run_tests.py --require-training-tests
```

En esta sesión se reutilizaron NumPy 2.3.5 y pandas 3.0.1 del runtime y se instalaron en .venv scikit-learn 1.7.2, SciPy 1.16.2, joblib 1.5.2 y threadpoolctl 3.6.0. pip no pudo descargar por red: se obtuvieron los wheels oficiales desde las páginas de PyPI mediante el navegador y se instalaron offline con pip --python .venv/Scripts/python.exe install --no-index --no-deps --find-links .wheelhouse (versiones fijadas). La instalación y los hashes están en evidence/installation.json. La creación inicial falló al ejecutar ensurepip; se utilizó pip del runtime base dirigido al entorno y se habilitó la reutilización de sus paquetes, sin modificar el runtime base. `--require-training-tests` devuelve error si las pruebas de entrenamiento no se pudieron ejecutar, para que esa omisión no pase por una validación completa.

## Obtener el original y auditar

```powershell
.\.venv\Scripts\python.exe download_source.py --out data/raw
.\.venv\Scripts\python.exe dietfits_eval.py audit --csv data/raw/All_outcomes_v4.csv --out runs/dietfits-v1
```

La descarga utiliza únicamente la URL pública oficial, sin credenciales. Guarda el original sin modificar, SHA-256, URL final y fecha. No acepta una página HTML como si fuese CSV ni sobrescribe una descarga anterior. Descargar no equivale a comprobar la autorización de entrenamiento.

La auditoría comprueba campos requeridos, códigos temporales, duplicados de participante/visita, valores ausentes, errores numéricos, rangos de revisión y conteos por visita. No elimina valores raros ni imputa etiquetas silenciosamente. Si encuentra un problema estructural o un valor que requiere revisión, detiene la evaluación. Los límites numéricos son controles de calidad amplios, no criterios clínicos.

Los códigos `a.BL`, `b.3`, `c.6` y `d.12` y las unidades se contrastaron con All_outcomes_v4_CODEBOOK.csv del repositorio original (https://osf.io/kyiuj/files/mfsg4). El diccionario confirma kg para peso y kcal/kg/día para gasto; la publicación original identifica este último como gasto total del cuestionario. Se calcula gasto total = kcal/kg/día × peso de la misma visita, sin sumar de nuevo metabolismo ni ejercicio.

## Resolver el alcance de uso y ejecutar

Copiar `data-review.example.json` a `data-review.json` y documentar la evidencia aplicable al SHA-256 exacto del archivo. La plantilla mantiene las verificaciones en false. No basta con marcar casillas: hay que comprobar los términos aplicables y el diccionario. La situación de licencia y las fuentes revisadas figuran en `evidence/source-review.json`; se incluye un borrador de consulta **no enviado**.

```powershell
.\.venv\Scripts\python.exe dietfits_eval.py evaluate --csv data/raw/All_outcomes_v4.csv --review data-review.json --out runs/dietfits-v1
```

La revisión debe documentar uso de investigación, unidades y visitas. No se da por resuelto el uso comercial. El evaluador rechaza reutilizar una carpeta que ya contiene un benchmark o cambiar de archivo dentro de una misma auditoría. Repetir el análisis con cambios después de observar el test requiere otro protocolo y nuevos datos de prueba; crear otra carpeta no convierte ese test en independiente.

## Protocolo predefinido

- Resultado principal: cambio de peso de inicio a visita de tres meses. Se usan meses programados, no fechas exactas de medición que el archivo no haya proporcionado.
- Entradas: peso, ingesta y gasto total estimado **de la visita inicial**. Nunca calorías/actividad de la visita final, peso final como predictor, dieta asignada, edad inventada o pesos diarios interpolados.
- Participantes de inicio: asignación determinista por hash y semilla 407, antes de filtrar por seguimiento disponible. 60% entrenamiento, 15% validación, 10% calibración y 15% test. Una persona no aparece en grupos diferentes. Se registran las pérdidas por seguimiento y mínimos de 80/20/20/40 personas utilizables respectivamente.
- Valores ausentes de ingesta/gasto: imputación por mediana de entrenamiento. Escalado y modelo también se ajustan solo con entrenamiento; ni calibración ni test ajustan transformaciones. Si una entrada falta por completo en entrenamiento se aborta. No se imputan pesos iniciales ni resultados.
- Ridge: alpha 0.1, 1, 10, 100, 1000; elección por MAE de validación. No se reajusta sobre validación después de elegir.
- Boosting: únicamente si Ridge supera en validación tanto peso constante como cambio medio del entrenamiento por al menos 0,2 kg y 5%. Se prueban dos tamaños de árbol predefinidos; la elección final permanece en validación y se congela antes de calibrar y abrir el test. Estos umbrales son decisiones de investigación del producto, sin significado clínico demostrado.
- Calibración: radio de residuos absolutos con cuantíl conformal de corrección finita, nivel nominal 90%. Se mide cobertura y anchura en test. No se afirma que esa cobertura se conserve con usuarios de la aplicación o bajo cambio de distribución.
- Test principal: MAE, sesgo, RMSE, número de personas y cobertura; referencias de peso constante y cambio medio de entrenamiento. Comparación pareada de errores con bootstrap por participante (2.000 remuestras, intervalo percentil 95%). Se requiere mejora práctica sobre ambas referencias y extremo inferior positivo para considerar un candidato de investigación; no equivale a permiso para desplegarlo.
- Diagnóstico temporal adicional: el mismo modelo congelado se evalúa en 3→6 meses de las personas reservadas a test. No se entrena con sus seguimientos ni se vuelve a seleccionar el modelo. Es otra fase de la misma cohorte de test, no una muestra independiente. Se añade una extrapolación exploratoria entre visitas, identificada como diferente del sprint 6.
- No se evalúa un modelo a seis meses en esta versión: necesita protocolo separado. No se reutiliza una regresión de tres meses como si validase seis meses o siete días.

El método del sprint 6 requiere pesajes frecuentes y un horizonte de siete días: no se puede contrastar directamente con las cuatro visitas de DIETFITS. La ausencia de esa comparación se registra como no comparable, sin inventar datos para simularla.

## Salidas y decisión

`audit.json`, `pair-counts.json` y, cuando sea posible evaluar realmente, `benchmark.json`. Este último conserva fuente, código, revisión y particiones mediante hashes, parámetros elegidos, versiones y resultados. No publica registros individuales.

Si se selecciona Ridge, se prepara un JSON de coeficientes, imputación y escalado solo para investigación, con `deployable: false`. Se comprueba equivalencia NumPy/scikit-learn y, con Node disponible, JavaScript. `predict-research.mjs` está fuera del frontend y solo sirve para esa comprobación. Con boosting seleccionado no se exporta a la aplicación: haría falta definir y validar un servicio de inferencia en un paso posterior.

Incluso si mejora en DIETFITS, `integrate_in_app` permanece false: faltan comparabilidad con la aplicación, validación externa del horizonte y condiciones de uso aplicables. El programa continúa con el sprint 6. Un test con datos sintéticos valida el código; no demuestra precisión predictiva en personas.

## Comprobaciones realizadas

```powershell
python run_tests.py
python dietfits_eval.py status --out evidence
```

Las 27 pruebas pasaron, incluidas las dos que antes se omitían. Los resultados están en `evidence/software-tests.json`. `source-access.json` conserva los fallos iniciales por terminal; `source-provenance.json` registra la descarga posterior por navegador. `evidence/benchmark.json` contiene la evaluación real y `evidence/readiness.json` su estado consolidado. El subcomando status es una comprobación de disponibilidad y no busca ejecuciones anteriores: no debe utilizarse para sustituir ese estado consolidado ni el benchmark. La entrega excluye los CSV, el entorno, los wheels y los coeficientes entrenados, que permanecen únicamente en el espacio local de investigación.

## Resultado real del 22 de octubre de 2026

609 participantes y 2.436 visitas; 533 pares 0→3 meses con ambos pesos, de ellos 483 con las tres entradas completas. Particiones utilizables: 314 entrenamiento, 86 validación, 55 calibración y 78 test. Ridge alpha=1 fue elegido en validación; los dos modelos boosting no lo superaron. En test: MAE 3,152 kg frente a 6,065 kg de peso constante y 3,160 kg del cambio medio de entrenamiento. La ventaja de 0,008 kg frente a esa referencia no alcanza el criterio predefinido; el intervalo bootstrap de la diferencia cruza cero (−0,251 a +0,254 kg). Cobertura observada 92,3% y anchura 14,36 kg. En 3→6 meses (70 personas reservadas): MAE 4,819 kg frente a 2,376 kg de peso constante, y cobertura 81,4%. No se integra el candidato. Estos resultados no validan un horizonte de siete días.

La revisión de uso limita esta ejecución a análisis local exploratorio de medidas públicas anonimizadas, apoyándose en la declaración de los investigadores y documentando expresamente su alcance como interpretación de investigación. OSF sigue mostrando No License. No se afirma una licencia formal de todo el archivo ni autorización comercial, de redistribución o de producción.
