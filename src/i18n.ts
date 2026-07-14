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
  appName: "LudoPata'S",
  tagline: 'El parchís más divertido del universo',
  chooseMode: 'Elige cómo jugar',
  modeSolo: 'Jugar vs Bots',
  modeSoloDesc: 'Tú contra 3 bots con actitud',
  modeLocal: 'Pasar y Jugar',
  modeLocalDesc: '2–4 amigos en el mismo dispositivo',
  modeTeams: 'Equipos 2v2',
  modeTeamsDesc: '4 humanos: Rojo+Amarillo vs Verde+Azul',
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
  rejoinRoom: 'Volver a tu sala',
  reconnecting: 'Reconectando…',
  enableAv: 'Activar cámara/micrófono',
  turnCameraOff: 'Apagar cámara',
  turnCameraOn: 'Encender cámara',
  turnMicOff: 'Silenciar micrófono',
  turnMicOn: 'Activar micrófono',
  back: 'Volver',
  yourName: 'Tu nombre...',
  add: 'Añadir',
  addBot: 'Bot',
  seatFree: 'Asiento libre',
  sitHere: 'Sentarme aquí',
  bot: 'Bot',
  you: 'Tú',
  teamA: 'Equipo Fuego',
  teamB: 'Equipo Bosque',
  start: '¡A JUGAR!',
  needName: 'Escribe tu nombre para empezar',
  needTwo: 'Se necesitan al menos 2 jugadores',
  needFourTeams: 'El 2v2 es solo de humanos: se necesitan 4 jugadores',
  botsWillFill: 'Los asientos vacíos se llenan con bots',
  rollDice: '¡Tira el dado!',
  rolling: 'Tirando...',
  thinking: 'pensando...',
  yourTurn: '¡Tu turno!',
  turnOf: 'Turno de',
  extraTurn: '¡TURNO EXTRA!',
  rolledSix: 'sacaste un 6',
  rolledOne: 'sacaste un 1',
  thirdSix: '¡3 tiradas extra seguidas! Jugada cancelada',
  tapPiece: 'Toca una ficha brillante',
  noMoves: 'Sin movimientos posibles 😴',
  luckyTitle: 'Dado de la suerte',
  luckyHint: 'Compra un dado en cualquier momento: queda ARMADO y se usa en tu próxima tirada (tú lanzas igual). 50% de que salga tu número, 50% uno menor (el 1 cae en 2 o 3).',
  luckyEarn: 'Cada 6 o 1 suma +1 ⭐ · Cada compra sube +1 ⭐ el precio de todos los dados',
  luckyArmed: 'armado — se usará en tu próxima tirada',
  luckyReady: 'listo',
  ranking: 'Ranking',
  rankingEmpty: 'Aún no hay partidas registradas. ¡Juega una y aparecerás aquí!',
  rankingNote: 'Ranking local de este dispositivo · 🏆 victorias · 🎮 partidas · 💥 capturas · 🏁 fichas en meta',
  rankPlayer: 'Jugador',
  rankWins: 'Victorias',
  rankGames: 'Partidas',
  rankKills: 'Capturas',
  rankGoals: 'Metas',
  profileTitle: 'Mi perfil',
  profilePoints: 'puntos',
  profileId: 'ID',
  profilePin: 'PIN',
  profileCode: 'Código',
  profileCodeHint: 'Copia tu código y tu PIN para llevar tu cuenta (nombre y ⭐) a otro dispositivo o si cambia tu red.',
  profileEmpty: 'Juega una partida con tu nombre para crear tu perfil automáticamente.',
  profileRestore: 'Recuperar cuenta',
  profileCodePlaceholder: 'Pega aquí tu código LP1…',
  profileRestoreBtn: 'Recuperar',
  profileRestoreOk: '¡Cuenta recuperada!',
  profileRestoreBad: 'Código o PIN incorrecto',
  chatTitle: 'Chat del juego',
  typeMessage: 'Escribe un mensaje...',
  send: 'Enviar',
  chatEmpty: '¡Escribe algo o manda una reacción! 👋',
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
  appName: "LudoPata'S",
  tagline: 'The funniest ludo game in the universe',
  chooseMode: 'Choose how to play',
  modeSolo: 'Play vs Bots',
  modeSoloDesc: 'You against 3 sassy bots',
  modeLocal: 'Pass & Play',
  modeLocalDesc: '2–4 friends on one device',
  modeTeams: 'Teams 2v2',
  modeTeamsDesc: '4 humans: Red+Yellow vs Green+Blue',
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
  rejoinRoom: 'Rejoin your room',
  reconnecting: 'Reconnecting…',
  enableAv: 'Enable camera/mic',
  turnCameraOff: 'Turn camera off',
  turnCameraOn: 'Turn camera on',
  turnMicOff: 'Mute microphone',
  turnMicOn: 'Unmute microphone',
  back: 'Back',
  yourName: 'Your name...',
  add: 'Add',
  addBot: 'Bot',
  seatFree: 'Open seat',
  sitHere: 'Sit here',
  bot: 'Bot',
  you: 'You',
  teamA: 'Team Fire',
  teamB: 'Team Forest',
  start: 'PLAY!',
  needName: 'Type your name to start',
  needTwo: 'You need at least 2 players',
  needFourTeams: '2v2 is humans-only: 4 players needed',
  botsWillFill: 'Empty seats are filled with bots',
  rollDice: 'Roll the dice!',
  rolling: 'Rolling...',
  thinking: 'thinking...',
  yourTurn: 'Your turn!',
  turnOf: 'Turn of',
  extraTurn: 'EXTRA TURN!',
  rolledSix: 'you rolled a 6',
  rolledOne: 'you rolled a 1',
  thirdSix: '3 bonus rolls in a row! Play cancelled',
  tapPiece: 'Tap a glowing piece',
  noMoves: 'No possible moves 😴',
  luckyTitle: 'Lucky dice',
  luckyHint: 'Buy a dice at any moment: it stays ARMED and is used on your next roll (you still roll yourself). 50% chance your number comes up, 50% a lower one (the 1 falls to 2 or 3).',
  luckyEarn: 'Every 6 or 1 earns +1 ⭐ · Each purchase raises every dice price by +1 ⭐',
  luckyArmed: 'armed — it will be used on your next roll',
  luckyReady: 'ready',
  ranking: 'Ranking',
  rankingEmpty: 'No matches recorded yet. Play one and you will show up here!',
  rankingNote: 'Local ranking on this device · 🏆 wins · 🎮 games · 💥 captures · 🏁 pieces home',
  rankPlayer: 'Player',
  rankWins: 'Wins',
  rankGames: 'Games',
  rankKills: 'Captures',
  rankGoals: 'Goals',
  profileTitle: 'My profile',
  profilePoints: 'points',
  profileId: 'ID',
  profilePin: 'PIN',
  profileCode: 'Code',
  profileCodeHint: 'Copy your code and PIN to move your account (name and ⭐) to another device or if your network changes.',
  profileEmpty: 'Play a game with your name to create your profile automatically.',
  profileRestore: 'Recover account',
  profileCodePlaceholder: 'Paste your LP1 code here…',
  profileRestoreBtn: 'Recover',
  profileRestoreOk: 'Account recovered!',
  profileRestoreBad: 'Wrong code or PIN',
  chatTitle: 'Game chat',
  typeMessage: 'Type a message...',
  send: 'Send',
  chatEmpty: 'Say something or send a reaction! 👋',
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
    'Recuerda: el 6 y el 1 dan turno extra 😉',
    'El 6 y el 1 sacan fichas de la base 🚀',
    '¡Capturar da tirada extra! 🎯🎲',
    'Llegar a meta también da otra tirada 🏁🎁',
    'Tres tiradas extra seguidas = pierdes el turno 😱',
    'Las casillas con estrella son refugio ⭐',
    'Consejo: captura a tus amigos, que se frustren 💀',
    'Si pierdes, culpa al WiFi 📶😤',
  ],
  en: [
    'Remember: a 6 or a 1 gives an extra turn 😉',
    'A 6 or a 1 gets a piece out of base 🚀',
    'Capturing grants an extra roll! 🎯🎲',
    'Reaching the goal also grants a roll 🏁🎁',
    'Three bonus rolls in a row = lose your turn 😱',
    'Star squares are safe havens ⭐',
    'Pro tip: capture your friends, let them rage 💀',
    'If you lose, blame the WiFi 📶😤',
  ],
};
