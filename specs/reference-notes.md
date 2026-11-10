# Reference Video Analysis & Screen Measurement Notes

## 1. Video Specifications
- **File**: `public/assets/reference/reunion-full-with-theme-video.mp4`
- **Resolution**: 720 x 1280 px (Portrait, 9:16 aspect ratio)
- **Frame Rate**: 30.00 fps (constant)
- **Total Duration**: 20.133 seconds (604 frames)
- **Target Viewport Baseline**: 360 x 640 up to 430 x 932 (Reference canvas: 720 x 1280 DPR 1 / 360 x 640 DPR 2)

---

## 2. Screen-by-Screen Layout Measurements & Timing

### S1: Welcome Card ($0.00\text{s} - 1.87\text{s}$)
- **Time Window**:
  - $0.00\text{s} - 1.00\text{s}$: Static hold with subtle camera zoom ($1.00 \to 1.05$).
  - $1.00\text{s} - 1.87\text{s}$ ($26$ frames): Card slides UP and off screen with `easeInOutCubic` (`cubic-bezier(0.65, 0, 0.35, 1)`), reaching `translateY(-104.7%)`.
- **Canvas / Viewport Measurements**:
  - Full viewport: $720 \times 1280\text{px}$ ($100\text{vw} \times 100\text{dvh}$).
  - Background: Vertical linear gradient from top `#F6F0FC` to bottom `#FDF6EE`.
  - Radial Glow 1 (Top-Left): Center at $(5\%, 3\%)$ ($36\text{px}, 38\text{px}$), radius $75\text{vw}$ ($540\text{px}$), color `#6B3AA8` at $22\%$ opacity.
  - Radial Glow 2 (Bottom-Right): Center at $(98\%, 97\%)$ ($705\text{px}, 1241\text{px}$), radius $80\text{vw}$ ($576\text{px}$), color `#F28C1E` at $26\%$ opacity.
  - Flower Line Art Mask: Overlay layer filled with diagonal gradient (purple top-left to orange bottom-right), opacity $0.62$. Masked by radial elliptical mask (radii $rx = 52\text{vw} = 374\text{px}$, $ry = 30\text{vh} = 384\text{px}$ centered at $50\%, 39\%$) attenuating center to $35\%$ and edges to $100\%$.
  - Logo: Centered at $(x = 50\%, y = 28\%)$ ($360\text{px}, 358\text{px}$), width $55\text{vw}$ ($396\text{px}$).
  - Headline "WELCOME": Color `#3B1A6E`, uppercase serif, font-size $14\text{vw}$ ($100.8\text{px}$), letter-spacing $0.16\text{em}$ ($16.1\text{px}$), line-height $1.12$, centered at $y = 49.7\%$ ($636\text{px}$).
  - Headline "HOME": Color `#E2780C`, uppercase serif, font-size $14\text{vw}$, letter-spacing $0.16\text{em}$, line-height $1.12$.
  - Divider: Placed $0.78\text{em}$ below HOME center. Two horizontal lines of height $3\text{px}$, color `#F28C1E`, width $13\text{vw}$ ($93.6\text{px}$) each, separated by a $45^\circ$ rotated diamond of width $1.7\text{vw}$ ($12.2\text{px}$).
  - Slide-Up Bottom Edge FX: $3\text{px}$ horizontal gradient line (`#6B3AA8` to `#F28C1E`), $16\text{px}$ orange glow (peak opacity $0.55$), and $70\text{px}$ soft drop shadow (opacity $0.28$).

### S2: Counter Reel ($c = t - 1.00\text{s}$, $c \in [0.0\text{s}, 3.9\text{s}]$)
- **Time Window**:
  - $c = 0.0\text{s}$ ($t = 1.00\text{s}$): Counter reel begins revealing underneath S1.
  - $c \in [0.0\text{s}, 3.6\text{s}]$: Value runs from $0 \to 7000 \to 2035 \to 2030 \to 2026$.
  - $c \in [3.6\text{s}, 3.9\text{s}]$: Holds steady at $2026$.
- **Layout & Dimension Measurements**:
  - Background: `#FDFDF8`.
  - Reel Container: Width $85\text{vw}$ ($612\text{px}$), height $0.428 \times \text{width} = 262\text{px}$, centered at $(50\%, 50\%)$.
  - 4 Digit Slots (Thousands, Hundreds, Tens, Units): Gap between reels $= 1.9\text{vw}$ ($13.7\text{px}$).
  - Digit Slot Width: $(612 - 3 \times 13.7) / 4 \approx 142.7\text{px}$.
  - Digit Row Spacing: $1.30 \times \text{digit height} = 340.6\text{px}$.
  - Visible Reel Window: $\pm 0.60 \times \text{digit height} = \pm 157.2\text{px}$.
  - Glyphs: Inter Display Black compressed horizontally to $68\%$, converted to SVG Path2D vector shapes.
- **Odometer Mechanics**:
  - Units digit rolls continuously: $y_0 = N$.
  - Tens digit rolls during last $10\%$ of units cycle ($y_0 \in [9.0, 10.0]$) using `smoothstep(9.0, 10.0, y_0)`.
  - Hundreds digit rolls during last $10\%$ of tens cycle ($N \pmod{100} \ge 90$) using `smoothstep(90.0, 100.0, N % 100)`.
  - Thousands digit rolls during last $10\%$ of hundreds cycle ($N \pmod{1000} \ge 900$) using `smoothstep(900.0, 1000.0, N % 1000)`.
- **Photo Fill**:
  - Slideshow of 5 photos: $0.78\text{s}$ display time per photo, $0.14\text{s}$ smoothstep crossfade.
  - Image display width: $153\text{vw}$ ($1101.6\text{px}$).
  - Ken Burns effect: Scale $1.00 \to 1.08$, horizontal visible center drifts from $35\%$ to $65\%$.
  - Photo Duotone Map:
    $L = 0.299R + 0.587G + 0.114B$
    $L' = \text{clamp}((L - 0.12) \times 1.3, 0, 1)$
    Linear stops: $0.0 \to \text{rgb}(0.26, 0.07, 0.48)$, $0.45 \to \text{rgb}(0.93, 0.52, 0.14)$, $0.80 \to \text{rgb}(1, 0.93, 0.70)$, $1.00 \to \text{rgb}(1, 1, 1)$.
    Multiply by $(0.95, 0.64, 0.40)$ inside digits.

### S3: Digit "6" Zoom to Meet & Greet Poster ($t \in [4.90\text{s}, 5.75\text{s}]$)
- **Time Window**:
  - Normalized time $z = (c - 3.9) / 0.85 = (t - 4.9) / 0.85 \in [0.0, 1.0]$.
  - Scale factor: $s = 1 + (S_{\text{end}} - 1) \times z^3$, with $S_{\text{end}} \approx 27.0$.
- **Anchor Coordinates**:
  - Center of inscribed circle of glyph "6" lower-left bowl ($x \approx 48\%, y \approx 69\%$ within the glyph slot).
  - Anchor travels from initial screen position $(x \approx 595\text{px}, y \approx 690\text{px})$ to viewport center $(360\text{px}, 640\text{px})$ with $z^3$ easing.
- **Fade & Crossfade Transitions**:
  - Digits "2", "0", "2" fade out with opacity $= \max(0, 1 - 5z)$ (completely gone by $z = 0.20$).
  - Photo fill inside "6" crossfades to poster with $w = \text{smoothstep}(z, 0.10, 0.70)$.
  - Poster tint color multiplier: Eases from lavender $(0.86, 0.78, 0.96)$ to white $(1, 1, 1)$ via $\text{smoothstep}(z, 0.55, 1.00)$.
  - At $z = 1.0$ ($t = 5.75\text{s}$), the viewport is $100\%$ the Meet & Greet Poster.
  - $t \in [5.75\text{s}, 7.00\text{s}]$: Poster holds static.
  - Poster dimensions: $2:3$ aspect ratio ($720 \times 1080\text{px}$), fitted to $100\text{vw}$ width, vertically centered, `#FFFFFF` letterbox top and bottom ($100\text{px}$ each).

### S4: Poster Slide-Left ($t \in [7.00\text{s}, 7.87\text{s}]$)
- **Time Window**: $0.87\text{s}$ duration ($26$ frames).
- **Motion**: `translateX(0) -> translateX(-108.3vw)` ($-779.8\text{px}$) with `easeInOutCubic` (`cubic-bezier(0.65, 0, 0.35, 1)`).
- **Edge FX**:
  - Along poster's right edge: $3\text{px}$ vertical gradient line (`#6B3AA8` top to `#F28C1E` bottom).
  - $14\text{px}$ soft orange glow.
  - $80\text{px}$ soft shadow ($35\%$ opacity) cast onto the underlying Main Page.
  - Underlying Main Page (S5) is already mounted and running at rotation $0^\circ$ at $t = 7.00\text{s}$.

### S5: Main Page – Rotating Photo Wheel ($t \ge 7.00\text{s}$ onward)
- **Background**: White `#FFFFFF`.
- **Wheel Geometry**:
  - Wheel Center: $(x = 12\text{vw} = 86.4\text{px}, y = 50\text{vh} = 640\text{px})$.
  - Inner white disc radius: $49\text{vw} = 352.8\text{px}$ (Diameter $= 98\text{vw} = 705.6\text{px}$).
  - Outer wheel radius: $83\text{vw} = 597.6\text{px}$ (Diameter $= 166\text{vw} = 1195.2\text{px}$).
  - Ring Width: $83\text{vw} - 49\text{vw} = 34\text{vw} = 244.8\text{px}$.
  - Outer border: $2\text{px}$ solid `#5B2A9E`.
- **Photo Tiles**:
  - $N = 10$ tiles (each $36^\circ$ sector).
  - Radial gap lines: $2\text{px}$ white lines.
  - CSS Annular sector clip-path: 10-point polygon math mapping $R_{\text{in}} = 29.52\%$ to $R_{\text{out}} = 50.00\%$.
  - Purple monochrome duotone filter applied via SVG `<feComponentTransfer>`:
    Input $0.0 \to \#2B1059$, $0.5 \to \#6B3AA8$, $1.0 \to \#E2D6F5$.
- **Radial Label Chips**:
  - Position: Along radial centerline near outer perimeter ($R \approx 78\text{vw}$).
  - Rotation: Rotated with the tile angle; flipped $180^\circ$ when angle is between $90^\circ$ and $270^\circ$ to maintain upright readability.
  - Styling: Deep purple `rgba(59, 26, 110, 0.88)`, $1\text{px}$ outline `rgba(255, 255, 255, 0.45)`, rounded pill, uppercase serif text (`#FFFFFF`, letter-spacing $0.12\text{em}$).
- **Continuous Rotation**:
  - Pure CSS GPU keyframe animation on `transform: rotate(360deg)`.
  - Clockwise, linear, infinite, $8^\circ/\text{s}$ ($\sim 45\text{s}$ per full revolution).
- **Static Center Disc Content**:
  - Remains stationary at $(12\text{vw}, 50\text{vh})$ inside the inner radius.
  - Logo: As-Sunnah Skill Development Institute transparent SVG.
  - Title: "WELCOME *HOME*" (HOME in orange italic).
  - Script Subtitle: "Reunion 2026" cursive.
  - Date Line: "Wednesday, December 16th".
  - Schedule Lines: "Network • Diversify • Connect • Expand • Evolve" and "As-Sunnah Skill Development Institute".
  - Button: "RSVP" lavender pill (`#6B3AA8` / `#FFFFFF`).
