export const STICKERS = [
  { id: 'laugh', emoji: '😂', label: 'JAJAJA' },
  { id: 'cry', emoji: '😭', label: 'LLORANDO' },
  { id: 'angry', emoji: '🤬', label: 'FUERA!' },
  { id: 'fire', emoji: '🔥', label: 'FUEGO!' },
  { id: 'clown', emoji: '🤡', label: 'PAYASO' },
  { id: 'skull', emoji: '💀', label: 'MUERTO' },
  { id: 'pray', emoji: '🙏', label: 'PLS' },
  { id: 'heart', emoji: '❤️', label: 'LOVE' },
  { id: 'eyes', emoji: '👀', label: 'MIRANDO' },
  { id: '100', emoji: '💯', label: 'PERFECTO' },
  { id: 'rocket', emoji: '🚀', label: 'VAMOS!' },
  { id: 'poop', emoji: '💩', label: 'CACA' },
  { id: 'snake', emoji: '🐍', label: 'SNAKE' },
  { id: 'devil', emoji: '😈', label: 'DIABLO' },
  { id: 'ghost', emoji: '👻', label: 'BOO' },
  { id: 'win', emoji: '🏆', label: 'GANÉ' },
  { id: 'lose', emoji: '🤡', label: 'PERDÍ' },
  { id: 'think', emoji: '🤔', label: 'HMMMM' },
  { id: 'sleep', emoji: '😴', label: 'DORMIDO' },
  { id: 'mega', emoji: '🧠', label: 'MEGA' },
  { id: 'egg', emoji: '🥚', label: 'FRAGIL' },
  { id: 'zap', emoji: '⚡', label: 'ZAP!' },
  { id: 'cold', emoji: '🥶', label: 'FRIO' },
  { id: 'troll', emoji: '🤪', label: 'TROLL' },
] as const;

export const CAPTURE_MESSAGES = [
  '¡BOOM! 💥 Se acabó tu recorrido...',
  'A dormir ☠️ ¡Otra vez desde cero!',
  '¡VUELVE A TU CASA! 🏠😂',
  '¡No llores! 😭 Es solo un juego... MENTIRA',
  'Captura letal 💀 R.I.P. pieza',
  '¿Perdiste tu pieza? 🤷‍♂️ Problemas tuyos',
  '¡SNAP! 🫰 Fuera de aquí',
  'Directo a la base 🏃‍♂️💨',
  'Esa pieza tuvo una vida corta 🪦',
  '¡CAPTURADO! 🔥🔥🔥',
  'Sentémonos a ver cómo se va al hoyo 😈',
  'Tu pieza pidió un taxi 🚕 hasta home',
  '¡Eliminado! como meme de los 2010 💀',
  'Game over para esa pieza, GG EZ 💀',
  'Viaje express: Tablero → Casa 🏠',
];

export const CAPTURE_GIFS = [
  { type: 'explosion', cssClass: 'capture-explosion' },
  { type: 'skull-rain', cssClass: 'capture-skull' },
  { type: 'fire-burst', cssClass: 'capture-fire' },
  { type: 'lightning', cssClass: 'capture-lightning' },
  { type: 'star-burst', cssClass: 'capture-stars' },
];

export const ENTRY_MESSAGES = [
  '¡Sale al tablero! 🎉',
  '¡A la carrera! 🏃‍♂️💨',
  '¡Vamos allá! 🚀',
  'Pieza en juego! 🎯',
];

export const HOME_MESSAGES = [
  '¡En casa! 🏠✨',
  '¡Safe! Llegó al refugio 🛡️',
  '¡Una menos! 📉',
  '¡Llegó! Que fiesta 🎊',
];

export const SIX_MESSAGES = [
  '¡SEIS! 🎲➡️🎲 Doble turno baby',
  '¡Otra vez! 6 = regalado 🎁',
  '¡SACÓ SEIS! Ese era yo 😎',
  'El dado dice: REPITE 🔁',
];

export const WIN_MESSAGES = [
  '¡¡¡GANASTE!! 🏆🎉🎊 ¡QUE BIEN!',
  '¡CAMPEÓN! 👑✨ Invicto vibes',
  '¡VICTORIA! 🏅💪 GG WP',
];

export const CAPTURE_BONUS_MESSAGES = [
  '¡Captura = otra tirada! 🎁🎲',
  'Premio por la captura: ¡tira otra vez! 🔁',
  '¡Cazador recompensado! 🎯🎲',
];

export const HOME_BONUS_MESSAGES = [
  '¡Ficha en meta = tirada extra! 🏁🎲',
  '¡Premio por llegar! Tira de nuevo 🎁',
  'Meta alcanzada → otra tirada 🔁🏆',
];

export const NO_MOVE_MESSAGES = [
  'No se puede mover nada 😴 Siguiente turno',
  'Pieza atascada... ni modo 🤷',
  'Movimiento imposible → pasa el turno 🚫',
];

export function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export type StickerCategory = 'reacciones' | 'juego' | 'basura' | 'frases';

export const STICKER_TABS: { key: StickerCategory; label: string }[] = [
  { key: 'reacciones', label: '😂 Reacciones' },
  { key: 'juego', label: '🎲 Juego' },
  { key: 'basura', label: '💀 Trash Talk' },
  { key: 'frases', label: '💬 Frases' },
];

/** Quick chat phrases (Ludo Club style quick replies). */
export const QUICK_PHRASES = [
  '¡Buena suerte! 🍀',
  '¡Jajaja! 😂',
  '¡Nooo! 😱',
  '¡Te voy a atrapar! 😈',
  '¡Qué suerte tienes! 🎲',
  '¡Uy, casi! 😅',
  '¡Rápido, es tu turno! ⏱️',
  'GG, bien jugado 🤝',
  '¡Venganza! 🔥',
  '¡No me captures! 🙏',
];

/** Categorized sticker grid for the sticker picker. */
export const STICKER_GRID: Record<StickerCategory, string[]> = {
  reacciones: ['😂', '😭', '🤬', '🔥', '🤡', '💀', '🙏', '❤️', '👀', '💯', '🚀', '💩'],
  juego: ['🎲', '🎯', '🏆', '🏠', '🏁', '🛡️', '⚡', '🧠', '🐍', '🥚', '🤔', '😴'],
  basura: ['😈', '👻', '🤪', '🧊', '🥶', '🫠', '😤', '🥴', '🤯', '😵', '🤢', '🙄'],
  frases: [], // rendered as text buttons, see QUICK_PHRASES
};
