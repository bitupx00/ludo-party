import { create } from 'zustand';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'ludo-party-lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'es';
}

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useLangStore = create<LangStore>((set, get) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* noop */
    }
    set({ lang });
  },
  toggleLang: () => get().setLang(get().lang === 'es' ? 'en' : 'es'),
}));

const es = {
  appName: 'Ludo Party',
  tagline: 'El parchís más divertido del universo',
  chooseMode: 'Elige cómo jugar',
  modeSolo: 'Jugar vs Bots',
  modeSoloDesc: 'Tú contra 3 bots con actitud',
  modeLocal: 'Pasar y Jugar',
  modeLocalDesc: '2–4 amigos en el mismo dispositivo',
  modeTeams: 'Equipos 2v2',
  modeTeamsDesc: 'Rojo + Amarillo vs Verde + Azul',
  back: 'Volver',
  yourName: 'Tu nombre...',
  add: 'Añadir',
  addBot: 'Bot',
  seatFree: 'Asiento libre',
  bot: 'Bot',
  you: 'Tú',
  teamA: 'Equipo Fuego',
  teamB: 'Equipo Bosque',
  start: '¡A JUGAR!',
  needName: 'Escribe tu nombre para empezar',
  needTwo: 'Se necesitan al menos 2 jugadores',
  botsWillFill: 'Los asientos vacíos se llenan con bots',
  rollDice: '¡Tira el dado!',
  rolling: 'Tirando...',
  thinking: 'pensando...',
  yourTurn: '¡Tu turno!',
  turnOf: 'Turno de',
  extraTurn: '¡TURNO EXTRA!',
  rolledSix: 'sacaste un 6',
  tapPiece: 'Toca una ficha brillante',
  noMoves: 'Sin movimientos posibles 😴',
  chatTitle: 'Chat del juego',
  wins: '¡GANA!',
  winner: 'Ganador',
  teamWinner: 'Equipo ganador',
  playAgain: 'Jugar de nuevo',
  mainMenu: 'Menú principal',
  inGoal: 'en meta',
  exitGame: 'Salir',
  colorRed: 'Rojo',
  colorGreen: 'Verde',
  colorYellow: 'Amarillo',
  colorBlue: 'Azul',
};

const en: typeof es = {
  appName: 'Ludo Party',
  tagline: 'The funniest ludo game in the universe',
  chooseMode: 'Choose how to play',
  modeSolo: 'Play vs Bots',
  modeSoloDesc: 'You against 3 sassy bots',
  modeLocal: 'Pass & Play',
  modeLocalDesc: '2–4 friends on one device',
  modeTeams: 'Teams 2v2',
  modeTeamsDesc: 'Red + Yellow vs Green + Blue',
  back: 'Back',
  yourName: 'Your name...',
  add: 'Add',
  addBot: 'Bot',
  seatFree: 'Open seat',
  bot: 'Bot',
  you: 'You',
  teamA: 'Team Fire',
  teamB: 'Team Forest',
  start: 'PLAY!',
  needName: 'Type your name to start',
  needTwo: 'You need at least 2 players',
  botsWillFill: 'Empty seats are filled with bots',
  rollDice: 'Roll the dice!',
  rolling: 'Rolling...',
  thinking: 'thinking...',
  yourTurn: 'Your turn!',
  turnOf: 'Turn of',
  extraTurn: 'EXTRA TURN!',
  rolledSix: 'you rolled a 6',
  tapPiece: 'Tap a glowing piece',
  noMoves: 'No possible moves 😴',
  chatTitle: 'Game chat',
  wins: 'WINS!',
  winner: 'Winner',
  teamWinner: 'Winning team',
  playAgain: 'Play again',
  mainMenu: 'Main menu',
  inGoal: 'home',
  exitGame: 'Exit',
  colorRed: 'Red',
  colorGreen: 'Green',
  colorYellow: 'Yellow',
  colorBlue: 'Blue',
};

export type TKey = keyof typeof es;

const DICTS: Record<Lang, typeof es> = { es, en };

/** Hook: returns the translate function for the active language. */
export function useT(): (key: TKey) => string {
  const lang = useLangStore((s) => s.lang);
  return (key: TKey) => DICTS[lang][key];
}

/** Non-hook translate (for code outside React). */
export function t(key: TKey): string {
  return DICTS[useLangStore.getState().lang][key];
}

/** Rotating funny tips shown on the home screen. */
export const TIPS: Record<Lang, string[]> = {
  es: [
    'Recuerda: el 6 da turno extra 😉',
    'Tranquilo, es solo un juego... 😏',
    'No te enojes, los bots también tienen sentimientos 🤖',
    'Consejo: captura a tus amigos, que se frustren 💀',
    'Si pierdes, culpa al WiFi 📶😤',
    'El que ríe último... ¡gana! 😂🏆',
    'Con 5 o 6 sacas ficha de la base 🚀',
    'Las casillas con estrella son refugio ⭐',
  ],
  en: [
    'Remember: a 6 gives an extra turn 😉',
    "Relax, it's just a game... 😏",
    'Be nice, bots have feelings too 🤖',
    'Pro tip: capture your friends, let them rage 💀',
    'If you lose, blame the WiFi 📶😤',
    'Who laughs last... wins! 😂🏆',
    'Roll a 5 or 6 to leave your base 🚀',
    'Star squares are safe havens ⭐',
  ],
};
