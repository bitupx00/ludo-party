import { calculateNewPosition } from "./src/game/gameEngine";

// Ludo Club convention: HS entries — red 50, blue 11, yellow 24, green 37.
// Lane cells are 52-56 (5 squares) and the GOAL is its own extra step (57).
const tests = [
  { color: "red" as const, pos: 50, dice: 1, expect: 52 },
  { color: "red" as const, pos: 50, dice: 6, expect: 57 }, // exact landing on the goal
  { color: "red" as const, pos: 50, dice: 7 as number, expect: -2 }, // overshoot (theoretical)
  { color: "blue" as const, pos: 11, dice: 1, expect: 52 },
  { color: "yellow" as const, pos: 24, dice: 1, expect: 52 },
  { color: "green" as const, pos: 37, dice: 1, expect: 52 },
  { color: "red" as const, pos: 49, dice: 2, expect: 52 },
  { color: "red" as const, pos: 55, dice: 1, expect: 56 },
  { color: "red" as const, pos: 55, dice: 2, expect: 57 }, // last lane cell → goal
  { color: "red" as const, pos: 55, dice: 3, expect: -2 }, // overshoots the goal
  { color: "red" as const, pos: 53, dice: 4, expect: 57 }, // "faltan 4 casillas" → needs a 4
  { color: "red" as const, pos: 53, dice: 3, expect: 56 }, // a 3 only reaches the last lane cell
  { color: "blue" as const, pos: 10, dice: 2, expect: 52 },
  { color: "green" as const, pos: 36, dice: 2, expect: 52 },
  // Verify board positions still work
  { color: "red" as const, pos: 0, dice: 3, expect: 3 },
  { color: "red" as const, pos: 48, dice: 1, expect: 49 },
  { color: "green" as const, pos: 40, dice: 3, expect: 43 },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const result = calculateNewPosition(t.pos, t.dice, t.color);
  const ok = result === t.expect;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✅" : "❌"} ${t.color} pos=${t.pos} +${t.dice} = ${result} (expected ${t.expect})`);
}
console.log(`\n${pass}/${tests.length} passed, ${fail} failed`);
