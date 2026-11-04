# Sprint 3 del nuevo agente — Estimación del gasto diario

Fecha: 27 de octubre de 2026. Proyecto activo: `Gym-ultima-version`.

## Modelo y trabajo realizado

Se mantiene Mifflin–St Jeor para reposo, factores cotidianos explícitos 1,4/1,6/1,8 y categorías MET documentadas. El aporte del ejercicio descuenta la base de sus mismos minutos y no vuelve a sumar calorías brutas. No se entrenó ni activó IA.

La implementación existente ya cubría selección de categoría, adulto de 19–59 años, peso reciente, perfil válido para el periodo, sesiones solapadas, cambios de día y distinción provisional/completo. Se reforzó:

1. Reloj explícito `now` en la función pura, utilizado también al recalcular balances. Permite reproducir límites temporales sin depender del reloj del equipo durante la prueba.
2. Rechazo de pesos, perfiles y sesiones situados en el futuro respecto de ese reloj, incluso si caen dentro del día actual.
3. Detección de una sesión sin identificador y de versiones contradictorias de un mismo identificador. Las copias idénticas se deduplican; las contradictorias impiden total válido.
4. Detección de categorías contradictorias para una sesión, sin elegir silenciosamente la primera.
5. Validación de segundos enteros, duración total y coherencia entre tiempo activo, descanso, preparación y pausa cuando esos campos están presentes. Las fases no pueden superar la duración transcurrida.
6. Marca de fecha `calculatedAt` y versión de validación `energy-inputs-v2` en las nuevas instantáneas. La fórmula conserva su versión `mifflin-met-replacement-v1` porque no cambió su matemática.
7. Antes del guardado, se reproduce el cálculo con sus entradas y fecha originales. Se rechazan totales alterados, formatos sin información reproducible y fechas de cálculo futuras. Se guarda la salida reconstruida, no detalles arbitrarios aportados por el cliente. La operación requiere identificador para reintentos.
8. Validación de categorías en el servicio y enlace a la fuente de cada MET en el desglose. Se eliminó el texto desactualizado que indicaba que el balance aún no existía.

## Archivos

- `frontend-web/src/lib/energyData.js`
- `frontend-web/src/lib/balanceData.js`
- `frontend-web/src/services/energyService.js`
- `frontend-web/src/components/EnergyEstimate.jsx`
- `frontend-web/scripts/energy.test.mjs`
- `frontend-web/scripts/energy-service.test.mjs`

## Pruebas ejecutadas

`test:energy` pasó con casos de las variantes de fórmula masculina y femenina, cumpleaños, días de 23 y 25 horas, 30 días exactos de antigüedad del peso, tiempo futuro dentro del día actual, categorías y sesiones contradictorias, duración por fases e identificadores. Se probó reproducción tras serializar a JSON, detección de alteraciones y preservación del carácter provisional según el reloj de emisión.

También pasaron `test:balance` y `test:projection`, incluyendo servicios y renderizado de proyección. La compilación terminó correctamente. Lint terminó sin errores, con las cinco advertencias preexistentes en otros componentes. Se mantiene el aviso de bundle grande.

Los servicios se probaron con dobles de Supabase. No equivalen a probar permisos ni persistencia contra PostgreSQL.

## Persistencia y límites

No se necesita otra migración: la fecha y versión de validación se almacenan dentro del JSON existente de `daily_energy_estimates`. Las migraciones previas, incluidas 20 y 21, siguen pendientes de aplicación y verificación remota. No se ejecutó ninguna migración ni despliegue durante este sprint.

Las instantáneas antiguas siguen siendo consultables y su factor puede utilizarse para recalcular el balance con registros actuales. Para guardar una nueva instantánea se exige el formato reproducible nuevo. No se modificaron estimaciones históricas.

La reproducción y validación del servicio mejoran consistencia del cliente; no convierten el JSON en una estimación certificada por el servidor. El cálculo sigue siendo aproximado y los factores no están calibrados individualmente. Las sesiones que cruzan de día deben revisarse/dividirse antes de emitir un total válido; no se infiere cómo repartir esfuerzo entre días.

Falta aceptación interactiva en móvil/navegador y ejecución de las pruebas SQL de energía y seguridad con las migraciones aplicadas. Estado: implementación y pruebas locales completadas; aceptación remota pendiente.
