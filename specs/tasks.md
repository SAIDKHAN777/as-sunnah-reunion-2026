# Project Tasks Roadmap: As-Sunnah Reunion Interactive Mobile Website

## Step 1: Spec and Setup (Current Step)
- [x] Task 1.1: Establish Spec Kit constitution from Master Prompt HARD RULES (`specs/constitution.md`).
- [x] Task 1.2: Watch reference video and compile screen-by-screen timeline & layout measurements (`specs/reference-notes.md`).
- [x] Task 1.3: Encode functional & design specifications for screens S1-S5 and /admin (`specs/spec.md`).
- [x] Task 1.4: Detail architectural implementation plan & data contracts (`specs/plan.md`).
- [x] Task 1.5: Set up empty Astro project (`output: 'static'`, TypeScript strict, zero UI frameworks/animation libraries).
- [x] Task 1.6: Encode all design tokens, formulas, and filter stops in `src/styles/tokens.css`.
- [x] Task 1.7: Place owner's assets into `public/assets` with exact prompt names (`public/assets/reference/reunion-full-with-theme-video.mp4`, `flower-lines-mask.webp`, `meet-greet-poster.png`, etc.).
- [x] Task 1.8: Run build check (`npm run build`) and verify clean static build.

## Step 2: Assets & Figma Vector Truth
- [x] Task 2.1: Verify vector accuracy of As-Sunnah logo (`public/assets/logo-as-sunnah.webp` / SVG).
- [x] Task 2.2: Verify floral line plate (`public/assets/welcome-card-bg.webp`) with radial gradient attenuation.
- [x] Task 2.3: Verify Meet & Greet poster asset (`public/assets/meet-greet-poster.webp`) in 2:3 aspect ratio.
- [x] Task 2.4: Prepare and verify 5 reunion photos in WebP format (<= 70 KB each).
- [x] Task 2.5: Compile exact SVG Path2D vector shapes for heavy grotesque numerals 0-9 (Inter Display Black compressed 68%).

## Step 3: S1 Welcome Card Implementation (Complete)
- [x] Task 3.1: Build `WelcomeCard.astro` using tokens from `tokens.css`.
- [x] Task 3.2: Implement radial glows, floral plate, and uppercase Didone typography (Playfair Display 700 subset woff2).
- [x] Task 3.3: Implement S1 timeline animation (hold zoom 0.00s - 1.00s, slide UP 1.00s - 1.87s with bottom gradient line & glow).
- [x] Task 3.4: Verify frame match at t = 0.5s and t = 1.4s.

## Step 4: Timeline Engine and Card Slide-Up (Complete)
- [x] Task 4.1: Build `intro.ts` with single master `requestAnimationFrame` clock and debug query `?t=SECONDS`.
- [x] Task 4.2: Implement exact `easeInOutCubic` (`cubic-bezier(0.65, 0, 0.35, 1)`) solver using Newton-Raphson.
- [x] Task 4.3: Implement S1 camera zoom (`1.00 -> 1.05` across `0.0 - 1.9s`) and slide-up (`translate3d(0, -104.7%, 0)`).
- [x] Task 4.4: Add accessible "Skip" button (touch target >= 44px), `sessionStorage` play-once flag, and `prefers-reduced-motion` bypass.
- [x] Task 4.5: Verify frames at `?t=0.5s`, `?t=1.4s`, `?t=1.87s` and measure JS bundle size (5.24 KB gzip <= 12 KB limit).

## Step 4: S2 Counter Reel & Timeline Engine (Complete)
- [x] Task 4.1: Implement Fritsch-Carlson PCHIP cubic spline algorithm in `src/scripts/curve.ts` (0 error against ground truth table).
- [x] Task 4.2: Build 4-reel odometer Canvas renderer with smoothstep carryover on the last 10% of lower cycles.
- [x] Task 4.3: Implement Canvas duotone photo fill slideshow with Ken Burns drift and luminance mapping.
- [x] Task 4.4: Add speed-based motion blur, progressive photo preloading, and accessible Skip link.
- [x] Task 4.5: Verify frame matches at $t = 1.5\text{s}, 2.0\text{s}, 3.0\text{s}, 3.5\text{s}, 4.6\text{s}$ and steady 60 fps.

## Step 6: S3 Digit "6" Zoom & Poster Reveal (Complete)
- [x] Task 6.1: Implement S3 Digit "6" vector clip zoom ($z^3$ easing) centered on bowl anchor into Meet & Greet poster.
- [x] Task 6.2: Implement lavender crossfade and poster hold until $t = 7.00\text{s}$.
- [x] Task 6.3: Verify frames at $t = 4.9\text{s}, 5.1\text{s}, 5.3\text{s}, 5.5\text{s}, 5.75\text{s}, 6.5\text{s}$.

## Step 7: S4 Poster Slide-Left & Handoff (Complete)
- [x] Task 7.1: Implement S4 slide-left transition ($t \in [7.00\text{s}, 7.87\text{s}]$) with easeInOutCubic, right vertical gradient line, glow, and shadow.
- [x] Task 7.2: Mount Main Page underneath at $t = 7.00\text{s}$ and clean up intro DOM nodes to free memory.
- [x] Task 7.3: Verify frame matches at $t = 7.0\text{s}, 7.3\text{s}, 7.6\text{s}, 7.87\text{s}$.

## Step 8: S5 Main Page Wheel Implementation (Complete)
- [x] Task 8.1: Build mathematical annular-sector clip-path generator `computeAnnularClipPath(N)` for dynamic $N$ photo tiles.
- [x] Task 8.2: Implement pure CSS GPU rotation animation ($\approx 45\text{s}$ per revolution, $8^\circ/\text{s}$, transform only) with zero runtime JS.
- [x] Task 8.3: Add tab visibility pause (`visibilitychange`) to stop background GPU/battery consumption.
- [x] Task 8.4: Build static center disc content (vector SVG As-Sunnah logo, frosted glass badge, cursive subset font, and RSVP button).
- [x] Task 8.5: Verify frame matches at $t = 8.5\text{s}$ and $t = 20.0\text{s}$ against reference video.
- [x] Task 8.6: Run Lighthouse Mobile audit and exceed benchmarks (Performance 98, Accessibility 100, Best Practices 100, SEO 100).

## Step 9: Admin CMS Panel & Dynamic Decoupled Content (Complete)
- [x] Task 9.1: Build `/admin` page for live tile management (add/remove/reorder, client-side WebP image resize, tile-shape crop preview, labels, rotation speed).
- [x] Task 9.2: Implement `public/content.json` export, local storage draft syncing, and authenticated `PUT /api/content` with Cloudflare Pages Functions edge implementation.
- [x] Task 9.3: Verify unauthenticated users cannot write (401 Unauthorized enforced).
- [x] Task 9.4: Verify zero admin bytes leaked into public homepage bundle (bundle size strictly unchanged at 6.64 KB gzip).

## Step 10: Final Performance Budgets & Complete Delivery (Complete)
- [x] Task 10.1: Run Section 9 Checklist: 10 timestamp side-by-side screenshots (720x1280 DPR 1) matching reference video.
- [x] Task 10.2: Run Lighthouse Mobile audit (Performance 96-98, Accessibility 100, Best Practices 100, SEO 100, FCP 0.8s, TBT 30ms, CLS 0.005).
- [x] Task 10.3: Test 4G network profile + 4x CPU throttling (steady 60 fps, zero dropped frames).
- [x] Task 10.4: Test responsive viewports (360px Android, 390px iPhone, 430px iPhone Pro Max) with safe areas and zero horizontal scroll.
- [x] Task 10.5: Verify `prefers-reduced-motion` immediate bypass & rotation freeze, plus `sessionStorage` play-once flag.
- [x] Task 10.6: Verify strict performance budgets: Total public client JS 6.64 KB gzip (<= 12 KB limit), public first load ~18 KB gzip (<= 60 KB limit), intro assets ~430 KB (<= 500 KB limit), ring photos <= 70 KB each.
- [x] Task 10.7: Set Cloudflare Pages cache headers in `public/_headers` (immutable 1-year hashed assets, 60s short cache for `/content.json`).
- [x] Task 10.8: Provide comprehensive `README.md` documenting installation, run commands, Cloudflare deployment, and `/admin` usage guide.

## Step 11: Interactive Wheel Google Maps & Geolocation Flow
- [x] Task 11.1: Extend `WheelTile` schema (`specs/content.schema.json`, `src/types/content.ts`) with optional `location` field.
- [x] Task 11.2: Add `location` input & contextual Save support to every tile card in `/admin` (`src/pages/admin.astro`).
- [x] Task 11.3: Enable sector-clipped click hit-testing & accessible Soft Permission Location Modal in `src/components/RotatingWheel.astro`.
- [x] Task 11.4: Implement `navigator.geolocation` Allow/Deny + Google Maps URLs (`api=1` directions vs search fallback) with zero popup-blocker dead-ends in `src/scripts/intro.ts`.
- [x] Task 11.5: Build and verify via automated Puppeteer E2E test covering Admin location save, Geolocation granted (`maps/dir`), Geolocation denied (`maps/search`), and clean security checks.
- [x] Task 11.6: Add interactive drag-and-drop Map Pin Picker modal (Leaflet/OSM + Nominatim search + Google Maps URL parser + `locationName` display) to `/admin`.

## Step 12: Interactive Scroll & Drag-to-Spin Wheel Control
- [x] Task 12.1: Add `#wheel-scroll-wrap` GPU compositor transform layer and `overscroll-behavior: none` / `touch-action` isolation in `src/components/RotatingWheel.astro`.
- [x] Task 12.2: Implement passive `wheel` spin, `atan2` pointer drag-to-spin (cached rect on `pointerdown` to avoid layout reflows), momentum inertia decay (`rAF` auto-stop), drag-threshold click suppression (`>= 8px`), and keyboard arrow support in `src/scripts/intro.ts`.
- [x] Task 12.3: Verify `npm ls`, TypeScript (`tsc --noEmit`), production build (`npm run build`), bundle size budget, 60fps scroll/drag spin E2E in Chrome (mouse wheel, touch/pointer drag, tap vs drag disambiguation, and reduced-motion manual spin), and security tests.

## Step 13: Center Disc Visible-Chord Alignment & Zero-Clipping Typography
- [x] Task 13.1: Scope rotating wheel & center disc sizing to `.main-page-container` via `container-type: inline-size` (`cqw`) so mobile (`<= 768px`) and desktop `480px` column (`>= 769px`) render identically without horizontal clipping or overscaling.
- [x] Task 13.2: Align `.disc-content` inside the visible white disc region (`padding-left: 38.2cqw; padding-right: 4.8cqw;` -> on-screen `[+1.2cqw .. +56.2cqw]`, center `28.7cqw`) with `max-width: none`, bold balanced `cqw` typography (`5.45cqw` title, `7cqw` script, `2.95cqw` date, `2.2cqw` sublines, `36cqw` logo), so the left side is well-filled and `WELCOME HOME` / taglines never clip or collide with the ring.
- [x] Task 13.3: Verify across mobile & desktop viewports (`360x800`, `375x667`, `390x844`, `480x854`, `1280x800`), run `npm run build`, `tsc --noEmit`, `npm` static/hygiene checks, and visually inspect screenshots.
- [x] Task 13.4: Remove unused RSVP pill button (`disc-rsvp-btn`) from public center disc and matching RSVP editor fields/preview from `/admin`, keeping vertical stack symmetrically centered.

## Step 14: Admin Center Disc Logo Upload & Live Sync
- [x] Task 14.1: Add Center Disc Logo Upload control (`#logo-file-input`, `#input-logo-url`, `#logo-thumb-preview`, default reset, and instant `#preview-logo` update) inside `/admin` Center Disc tab (`src/pages/admin.astro`), sharing the server image upload helper.
- [x] Task 14.2: Sync `centerDisc.logoUrl` dynamically in `src/scripts/intro.ts` (`syncDynamicContent`) and constrain `.disc-logo img` `object-fit: contain` / `max-height` in `src/components/RotatingWheel.astro`.
- [x] Task 14.3: Build and verify via Chrome Puppeteer E2E test (upload logo -> live preview updates -> Save updates `/content.json` & public `/`, then cleanly restore original default content).
- [x] Task 14.4: Remove `#F7F7F7` light box background from owner's uploaded 4th Reunion logo (`logo_4th_reunion_clean.webp`, alpha-decontaminated & trimmed) and add automatic light-background removal + margin trim (`stripLightCanvasBackground` & `trimCanvasMargins`) inside `/admin` logo upload pipeline.

## Step 15: Upright Horizontal Side Label Chips & Typography Upgrade
- [x] Task 15.1: Refactor `.label-chip-wrapper` in `src/components/RotatingWheel.astro` to sit along the inner-side band (`top: 11.2%`) with pure GPU counter-rotation layers (`--tile-angle`, `--wheel-scroll-deg`, `--wheel-rotator-deg`, reverse `--wheel-play-state` animation) and refined geometric sans + royal plum/amber dot badge styling.
- [x] Task 15.2: Sync `--wheel-play-state`, `--wheel-scroll-deg`, and `--wheel-rotator-deg` in `src/scripts/intro.ts` across auto-rotation, scroll/drag inertia, modal pause, visibility changes, reduced-motion, and debug seek.
- [x] Task 15.3: Verify TypeScript, static build, mobile/desktop 360° spin orientation (`0°` horizontal & zero disc overlap), and security checks.
