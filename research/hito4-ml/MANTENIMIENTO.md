# Sprint 8: política preparada, IA sin adoptar

Estado: el candidato DIETFITS del sprint 7 sigue rechazado. No existe un modelo de IA activo en la aplicación. El método de referencia es `observed-weekly-v1` (sprint 6). Este módulo es una revisión offline: no recoge consentimiento real, no consulta Supabase, no entrena y no cambia la aplicación. No se afirma validación con usuarios reales.

## Consentimiento y reutilización

Antes de cualquier reutilización secundaria, ofrecer aceptación voluntaria, separada para entrenamiento y para inferencia personalizada, desactivada inicialmente. Explicar finalidad, datos (pesajes y resúmenes energéticos), retención, responsables y retirada. Rechazar debe permitir seguir usando el diario y la proyección explicable. No incluir fotos, nombres, credenciales ni texto libre en conjuntos de entrenamiento.

Guardar en Supabase eventos inmutables por usuario, finalidad, versión de política y fecha UTC, protegidos por RLS. La retirada bloquea nuevas extracciones y usos personalizados; excluirlo de futuras versiones y aplicar la política de eliminación también a copias derivadas. No prometer que una retirada borra automáticamente su influencia de modelos ya entrenados: retirar o reentrenar los afectados según revisión documentada. Propuesta inicial: eliminar extractos de trabajo a los 30 días; definir retención de auditoría antes de producción. Estas tablas y pantallas se implementarán cuando haya un piloto autorizado, antes de extraer datos; esta entrega no simula esa persistencia.

## Actualizaciones y evaluación

No reentrenar por comida ni por pesaje. Revisar como máximo mensualmente y solo con nuevas etiquetas maduras y consentimiento vigente. Para evaluar un ajuste individual, exigir al menos 8 pronósticos semanales con resultados posteriores; evaluar el ajuste en las siguientes 4 semanas sin usarlas para ajustarlo. Mantener el ajuste explicable del sprint 6 independiente.

Protocolo inicial de ingeniería (no validación clínica): mínimo 200 personas de entrenamiento, 50 de validación, 50 de calibración y 100 de prueba, sin participantes compartidos. Seleccionar por validación, calibrar aparte y abrir prueba una sola vez. Entradas congeladas al emitir; etiquetas posteriores; corte temporal y horizonte explícitos. No confundir registros con personas. Ajustar transformaciones solo con entrenamiento. Exigir evidencia de uso autorizado en producción y validación de la aplicación al mismo horizonte; los 3 meses de DIETFITS no validan 7 días.

El informe debe comparar con peso constante y método vigente al mismo horizonte. Usar como referencia la mejor de ambas. Exigir mejora MAE ≥0,2 kg y ≥5%, límite inferior del intervalo bootstrap por persona del 95% de mejora >0, sesgo absoluto ≤0,5 kg, cobertura observada ≥85% para banda nominal del 90% y anchura media ≤4 kg. Registrar por horizonte; revisar subgrupos con tamaño suficiente sin afirmar precisión en grupos pequeños. Estos límites iniciales son modificables solo en una nueva política aprobada antes de abrir la prueba.

## Versiones, seguimiento y retorno

Cada versión tendrá identificador único, hashes de artefacto y extracto, versión de código/política, unidades, horizonte, fechas de corte, consentimiento aplicado, métricas, aprobación y predecesor. No sobrescribir artefactos ni cambiar el estado de un candidato rechazado sin nueva evaluación. Estados propuestos: candidato, evaluado, aprobado, activo, retirado. Una revisión offline elegible no autoriza por sí sola activación.

Antes de activar: implementar registro persistente e inmutable, consentimiento/RLS, inferencia reproducible, aprobación de versión y prueba de retorno. Guardar para cada pronóstico versión, fecha real de emisión, horizonte e inputs congelados. Analizar resultados maduros semanalmente, una observación reciente por persona, sin mezclar horizontes/versiones. Con menos de 30 personas, informar evidencia insuficiente y mantener el método anterior. Con MAE que no mejora la referencia, sesgo absoluto >0,5 kg, cobertura <85%, datos inválidos o fallo de inferencia: suspender IA, registrar motivo y volver al sprint 6 si cumple sus requisitos; si tampoco los cumple, mostrar datos insuficientes. No extender el horizonte ni inventar fecha de meta durante el retorno.

`model_governance.py` prueba criterios offline con informes ya preparados. Las fechas de entrada deben ser ISO UTC normalizado, los resultados maduros deben corresponder al objetivo del pronóstico y los informes deben ser generados y revisados por un proceso fiable: los indicadores booleanos no verifican por sí solos permisos, separación de participantes o consentimiento. Hace falta implementar esos adaptadores antes de producción. El monitor no ejecuta el retorno en la app.

## Reproducibilidad

Desde esta carpeta: `.venv/Scripts/python.exe -m unittest test_model_governance -v`; para revisar el candidato real: `.venv/Scripts/python.exe model_governance.py`. La revisión genera `evidence/governance-review.json` y mantiene `activates_app=false`. Las pruebas usan casos sintéticos; el candidato real solo se lee desde el informe existente, sin reentrenarlo.
