import { calculateNewPosition } from "./src/game/gameEngine";

// Current WRONG HS entries
const WRONG_HS: Record<string, number> = { red: 50, green: 11, yellow: 24, blue: 38 };
// Correct HS entries
const CORRECT_HS: Record<string, number> = { red: 51, green: 12, yellow: 25, blue: 38 };

function testCalc(pos: number, dice: number, color: string, hsEntry: number) {
  let distToHS: number;
  if (pos <= hsEntry) {
    distToHS = hsEntry - pos;
  } else {
    distToHS = (52 - pos) + hsEntry;
  }
  let result: number;
  if (dice <= distToHS) {
    result = (pos + dice) % 52;
  } else {
    const hsPos = 52 + (dice - distToHS - 1);
    result = hsPos > 56 ? -2 : hsPos;
  }
  const tag = result >= 52 ? 'HS' : result === -2 ? 'BLOCK' : 'board';
  console.log(`  pos=${pos} +${dice} dist=${distToHS} → ${result} (${tag})`);
}

console.log('=== RED: entry=0 ===');
console.log('WRONG (HS_entry=50):');
testCalc(51, 1, 'red', 50);
testCalc(50, 1, 'red', 50);
testCalc(50, 2, 'red', 50);
console.log('CORRECT (HS_entry=51):');
testCalc(51, 1, 'red', 51);
testCalc(50, 2, 'red', 51);
testCalc(51, 2, 'red', 51);

console.log('\n=== GREEN: entry=13 ===');
console.log('WRONG (HS_entry=11):');
testCalc(12, 1, 'green', 11);
testCalc(12, 2, 'green', 11);
console.log('CORRECT (HS_entry=12):');
testCalc(12, 1, 'green', 12);
testCalc(11, 2, 'green', 12);
