# Revisión de visibilidad de los 62 ejercicios

Se revisaron las dependencias reales de sus mediciones y validaciones. Se redujeron los puntos exigidos en **60 ejercicios**; **Seal jack y Mariposa mantienen ocho**, porque utilizan todos. No se rebajó el umbral de confianza ni se eliminaron comprobaciones de postura para aumentar el conteo.

Los puntos centrales usados por bodyScale (ambos hombros y caderas) se conservan donde la fórmula necesita esa normalización. Las reglas bilaterales conservan los dos lados. Una fórmula que mide un solo lado declara sus puntos aparte; la selección y la validación usan el mismo lado. El lado se mantiene durante el ciclo y una oclusión breve usa la tolerancia de seguimiento existente.

Se conservaron los umbrales y las condiciones de los ejercicios; en Gato-vaca y Perro de caza sostenido se hizo que la comprobación horizontal use el mismo lado que su medición. Esto evita exigir puntos del lado contrario sin usarlos en el cálculo elegido.

## Inventario

Índices MediaPipe: 0 nariz; 11/12 hombros; 13/14 codos; 15/16 muñecas; 23/24 caderas; 25/26 rodillas; 27/28 tobillos; 29/30 talones; 31/32 puntas de pies. “Izquierdo/derecho” indica el lado que se mide, no la orientación de la cámara. Las listas pueden incluir puntos centrales o contrarios cuando la fórmula los utiliza.

| Ejercicio | Antes | Ahora: lado izquierdo | Ahora: lado derecho |
|---|---:|---|---|
| Flexiones con rodillas apoyadas (`pushup_knees`) | 13 | 5: 11, 13, 15, 23, 25 | 5: 12, 14, 16, 24, 26 |
| Flexiones abiertas (`pushup_wide`) | 13 | 7: 11, 12, 23, 24, 15, 16, 13 | 7: 11, 12, 23, 24, 15, 16, 14 |
| Flexiones diamante (`pushup_diamond`) | 13 | 7: 11, 12, 23, 24, 15, 16, 13 | 7: 11, 12, 23, 24, 15, 16, 14 |
| Flexiones inclinadas (`pushup_incline`) | 13 | 5: 11, 13, 15, 23, 27 | 5: 12, 14, 16, 24, 28 |
| Flexiones declinadas (`pushup_decline`) | 13 | 5: 11, 13, 15, 23, 27 | 5: 12, 14, 16, 24, 28 |
| Flexiones pike (`pike_pushup`) | 13 | 5: 11, 13, 15, 23, 27 | 5: 12, 14, 16, 24, 28 |
| Pájaros (`rear_delt_fly`) | 13 | 3: 23, 11, 13 | 3: 24, 12, 14 |
| Remo al mentón (`upright_row`) | 13 | 4: 11, 13, 15, 23 | 4: 12, 14, 16, 24 |
| Dominadas (`pullup`) | 13 | 3: 11, 13, 15 | 3: 12, 14, 16 |
| Dominadas supinas (`chinup`) | 13 | 3: 11, 13, 15 | 3: 12, 14, 16 |
| Remo con barra (`bent_row`) | 13 | 4: 11, 13, 15, 23 | 4: 12, 14, 16, 24 |
| Face pull (`face_pull`) | 13 | 7: 0, 11, 12, 23, 24, 13, 15 | 7: 0, 11, 12, 23, 24, 14, 16 |
| Patada de tríceps (`triceps_kickback`) | 13 | 4: 11, 13, 15, 23 | 4: 12, 14, 16, 24 |
| Sentadilla sumo (`squat_sumo`) | 13 | 7: 11, 12, 23, 24, 27, 28, 25 | 7: 11, 12, 23, 24, 27, 28, 26 |
| Sentadilla con salto (`squat_jump`) | 8 | 6: 11, 12, 23, 24, 25, 27 | 6: 11, 12, 23, 24, 25, 27 |
| Sentadilla cosaca (`squat_cossack`) | 13 | 7: 11, 12, 23, 24, 27, 28, 25 | 7: 11, 12, 23, 24, 27, 28, 26 |
| Peso muerto rumano (`deadlift_rdl`) | 13 | 4: 11, 23, 25, 27 | 4: 12, 24, 26, 28 |
| Talones al glúteo (`butt_kicks`) | 8 | 3: 23, 25, 27 | 3: 24, 26, 28 |
| Burpees (`burpee`) | 8 | 6: 11, 12, 23, 24, 25, 27 | 6: 11, 12, 23, 24, 25, 27 |
| Seal jacks (`seal_jack`) | 8 | 8: 11, 12, 23, 24, 15, 16, 27, 28 | 8: 11, 12, 23, 24, 15, 16, 27, 28 |
| Bicicleta (`bicycle_crunch`) | 8 | 6: 11, 12, 23, 24, 13, 26 | 6: 11, 12, 23, 24, 14, 25 |
| Tocar puntas (`toe_touch`) | 8 | 6: 11, 12, 23, 24, 15, 28 | 6: 11, 12, 23, 24, 16, 27 |
| Bicho muerto (`dead_bug`) | 10 | 6: 15, 11, 23, 24, 26, 28 | 6: 16, 12, 24, 23, 25, 27 |
| Perro de caza (`bird_dog`) | 8 | 6: 15, 11, 23, 12, 24, 28 | 6: 16, 12, 24, 11, 23, 27 |
| Superman (`superman`) | 8 | 6: 11, 12, 23, 24, 15, 27 | 6: 11, 12, 23, 24, 15, 27 |
| Plancha (`plank`) | 8 | 3: 11, 23, 27 | 3: 12, 24, 28 |
| Plancha en antebrazos (`plank_forearm`) | 12 | 5: 11, 23, 27, 13, 15 | 5: 12, 24, 28, 14, 16 |
| Plancha lateral (`plank_side`) | 8 | 3: 11, 23, 27 | 3: 12, 24, 28 |
| Plancha inversa (`plank_reverse`) | 8 | 3: 11, 23, 27 | 3: 12, 24, 28 |
| Hollow hold (`hollow_hold`) | 8 | 3: 11, 23, 27 | 3: 12, 24, 28 |
| Colgarse de la barra (`dead_hang`) | 12 | 3: 11, 13, 15 | 3: 12, 14, 16 |
| Isométrico de dominada (`chin_hold`) | 13 | 4: 0, 11, 13, 15 | 4: 0, 12, 14, 16 |
| Superman sostenido (`superman_hold`) | 12 | 4: 15, 11, 27, 23 | 4: 16, 12, 28, 24 |
| Perro de caza sostenido (`bird_dog_hold`) | 12 | 6: 15, 11, 23, 12, 24, 28 | 6: 16, 12, 24, 11, 23, 27 |
| Postura del bote (`boat_pose`) | 8 | 4: 11, 23, 25, 27 | 4: 12, 24, 26, 28 |
| L-sit (`l_sit`) | 8 | 4: 11, 23, 27, 25 | 4: 12, 24, 28, 26 |
| Postura de la silla (`chair_pose`) | 12 | 7: 11, 12, 15, 16, 23, 25, 27 | 7: 11, 12, 15, 16, 24, 26, 28 |
| Isquiotibiales (`st_hamstring`) | 12 | 7: 11, 12, 23, 24, 25, 27, 15 | 7: 11, 12, 23, 24, 26, 28, 16 |
| Cuádriceps de pie (`st_quad`) | 8 | 4: 23, 25, 27, 11 | 4: 24, 26, 28, 12 |
| Pantorrilla contra pared (`st_calf_wall`) | 12 | 8: 11, 12, 23, 24, 25, 27, 29, 31 | 8: 11, 12, 23, 24, 26, 28, 30, 32 |
| Flexor de cadera (`st_hip_flexor`) | 8 | 7: 11, 12, 23, 24, 25, 27, 26 | 7: 11, 12, 23, 24, 26, 28, 25 |
| Paloma (`st_pigeon`) | 8 | 6: 23, 25, 27, 24, 26, 28 | 6: 24, 26, 28, 23, 25, 27 |
| Figura 4 (`st_figure4`) | 8 | 7: 11, 12, 23, 24, 27, 26, 25 | 7: 11, 12, 23, 24, 28, 25, 26 |
| Mariposa (`st_butterfly`) | 8 | 8: 11, 12, 23, 24, 27, 28, 25, 26 | 8: 11, 12, 23, 24, 27, 28, 25, 26 |
| Rana (`st_frog`) | 8 | 6: 11, 12, 23, 24, 25, 26 | 6: 11, 12, 23, 24, 25, 26 |
| Cobra (`st_cobra`) | 12 | 5: 11, 13, 15, 23, 27 | 5: 12, 14, 16, 24, 28 |
| Postura del niño (`st_childs_pose`) | 14 | 7: 11, 12, 23, 24, 29, 13, 15 | 7: 11, 12, 23, 24, 30, 14, 16 |
| Gato-vaca (`st_cat_cow`) | 8 | 3: 11, 23, 25 | 3: 12, 24, 26 |
| Perro boca abajo (`st_downdog`) | 12 | 6: 11, 23, 27, 25, 13, 15 | 6: 12, 24, 28, 26, 14, 16 |
| Deltoides (`st_shoulder_cross`) | 12 | 5: 11, 12, 23, 24, 15 | 5: 11, 12, 23, 24, 16 |
| Tríceps sobre la cabeza (`st_triceps`) | 12 | 3: 11, 13, 15 | 3: 12, 14, 16 |
| Pectoral en puerta (`st_chest_door`) | 12 | 6: 11, 12, 23, 24, 13, 15 | 6: 11, 12, 23, 24, 14, 16 |
| Dorsal (`st_lat`) | 12 | 5: 11, 12, 23, 24, 15 | 5: 11, 12, 23, 24, 16 |
| Torsión espinal sentado (`st_spinal_twist`) | 8 | 5: 11, 12, 23, 24, 25 | 5: 11, 12, 23, 24, 26 |
| Flexión adelante de pie (`st_standing_forward`) | 8 | 4: 23, 25, 27, 11 | 4: 24, 26, 28, 12 |
| Gusano (`wu_inchworm`) | 8 | 4: 11, 23, 25, 27 | 4: 11, 23, 25, 27 |
| World's greatest (`wu_worlds_greatest`) | 10 | 9: 11, 12, 23, 24, 15, 16, 27, 28, 25 | 9: 11, 12, 23, 24, 15, 16, 27, 28, 26 |
| Pase de hombros (`wu_shoulder_dislocate`) | 8 | 4: 11, 13, 15, 23 | 4: 12, 14, 16, 24 |
| Equilibrio a una pierna (`bal_single_leg`) | 8 | 6: 11, 12, 23, 24, 27, 28 | 6: 11, 12, 23, 24, 27, 28 |
| Postura del árbol (`bal_tree`) | 12 | 9: 11, 12, 23, 24, 15, 16, 25, 27, 26 | 9: 11, 12, 23, 24, 15, 16, 26, 28, 25 |
| Guerrero III (`bal_warrior3`) | 8 | 3: 11, 23, 27 | 3: 12, 24, 28 |
| Equilibrio con cuádriceps (`bal_standing_quad`) | 8 | 4: 11, 23, 25, 27 | 4: 12, 24, 26, 28 |

## Verificación

- Fixture histórico: frontend-web/scripts/fixtures/visibility-before.json identifica los 62 originales.
- frontend-web/scripts/exercise-visibility.test.mjs contiene 193 pruebas nuevas: registra los índices que las fórmulas leen en 500 poses reproducibles por lado; compara los resultados con todos los puntos frente a solo los necesarios; elimina cada punto indispensable y comprueba que se rechace la medición.
- Casos de integración: flexiones con rodillas sin nariz/tobillos/lado contrario, dominada con tres articulaciones, plancha de cada lado, tiempo unilateral sin acreditar el brazo oculto, estabilidad del lado durante el ciclo y recuperación tras pérdida prolongada.
- Los casos sintéticos de lectura recorren ramas, pero no constituyen una prueba matemática de todas las poses posibles ni una validación de precisión con personas.
- La suite completa de CI conserva también las regresiones de los 131 analizadores, geometría, seguimiento, contadores y demás módulos web.

La selección mínima no asegura que el detector de pose encuentre esas articulaciones en cualquier encuadre. Si falta una articulación necesaria, la medición sigue pausándose; no se inventan posiciones. Sigue pendiente la verificación con cámara real. El diagnóstico del sprint 0 se conserva como documento histórico anterior a estas correcciones.

## Resultado de la validación local

Suite completa: **640 resultados aprobados, 0 fallidos, 0 omitidos**, incluidos los 193 casos nuevos. JUnit XML verificado. Compilación correcta y lint con salida 0 (cinco advertencias preexistentes). No se utilizó cámara física ni servicios reales.
