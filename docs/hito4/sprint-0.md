# Sprint 0 — Revisión contra el nuevo agente

Inicio de implementación del nuevo plan: 27 de octubre de 2026.

Carpeta activa: `Gym-ultima-version`. El agente vigente se encuentra en su raíz, en `AGENTE-HITO4.md`. Se reutilizará la base existente; no se reiniciará el desarrollo ni se crearán proyectos duplicados.

## Inventario verificado

Existen módulos separados de perfil/pesajes, diario, gasto, balance, tendencia y proyección en `frontend-web/src/lib`. Existen migraciones 15–19 para persistir esas funciones. Su aplicación remota y pruebas RLS siguen pendientes de verificación; la existencia de archivos SQL no acredita despliegue.

Se ejecutaron las seis suites puras `progress`, `tracking`, `energy`, `balance`, `weight-trend` y `projection`: todas finalizaron correctamente. Cubren fórmulas, fechas, completitud, medianas y proyección. No se ejecutaron en esta revisión pruebas de navegador, compilación o Supabase; faltan dependencias instaladas en esta copia para las comprobaciones que las requieran.

## Diferencias que deben implementarse

1. Perfil: definir y persistir exclusión voluntaria de proyección ante circunstancias fuera del alcance, sin inferir diagnósticos.
2. Diario: revisar política de unidades y repetición de solicitudes contra el agente actualizado.
3. Proyección: incorporar interrupción y reinicio por cambios de hábitos; comprobar tratamiento de meta ya alcanzada y anclaje de la última mediana semanal.
4. Evaluación semanal: implementar etiquetas de días 6–8 con al menos dos días distintos, separadas del método de evaluación anterior.
5. Investigación: el evaluador anterior habilita boosting mediante una condición; el nuevo agente requiere comparar ambos modelos. El protocolo nuevo queda registrado en `research/hito4-ml/protocol-v2.json`; todavía no ejecuta entrenamiento.
6. El test DIETFITS anterior ya fue observado. Repetirlo con protocolo cambiado puede servir como análisis exploratorio, pero no constituirá prueba independiente nueva. Se necesitará evidencia reservada o externa para nuevas afirmaciones de generalización.
7. Consentimiento persistente, registro de modelos y retorno en ejecución requerirán integración antes de un piloto real.

## Orden de continuación

Revisar primero los contratos de perfil y persistencia del sprint 1, integrar las diferencias necesarias y sus pruebas. Continuar después con diario y proyección; mantener investigación separada. No activar IA a partir de un archivo de configuración.

Estado: inventario y pruebas de cálculo completados; diseño de persistencia de los nuevos requisitos y validación remota pendientes. Este informe no marca el Hito 4 completo.
