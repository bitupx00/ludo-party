/**
 * Ludo Party — Post-fix Engine Test (position-based detection)
 * Tests 300 turns and detects events by position, not messages.
 */
import { rollDice, calculateNewPosition, canPieceMove, getMovablePieces, movePiece, checkWin, getNextPlayer, createInitialState, createPlayer, createId } from './src/game/gameEngine.ts';

const PLAYERS = ['Ana 🔴', 'Carlos 🔵', 'Diana 🟡', 'Eduardo 🟢'];
let diceRolls: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let totalRolls = 0, totalMoves = 0, captures = 0, entries = 0, hsEntries = 0, homes = 0, extraTurns = 0, threeSixes = 0, noMoveTurns = 0;
let turnNumber = 0, winner: string | null = null;

function log(emoji: string, player: string, action: string, detail = '') {
  const line = `• ${emoji} ${player}: ${action}${detail ? ' → ' + detail : ''}`;
  console.log(line);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function createGameState() {
  const state = createInitialState();
  state.players = [
    createPlayer(createId(), 'Ana', 'red', '🔴', false),
    createPlayer(createId(), 'Carlos', 'blue', '🔵', false),
    createPlayer(createId(), 'Diana', 'yellow', '🟡', false),
    createPlayer(createId(), 'Eduardo', 'green', '🟢', false),
  ];
  state.currentPlayerIndex = 0;
  state.phase = 'rolling';
  state.messages = [{ id: createId(), playerId: 'system', text: '¡¡¡EL JUEGO COMIENZA!!! 🎲🔥', timestamp: Date.now() }];
  return state;
}

(async () => {
  let state: any = createGameState();
  const MAX_TURNS = 300;

  while (turnNumber < MAX_TURNS) {
    turnNumber++;
    const cp = state.players[state.currentPlayerIndex];
    const emoji = cp.emoji;
    const name = cp.name;

    const diceValue = rollDice();
    diceRolls[diceValue]++;
    totalRolls++;
    state = { ...state, diceValue };

    const movable = getMovablePieces(state, diceValue);
    if (movable.length === 0) {
      noMoveTurns++;
      if (turnNumber <= 15) log(emoji, name, `ROLL ${diceValue}`, 'No move');
      state = getNextPlayer(state);
      if (state.consecutiveSixes >= 3) { threeSixes++; log(emoji, name, 'FORFEIT', '🎲🎲🎲'); }
      continue;
    }

    // Smart selection
    let chosen: any = null;
    // Priority: capture > home > enter HS > enter board > furthest
    for (const p of movable) {
      if (p.position === -1) continue;
      const np = calculateNewPosition(p.position, diceValue, cp.color);
      if (np >= 0 && np < 52) {
        for (const opp of state.players) {
          if (opp.color === cp.color) continue;
          for (const op of opp.pieces) { if (op.position === np) { chosen = p; break; } }
          if (chosen) break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) chosen = movable.find(p => calculateNewPosition(p.position, diceValue, cp.color) === 56);
    if (!chosen) chosen = movable.find(p => { const np = calculateNewPosition(p.position, diceValue, cp.color); return np >= 52 && np < 56; });
    if (!chosen) chosen = movable.find(p => p.position === -1);
    if (!chosen) chosen = movable[0];

    const oldPos = chosen.position;
    const oldStr = oldPos === -1 ? '🏠' : oldPos >= 52 ? `🏃HS${oldPos-52}` : `#${oldPos}`;

    state = movePiece(state, chosen.id, diceValue);
    totalMoves++;

    const movedPiece = state.players[state.currentPlayerIndex].pieces.find((p: any) => p.id === chosen.id);
    const newPos = movedPiece.position;
    const newStr = newPos === 56 ? '🏁' : newPos >= 52 ? `🏃HS${newPos-52}` : `#${newPos}`;

    // Event detection by POSITION (not messages!)
    if (oldPos === -1 && newPos >= 0) { entries++; }
    if (oldPos < 52 && newPos >= 52 && newPos < 56) { hsEntries++; log(emoji, name, 'HS_ENTRY', `${oldStr} → ${newStr}`); }
    if (newPos === 56) { homes++; log(emoji, name, 'HOME', `${oldStr} → 🏁!`); }
    
    // Capture detection: check if any opponent piece was sent home
    if (newPos >= 0 && newPos < 52) {
      for (const opp of state.players) {
        if (opp.color === cp.color) continue;
        for (const op of opp.pieces) {
          if (op.position === newPos && op.capturedCount > 0 && state.messages.length > 0) {
            // Check if a new capture message was added
            const lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg && (lastMsg.text.includes('BOOM') || lastMsg.text.includes('dormir'))) {
              captures++;
              if (turnNumber <= 30 || turnNumber % 25 === 0) log(emoji, name, 'CAPTURE', `${oldStr} → ${newStr} 💥`);
            }
          }
        }
      }
    }

    if (turnNumber <= 15) log(emoji, name, 'MOVE', `${oldStr} → ${newStr} (dice=${diceValue})`);

    if (state.phase === 'finished' && state.winner) {
      const wp = state.players.find((p: any) => p.color === state.winner);
      winner = wp ? wp.name : state.winner;
      log('🏆', winner!, 'WIN', `🎉🎉🎉 WINS! 🎉🎉🎉`);
      break;
    }

    const prevIdx = state.currentPlayerIndex;
    state = getNextPlayer(state);
    if (state.currentPlayerIndex === prevIdx && state.consecutiveSixes > 0 && state.consecutiveSixes < 3) {
      extraTurns++;
    }
    if (state.consecutiveSixes >= 3) threeSixes++;
  }

  // Final scores
  console.log('\n📊 FINAL SCOREBOARD:');
  for (const p of state.players) {
    const inHome = p.pieces.filter((pc: any) => pc.position === -1).length;
    const onBoard = p.pieces.filter((pc: any) => pc.position >= 0 && pc.position < 52).length;
    const inHS = p.pieces.filter((pc: any) => pc.position >= 52 && pc.position < 56).length;
    const finished = p.pieces.filter((pc: any) => pc.position === 56).length;
    console.log(`  ${p.emoji} ${p.name}: 🏠${inHome} 🎮${onBoard} 🏃${inHS} 🏁${finished}`);
  }

  console.log(`\n📊 STATS: turns=${turnNumber}, moves=${totalMoves}, captures=${captures}, entries=${entries}, HS_entries=${hsEntries}, homes=${homes}, extras=${extraTurns}, 3x6=${threeSixes}, skips=${noMoveTurns}, winner=${winner || 'none'}`);
  
  const total = Object.values(diceRolls).reduce((a: number, b: number) => a + b, 0);
  console.log(`🎲 Dice: ${Object.entries(diceRolls).map(([v,c]) => `${v}:${c}(${(c/total*100).toFixed(1)}%)`).join(' ')}`);
  
  if (winner) process.exit(0);
  else process.exit(1);
})();
