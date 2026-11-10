# Feature Specification: As-Sunnah Reunion Interactive Mobile Web Experience

## 1. Overview & Objectives
A high-performance mobile-first web experience replicating the reunion announcement and interactive wheel presentation for the As-Sunnah Skill Development Institute. The experience starts with a cinematic 7-second intro (S1-S4) and seamlessly transitions into the perpetual interactive rotating photo wheel on the Main Page (S5).

## 2. Design Tokens & Color Palettes
Exact tokens extracted from the reference design:
- `purple`: `#6B3AA8`
- `purple-deep`: `#3B1A6E`
- `purple-text`: `#623096`
- `orange`: `#F28C1E`
- `orange-deep`: `#E2780C`
- `peach`: `#FFE8C8`
- `counter-bg`: `#FDFDF8`
- `card-gradient-top`: `#F6F0FC`
- `card-gradient-bottom`: `#FDF6EE`
- `white`: `#FFFFFF`

### Color Filtering Maps
1. **Counter Photo Duotone Map**:
   - Luminance: $L = 0.299R + 0.587G + 0.114B$
   - Contrast adjusted: $L' = \text{clamp}((L - 0.12) \times 1.3, 0, 1)$
   - Linear gradient color stops:
     - $L' = 0.00 \to \text{rgb}(0.26, 0.07, 0.48)$
     - $L' = 0.45 \to \text{rgb}(0.93, 0.52, 0.14)$
     - $L' = 0.80 \to \text{rgb}(1.00, 0.93, 0.70)$
     - $L' = 1.00 \to \text{rgb}(1.00, 1.00, 1.00)$
   - Tint multiplication: $(0.95, 0.64, 0.40)$ while inside digits.
2. **Ring Photo Purple Monochrome Map (Main Page S5)**:
   - Evaluated as single SVG `<feComponentTransfer>` filter:
     - Input $0.0 \to \#2B1059$
     - Input $0.5 \to \#6B3AA8$
     - Input $1.0 \to \#E2D6F5$

## 3. Screen Breakdown & Timing Pipeline

### S1: Welcome Card ($0.00\text{s} - 1.87\text{s}$)
- **Background**: `linear-gradient(#F6F0FC, #FDF6EE)` with two radial glows:
  - Purple `#6B3AA8` at 22% opacity at (5%, 3%), radius ~75vw.
  - Orange `#F28C1E` at 26% opacity at (98%, 97%), radius ~80vw.
- **Flower Line Art**: CSS `mask-image` on diagonal gradient (purple top-left $\to$ orange bottom-right), opacity 0.62, center elliptical mask (rx 52vw, ry 30vh at 50%/39%) attenuating center lines to ~35%.
- **Logo**: 55vw wide, centered at (50%, 28%).
- **Typography**: "WELCOME" (`#3B1A6E`) + "HOME" (`#E2780C`). High-contrast Didone serif, 14vw font-size, letter-spacing 0.16em, line-height 1.12. "WELCOME" centered at y 49.7%.
- **Divider**: 0.78em below HOME center: two 3px `#F28C1E` lines (13vw long each) with a ~1.7vw rotated diamond.
- **Motion**:
  - $0.00\text{s} - 1.00\text{s}$: Slow hold zoom ($1.00 \to 1.05$).
  - $1.00\text{s} - 1.87\text{s}$: Slide UP and off with `cubic-bezier(0.65, 0, 0.35, 1)`, translateY $0 \to -104.7\%$.
  - Edge FX: 3px gradient line + 16px orange glow + 70px soft shadow.

### S2: Counter Reel ($c = t - 1.00\text{s}$, $c \in [0, 3.9\text{s}]$)
- **Background**: `#FDFDF8`. Width 85vw, height $0.428 \times \text{width}$, screen centered.
- **Glyphs**: Inter Display Black compressed horizontally to 68%, converted to SVG Path2D at build time.
- **Fritsch-Carlson PCHIP Curve**:
  - Nodes: $(0,0) \to (0.9, 7000) \to (2.1, 2035) \to (2.9, 2030) \to (3.6, 2026)$, hold 2026 to $c=3.9$.
- **Odometer Mechanism**: Units roll continuously ($y = N$). Tens/hundreds/thousands roll ONLY during the last 10% of lower cycle via smoothstep.
- **Photo Fill**: Duotone slideshow of 5 reunion photos, 0.78s each with 0.14s smoothstep crossfade, Ken Burns drift.

### S3: Digit "6" Zoom $\to$ Poster ($c \in [3.9, 4.75\text{s}]$, $t \in [4.9, 5.75\text{s}]$)
- Normalized time: $z = (c - 3.9) / 0.85$.
- Scale: $s = 1 + (S_{\text{end}} - 1) \times z^3$ ($S_{\text{end}} \approx 27\times$) centered on the inscribed bowl circle of glyph "6".
- Vector clip via Path2D for razor-sharp edge rendering.
- Fade out digits "2","0","2" with $\max(0, 1 - 5z)$.
- Poster crossfade inside "6" with $w = \text{smoothstep}(z, 0.10, 0.70)$, color multiplier easing from lavender $(0.86, 0.78, 0.96)$ to white $(1,1,1)$.
- Result at $z=1$: Screen displays Meet & Greet Poster (2:3 aspect, 100vw wide, vertically centered). Holds until $t=7.00\text{s}$.

### S4: Poster Slide-Left ($t \in [7.00, 7.87\text{s}]$)
- Easing: `cubic-bezier(0.65, 0, 0.35, 1)`, translateX $0 \to -108.3\text{vw}$.
- Right edge FX: 3px gradient line + 14px glow + 80px shadow (35%) revealing Main Page S5 underneath.

### S5: Main Page (Perpetual Rotating Wheel) ($t \ge 7.00\text{s}$)
- **Container**: White `#FFFFFF` page.
- **Wheel Geometry**:
  - Container-relative (`container-type: inline-size` on `.main-page-container`, using `cqw`) so mobile (`100vw`) and wide-desktop `480px` mobile column frame scale identically.
  - Center at `(12cqw, 50vh)`.
  - Inner white disc radius: `49cqw` (visible on-screen chord span `0cqw`–`61cqw`).
  - Outer ring radius: `83cqw`.
  - Outer border: 2px `#5B2A9E`.
- **Photo Ring**:
  - $N$ annular-sector tiles ($N=10$ default).
  - Angular sector: $360^\circ / N$.
  - Separated by 2px white gap lines.
  - CSS `clip-path` annular sector math.
  - Duotone purple monochrome SVG filter applied.
- **Label Chips**:
  - Anchored along the inner-side band (`top: 11.2%`) of each sector so every label clears the center disc across 360° while leaving the outer photo open.
  - Pure GPU counter-rotation layers (`--tile-angle`, `--wheel-scroll-deg`, `--wheel-rotator-deg`, and synchronized `--wheel-play-state` reverse `@keyframes`) keep every label upright horizontal (`0°`) across auto-rotation, manual scroll/drag, pause, and reduced-motion states.
  - Royal-plum sharp 90° rectangular frosted box (`border-radius: 0`, `linear-gradient` `#2B1059` → `#4E2486`, champagne `#FFE8C8` border) with text-only crisp geometric uppercase sans-serif (`700`) typography for high contrast & effortless legibility.
- **Motion & Interactive Scroll/Drag Spin (Step 12)**:
  - Pure CSS GPU keyframe animation on `#wheel-rotator` (`transform: rotate(360deg)` only), clockwise, linear, infinite, ~8°/s (~45s per revolution).
  - Passive `wheel` listener and angular `pointerdown`/`pointermove`/`pointerup` drag (`atan2` 1:1 tracking) drive `#wheel-scroll-wrap` compositor transform with `requestAnimationFrame` inertia decay (`0.92` friction, auto-stops when velocity settles).
  - Drag movement threshold (`>= 8px`) suppresses synthetic click so spinning never triggers accidental map modals; keyboard arrows rotate by accessible increments.
- **Center Disc (Static)**:
  - Positioned cleanly inside the visible inner chord (`[+1.2cqw .. +56.2cqw]`, centered at `28.7cqw`) so headlines and taglines fill the left margin boldly while staying clear of the left edge and right ring boundary.
  - Transparent logo (`36cqw` width).
  - Serif Title: "WELCOME *HOME*" (`5.45cqw`, balanced wrapping).
  - Script Subtitle: "Reunion 2026" (`7cqw`).
  - Date line: "Wednesday, December 16th" (`2.95cqw`).
  - Subline: "Network • Diversify • Connect • Expand • Evolve" (`2.2cqw`).
  - Tagline: "As-Sunnah Skill Development Institute" (`2.2cqw`).

## 4. Admin Portal (`/admin`)
- Accessible via `/admin`.
- Dynamic settings:
  - Wheel tiles: photo URLs, labels, rotation speed (s/rev).
  - Center disc content: logo upload (`logoUrl` with live preview & default reset), title, subtitle, date, and schedule lines.
  - Intro settings: welcome card text, final year number.
- **Admin Tile Map Location & Public Directions Flow (Step 11):**
  - Each tile in `wheel.tiles` supports an optional `location` string (place name, address, or coordinates) configurable via `/admin`.
  - Clicking a wheel tile with a configured `location` pauses the wheel gently and presents an accessible Soft Permission modal dialog (`Allow Distance & Route` vs `View Place Only`).
  - If device location is ON and user selects `Allow`, calls `navigator.geolocation.getCurrentPosition()` and opens Google Maps Directions (`https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=...&travelmode=driving`).
  - If location is OFF, denied, unavailable, or user selects `View Place Only`, seamlessly falls back to Google Maps Place View (`https://www.google.com/maps/search/?api=1&query=...`) with zero dead-end errors.
- Output: Exports clean `/content.json` file.
- Fallback: Pre-baked default JSON embedded at build time if `/content.json` fails to load.
