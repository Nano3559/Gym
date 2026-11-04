# Sprint 5 del nuevo agente — Tendencia del peso

Fecha: 3 de noviembre de 2026. Proyecto activo: `Gym-ultima-version`.

## Modelo y cambios

Se mantiene `daily-median-7d-v1`: mediana diaria de mediciones reales y mediana móvil de siete días de calendario, con mínimo de tres días distintos con peso. La comparación sigue usando dos intervalos consecutivos de catorce días dentro de los últimos veintiocho del periodo seleccionado, con todos los días energéticos evaluables y tres días de pesaje por semana. No se entrenó IA ni se ajustó el gasto por una fluctuación aislada.

Se completaron los controles y presentación:

1. Copias de una medición con el mismo identificador no alteran la mediana ni se presentan como pesajes nuevos. Varias mediciones reales con identificadores distintos se conservan y forman la mediana diaria.
2. Versiones contradictorias del mismo pesaje se excluyen de la tendencia y bloquean la conclusión comparativa hasta actualizar el historial. No se elige una versión por su orden de llegada.
3. Se descartan fechas inválidas o futuras y pesos fuera del rango de registro de 20–500 kg. Los descartes y copias se informan mediante avisos. Los registros originales no se modifican.
4. Los intervalos energéticos exigen catorce fechas distintas, con estado evaluable booleano y balance numérico finito. Copias de un día no sustituyen días faltantes; versiones contradictorias invalidan ese día.
5. Un intervalo que incluya un día local inexistente queda no comparable y se explica el motivo, sin lanzar un error que cierre toda la vista.
6. El gráfico usa las fronteras del periodo seleccionado para mostrar huecos iniciales y finales. No se dibujan puntos ni líneas de interpolación en días sin datos. Si una frontera local no existe, se utiliza el dominio de las observaciones como alternativa.
7. La tabla accesible separa peso observado, mediana diaria y tendencia de siete días. Indica cuántos días sustentan la tendencia y no añade unidades a la ausencia de resultados.
8. Se muestra el número de días con pesajes válidos y con tendencia calculable. Los avisos de calidad están separados de las causas de insuficiencia de comparación.

La matemática de las medianas conserva su versión. La salida identifica los controles de entrada con `trend-inputs-v2`.

## Archivos

- `frontend-web/src/lib/weightTrendData.js`
- `frontend-web/src/components/WeightTrendPanel.jsx`
- `frontend-web/scripts/weight-trend.test.mjs`
- `frontend-web/scripts/weight-trend-render.test.mjs`

## Pruebas

Pasaron `test:trend`, `test:projection` y `test:balance`, incluyendo servicios y renderizado disponibles. Los casos nuevos cubren copias que inclinarían la mediana, versiones contradictorias, datos inválidos, catorce filas con solo trece fechas, balance no finito, igualdad de influencia entre días y conservación de entradas sin mutación.

Se mantienen casos de pesajes irregulares, tres mediciones muy separadas, ausencia de datos, valor aislado, discrepancia de una sola quincena, cambio de cobertura y agrupación por zona horaria. El renderizado comprueba que una medición intermedia se coloque dentro del periodo completo, que existan tabla y encabezados accesibles y que los descartes se expliquen.

Una aserción inicial de renderizado falló por los comentarios separadores que React inserta entre textos. Se corrigió la normalización de esos comentarios en la prueba y la suite completa volvió a pasar; no se cambió la interfaz para satisfacer ese detalle técnico.

Compilación correcta y lint sin errores. Continúan cinco advertencias existentes en otros componentes y el aviso de tamaño de bundle.

## Límites y aceptación

No se añadieron tablas ni migraciones y no se desplegó en Supabase. Las verificaciones remotas pendientes de los sprints anteriores continúan pendientes. El renderizado del servidor no sustituye la aceptación interactiva en navegador y móvil.

Los umbrales de discrepancia (100 kcal/día y 0,2 kg entre medianas semanales, persistentes en ambos intervalos) son criterios de producto sin validación clínica. La discrepancia no identifica una causa ni demuestra error de registro. La vista no genera una corrección energética ni una fecha de meta.

Estado: implementación y pruebas locales completadas; aceptación remota y en dispositivos pendiente.
