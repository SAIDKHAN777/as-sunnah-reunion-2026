import { counterCurve } from '../src/scripts/curve.ts';

const GROUND_TRUTH = [
  0, 1258, 2442, 3533, 4510, 5353, 6044, 6562, 6887, 7000,
  6902, 6633, 6225, 5714, 5134, 4519, 3905, 3324, 2813, 2404,
  2134, 2035, 2034, 2033, 2032, 2032, 2031, 2031, 2031, 2030,
  2029, 2029, 2028, 2027, 2027, 2026, 2026, 2026
];

console.log('=== PCHIP Ground Truth Table Unit Test ===');
let maxDiff = 0;
let passed = true;

for (let i = 0; i < GROUND_TRUTH.length; i++) {
  const c = Math.round(i * 0.1 * 10) / 10;
  const expected = GROUND_TRUTH[i];
  const actual = Math.round(counterCurve.interpolate(c));
  const diff = Math.abs(actual - expected);

  if (diff > maxDiff) maxDiff = diff;
  if (diff > 1) {
    passed = false;
    console.error(`FAILED at c=${c}: expected ${expected}, got ${actual} (diff: ${diff})`);
  }
}

console.log(`Evaluated ${GROUND_TRUTH.length} ground-truth points across c in [0.0, 3.7]`);
console.log(`Max error observed: ${maxDiff} (Must be <= 1)`);

if (passed && maxDiff <= 1) {
  console.log('RESULT: PASSED (100% compliant with Master Prompt specification)');
} else {
  console.error('RESULT: FAILED');
  process.exit(1);
}
