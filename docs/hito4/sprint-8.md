# Sprint 8 del nuevo agente — validación semanal

Fecha: 2026-11-06. Proyecto: `Gym-ultima-version`. Referencia: sprint 8 de `AGENTE-HITO4.md`, no el sprint 8 del plan histórico.

## Entregado

- Formulario opcional en la proyección: consentimiento independiente de entrenamiento/evaluación, consulta, retirada, captura prospectiva y exportación propia. La proyección vigente funciona aunque falte la migración del piloto.
- Migración 24: RLS, funciones con propietario autenticado y bloqueo de concurrencia, extracción por lista explícita de campos, registros de consentimiento, retirada de copias y registro de versiones solo para operador. No se aplicó remotamente.
- Constructor de ejemplos: 28 días completos y resultado real en al menos dos días distintos de la ventana emisión +6..8. Control de futuro, maduración, integridad, alcance y consentimiento.
- Evaluador semanal separado de DIETFITS: Ridge y boosting, particiones por persona y tiempo, mínimos, selección por validación, conformal, referencias, bootstrap, subgrupos y rechazo de adopción sin evidencia.
- Exportación Ridge e inferencia de investigación con paridad Python/JavaScript. Registro local de predicciones sombra, monitoreo de degradación/recuperación y regla de revisión mensual. Ninguno activa automáticamente IA en la aplicación.

## Decisión de integración

Se mantiene `observed-weekly-v2`. No se aportó una cohorte semanal autorizada, no se ejecutó un piloto prospectivo real y el experimento DIETFITS del sprint 7 no valida este horizonte. No hay métricas semanales reales ni modelo de producción que se puedan declarar aprobados.

Quedan pendientes la aplicación y verificación PostgreSQL de la migración 24, acuerdos de manejo/retirada de exportaciones, recopilación prospectiva suficiente, evaluación reservada, piloto sombra real, validación del servicio de inferencia y aprobación independiente. Un boosting seleccionado seguiría bloqueado hasta implementar y probar su servicio compatible. La cobertura de seguimiento debe incluir emisiones sin etiqueta; no se deduce de la cobertura de intervalos.

## Verificación

Resultados finales y comandos se registran en `research/hito4-ml/evidence/software-tests-weekly.json` y los reportes web `frontend-web/reports`. Las pruebas usan datos ficticios; no acceden a Supabase real, cámara ni servicios de IA. Las pruebas SQL se entregan separadas y no se cuentan como ejecutadas por Jenkins web.

Verificación local: 932 comprobaciones web y 62 pruebas Python aprobadas, sin fallos ni omitidas; análisis web sin errores (cinco advertencias preexistentes) y compilación correcta. La suite web completa incluye los ejercicios y rutinas ya corregidos, además de cinco comprobaciones nuevas del piloto. El reporte JUnit y la cobertura real del ejecutor web se generan mediante los comandos habituales de CI.

Cobertura web medida mediante V8/c8: 47.83% de líneas, 93.38% de ramas y 77.70% de funciones, para el conjunto de archivos que configura el pipeline. Reporte HTML: `frontend-web/reports/coverage/index.html`. No son porcentajes de seguimiento nutricional ni evidencia clínica de precisión.

Consultar `research/hito4-ml/README-weekly.md` para variables, algoritmos, criterios, comandos, procedimiento y límites. Estado del sprint: implementación preparatoria entregada; validación real y despliegue condicionados a evidencia, no cerrados artificialmente.
