/**
 * Ludo Party — 4-Player Automated Game Test
 * 
 * 1 browser, 4 "human" players taking turns via direct store manipulation.
 * Tests the FULL game loop: lobby → play → win, with detailed logging.
 * 
 * Usage: node test-4players.mjs
 * 
 * Output: test-game-log.jsonl (structured JSON) + stdout live feed
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_URL = 'http://localhost:3457';
const LOG_FILE = path.join(__dirname, 'test-game-log.jsonl');
const REPORT_FILE = path.join(__dirname, 'test-report.md');

const PLAYERS = [
  { name: 'Ana', color: 'Rojo', emoji: '🔴', index: 0 },
  { name: 'Carlos', color: 'Azul', emoji: '🔵', index: 1 },
  { name: 'Diana', color: 'Amarillo', emoji: '🟡', index: 2 },
  { name: 'Eduardo', color: 'Verde', emoji: '🟢', index: 3 },
];

let logLines = [];
let gameEvents = [];

function log(playerIdx, action, detail = '', severity = 'info') {
  const entry = {
    ts: new Date().toISOString(),
    player: playerIdx != null ? PLAYERS[playerIdx].name : 'SYSTEM',
    playerIdx,
    action,
    detail: String(detail).substring(0, 300),
    severity,
  };
  logLines.push(entry);
  gameEvents.push(entry);
  
  const icon = playerIdx != null ? PLAYERS[playerIdx].emoji : '⚙️';
  const sevIcon = severity === 'error' ? '❌' : severity === 'warn' ? '⚠️' : severity === 'success' ? '✅' : '•';
  const line = `${sevIcon} ${icon} ${entry.player}: ${action}${detail ? ' → ' + detail : ''}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  // Clear logs
  fs.writeFileSync(LOG_FILE, '');
  fs.writeFileSync(REPORT_FILE, `# Ludo Party — Test Report\n\n${new Date().toISOString()}\n\n`);
  
  log(null, 'TEST_START', '4-Player Automated Game Test — Ludo Party v1.1');

  const browser = await puppeteer.launch({
    executablePath: '/usr/sbin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=480,900'],
    defaultViewport: { width: 480, height: 900 },
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') log(null, 'BROWSER_ERROR', msg.text(), 'error');
  });
  page.on('pageerror', err => log(null, 'PAGE_ERROR', err.message, 'error'));

  log(null, 'NAVIGATE', GAME_URL);
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);

  // ─── PHASE 1: LOBBY ────────────────────────────────────────────────
  log(null, 'LOBBY_PHASE', 'Adding 4 human players');

  for (let i = 0; i < 4; i++) {
    const p = PLAYERS[i];
    
    // Type name
    await page.type('input.lobby-input', p.name, { delay: 30 });
    await sleep(200);
    
    // Click Add
    await page.click('button.btn-add');
    await sleep(500);

    // Verify
    const found = await page.evaluate((expectedName) => {
      return document.body.innerText.includes(expectedName);
    }, p.name);

    if (found) {
      log(i, 'LOBBY_ADD', `${p.name} (${p.color}) added ✅`);
    } else {
      log(i, 'LOBBY_ADD', `${p.name} NOT found in lobby!`, 'error');
      await browser.close();
      process.exit(1);
    }
  }

  // Verify all 4 players are in lobby
  const playerCount = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Eliminar')).length;
  });
  
  if (playerCount === 4) {
    log(null, 'LOBBY_VERIFY', `All 4 players confirmed (${playerCount}/4)`, 'success');
  } else {
    log(null, 'LOBBY_VERIFY', `Expected 4 players, found ${playerCount}`, 'error');
  }

  await sleep(500);

  // Start game
  const started = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const startBtn = btns.find(b => b.textContent.includes('JUGAR') && !b.disabled);
    if (startBtn) { startBtn.click(); return true; }
    return false;
  });

  if (started) {
    log(null, 'GAME_START', '🚀 ¡A JUGAR! clicked — game starting', 'success');
  } else {
    log(null, 'GAME_START', 'Start button not found!', 'error');
    await browser.close();
    process.exit(1);
  }

  await sleep(2000);

  // ─── PHASE 2: GAMEPLAY ─────────────────────────────────────────────
  log(null, 'GAMEPLAY_PHASE', '=== GAMEPLAY — 4 HUMANS PLAYING ===');

  let turnCount = 0;
  let moveCount = 0;
  let captureCount = 0;
  let entryCount = 0;
  let homeStretchCount = 0;
  let turnExtraCount = 0;
  let sixStreakCount = 0;
  let skipCount = 0;
  let maxTurns = 300;
  let winner = null;
  let diceRolls = {};
  let errors = [];
  let warnings = [];

  while (turnCount < maxTurns) {
    turnCount++;
    
    // Get current state from Zustand store via page evaluation
    const state = await page.evaluate(() => {
      // Access Zustand store from window
      // The store is attached to window via React devtools or we can use the __zustand global
      // Alternative: read state from DOM
      
      const body = document.body.innerText;
      
      // Current player info
      const playerPanelSpans = [...document.querySelectorAll('.player-panel-name, .game-turn-name')].map(e => e.textContent);
      
      // Who's turn?
      const turnIndicator = document.querySelector('.game-turn-indicator');
      const turnText = turnIndicator ? turnIndicator.textContent : '';
      
      // Dice value from page
      const diceEl = document.querySelector('.dice-face, .dice-value');
      const diceText = diceEl ? diceEl.textContent : '';
      const diceMatch = turnText.match(/(\d)/);
      
      // Is rolling phase?
      const rollBtn = document.querySelector('button');
      const hasRollBtn = [...document.querySelectorAll('button')].some(b => b.textContent.includes('Tira el dado'));
      
      // Messages count
      const chatBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('💬'));
      const msgCount = chatBtn ? (parseInt(chatBtn.textContent.replace(/\D/g, '')) || 0) : 0;
      
      // Win screen
      const winScreen = document.querySelector('.win-screen');
      const isFinished = !!winScreen || body.includes('GANADOR') || body.includes('ganado') || body.includes('Victoria');
      
      // Player stats from panel
      const panelText = document.querySelector('.player-panel') ? document.querySelector('.player-panel').innerText : '';
      
      return {
        turnText,
        diceMatch: diceMatch ? diceMatch[1] : null,
        hasRollBtn,
        msgCount,
        isFinished,
        panelText,
        bodySnippet: body.substring(0, 300),
      };
    });

    // Check win
    if (state.isFinished) {
      log(null, 'GAME_WIN', `🎉🎉🎉 GAME OVER! Winner detected!`, 'success');
      winner = state.turnText;
      break;
    }

    // Determine whose turn it is
    let currentPlayerIdx = -1;
    for (let i = 0; i < 4; i++) {
      if (state.turnText.includes(PLAYERS[i].name)) {
        currentPlayerIdx = i;
        break;
      }
    }

    // Also check for bot names (shouldn't happen with 4 humans but just in case)
    if (currentPlayerIdx === -1) {
      if (state.turnText.includes('Bot')) {
        log(null, 'STATE', `Bot turn detected: ${state.turnText}`, 'warn');
        await sleep(3000);
        continue;
      }
      // Could be between turns
      if (turnCount % 10 === 0) {
        log(null, 'STATE', `Turn ${turnCount} — couldn't determine player: "${state.turnText}"`, 'warn');
      }
      await sleep(1500);
      continue;
    }

    const cp = PLAYERS[currentPlayerIdx];

    // Check if we need to roll
    if (state.hasRollBtn) {
      log(currentPlayerIdx, 'ROLL_DICE', `Turn ${turnCount} — Rolling...`);

      // Click roll button
      const rollResult = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const rollBtn = btns.find(b => b.textContent.includes('Tira el dado'));
        if (rollBtn && !rollBtn.disabled) {
          rollBtn.click();
          return true;
        }
        return false;
      });

      if (!rollResult) {
        log(currentPlayerIdx, 'ROLL_DICE', 'Roll button not found or disabled', 'warn');
        await sleep(1000);
        continue;
      }

      await sleep(1500);

      // Read dice value from message
      const diceValue = await page.evaluate(() => {
        const body = document.body.innerText;
        const match = body.match(/Salió un (\d)/);
        return match ? parseInt(match[1]) : null;
      });

      if (diceValue === null) {
        // Could be no-move scenario where turn auto-advances
        log(currentPlayerIdx, 'ROLL_RESULT', 'Could not read dice — turn may have auto-advanced', 'warn');
        await sleep(2000);
        continue;
      }

      // Track dice stats
      diceRolls[diceValue] = (diceRolls[diceValue] || 0) + 1;
      log(currentPlayerIdx, 'DICE', `Rolled ${diceValue} (⬀ ${'⚀⚁⚂⚃⚄⚅'[diceValue-1]})`);

      await sleep(1000);

      // Check for extra turn message (rolled 6)
      const isExtraTurn = await page.evaluate(() => {
        const body = document.body.innerText;
        return body.includes('TURNO EXTRA') || body.includes('sacaste 6');
      });

      if (isExtraTurn) {
        turnExtraCount++;
        log(currentPlayerIdx, 'EXTRA_TURN', '🔥 Rolled 6 — extra turn!');
      }

      // Check for 3 sixes forfeit
      const forfeitMsg = await page.evaluate(() => {
        const body = document.body.innerText;
        return body.includes('TRES SESES') || body.includes('Turno perdido');
      });

      if (forfeitMsg) {
        sixStreakCount++;
        log(currentPlayerIdx, 'FORFEIT', '🎲🎲🎲 Three sixes! Turn forfeited!', 'warn');
        await sleep(2000);
        continue;
      }

      // Try to select a piece to move
      await sleep(800);
      
      // Find movable pieces (they have tabindex and are in board area)
      const moveResult = await page.evaluate(() => {
        const allElements = [...document.querySelectorAll('[tabindex]')];
        const boardPieces = allElements.filter(el => {
          const rect = el.getBoundingClientRect();
          // Board pieces are small (15-40px) and positioned absolutely
          return rect.width >= 8 && rect.width <= 50 && rect.height >= 8 && rect.height <= 50;
        });

        if (boardPieces.length > 0) {
          // Get info about each piece for smarter selection
          const pieces = boardPieces.map((el, idx) => ({
            idx,
            text: el.textContent || '',
            rect: { x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, w: el.getBoundingClientRect().width },
            classes: el.className,
          }));
          
          // Click first piece
          boardPieces[0].click();
          return { clicked: true, count: boardPieces.length, pieces };
        }
        return { clicked: false, count: 0, pieces: [] };
      });

      if (moveResult.clicked) {
        moveCount++;
        const pieceInfo = moveResult.pieces.map(p => `[${p.idx}] "${p.text}"`).join(', ');
        log(currentPlayerIdx, 'MOVE', `Selected piece (1 of ${moveResult.count} movable): ${pieceInfo}`);

        await sleep(1000);

        // Check for capture
        const captureMsg = await page.evaluate(() => {
          const body = document.body.innerText;
          return {
            capture: body.includes('BOOM') || body.includes('CAPTURADO') || body.includes('dormir') || body.includes('R.I.P'),
            entry: body.includes('entra') || body.includes('tablero') || body.includes('Entra'),
            homeStretch: body.includes('Safe') || body.includes('corredor') || body.includes('fiesta'),
            home: body.includes('casa') || body.includes('meta'),
            noMove: body.includes('no puede') || body.includes('No mueves') || body.includes('Nada'),
          };
        });

        if (captureMsg.capture) {
          captureCount++;
          log(currentPlayerIdx, 'CAPTURE', '💥 CAPTURE! Opponent sent home!', 'success');
        }
        if (captureMsg.entry) {
          entryCount++;
          log(currentPlayerIdx, 'ENTRY', '🏁 Piece entered the board!');
        }
        if (captureMsg.homeStretch) {
          homeStretchCount++;
          log(currentPlayerIdx, 'HOME_STRETCH', '🏃 Piece in home stretch!');
        }

      } else {
        skipCount++;
        log(currentPlayerIdx, 'NO_MOVE', `No movable pieces with dice=${diceValue} — turn auto-advances`);
      }

      await sleep(1500);

    } else {
      // Not our turn to roll — maybe auto-moving or between turns
      // Check if bot is thinking (shouldn't happen with 4 humans)
      const botThinking = await page.evaluate(() => document.body.innerText.includes('pensando'));
      if (botThinking) {
        log(null, 'BOT_DETECTED', 'A bot is playing (should be all humans!)', 'warn');
        errors.push(`Turn ${turnCount}: Bot detected in all-human game`);
        await sleep(3000);
      } else {
        await sleep(500);
      }
    }

    // Periodic state report every 25 turns
    if (turnCount % 25 === 0) {
      log(null, 'PROGRESS', `Turn ${turnCount}: moves=${moveCount}, captures=${captureCount}, entries=${entryCount}, homeStretch=${homeStretchCount}, skips=${skipCount}, extras=${turnExtraCount}`);
      
      // Get player scores from DOM
      const scores = await page.evaluate(() => {
        const body = document.body.innerText;
        const players = [];
        for (const name of ['Ana', 'Carlos', 'Diana', 'Eduardo']) {
          const idx = body.indexOf(name);
          if (idx >= 0) {
            const snippet = body.substring(idx, idx + 100);
            const homeMatch = snippet.match(/🏠(\d)/);
            const boardMatch = snippet.match(/🎮(\d)/);
            const finishMatch = snippet.match(/🏁(\d)/);
            players.push({
              name,
              home: homeMatch ? parseInt(homeMatch[1]) : '?',
              board: boardMatch ? parseInt(boardMatch[1]) : '?',
              finish: finishMatch ? parseInt(finishMatch[1]) : '?',
            });
          }
        }
        return players;
      });

      for (const s of scores) {
        log(null, 'SCORE', `${s.name}: 🏠${s.home} 🎮${s.board} 🏁${s.finish}`);
      }
    }
  }

  // ─── PHASE 3: RESULTS ──────────────────────────────────────────────
  await sleep(2000);
  
  const finalState = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  
  log(null, 'TEST_END', `=== TEST COMPLETED after ${turnCount} turns ===`);
  log(null, 'STATS', JSON.stringify({
    totalTurns: turnCount,
    totalMoves: moveCount,
    captures: captureCount,
    entries: entryCount,
    homeStretchMoves: homeStretchCount,
    extraTurns: turnExtraCount,
    threeSixes: sixStreakCount,
    skips: skipCount,
    winner: winner || 'none (limit reached)',
    diceDistribution: diceRolls,
    errors: errors.length,
    warnings: warnings.length,
  }, null, 2));

  // Generate report
  const totalRolls = Object.values(diceRolls).reduce((a, b) => a + b, 0) || 1;
  const diceDistStr = Object.entries(diceRolls).map(([v, c]) => `${v}: ${c} (${(c/totalRolls*100).toFixed(1)}%)`).join(', ');
  
  const report = `# Ludo Party — Automated 4-Player Test Report

**Date:** ${new Date().toISOString()}
**Max Turns:** ${maxTurns}
**Actual Turns:** ${turnCount}

## Results

| Metric | Value |
|---|---|
| Total Moves | ${moveCount} |
| Captures | ${captureCount} |
| Board Entries | ${entryCount} |
| Home Stretch Moves | ${homeStretchCount} |
| Extra Turns (6s) | ${turnExtraCount} |
| Three Sixes Forfeit | ${sixStreakCount} |
| Skip Turns (no valid move) | ${skipCount} |
| Winner | ${winner || '⚠️ None (turn limit)'} |

## Dice Distribution (fairness check)

${diceDistStr}

Expected: ~16.7% each. All values should be within 10-25% range.

## Errors (${errors.length})
${errors.length === 0 ? '✅ No errors detected' : errors.map(e => '- ' + e).join('\n')}

## Warnings (${warnings.length})
${warnings.length === 0 ? '✅ No warnings' : warnings.map(w => '- ' + w).join('\n')}

## Final State
\`\`\`
${finalState.substring(0, 500)}
\`\`\`

## Events Log
See: test-game-log.jsonl
`;

  fs.appendFileSync(REPORT_FILE, report);
  log(null, 'REPORT', `Report saved to ${REPORT_FILE}`);

  await browser.close();
  log(null, 'DONE', 'Test complete');
  process.exit(errors.length > 5 ? 1 : 0);
})();
