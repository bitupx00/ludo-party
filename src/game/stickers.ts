/**
 * Text pools for engine narration and quick chat phrases. Emoji-free by
 * design: the UI communicates with vector icons, not emoji glyphs.
 */

export const CAPTURE_MESSAGES = [
  '¡BOOM! Se acabó tu recorrido...',
  'A dormir. ¡Otra vez desde cero!',
  '¡VUELVE A TU CASA!',
  '¡No llores! Es solo un juego... MENTIRA',
  'Captura letal. R.I.P. pieza',
  '¿Perdiste tu pieza? Problemas tuyos',
  '¡SNAP! Fuera de aquí',
  'Directo a la base, sin escalas',
  'Esa pieza tuvo una vida corta',
  '¡CAPTURADO!',
  'Sentémonos a ver cómo se va al hoyo',
  'Tu pieza pidió un taxi hasta home',
  '¡Eliminado! como meme de los 2010',
  'Game over para esa pieza, GG EZ',
  'Viaje express: Tablero a Casa',
];

export const ENTRY_MESSAGES = [
  '¡Sale al tablero!',
  '¡A la carrera!',
  '¡Vamos allá!',
  '¡Pieza en juego!',
];

export const HOME_MESSAGES = [
  '¡En casa!',
  '¡Safe! Llegó al refugio',
  '¡Una menos!',
  '¡Llegó! Qué fiesta',
];

export const SIX_MESSAGES = [
  '¡SEIS! Doble turno baby',
  '¡Otra vez! 6 = regalado',
  '¡SACÓ SEIS! Ese era yo',
  'El dado dice: REPITE',
];

export const WIN_MESSAGES = [
  '¡¡¡GANASTE!!! ¡QUÉ BIEN!',
  '¡CAMPEÓN! Invicto vibes',
  '¡VICTORIA! GG WP',
];

export const CAPTURE_BONUS_MESSAGES = [
  '¡Captura = otra tirada!',
  'Premio por la captura: ¡tira otra vez!',
  '¡Cazador recompensado!',
];

export const HOME_BONUS_MESSAGES = [
  '¡Ficha en meta = tirada extra!',
  '¡Premio por llegar! Tira de nuevo',
  'Meta alcanzada: otra tirada',
];

export const THREE_SIX_MESSAGES = [
  '¡TRES SEISES! Jugada cancelada, turno perdido',
  '3×6 = prohibido. La jugada se cancela',
  '¡Demasiada suerte! Tercer 6: pierdes el turno',
];

export const NO_MOVE_MESSAGES = [
  'No se puede mover nada. Siguiente turno',
  'Pieza atascada... ni modo',
  'Movimiento imposible: pasa el turno',
];

export function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Quick chat phrases (Ludo Club style quick replies). */
export const QUICK_PHRASES = [
  '¡Buena suerte!',
  '¡Jajaja!',
  '¡Nooo!',
  '¡Te voy a atrapar!',
  '¡Qué suerte tienes!',
  '¡Uy, casi!',
  '¡Rápido, es tu turno!',
  'GG, bien jugado',
  '¡Venganza!',
  '¡No me captures!',
];
