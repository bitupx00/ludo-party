/**
 * Ludo Party — Test Harness con Puppeteer
 * Controla el juego via browser automation y reporta todas las jugadas.
 * Uso: node test-harness.mjs <playerIndex 0-3>
 *
 * Cada agente (player) se conecta a http://localhost:3457
 * con un nombre y color asignado. Espera su turno, tira el dado,
 * selecciona la mejor ficha, y reporta todo a un log compartido.
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const PLAYER_NAMES = ['Ana 🔴', 'Carlos 🔵', 'Diana 🟡', 'Eduardo 🟢'];
const PLAYER_COLORS = ['Rojo', 'Azul', 'Amarillo', 'Verde'];
const PLAYER_EMOJIS = ['🔴', '🔵', '🟡', '🟢'];
const GAME_URL = 'http://localhost:3457';
const LOG_FILE = path.join(process.cwd(), 'test-game-log.jsonl');
const ACTION_LOG = path.join(process.cwd(), 'test-actions-log.txt');

const PLAYER_INDEX = parseInt(process.argv[2] || '0', 10);
const IS_FIRST = PLAYER_INDEX === 0;
const MY_NAME = PLAYER_NAMES[PLAYER_INDEX];
const MY_COLOR = PLAYER_COLORS[PLAYER_INDEX];
const MY_EMOJI = PLAYER_EMOJIS[PLAYER_INDEX];

function log(action, detail = '') {
  const entry = {
    ts: new Date().toISOString(),
    player: PLAYER_INDEX,
    name: MY_NAME,
    action,
    detail,
  };
  const line = JSON.stringify(entry);
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(`${MY_EMOJI} ${MY_NAME}: ${action}${detail ? ' — ' + detail : ''}`);
  // Also write to human-readable log
  const readable = `[${entry.ts}] ${MY_EMOJI} ${MY_NAME} | ${action}${detail ? ' | ' + detail : ''}`;
  fs.appendFileSync(ACTION_LOG, readable + '\n');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Wait for an element matching the selector to appear (with timeout)
async function waitForSelector(page, selector, timeout = 30000) {
  await page.waitForSelector(selector, { timeout, visible: true });
}

// Wait for text content to appear anywhere on the page
async function waitForText(page, text, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes(text)) return true;
    await sleep(300);
  }
  throw new Error(`Timeout waiting for text: "${text}"`);
}

// Read the current game state from the page
async function getGameState(page) {
  return await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    // Check phase
    const phase = bodyText.includes('Tira el dado') ? 'rolling' :
                  bodyText.includes('selecciona') || bodyText.includes('moviendo') ? 'moving' :
                  bodyText.includes('JUEGO COMIENZA') || bodyText.includes('jugando') ? 'playing' :
                  'unknown';

    // Check who's turn it is
    const turnMatch = bodyText.match(/(\S+)\s*Tira el dado/i) || 
                      bodyText.match(/(\S+)\s*pensando/i) ||
                      bodyText.match(/(\S+)\s*🎲/);

    // Get dice value
    const diceMatch = bodyText.match(/Salió un (\d)/i);
    const diceValue = diceMatch ? parseInt(diceMatch[1]) : null;

    // Get player stats
    const stats = {};
    const statLines = bodyText.match(/(🏠\d+)/g) || [];
    
    return { phase, diceValue, turnMatch: turnMatch ? turnMatch[0] : null, bodySnippet: bodyText.substring(0, 500) };
  });
}

// Count messages in chat
async function getMessageCount(page) {
  return await page.evaluate(() => {
    const chatBtn = document.querySelector('button');
    const allBtns = [...document.querySelectorAll('button')];
    const chatBtnEl = allBtns.find(b => b.textContent.includes('💬'));
    const count = chatBtnEl ? parseInt(chatBtnEl.textContent.replace(/\D/g, '') || '0') : 0;
    return count;
  });
}

// Check if it's my turn by looking for my name + "Tira el dado"
async function isMyTurn(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  return bodyText.includes(MY_NAME.split(' ')[0]) && (bodyText.includes('Tira el dado') || bodyText.includes('🎲 ¡Tira el dado!'));
}

// Check if game is finished (win screen)
async function isGameFinished(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  return bodyText.includes('GANADOR') || bodyText.includes('¡Ganaste') || 
         bodyText.includes(' Victoria') || bodyText.includes('otra vez') ||
         bodyText.includes('JUGAR DE NUEVO');
}

// Check if it's a bot thinking
async function isBotThinking(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  return bodyText.includes('pensando');
}

(async () => {
  log('INIT', `Arrancando como Jugador ${PLAYER_INDEX} (${MY_NAME})`);

  // Clear logs if first player
  if (IS_FIRST) {
    fs.writeFileSync(LOG_FILE, '');
    fs.writeFileSync(ACTION_LOG, `=== LUDO PARTY TEST SESSION ${new Date().toISOString()} ===\n`);
  }

  const browser = await puppeteer.launch({
    executablePath: '/usr/sbin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=400,800'],
    defaultViewport: { width: 400, height: 800 },
  });

  const page = await browser.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log('PAGE_ERROR', msg.text());
    }
  });

  log('NAVIGATE', `Abriendo ${GAME_URL}`);
  await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2000);

  // Phase 1: LOBBY — wait for page to load, then add name
  log('LOBBY', 'Page loaded, entering name');

  // Wait for the input field
  await waitForSelector(page, 'input.lobby-input');
  await sleep(500);

  // Type name
  const nameOnly = MY_NAME.split(' ')[0]; // "Ana", "Carlos", etc.
  await page.click('input.lobby-input');
  await page.keyboard.type(nameOnly, { delay: 50 });
  await sleep(300);

  // Click Add button
  await page.click('button.btn-add');
  log('LOBBY', `Added player "${nameOnly}"`);
  await sleep(1000);

  // Verify player was added
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes(nameOnly)) {
    log('LOBBY', `✅ Player "${nameOnly}" confirmed in lobby`);
  } else {
    log('LOBBY', `❌ ERROR: Player "${nameOnly}" NOT found in lobby!`);
    await browser.close();
    process.exit(1);
  }

  // If NOT first player, wait for others to join (first player starts the game)
  if (!IS_FIRST) {
    log('LOBBY', `Waiting for other players... (${PLAYER_INDEX + 1} total needed)`);
    // We'll wait — the first player will click "JUGAR" 
    // But since all 4 agents run simultaneously, we need a sync mechanism
    await sleep(3000 + PLAYER_INDEX * 1000);
  }

  // First player: add bots to fill remaining slots then start
  if (IS_FIRST) {
    log('LOBBY', 'I am the first player. Filling with bots...');
    
    // Click "Add bot" until we have 4 players
    for (let i = 0; i < 3; i++) {
      const botBtn = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const botBtn = btns.find(b => b.textContent.includes('Añadir bot'));
        if (botBtn) { botBtn.click(); return true; }
        return false;
      });
      if (botBtn) {
        log('LOBBY', `Added bot ${i + 1}`);
        await sleep(500);
      } else {
        log('LOBBY', `No more bot slots`);
        break;
      }
    }
    await sleep(1000);

    // Verify 4 players
    const playerCount = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const removeBtns = btns.filter(b => b.textContent.includes('Eliminar'));
      return removeBtns.length;
    });
    log('LOBBY', `Total players in lobby: ${playerCount}`);

    // Click Start Game
    const startBtn = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const startBtn = btns.find(b => b.textContent.includes('JUGAR') && !b.disabled);
      if (startBtn) { startBtn.click(); return true; }
      return false;
    });
    if (startBtn) {
      log('GAME_START', '🎉 Clicked ¡A JUGAR!');
    } else {
      log('GAME_START', '❌ ERROR: Start button not found or disabled!');
      await browser.close();
      process.exit(1);
    }
    await sleep(2000);
  }

  // All non-first players need to wait for game to start
  // (they'll see the game view since it's the same state in all browser instances)
  if (!IS_FIRST) {
    // Wait for game phase — look for dice or board
    log('WAITING', 'Waiting for game to start...');
    let gameStarted = false;
    for (let i = 0; i < 30; i++) {
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('Tira el dado') || text.includes('COMIENZA') || text.includes('Dados') || text.includes('⚀')) {
        gameStarted = true;
        break;
      }
      await sleep(1000);
    }
    if (!gameStarted) {
      log('WAITING', '⚠️ Game did not start in expected time, proceeding anyway');
    } else {
      log('GAME_START', '✅ Game started!');
    }
  } else {
    log('GAME_START', '✅ Game started!');
    await sleep(2000);
  }

  // PHASE 2: GAMEPLAY — take turns
  log('GAMEPLAY', '=== GAMEPLAY PHASE ===');
  
  let totalMoves = 0;
  let myMoves = 0;
  let turnsSkipped = 0;
  let maxTurns = 200; // Safety limit
  let turnNumber = 0;

  while (turnNumber < maxTurns) {
    turnNumber++;
    await sleep(1500);

    // Check if game finished
    if (await isGameFinished(page)) {
      log('GAME_OVER', '🎉🎉🎉 GAME FINISHED!');
      const finalText = await page.evaluate(() => document.body.innerText.substring(0, 800));
      log('GAME_OVER', `Final screen text: ${finalText.substring(0, 200)}`);
      break;
    }

    const state = await getGameState(page);
    log('STATE', `Turn ${turnNumber} | dice=${state.diceValue} | phase=${state.phase}`);

    // Check if it's my turn
    if (await isMyTurn(page)) {
      myMoves++;
      log('MY_TURN', `🎲 Rolling dice...`);

      // Click the roll dice button
      const rolled = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const diceBtn = btns.find(b => b.textContent.includes('Tira el dado'));
        if (diceBtn) { diceBtn.click(); return true; }
        return false;
      });

      if (!rolled) {
        log('MY_TURN', '❌ Could not find dice button');
        await sleep(2000);
        continue;
      }

      await sleep(1500);

      // Read dice value
      const afterRoll = await getGameState(page);
      log('DICE_ROLL', `Got dice value: ${afterRoll.diceValue}`);

      if (!afterRoll.diceValue) {
        log('DICE_ROLL', '⚠️ Could not read dice value, continuing...');
        await sleep(2000);
        continue;
      }

      // Check if we need to select a piece (wait for movable pieces)
      await sleep(1000);

      // Try to select a movable piece
      const pieceSelected = await page.evaluate(() => {
        // Find clickable pieces (they have cursor:pointer and are in the board area)
        const pieces = document.querySelectorAll('[style*="cursor: pointer"], [tabindex]');
        const boardPieces = [...pieces].filter(el => {
          // Must be inside the board area
          const rect = el.getBoundingClientRect();
          return rect.width > 10 && rect.width < 60 && rect.height > 10 && rect.height < 60;
        });
        
        if (boardPieces.length > 0) {
          // Click the first available piece
          boardPieces[0].click();
          return { clicked: true, count: boardPieces.length };
        }
        return { clicked: false, count: 0 };
      });

      if (pieceSelected.clicked) {
        log('MOVE', `✅ Selected piece (1 of ${pieceSelected.count} movable)`);
        totalMoves++;
      } else {
        // No movable pieces — turn will auto-advance
        log('NO_MOVE', `Cannot move any piece with dice=${afterRoll.diceValue}`);
        turnsSkipped++;
      }

      await sleep(1500);

    } else if (await isBotThinking(page)) {
      log('BOT_TURN', '🤖 A bot is thinking...');
      await sleep(3000);
    } else {
      // It's another human player's turn (or we're waiting)
      const currentText = await page.evaluate(() => {
        const body = document.body.innerText;
        // Find who's turn it is
        const turnLine = body.match(/([A-Z][a-z]+).*(?:Tira el dado|🎲)/);
        return turnLine ? turnLine[0] : 'unknown turn';
      });
      log('WAIT', `Waiting... ${currentText}`);
      await sleep(2000);
    }
  }

  if (turnNumber >= maxTurns) {
    log('LIMIT', `⚠️ Reached turn limit (${maxTurns}). Ending test.`);
  }

  // Final state capture
  const finalState = await getGameState(page);
  log('FINAL', JSON.stringify(finalState, null, 2));

  // Summary
  log('SUMMARY', `Total turns observed: ${turnNumber} | My moves: ${myMoves} | Total piece moves: ${totalMoves} | Skipped turns: ${turnsSkipped}`);

  await browser.close();
  log('DONE', 'Browser closed');
  process.exit(0);
})();
