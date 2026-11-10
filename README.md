# As-Sunnah Reunion 2026

A mobile-first invitation web app and lightweight flat-file CMS built with Astro 5 for the As-Sunnah Skill Development Institute 4th Annual Alumni Reunion.

Live deployment: https://as-sunnah-reunion-three.vercel.app

## Overview

Rather than shipping a single-page framework runtime, the public experience is compiled to static HTML, scoped CSS, SVG filters, and a small TypeScript timeline controller. All dynamic event data lives in `public/content.json`, paired with a built-in `/admin` workspace for updating schedules, times, photos, and map coordinates without touching source code.

## Public Experience Flow

1. **Welcome Card**: Fades and scales in immediately using preloaded subsetted WOFF2 typography (`Playfair Display`, `Bodoni Moda`, `Alex Brush`), followed by a smooth vertical reveal into the counter stage.
2. **Numerical Counter (`0000` to `2026`)**: Drawn on a single `<canvas>` using pre-compiled SVG `Path2D` digit outlines and five reunion backdrop photos driven by a Fritsch-Carlson cubic spline curve.
3. **Digit-6 Zoom Reveal**: Isolates the final numeral `6`, scales smoothly from its lower-left bowl anchor across the viewport diagonal, and crossfades into the event poster before sliding left.
4. **Interactive Schedule Wheel**: A 10-sector circular photo ring rendered with CSS annular `clip-path` polygons and an SVG monochrome duotone filter (`#purple-monochrome-duotone`). Users can drag, flick with inertia, scroll horizontally/vertically, pause on tab switch, or tap any item or horizontal label badge to open the location prompt for Google Maps.

## Built-in Admin Studio (`/admin`)

The `/admin` route works independently of the public bundle and ships zero admin JavaScript to regular visitors:

- **Wheel & Schedule Editor**: Upload JPG/PNG/WebP photos (resized client-side to 480px grayscale WebP so the SVG duotone filter keeps colors consistent), reorder or add tiles (4 to 24 sectors), edit uppercase labels, and add an optional event time (for example `7:45 AM`, `8:00 AM`, `1:00 PM`) displayed directly beneath each badge.
- **Interactive Map Picker**: Powered by Leaflet + OpenStreetMap (with coordinate parsing for pasted Google Maps links or draggable pins).
- **Center Disc & Intro Controls**: Live circular preview for the hub text, date line, transparent 4th Reunion logo (with automatic light-background removal and margin trimming), welcome headline, and counter target year.
- **Passkey Guard & Validation**: Protects `PUT /api/content` and `POST /api/upload` via constant-time `ADMIN_SECRET` verification (or Cloudflare Access JWT verification in `functions/api/`), rate limiting (`429` after 5 failed attempts within 60s), and schema validation defined in `specs/content.schema.json`.

## Performance & Asset Architecture

To keep mobile cellular loads fast without changing the visual theme:

- Initial page load only preloads the first-screen fonts and Welcome Card assets (~172.5 KB across 9 requests on emulated Slow 4G, reaching `DOMContentLoaded` / `onLoad` around `1.15s` in local Chrome Slow 4G tests; full session across all 25 requests totals ~372 KB).
- Wheel sector photos use deferred `data-src` loading activated right after the welcome transition starts, so they finish decoding well before the poster reveals the wheel.
- Production build output (`dist/`) is ~640 KB total.

## Project Structure

```text
src/
  components/       Astro UI sections (WelcomeCard, CounterCanvas, PosterCard, RotatingWheel, DuotoneFilters)
  pages/            Routes (index.astro, admin.astro, test-digits.astro, welcome-card.astro)
  scripts/          Intro timeline & canvas engine (intro.ts), Path2D numerals (digits.ts)
  styles/           Design tokens and base layout styles
functions/api/      Cloudflare Pages Functions for content updates and R2 uploads
scripts/            Local static + API server emulator (local-api-server.mjs) and security test suite
specs/              JSON schema (content.schema.json) and architecture notes
public/             Static content.json, subset WOFF2 fonts, and WebP assets
vercel.json         Vercel static build, clean URLs, and cache/security headers
```

## Running Locally

Requires Node.js 18 or newer.

```bash
# Install dependencies
npm install

# Type-check and build static output into dist/
npx tsc --noEmit
npm run build

# Start local static + CMS API server on http://localhost:4321
ADMIN_SECRET=your_local_passkey node scripts/local-api-server.mjs
```

- Public site: `http://localhost:4321/`
- Admin studio: `http://localhost:4321/admin`

Run the automated authentication, upload validation, and rate-limit test suite against a running local server:

```bash
ADMIN_SECRET=your_local_passkey node scripts/test-admin-security.mjs
```

## Deployment

### Vercel (Static Public Site)

The project is configured via `vercel.json` and `.vercelignore` for static Astro deployment:

```bash
vercel deploy --prod --yes
```

Because Vercel hosts this project as a static bundle without server-side write persistence on `content.json`, use your local `/admin` workspace (or `Export JSON`) to make content changes and re-run `vercel deploy --prod --yes` to publish updates.

### Cloudflare Pages (Full Serverless CMS)

For live online `/admin` publishing backed by Cloudflare KV and R2 storage, use the handlers in `functions/api/` (`content.ts` and `upload.ts`), configure `CONTENT_KV`, `RATE_LIMIT_KV`, and `MEDIA_BUCKET` in `wrangler.toml`, and set `ADMIN_SECRET`, `ALLOWED_ADMIN_EMAILS`, and `CF_ACCESS_AUD` as Wrangler secrets before deploying `dist/`.

## License

MIT
