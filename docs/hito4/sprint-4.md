# Sprint 4 del nuevo agente — Balance energético y cobertura

Fecha: 3 de noviembre de 2026. Proyecto activo: `Gym-ultima-version`.

## Implementación

Se conserva el modelo determinista: ingesta confirmada menos gasto estimado, por el mismo día local. Solo se acumulan días cerrados, con alimentación y actividad confirmadas completas y gasto evaluable. No se entrenó IA ni se convirtió el balance a kilos o fecha de meta.

Se reutilizó la consulta `get_balance_data`: lectura coherente de registros por propietario, agregación SQL sin truncamiento REST y periodo de hasta 31 días. El gasto se recalcula desde los registros actuales; el total de una instantánea antigua no se considera autoritativo.

Se añadieron los siguientes controles y salidas:

1. Porcentaje de cobertura y número explícito de días excluidos.
2. Resumen de motivos de exclusión con conteo de días. Un día puede presentar varios motivos y se advierte que no deben sumarse como días independientes.
3. Validación de calorías de comidas confirmadas: valores vacíos, nulos, negativos, no finitos, booleanos o superiores al rango admitido bloquean el día. No se reemplazan silenciosamente por cero. Una comida anulada no se suma.
4. Deduplicación de copias con el mismo identificador. Dos comidas reales con identificadores diferentes siguen sumándose aunque tengan los mismos datos. Versiones contradictorias de un identificador impiden evaluar el día.
5. Exigencia de confirmaciones booleanas reales para completitud. Una cadena de texto no equivale a una confirmación.
6. Mensajes distintos para días en curso y futuros. Un día inexistente en una zona queda excluido con motivo.
7. Firma de comparación del gasto ampliada con suspensión y duración de las fases de sesión, para identificar cambios relevantes frente a las entradas de una estimación guardada.
8. Componente `BalanceSummary` reutilizable para separar la presentación y probar cobertura nula, parcial y completa, incluido balance cero real.

La ingesta se informa como no disponible cuando hay registros que impiden determinar un total fiable. Para los demás días se puede mostrar la ingesta confirmada parcial, sin convertirla en un balance evaluable. Una ingesta cero solo entra al acumulado si el día fue confirmado completo y cumple el resto de requisitos.

## Archivos

- `frontend-web/src/lib/balanceData.js`
- `frontend-web/src/components/BalancePanel.jsx`
- `frontend-web/src/components/BalanceSummary.jsx`
- `frontend-web/scripts/balance.test.mjs`
- `frontend-web/scripts/balance-render.test.mjs`
- `frontend-web/package.json`: incorpora el renderizado a `test:balance`.

## Pruebas ejecutadas

Pasaron `test:balance`, `test:trend`, `test:projection` y `test:energy`, incluyendo sus pruebas de servicios y renderizado disponibles.

Casos del balance: déficit, superávit, equilibrio real, días incompletos/abiertos/futuros, días sin registros, corrección de comidas y pesos, estimaciones antiguas, alimentos anulados o sin confirmar, duplicados, registros contradictorios, calorías inválidas, 1.501 comidas, periodos de hasta 31 días y días locales de 23/25 horas o inexistentes. Se verificó que el cálculo no muta los datos fuente ni las instantáneas recibidas.

El renderizado verifica que cero se muestre como cero y que ausencia de balance se muestre como no disponible; también confirma la explicación de sumas parciales y motivos de exclusión.

Compilación correcta. Lint sin errores, con cinco advertencias existentes fuera de los archivos modificados. Se mantiene el aviso de tamaño de bundle.

## Persistencia y aceptación pendientes

No se añadió ninguna migración ni se ejecutó SQL remoto. El balance usa la función y las tablas existentes; las migraciones pendientes anteriores siguen requiriendo aplicación y verificación. La prueba SQL `supabase/tests/balance_security.sql` ya contempla aislamiento, límite del periodo, zona inválida y lectura de más de 1.000 filas; no se ejecutó en PostgreSQL durante este sprint.

Los servicios se probaron con dobles de Supabase, no contra una base real. Falta verificar RLS y lectura coherente en la base de pruebas, además de aceptación interactiva en navegador y móvil. La consistencia local y la compilación no acreditan esas verificaciones remotas.

Estado: implementación del sprint y pruebas locales completadas; aceptación remota y en dispositivos pendiente. Los cambios se realizaron directamente en la última versión sin crear copias adicionales del proyecto.
