# Hito 4 — Sprint 8

Preparación local terminada: política de consentimiento y mantenimiento, revisión de versiones y monitor de error offline. La adopción y el mantenimiento de una IA en producción quedan sin activar: el candidato del sprint 7 no mejoró suficientemente y no existe validación temporal con usuarios de la aplicación.

Se añadieron `research/hito4-ml/MANTENIMIENTO.md`, `model_governance.py`, `test_model_governance.py` y evidencias. La política establece consentimiento voluntario y revocable, usos separados, conservación, mínimos de participantes, evaluación temporal, horizonte, trazabilidad de versiones y condiciones de retorno. El evaluador rechaza evidencia ausente y el monitor analiza MAE, sesgo, cobertura y anchura por versión/horizonte sin multiplicar personas por sus registros. No recopila datos reales ni ejecuta cambios de modelo.

Pruebas: 8 nuevas correctas; 27 de regresión del sprint 7 correctas, ninguna omitida. Casos sintéticos de consentimiento, retirada, política antigua, datos insuficientes, versiones/horizontes diferentes, evidencia inválida y degradación. El informe real existente de DIETFITS conserva el rechazo; no se volvió a entrenar ni se reutilizó la prueba para seleccionar otro modelo.

La aplicación, su método del sprint 6 y las migraciones no cambian. No procede repetir pruebas de interfaz para este módulo offline. Persistencia de consentimiento/RLS, registro de versiones, retorno en ejecución y piloto real requieren una integración futura antes de adoptar IA; no se presentan como implementados. Siguen pendientes las pruebas remotas de Supabase y aceptación en dispositivos de los primeros sprints.

Entrega acumulada: `Hito4-sprints1a8.zip`, con instalador de archivos verificado y manifiesto de hashes. Excluye datos originales DIETFITS, coeficientes, entornos, dependencias y secretos. No se aplicó al proyecto original ni se desplegó en Supabase.
