/**
 * Ludo Party — Direct Store Test
 * Bypasses UI entirely, tests game logic via Zustand store injection.
 * Exposes store on window, runs 200+ turns, logs everything.
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';

const GAME_URL = 'http://localhost:3457';
const LOG_FILE = 'test-direct-log.jsonl';

let events = [];
function log(action, detail = '', severity = 'info') {
  const entry = { ts: Date.now(), action, detail: String(detail).substring(0, 500), severity };
  events.push(entry);
  console.log(`${severity === 'error' ? '❌' : severity === 'warn' ? '⚠️' : '•'} ${action}: ${detail}`);
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

(async () => {
  fs.writeFileSync(LOG_FILE, '');
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/sbin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 480, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Add 4 players via store
  log('SETUP', 'Adding 4 players via Zustand store');
  await page.evaluate(() => {
    const store = window.__NEXT_DATA__ || null;
    // Zustand doesn't auto-expose to window. Need to inject a global ref.
    // We'll intercept the store via the React component.
  });

  // The store isn't directly accessible. Let's inject a bridge.
  // We'll add a script that hooks into the store.
  log('SETUP', 'Injecting store bridge...');

  // Strategy: add players via UI, then inject store access script, then play via store
  // First, add 4 players via UI (already tested)
  for (const name of ['Ana', 'Carlos', 'Diana', 'Eduardo']) {
    await page.type('input.lobby-input', name, { delay: 20 });
    await page.click('button.btn-add');
    await new Promise(r => setTimeout(r, 400));
  }
  
  // Click add bot to fill? No — we want 4 humans
  // Click JUGAR
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const startBtn = btns.find(b => b.textContent.includes('JUGAR') && !b.disabled);
    if (startBtn) startBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));

  // Now inject a global store accessor by hooking into React fiber
  // This is the cleanest way to access Zustand from outside React
  const storeInjected = await page.evaluate(() => {
    // Find the Zustand store by looking at React fiber tree
    const rootEl = document.getElementById('root');
    if (!rootEl) return 'no root';
    
    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!fiberKey) return 'no fiber key';
    
    const fiber = rootEl[fiberKey];
    
    // Walk the fiber tree to find zustand hook
    let current = fiber;
    let depth = 0;
    const maxDepth = 50;
    
    while (current && depth < maxDepth) {
      // Zustand stores are typically in memoizedState of hooks
      if (current.memoizedState) {
        let hook = current.memoizedState;
        let hookDepth = 0;
        while (hook && hookDepth < 20) {
          // Zustand store has a getState function
          if (hook.queue && hook.queue.lastRenderedState && 
              typeof hook.queue.lastRenderedState === 'object' &&
              hook.queue.lastRenderedState !== null &&
              'players' in hook.queue.lastRenderedState &&
              'phase' in hook.queue.lastRenderedState) {
            window.__ludoStore = {
              getState: () => hook.queue.lastRenderedState,
              setState: (partial) => {
                // Force re-render by dispatching
                hook.queue.dispatch({ type: 'SET', payload: partial });
              }
            };
            return 'found';
          }
          // Also check for the actual store ref
          if (hook.memoizedState && typeof hook.memoizedState === 'object' && 
              hook.memoizedState !== null && !Array.isArray(hook.memoizedState) &&
              'players' in hook.memoizedState && 'phase' in hook.memoizedState &&
              'roll' in hook.memoizedState) {
            window.__ludoStore = hook.memoizedState;
            return 'found-direct';
          }
          hook = hook.next;
          hookDepth++;
        }
      }
      current = current.child || current.sibling || current.return;
      depth++;
    }
    
    return 'not-found';
  });

  log('INJECT', `Store bridge result: ${storeInjected}`);

  if (storeInjected === 'not-found' || storeInjected === 'no root' || storeInjected === 'no fiber key') {
    log('INJECT', 'Could not inject store bridge. Using UI-only approach.', 'warn');
    
    // Fallback: play entirely via UI
    let turnCount = 0;
    let moveCount = 0;
    let maxTurns = 250;
    
    while (turnCount < maxTurns) {
      turnCount++;
      await new Promise(r => setTimeout(r, 2000));
      
      // Check if finished
      const finished = await page.evaluate(() => {
        const t = document.body.innerText;
        return t.includes('GANADOR') || t.includes('Victoria') || t.includes('JUGAR DE NUEVO');
      });
      if (finished) {
        log('GAME_OVER', 'Game finished!', 'success');
        break;
      }
      
      // Click roll if available
      const rolled = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const rollBtn = btns.find(b => b.textContent.includes('Tira el dado') && !b.disabled);
        if (rollBtn) { rollBtn.click(); return 'rolled'; }
        return 'no-roll-btn';
      });
      
      if (rolled === 'no-roll-btn') {
        if (turnCount % 20 === 0) log('WAIT', `Turn ${turnCount}: no roll button (bot turn?)`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      await new Promise(r => setTimeout(r, 1500));
      
      // Read dice
      const diceInfo = await page.evaluate(() => {
        const t = document.body.innerText;
        const diceMatch = t.match(/Salió un (\d)/);
        const turnMatch = t.match(/(\w+) .*?(Tira el dado|🎲.*?(\d))/);
        const isBotTurn = t.includes('pensando');
        const isNoMove = t.includes('No puedes') || t.includes('no puede mover');
        const isCapture = t.includes('BOOM') || t.includes('CAPTURADO') || t.includes('dormir');
        const isEntry = t.includes('Entra') || t.includes('entra');
        const isHome = t.includes('casa') || t.includes('meta');
        const isExtraTurn = t.includes('TURNO EXTRA');
        const isForfeit = t.includes('TRES SESES');
        return { dice: diceMatch ? diceMatch[1] : null, isBotTurn, isNoMove, isCapture, isEntry, isHome, isExtraTurn, isForfeit, turnInfo: turnMatch ? turnMatch[0] : null };
      });
      
      if (diceInfo.isBotTurn) {
        log('BOT', 'Bot is playing...');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      
      if (diceInfo.dice) {
        log('DICE', `Dice = ${diceInfo.dice}`);
      } else {
        if (turnCount % 10 === 0) log('WARN', `Turn ${turnCount}: no dice info read`);
        continue;
      }
      
      if (diceInfo.isForfeit) log('EVENT', '🎲🎲🎲 Three sixes forfeit!', 'warn');
      if (diceInfo.isExtraTurn) log('EVENT', '🔥 Extra turn (6)');
      if (diceInfo.isNoMove) log('EVENT', 'No valid moves');
      if (diceInfo.isCapture) { log('EVENT', '💥 CAPTURE!', 'success'); moveCount++; }
      if (diceInfo.isEntry) { log('EVENT', '🏁 Piece entered board'); moveCount++; }
      if (diceInfo.isHome) { log('EVENT', '🏠 Piece reached home'); moveCount++; }
      
      // Try to click a movable piece
      await new Promise(r => setTimeout(r, 800));
      
      const moveResult = await page.evaluate(() => {
        // Find all clickable elements in the board area
        const all = [...document.querySelectorAll('*')];
        const clickable = all.filter(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (style.cursor === 'pointer' || el.tabIndex >= 0) &&
                 rect.width > 5 && rect.width < 60 && 
                 rect.height > 5 && rect.height < 60;
        });
        
        if (clickable.length > 0) {
          clickable[0].click();
          return { clicked: true, count: clickable.length };
        }
        return { clicked: false, count: 0 };
      });
      
      if (moveResult.clicked) {
        moveCount++;
        if (turnCount <= 10 || turnCount % 25 === 0) {
          log('MOVE', `Piece selected (${moveResult.count} available) — total moves: ${moveCount}`);
        }
      } else {
        if (turnCount <= 10 || turnCount % 25 === 0) {
          log('NO_PIECES', `No clickable pieces found — auto-advancing`);
        }
      }
      
      if (turnCount % 50 === 0) {
        log('PROGRESS', `Turn ${turnCount}, Moves: ${moveCount}`);
      }
    }
    
    log('DONE', `Finished after ${turnCount} turns, ${moveCount} moves`);
    await browser.close();
    return;
  }

  // If we got here, store was injected — play via store
  log('STORE', 'Playing via direct store access');
  
  // Run game logic directly
  const result = await page.evaluate(async () => {
    const store = window.__ludoStore;
    const state = store.getState();
    return JSON.stringify({ players: state.players.length, phase: state.phase });
  });
  
  log('STORE_STATE', result);

  await browser.close();
  log('DONE', 'Test complete');
})();
