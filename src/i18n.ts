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
  modeOnline: 'Jugar Online',
  modeOnlineDesc: 'Crea una sala y comparte el código',
  createRoom: 'Crear sala',
  joinRoomBtn: 'Unirse',
  orJoin: 'o únete a una sala',
  codePlaceholder: 'CÓDIGO',
  roomCodeLabel: 'Código de sala',
  shareCode: 'Compártelo para que entren a jugar',
  copyCode: 'Copiar',
  copiedCode: '¡Copiado!',
  shareBtn: 'Compartir',
  quickPhrases: '💬 Frases',
  connecting: 'Conectando...',
  waitingHost: 'Esperando a que el anfitrión empiece...',
  waitingPlayers: 'Los jugadores que entren ocuparán los asientos',
  host: 'Anfitrión',
  errRoomNotFound: 'Sala no encontrada — revisa el código',
  errHostLeft: 'El anfitrión cerró la sala',
  errRoomFull: 'La sala está llena',
  errInGame: 'Esa partida ya empezó',
  errConnection: 'Error de conexión — inténtalo de nuevo',
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
  thirdSix: '¡Tercer 6! Jugada cancelada',
  tapPiece: 'Toca una ficha brillante',
  noMoves: 'Sin movimientos posibles 😴',
  chatTitle: 'Chat del juego',
  typeMessage: 'Escribe un mensaje...',
  send: 'Enviar',
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
  modeOnline: 'Play Online',
  modeOnlineDesc: 'Create a room and share the code',
  createRoom: 'Create room',
  joinRoomBtn: 'Join',
  orJoin: 'or join a room',
  codePlaceholder: 'CODE',
  roomCodeLabel: 'Room code',
  shareCode: 'Share it so friends can join',
  copyCode: 'Copy',
  copiedCode: 'Copied!',
  shareBtn: 'Share',
  quickPhrases: '💬 Phrases',
  connecting: 'Connecting...',
  waitingHost: 'Waiting for the host to start...',
  waitingPlayers: 'Players who join will fill the seats',
  host: 'Host',
  errRoomNotFound: 'Room not found — check the code',
  errHostLeft: 'The host closed the room',
  errRoomFull: 'The room is full',
  errInGame: 'That game already started',
  errConnection: 'Connection error — try again',
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
  thirdSix: 'Third 6! Play cancelled',
  tapPiece: 'Tap a glowing piece',
  noMoves: 'No possible moves 😴',
  chatTitle: 'Game chat',
  typeMessage: 'Type a message...',
  send: 'Send',
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
    'Saca un 6 para salir de la base 🚀',
    '¡Capturar da tirada extra! 🎯🎲',
    'Llegar a meta también da otra tirada 🏁🎁',
    'Tres 6 seguidos = pierdes el turno 😱',
    'Las casillas con estrella son refugio ⭐',
    'Consejo: captura a tus amigos, que se frustren 💀',
    'Si pierdes, culpa al WiFi 📶😤',
  ],
  en: [
    'Remember: a 6 gives an extra turn 😉',
    'Roll a 6 to leave your base 🚀',
    'Capturing grants an extra roll! 🎯🎲',
    'Reaching the goal also grants a roll 🏁🎁',
    'Three 6s in a row = lose your turn 😱',
    'Star squares are safe havens ⭐',
    'Pro tip: capture your friends, let them rage 💀',
    'If you lose, blame the WiFi 📶😤',
  ],
};
