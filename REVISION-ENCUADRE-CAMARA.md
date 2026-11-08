# Revisión de posición y encuadre — 14 ejercicios

Se revisaron los 14 ejercicios del grupo de perspectiva. Ocho pasan a una indicación lateral u oblicua; seis conservan la vista frontal con instrucciones de altura, espacio y articulaciones visibles. Las vistas son recomendaciones de captura para el analizador actual, pendientes de comprobar con cámara real; no una garantía de precisión ni instrucciones de técnica deportiva.

## Indicaciones por ejercicio

| Ejercicio | Vista | Posición de cámara | Encuadre | Qué evitar |
|---|---|---|---|---|
| Flexiones abiertas (`pushup_wide`) | Oblicua (tres cuartos) | Cámara baja, desde un costado y ligeramente hacia el frente. | Encuadra el tronco de perfil y ambas manos separadas. Deben verse hombros, codos, muñecas y caderas durante toda la flexión. | Evita apuntar desde la cabeza o desde los pies: el tronco y la flexión del codo pueden quedar ocultos. |
| Flexiones diamante (`pushup_diamond`) | Oblicua (tres cuartos) | Cámara baja, en diagonal desde un costado, sin quedar justo delante de la cabeza. | Mantén visibles el tronco, las caderas, ambos hombros y las manos juntas; deja espacio para que los codos se flexionen sin salir del cuadro. | Evita un perfil tan cerrado que una mano tape la otra o la toma desde los pies que acorta el tronco en imagen. |
| Curl de bíceps (`curl_biceps`) | Lateral | Coloca la cámara de lado, aproximadamente a la altura del codo del brazo que vas a mover. | Encuadra hombro, codo y muñeca del mismo brazo, desde el brazo extendido hasta la contracción. El otro brazo no debe taparlos. | Evita mirar totalmente de frente o mover la mano hacia la cámara: la flexión puede quedar acortada en imagen. |
| Curl martillo (`curl_hammer`) | Lateral | Cámara de lado, a la altura aproximada del codo, viendo el brazo que trabaja. | Deja completos hombro, codo y muñeca en todas las posiciones; reserva espacio por delante del torso para el movimiento. | Evita que el torso o la mancuerna tapen el codo y que el antebrazo apunte directamente hacia la cámara. |
| Curl alterno (`curl_alternate`) | Oblicua (tres cuartos) | Cámara en diagonal, de tres cuartos, para ver la flexión sin ocultar el otro brazo. | Incluye ambos hombros, codos y muñecas. Comprueba que el brazo que alternas siga visible al extenderlo y recogerlo. | Evita el perfil exacto que oculta un brazo y la toma frontal donde el antebrazo se mueve hacia la cámara. |
| Press militar (`shoulder_press`) | Frontal | Cámara de frente, aproximadamente a la altura del pecho y con espacio libre por encima de la cabeza. | Encuadra ambos hombros, codos y muñecas, incluyendo la posición más alta de las manos. | Evita recortar las manos al subir o que un brazo quede detrás del torso. |
| Press Arnold (`arnold_press`) | Frontal | Cámara de frente, a la altura aproximada del pecho, mostrando los dos brazos. | Incluye hombros, codos y muñecas desde la posición baja hasta las manos sobre la cabeza. | Evita recortar las manos o girarte hasta ocultar un codo. El conteo no comprueba el giro de las manos. |
| Remo al mentón (`upright_row`) | Frontal | Cámara de frente, con el torso centrado y los brazos visibles a ambos lados. | Encuadra desde las caderas hasta la cabeza, sin cortar codos ni muñecas al elevarlos. | Evita un recorte solo del pecho: la referencia de cadera y la posición baja de las manos deben verse. |
| Jalón al pecho (`lat_pulldown`) | Frontal | Cámara de frente a la máquina, centrada en el torso, dejando visible la zona sobre la cabeza. | Incluye hombros, codos y muñecas en la posición alta y durante todo el descenso. | Evita que la estructura de la máquina tape las articulaciones o que las manos salgan del borde superior. |
| Dominadas (`pullup`) | Frontal | Cámara de frente a la barra, suficientemente alejada para mantener los brazos completos en imagen. | Incluye hombros, codos y muñecas tanto al colgarte como al subir. Mantén la cámara fija durante la serie. | Evita cortar las muñecas en la barra o colocar un soporte delante de los codos. |
| Dominadas supinas (`chinup`) | Oblicua (tres cuartos) | Cámara en diagonal respecto de la barra para que se vea el recorrido del antebrazo. | Mantén visibles hombro, codo y muñeca del brazo que se mide en toda la subida y bajada. | Evita la toma frontal donde el antebrazo apunta hacia la cámara y el perfil donde la barra o el otro brazo lo ocultan. |
| Face pull (`face_pull`) | Oblicua (tres cuartos) | Cámara de tres cuartos, a la altura aproximada del pecho, viendo el rostro y el recorrido del brazo. | Incluye rostro, ambos hombros, caderas, codo y muñeca. El encuadre no debe terminar a la altura del pecho. | Evita que las manos tapen completamente la cara o que la polea oculte el codo. |
| Aperturas con mancuernas (`dumbbell_fly`) | Frontal | Cámara fija desde el extremo de los pies, mirando hacia el pecho y ligeramente elevada. | Debes ver ambos hombros y codos, con espacio a los lados para toda la apertura y por arriba para la posición de brazos juntos. | Evita la toma solo de perfil que oculta un brazo y la toma vertical desde arriba que acorta los brazos cuando se juntan. |
| Golpes de boxeo (`punch_cross`) | Lateral | Cámara de lado, aproximadamente a la altura del hombro, viendo el brazo que se extiende. | Deja espacio para el hombro, codo y muñeca desde la guardia hasta la extensión y el regreso. | Evita dirigir el puño hacia la cámara: la extensión debe apreciarse de lado en la imagen. |

## Coherencia entre pantallas

- Fuente única: frontend-web/src/data/cameraGuidance.js.
- El registro usa esa fuente para vistaCamara en los 14 ejercicios.
- CameraGuidance muestra posición, encuadre y advertencias específicas tanto en SquatCoachModal como en RoutineRunner.
- El catálogo de descripciones de src/data/exercises.js utiliza el mismo texto.
- Se eliminó la instrucción inicial universal que pedía colocarse de lado y de cuerpo entero incluso en ejercicios frontales.
- En los otros 117 ejercicios se conserva el texto alternativo de la cámara individual.

No se cambió ninguna fábrica de analizador, fórmula, límite angular, requisito de visibilidad o regla de seguimiento/conteo. La guía de aperturas corresponde a su medición ya corregida de ambos brazos; no al antiguo ángulo del codo. La vista de curl de bíceps coincide con el aviso lateral de su analizador específico.

## Pruebas

frontend-web/scripts/camera-guidance.test.mjs añade **19 casos**: cobertura exacta de los 14 IDs, coherencia de metadatos/descripciones/renderizado, articulaciones e indicaciones clave, conservación de textos alternativos y pruebas de las dos pantallas reales con selección/cambio de los 14 ejercicios.

Las pruebas de interfaz utilizan renderizado de React sin navegador ni cámara: la cámara individual permanece cerrada y el entorno de rutinas no dispone de mediaDevices. No hay permisos, captura física, descarga de modelos ni servicios reales. La suite completa mantiene las regresiones anteriores de conteo, geometría, seguimiento, visibilidad y umbrales.

## Pendiente de campo

Validar cada encuadre con videos autorizados o sesiones observadas, verificando que las articulaciones requeridas permanezcan visibles durante todo el recorrido. Una indicación de encuadre coherente no elimina los errores del detector, las autooclusiones ni las limitaciones de medir un movimiento tridimensional en una imagen.

## Resultado local

**927 resultados aprobados, 0 fallidos, 0 omitidos** en la suite completa, incluidos los 19 nuevos. JUnit XML verificado. Compilación correcta y lint con salida 0; permanecen las cinco advertencias preexistentes. La prueba con cámara física sigue pendiente.
