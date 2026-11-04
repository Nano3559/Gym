# Hito 4 — Sprint 5: tendencia del peso y comparación energética

## Estado

Implementado en la copia `hito4-work/Gym`, pendiente de aplicar al proyecto original y validar con navegador y Supabase reales. No añade tablas ni migraciones: reutiliza la lectura coherente y protegida `get_balance_data` de la migración 18 y las tablas de los sprints anteriores. No se entrenó IA ni se implementó el ajuste del sprint 6.

## Interfaz

“Mi diario”, dentro del balance, muestra pesajes individuales y tendencia en una gráfica de puntos con eje temporal real y unidades kg. No se unen ni interpolan puntos de días sin registros. Una tabla desplegable conserva cada pesaje individual, su fecha/hora en la zona seleccionada y la tendencia de su día. Los datos energéticos se muestran por separado en kcal/día, sin mezclar escalas en el eje de peso.

La consulta inicial usa los últimos 28 días ya terminados, según el calendario de la zona del diario. Se mantienen los periodos seleccionables de 1 a 31 días; los cortos permiten consultar peso y balance, pero no activar la comparación persistente. En periodos de 29–31 días, los dos intervalos de comparación corresponden explícitamente a los últimos 28 días. Gráfica y balance diario conservan el periodo completo consultado.

## Método reproducible

Versión `daily-median-7d-v1`, parámetros en `TREND_CONFIG`:

1. Filtrar pesajes válidos dentro del periodo y no posteriores al instante de lectura del cliente. La fecha local se calcula desde la hora real y la zona IANA.
2. Calcular una mediana por día: varios pesajes del mismo día no sustituyen días distintos ni dan más peso a ese día. Los originales siguen visibles.
3. En cada día que tiene pesajes, calcular la mediana de las medianas diarias de ese día y los seis días calendario anteriores. Se requieren al menos tres días distintos con pesajes. Si no alcanzan, la tendencia queda no disponible. No se usan observaciones futuras ni se completa el calendario con pesos artificiales.
4. Para comparar, usar dos intervalos consecutivos de 14 días. Cada intervalo requiere sus 14 balances evaluables y al menos tres días distintos con pesajes en cada mitad de siete días. Esto implica al menos 12 días de pesaje distribuidos en las cuatro semanas y 28 días energéticos completos.
5. El cambio de cada intervalo es la mediana diaria de la segunda semana menos la de la primera. No es el peso exacto de los extremos ni una tasa semanal obtenida por regresión. El balance medio usa los 14 días del mismo intervalo.
6. Una discrepancia candidata es déficit medio de al menos 100 kcal/día con cambio de peso mayor o igual a −0,2 kg, o superávit medio de al menos 100 kcal/día con cambio menor o igual a +0,2 kg. Solo se señala persistencia si ambos intervalos son utilizables y muestran la misma discrepancia. Una sola quincena discordante no basta.

Ventanas, mínimos y umbrales son decisiones conservadoras del producto, no parámetros clínicamente validados. No se convierte balance en kg esperados ni se afirma equivalencia causal entre energía registrada y variación de la báscula. La comparación de medianas semanales y balance de la quincena es descriptiva, no una medición fisiológica del intervalo exacto entre pesajes.

## Datos insuficientes y correcciones

Se explica si faltan días del periodo, pesajes de alguna semana, días energéticos evaluables o si el periodo sigue en curso. Un resultado no persistente no equivale a confirmar precisión del gasto o de la alimentación. Las fluctuaciones de agua y otras causas pueden producir desajustes: no se culpa al usuario ni se identifica automáticamente una causa.

No se modifican pesajes, ingestas, entrenamientos ni gasto. Editarlos y actualizar el diario vuelve a consultar una instantánea coherente y recalcula balance y tendencia juntos. La respuesta anterior no se muestra para una nueva zona horaria mientras carga. No hay tabla derivada que pueda quedar desactualizada, ni ajuste por una subida aislada.

## Verificación

- `npm run test:trend`: pesajes irregulares, mínimo de días distintos, varios pesajes diarios, huecos largos, ausencia de datos, días en curso, valores inválidos/futuros, zona local, orden temporal, mediana diaria, tendencia descendente con subida aislada, discrepancias en dos intervalos y ausencia de persistencia con uno solo.
- Renderizado React con y sin datos: gráfica, tabla accesible, estados de insuficiencia y unidades, sin valores NaN/Infinity.
- `test:balance`, `test:energy`, `test:tracking`, `test:progress`, pruebas existentes, lint y build.
- No se añadieron dependencias ni secretos; se conserva el acceso de solo lectura con filtros de propietario y RLS del sprint 4.

La aceptación visual móvil y las pruebas de aislamiento en Supabase siguen pendientes. Los tests de renderizado no sustituyen esa validación. No se ejecutaron pruebas SQL ni migraciones remotas en esta sesión.

## Entrega

`Hito4-sprints1a5.zip` incluye los cambios acumulados y un instalador con respaldo y hashes. Se prueba sobre una carpeta de prueba, nunca sobre el proyecto original. El instalador bloquea archivos con cambios ajenos y no ejecuta migraciones. Para usarlo en el proyecto activo hacen falta los archivos y las migraciones 15–18, así como comprobar el flujo real de consulta, edición y actualización con dos usuarios.
