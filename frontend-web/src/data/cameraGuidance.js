// Capture guidance for the 14 reviewed exercises. It does not alter detection
// thresholds or certify exercise technique; validate the framing with real video.
export const CAMERA_GUIDES = {
  pushup_wide: {
    view: 'oblicua',
    position: 'Cámara baja, desde un costado y ligeramente hacia el frente.',
    framing: 'Encuadra el tronco de perfil y ambas manos separadas. Deben verse hombros, codos, muñecas y caderas durante toda la flexión.',
    avoid: 'Evita apuntar desde la cabeza o desde los pies: el tronco y la flexión del codo pueden quedar ocultos.',
  },
  pushup_diamond: {
    view: 'oblicua',
    position: 'Cámara baja, en diagonal desde un costado, sin quedar justo delante de la cabeza.',
    framing: 'Mantén visibles el tronco, las caderas, ambos hombros y las manos juntas; deja espacio para que los codos se flexionen sin salir del cuadro.',
    avoid: 'Evita un perfil tan cerrado que una mano tape la otra o la toma desde los pies que acorta el tronco en imagen.',
  },
  curl_biceps: {
    view: 'lateral',
    position: 'Coloca la cámara de lado, aproximadamente a la altura del codo del brazo que vas a mover.',
    framing: 'Encuadra hombro, codo y muñeca del mismo brazo, desde el brazo extendido hasta la contracción. El otro brazo no debe taparlos.',
    avoid: 'Evita mirar totalmente de frente o mover la mano hacia la cámara: la flexión puede quedar acortada en imagen.',
  },
  curl_hammer: {
    view: 'lateral',
    position: 'Cámara de lado, a la altura aproximada del codo, viendo el brazo que trabaja.',
    framing: 'Deja completos hombro, codo y muñeca en todas las posiciones; reserva espacio por delante del torso para el movimiento.',
    avoid: 'Evita que el torso o la mancuerna tapen el codo y que el antebrazo apunte directamente hacia la cámara.',
  },
  curl_alternate: {
    view: 'oblicua',
    position: 'Cámara en diagonal, de tres cuartos, para ver la flexión sin ocultar el otro brazo.',
    framing: 'Incluye ambos hombros, codos y muñecas. Comprueba que el brazo que alternas siga visible al extenderlo y recogerlo.',
    avoid: 'Evita el perfil exacto que oculta un brazo y la toma frontal donde el antebrazo se mueve hacia la cámara.',
  },
  shoulder_press: {
    view: 'frontal',
    position: 'Cámara de frente, aproximadamente a la altura del pecho y con espacio libre por encima de la cabeza.',
    framing: 'Encuadra ambos hombros, codos y muñecas, incluyendo la posición más alta de las manos.',
    avoid: 'Evita recortar las manos al subir o que un brazo quede detrás del torso.',
  },
  arnold_press: {
    view: 'frontal',
    position: 'Cámara de frente, a la altura aproximada del pecho, mostrando los dos brazos.',
    framing: 'Incluye hombros, codos y muñecas desde la posición baja hasta las manos sobre la cabeza.',
    avoid: 'Evita recortar las manos o girarte hasta ocultar un codo. El conteo no comprueba el giro de las manos.',
  },
  upright_row: {
    view: 'frontal',
    position: 'Cámara de frente, con el torso centrado y los brazos visibles a ambos lados.',
    framing: 'Encuadra desde las caderas hasta la cabeza, sin cortar codos ni muñecas al elevarlos.',
    avoid: 'Evita un recorte solo del pecho: la referencia de cadera y la posición baja de las manos deben verse.',
  },
  lat_pulldown: {
    view: 'frontal',
    position: 'Cámara de frente a la máquina, centrada en el torso, dejando visible la zona sobre la cabeza.',
    framing: 'Incluye hombros, codos y muñecas en la posición alta y durante todo el descenso.',
    avoid: 'Evita que la estructura de la máquina tape las articulaciones o que las manos salgan del borde superior.',
  },
  pullup: {
    view: 'frontal',
    position: 'Cámara de frente a la barra, suficientemente alejada para mantener los brazos completos en imagen.',
    framing: 'Incluye hombros, codos y muñecas tanto al colgarte como al subir. Mantén la cámara fija durante la serie.',
    avoid: 'Evita cortar las muñecas en la barra o colocar un soporte delante de los codos.',
  },
  chinup: {
    view: 'oblicua',
    position: 'Cámara en diagonal respecto de la barra para que se vea el recorrido del antebrazo.',
    framing: 'Mantén visibles hombro, codo y muñeca del brazo que se mide en toda la subida y bajada.',
    avoid: 'Evita la toma frontal donde el antebrazo apunta hacia la cámara y el perfil donde la barra o el otro brazo lo ocultan.',
  },
  face_pull: {
    view: 'oblicua',
    position: 'Cámara de tres cuartos, a la altura aproximada del pecho, viendo el rostro y el recorrido del brazo.',
    framing: 'Incluye rostro, ambos hombros, caderas, codo y muñeca. El encuadre no debe terminar a la altura del pecho.',
    avoid: 'Evita que las manos tapen completamente la cara o que la polea oculte el codo.',
  },
  dumbbell_fly: {
    view: 'frontal',
    position: 'Cámara fija desde el extremo de los pies, mirando hacia el pecho y ligeramente elevada.',
    framing: 'Debes ver ambos hombros y codos, con espacio a los lados para toda la apertura y por arriba para la posición de brazos juntos.',
    avoid: 'Evita la toma solo de perfil que oculta un brazo y la toma vertical desde arriba que acorta los brazos cuando se juntan.',
  },
  punch_cross: {
    view: 'lateral',
    position: 'Cámara de lado, aproximadamente a la altura del hombro, viendo el brazo que se extiende.',
    framing: 'Deja espacio para el hombro, codo y muñeca desde la guardia hasta la extensión y el regreso.',
    avoid: 'Evita dirigir el puño hacia la cámara: la extensión debe apreciarse de lado en la imagen.',
  },
}

export const CAMERA_VIEW_LABELS = { frontal: 'Frontal', lateral: 'Lateral', oblicua: 'Oblicua (tres cuartos)' }

export function cameraDescription(exercise, fallback = '') {
  const guide = CAMERA_GUIDES[exercise?.id]
  return guide ? `${guide.position} ${guide.framing} ${guide.avoid}` : fallback
}
