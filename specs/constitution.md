# Spec Kit Constitution: As-Sunnah Reunion Interactive Mobile Website

## 1. Governance & Core Principles
This constitution encodes the non-negotiable **HARD RULES** defined in Section 3 of the Master Prompt. Every task and implementation phase must adhere to these governing constraints.

---

## 2. Hard Architectural Rules

### Rule 1: Framework & Zero Client JS by Default
- **Framework**: Astro, static output mode (`output: 'static'`).
- **Client JS Budget**: Zero client JS by default. Client-side JS is permitted **only** as small vanilla TypeScript: `intro.ts` ($\le 12\text{ KB gzip}$).
- **Pure CSS Wheel**: The rotating wheel (S5) must be 100% pure CSS animation.
- **Zero Heavy Libraries**: No React, Vue, Svelte, GSAP, Three.js, jQuery, or animation libraries.
- **Admin Isolation**: Admin panel code (`/admin`) is strictly isolated and never loaded or bundled into public pages.

### Rule 2: 100% Mobile-Only Viewport Architecture
- **Audience**: 100% of users are on mobile phones.
- **Orientation**: Portrait only, viewport baseline $360 \times 640\text{px}$ to $430 \times 932\text{px}$.
- **Viewport Units**: Enforce `100svh` / `100dvh` and safe-area insets (`env(safe-area-inset-*)`).
- **Touch & Interaction**: Touch targets $\ge 44\text{px}$. Zero dependence on hover states. Zero horizontal scroll (`overflow-x: hidden`).
- **Desktop Behavior**: On wide screens, center a max-width $480\text{px}$ mobile column on background `#FDFDF8`. Do NOT build a dedicated desktop layout.

### Rule 3: Lightest Technique Wins (Compositor & Performance)
- **Compositor Only**: Use GPU compositor properties (`transform`, `opacity`) for animations.
- **Single Canvas**: Exactly one `<canvas>` element for the numerical odometer counter (S2 & S3).
- **Layout Thrashing**: Zero DOM layout thrashing; `will-change` used only while active animations run.
- **Asset Formats**: Images in AVIF/WebP format, icons in scalable SVG.
- **Font Subsetting**: Maximum 3 subsetted WOFF2 font files ($\le 45\text{ KB}$ total), `font-display: swap`.

### Rule 4: Performance & Network Budgets (Mid Android, 4G)
- **Public First Load**: $\le 60\text{ KB gzip}$ (excluding photos).
- **Total Intro Assets**: $\le 500\text{ KB}$.
- **Ring Photos**: $\le 70\text{ KB}$ each, lazy loaded.
- **Lighthouse Mobile Score**: Performance $\ge 95$.
- **Core Web Vitals**: Cumulative Layout Shift (CLS) $= 0$; Largest Contentful Paint (LCP) $\le 1.5\text{s}$.
- **Frame Rate**: Steady $60\text{ fps}$.

### Rule 5: Accessibility & Session Control
- **`prefers-reduced-motion`**: Skip intro animation immediately, mount and display the Main Page (S5), and freeze wheel rotation.
- **Session Control**: Intro plays only once per user session (`sessionStorage`).
- **Skip Control**: Small, accessible "Skip" link at bottom center with $\ge 44\text{px}$ touch target.
- **Zero Disruption**: No audio playback or auto-playing sound.

### Rule 6: Design Tokens & Single Filter Truth
- All visual elements must strictly use the design tokens from Section 4.
- Purple monochrome filter on ring photos must be implemented as a single SVG `<feComponentTransfer>` filter, not per-image raster preprocessing.
