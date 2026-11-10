# Implementation Plan: As-Sunnah Reunion Interactive Website

## 1. Architecture Overview
- **Build Engine**: Astro 5.x (Static mode: `output: 'static'`) with vanilla TypeScript.
- **Styling**: Tailwind CSS / Vanilla CSS for custom radial gradients and annular clip-paths.
- **Intro Engine**: Single compiled vanilla script `src/scripts/intro.ts` (bundled into <= 12 KB gzip).
- **Public Bundle**: Zero heavy runtime frameworks on the public homepage. Pure HTML + CSS + one high-performance `<canvas>`.
- **Admin**: Dedicated `/admin` route utilizing browser-native forms and JSON generation, completely code-split from the public bundle.

## 2. Directory Structure
```
/home/saidkhan/Foundetion/
├── specs/
│   ├── constitution.md
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
├── public/
│   ├── content.json          # Live CMS configuration
│   ├── assets/
│   │   ├── flower-lines-mask.svg
│   │   ├── logo-as-sunnah.svg
│   │   ├── meet-greet-poster.webp
│   │   ├── photos/           # 5 reunion photos (1-5)
│   │   └── fonts/            # Subsetted WOFF2 serif & sans
├── src/
│   ├── components/
│   │   ├── WelcomeCard.astro  # S1
│   │   ├── CounterCanvas.astro# S2 & S3
│   │   ├── PosterCard.astro   # S3 & S4
│   │   ├── RotatingWheel.astro# S5
│   │   └── DuotoneFilters.astro# SVG feComponentTransfer filters
│   ├── scripts/
│   │   ├── curve.ts          # Fritsch-Carlson PCHIP cubic interpolator
│   │   ├── glyphs.ts         # Precomputed SVG Path2D paths for 0-9
│   │   └── intro.ts          # Orchestrator (rAF loop, Canvas draw, S1/S4 triggers)
│   ├── layouts/
│   │   └── Layout.astro      # Mobile viewport, safe areas, meta
│   └── pages/
│       ├── index.astro       # Public Experience
│       └── admin.astro       # Content Editor
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## 3. Data Contracts (`/public/content.json`)
```typescript
export interface ReunionContent {
  version: number;
  welcome: {
    line1: string; // "WELCOME"
    line2: string; // "HOME"
    finalNumber: number; // 2026
  };
  centerDisc: {
    logoUrl: string;
    titleRegular: string; // "WELCOME"
    titleItalic: string;  // "HOME"
    scriptSubtitle: string;// "Reunion 2026"
    dateLine: string;     // "Wednesday, December 16th"
    scheduleLine1: string;// "Network • Diversify • Connect • Expand • Evolve"
    scheduleLine2: string;// "As-Sunnah Skill Development Institute"
    buttonText: string;   // "RSVP"
    buttonUrl: string;    // "#"
  };
  wheel: {
    rotationDurationSec: number; // 45
    tiles: Array<{
      id: string;
      label: string;
      photoUrl: string;
      focalPointY?: number; // 0.0 - 1.0
      location?: string;    // Optional Google Maps destination
    }>;
  };
}
```

## 4. Odometer & Cubic Curve Engineering
1. **Fritsch-Carlson Monotone Cubic Hermite Interpolation**:
   Interpolate knots: `(0, 0)`, `(0.9, 7000)`, `(2.1, 2035)`, `(2.9, 2030)`, `(3.6, 2026)`.
   Guarantee strict monotonicity between knots so numbers never oscillate or jitter.
2. **Path2D Vector Glyphs**:
   Path strings extracted from Inter Display Black horizontally compressed to 68%.
   No font loading dependencies inside the `<canvas>`.
3. **Canvas Drawing Pipeline**:
   - Background `#FDFDF8`
   - Calculate digit positions for 4 reels (thousands, hundreds, tens, units)
   - Clip to reel bounding boxes
   - Draw duotone image buffer clipped to active digit paths
   - Apply speed blur during high velocity ($c < 1.0$)
4. **Digit "6" Zoom & Vector Clip**:
   - Center circle anchor coordinates of glyph "6"
   - Scale matrix applied to Canvas context
   - Smoothstep crossfade between duotone photo and poster texture

## 5. Pure CSS Annular Sector Photo Wheel (S5)
1. **Math for Annular Sector (`clip-path: polygon(...)`)**:
   For each tile $i \in [0, N-1]$:
   - Outer arc angle: $\theta_{\text{start}} = i \times \frac{360^\circ}{N}$, $\theta_{\text{end}} = (i+1) \times \frac{360^\circ}{N}$
   - Coordinate generator on inner radius $R_{\text{in}} = 49\text{vw}$ and outer radius $R_{\text{out}} = 83\text{vw}$.
2. **GPU Compositor Rotation**:
   ```css
   @keyframes wheel-spin {
     from { transform: rotate(0deg); }
     to { transform: rotate(360deg); }
   }
   .wheel-ring {
     animation: wheel-spin var(--rotation-duration, 45s) linear infinite;
     will-change: transform;
   }
   ```
3. **Duotone SVG Filter**:
   Defined inline in HTML via `<svg class="sr-only">` with `<filter id="ring-duotone">` utilizing `<feColorMatrix type="matrix">` and `<feComponentTransfer>` mapping RGB values to `#2B1059`, `#6B3AA8`, `#E2D6F5`.
