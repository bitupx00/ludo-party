import { calculateNewPosition } from "./src/game/gameEngine";
import { HOME_STRETCH_ENTRY, COLOR_CONFIG } from "./src/game/types";

// Simulate: Red piece at position 49, rolling various dice
// With correct HS_entry=51, position 49 + 3 = 52 (HS)
// But the issue might be the entry detection

// Let's trace a red piece going from pos 49 forward
console.log("=== Red piece at pos 49 ===");
for (let dice = 1; dice <= 6; dice++) {
  const newPos = calculateNewPosition(49, dice, "red");
  const tag = newPos >= 52 ? "HS!" : newPos === -2 ? "BLOCK" : "board";
  console.log(`  +${dice} → ${newPos} (${tag})`);
}

console.log("\n=== Red piece at pos 50 ===");
for (let dice = 1; dice <= 6; dice++) {
  const newPos = calculateNewPosition(50, dice, "red");
  const tag = newPos >= 52 ? "HS!" : newPos === -2 ? "BLOCK" : "board";
  console.log(`  +${dice} → ${newPos} (${tag})`);
}

console.log("\n=== Red piece at pos 51 ===");
for (let dice = 1; dice <= 6; dice++) {
  const newPos = calculateNewPosition(51, dice, "red");
  const tag = newPos >= 52 ? "HS!" : newPos === -2 ? "BLOCK" : "board";
  console.log(`  +${dice} → ${newPos} (${tag})`);
}

// The problem: HS_entry = 51. From pos 51, distToHS = 0. So ANY dice > 0 enters HS.
// pos=51 +1 → 52, pos=51 +2 → 53, pos=51 +3 → 54, pos=51 +4 → 55, pos=51 +5 → 56, pos=51 +6 → -2
// This looks correct!

// Wait — let me check: can pieces REACH position 51 as red?
// Red enters at 0, goes clockwise: 0→1→2→...→51 (full loop)
// To get to 51 from 0, need to travel 51 squares. That's many turns.
// But after entering, pieces start at 0 and go forward.
// The issue might be that pieces keep circling past their HS entry!

// Actually wait: the logic says steps <= distToHS means stay on board.
// For red at pos 0, HS_entry = 51:
// distToHS = 51 - 0 = 51
// So rolling any dice (1-6) gives steps (1-6) <= 51, stays on board
// From pos 50: distToHS = 1. Steps > 1 enters HS. So need dice 2+ from pos 50.
// From pos 51: distToHS = 0. Steps > 0 enters HS. So any dice enters HS.

// This is correct! But why 0 home stretches in 500 turns?

// Maybe pieces don't reach pos 50/51 often enough in 500 turns.
// Let's check: average piece needs to travel ~51 squares around the board.
// With average dice of 3.5, that's ~14-15 rolls per piece to go full circle.
// 500 turns / 4 players = 125 rolls per player.
// So each player should get ~125 rolls, and pieces could complete ~8 full loops.
// But captures send pieces home (-1), which resets progress!

// Let me check: the test only logs home stretch when:
// oldPos < 52 and newPos >= 52
// But in the test code, I check isHomeStretch by looking at the last message.
// The issue might be that the game engine doesn't emit a special message for entering HS.

console.log("\n=== Checking: what happens when piece enters HS ===");
// In movePiece: newPos >= 52, no capture check (correct)
// But there's no special message for entering HS.
// The test only detects HS via message text, which has no HS-specific keyword!

// Solution: the home stretch detection in the test was wrong!
// Fix the test to check positions instead of messages.
