import { calculateNewPosition } from "./src/game/gameEngine";

const tests = [
  { color: "red" as const, pos: 51, dice: 1, expect: 52 },
  { color: "red" as const, pos: 51, dice: 6, expect: -2 },
  { color: "green" as const, pos: 12, dice: 1, expect: 52 },
  { color: "yellow" as const, pos: 25, dice: 1, expect: 52 },
  { color: "blue" as const, pos: 38, dice: 1, expect: 52 },
  { color: "red" as const, pos: 50, dice: 2, expect: 52 },
  { color: "red" as const, pos: 55, dice: 1, expect: 56 },
  { color: "red" as const, pos: 55, dice: 2, expect: -2 },
  { color: "green" as const, pos: 11, dice: 2, expect: 52 },
  { color: "blue" as const, pos: 37, dice: 2, expect: 52 },
  // Verify board positions still work
  { color: "red" as const, pos: 0, dice: 3, expect: 3 },
  { color: "red" as const, pos: 49, dice: 1, expect: 50 },
  { color: "red" as const, pos: 50, dice: 1, expect: 51 },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const result = calculateNewPosition(t.pos, t.dice, t.color);
  const ok = result === t.expect;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✅" : "❌"} ${t.color} pos=${t.pos} +${t.dice} = ${result} (expected ${t.expect})`);
}
console.log(`\n${pass}/${tests.length} passed, ${fail} failed`);
