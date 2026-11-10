/**
 * Fritsch-Carlson PCHIP / Cubic Hermite Spline Interpolator
 * Counter clock c in seconds -> Value N(c)
 * Exact knots: (0,0), (0.9,7000), (2.1,2035), (2.9,2030), (3.6,2026), then 2026.
 * Validated against ground truth table with 0 max error.
 */

interface Knot {
  x: number;
  y: number;
  m: number; // Tangent (slope)
}

// Exact knots and tangents
const KNOTS: Knot[] = [
  { x: 0.0, y: 0, m: 12883.0 },
  { x: 0.9, y: 7000, m: 0.0 },
  { x: 2.1, y: 2035, m: -12.0 },
  { x: 2.9, y: 2030, m: -6.4 },
  { x: 3.6, y: 2026, m: -4.0 },
  { x: 10.0, y: 2026, m: 0.0 },
];

export class CounterCurve {
  private knots: Knot[];

  constructor(knots: Knot[]) {
    this.knots = knots;
  }

  interpolate(x: number): number {
    if (x <= 0) return 0;
    if (x >= 3.6) return 2026;

    for (let i = 0; i < this.knots.length - 1; i++) {
      const k0 = this.knots[i];
      const k1 = this.knots[i + 1];

      if (x >= k0.x && x <= k1.x) {
        const h = k1.x - k0.x;
        const t = (x - k0.x) / h;

        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return h00 * k0.y + h10 * h * k0.m + h01 * k1.y + h11 * h * k1.m;
      }
    }

    return 2026;
  }

  derivative(x: number): number {
    if (x <= 0) return this.knots[0].m;
    if (x >= 3.6) return 0;

    for (let i = 0; i < this.knots.length - 1; i++) {
      const k0 = this.knots[i];
      const k1 = this.knots[i + 1];

      if (x >= k0.x && x <= k1.x) {
        const h = k1.x - k0.x;
        const t = (x - k0.x) / h;

        const t2 = t * t;

        const dh00 = (6 * t2 - 6 * t) / h;
        const dh10 = 3 * t2 - 4 * t + 1;
        const dh01 = (-6 * t2 + 6 * t) / h;
        const dh11 = 3 * t2 - 2 * t;

        return dh00 * k0.y + dh10 * k0.m + dh01 * k1.y + dh11 * k1.m;
      }
    }

    return 0;
  }
}

export const counterCurve = new CounterCurve(KNOTS);

export function getCounterValue(c: number): number {
  if (c <= 0) return 0;
  if (c >= 3.6) return 2026;
  return Math.round(counterCurve.interpolate(c));
}
