import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { DIGITS } from '../src/scripts/digits.js';

const FRAMES_DIR = '/home/saidkhan/Foundetion/figma_frames';
const HTML_TMP_DIR = '/tmp/figma_html_frames';
fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(HTML_TMP_DIR, { recursive: true });

// Copy assets and tokens to HTML_TMP_DIR
execSync(`cp -r /home/saidkhan/Foundetion/public/assets ${HTML_TMP_DIR}/assets`, { stdio: 'ignore' });
execSync(`cp /home/saidkhan/Foundetion/src/styles/tokens.css ${HTML_TMP_DIR}/tokens.css`, { stdio: 'ignore' });

function generateFrameHTML(frameId) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Frame ${frameId}</title>
  <link rel="stylesheet" href="./tokens.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Alex+Brush&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--color-counter-bg);
    }
    .frame-container {
      position: relative; width: 100%; height: 100%; overflow: hidden;
    }
    /* S1 */
    .s1-bg {
      position: absolute; inset: 0;
      background:
        radial-gradient(circle at 5% 3%, rgba(107, 58, 168, 0.22) 0%, transparent 75vw),
        radial-gradient(circle at 98% 97%, rgba(242, 140, 30, 0.26) 0%, transparent 80vw),
        linear-gradient(to bottom, #F6F0FC 0%, #FDF6EE 100%);
    }
    .s1-flower {
      position: absolute; inset: 0;
      background: linear-gradient(135deg, var(--color-purple) 0%, var(--color-orange) 100%);
      opacity: 0.62;
      -webkit-mask-image: radial-gradient(ellipse 52vw 30vh at 50% 39%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,1) 100%), url('./assets/flower-lines-mask.webp');
      mask-image: radial-gradient(ellipse 52vw 30vh at 50% 39%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,1) 100%), url('./assets/flower-lines-mask.webp');
      -webkit-mask-size: cover; mask-size: cover;
    }
    .s1-logo {
      position: absolute; top: 28%; left: 50%; transform: translate(-50%, -50%);
      width: 55vw; max-width: 320px;
    }
    .s1-text-wrap {
      position: absolute; top: 49.7%; left: 50%; transform: translate(-50%, -50%);
      text-align: center; width: 100%;
    }
    .s1-title-1 {
      margin: 0; font-family: 'Playfair Display', Georgia, serif;
      font-size: 10vw; font-weight: 700; color: var(--color-purple-deep);
      letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.1;
    }
    .s1-title-2 {
      margin: 0; font-family: 'Playfair Display', Georgia, serif;
      font-size: 10vw; font-weight: 700; color: var(--color-orange-deep);
      letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.1;
    }
    .s1-divider {
      display: flex; align-items: center; justify-content: center; gap: 3.5vw; margin-top: 0.78em;
    }
    .s1-div-line { width: 13vw; height: 3px; background: var(--color-orange); border-radius: 2px; }
    .s1-div-diamond { width: 1.7vw; height: 1.7vw; min-width: 6px; min-height: 6px; background: var(--color-orange); transform: rotate(45deg); }
    .s1-bottom-fx {
      position: absolute; bottom: 0; left: 0; width: 100%; height: 3px;
      background: linear-gradient(90deg, var(--color-purple), var(--color-orange));
      box-shadow: 0 4px 16px rgba(242, 140, 30, 0.55), 0 35px 70px rgba(0,0,0,0.28);
    }
    /* S2 Counter */
    .counter-block {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 85vw; display: flex; justify-content: space-between;
    }
    .counter-slot {
      width: 23%; aspect-ratio: 100 / 147; position: relative; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .counter-slot svg { width: 100%; height: 100%; }

    /* S3 Poster */
    .poster-wrap {
      position: absolute; inset: 0; background: #FFFFFF;
      display: flex; align-items: center; justify-content: center;
    }
    .poster-img { width: 100%; height: auto; aspect-ratio: 2/3; object-fit: contain; }

    /* S4 Transition */
    .s4-poster {
      position: absolute; inset: 0; transform: translateX(-40vw); z-index: 20;
      background: #FFFFFF; display: flex; align-items: center; justify-content: center;
      box-shadow: 40px 0 80px rgba(0,0,0,0.35);
    }
    .s4-edge {
      position: absolute; top: 0; right: 0; width: 3px; height: 100%;
      background: linear-gradient(to bottom, var(--color-purple), var(--color-orange));
      box-shadow: -4px 0 14px rgba(242, 140, 30, 0.45);
    }

    /* S5 Wheel */
    .wheel-system {
      position: absolute; top: 50vh; left: 12vw; width: 166vw; height: 166vw;
      transform: translate(-50%, -50%);
    }
    .wheel-border {
      position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--color-wheel-border);
    }
    .wheel-disc {
      position: absolute; top: 50%; left: 50%; width: 98vw; height: 98vw;
      transform: translate(-50%, -50%); background: #FFFFFF; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; z-index: 20;
      box-shadow: 0 0 20px rgba(91, 42, 158, 0.08); text-align: center;
      padding-left: 22vw; padding-right: 4vw;
    }
    .disc-title {
      font-family: 'Playfair Display', Georgia, serif; font-size: 5.4vw; font-weight: 700;
      color: var(--color-purple-deep); margin: 0; text-transform: uppercase;
    }
    .disc-title span { font-style: italic; color: var(--color-orange-deep); }
    .disc-script {
      font-family: 'Alex Brush', cursive; font-size: 6.5vw; color: var(--color-orange);
      margin: 0.4vh 0;
    }
    .disc-date {
      font-size: 2.8vw; font-weight: 600; color: var(--color-purple-deep); margin: 0.4vh 0;
    }
    .disc-lines { font-size: 2vw; color: var(--color-purple-text); margin: 0.6vh 0 1vh 0; }
    .disc-btn {
      display: inline-block; min-height: 44px; padding: 10px 28px; background: var(--color-purple);
      color: #FFFFFF; border-radius: 9999px; font-weight: 700; font-size: 3.2vw;
      text-decoration: none; text-transform: uppercase; letter-spacing: 0.1em;
      box-shadow: 0 4px 14px rgba(107, 58, 168, 0.35);
    }
  </style>
</head>
<body>
  <div class="frame-container" id="frame-root">
    ${renderFrameContent(frameId)}
  </div>
</body>
</html>`;
}

function renderFrameContent(id) {
  if (id === 's1') {
    return `
      <div class="s1-bg"></div>
      <div class="s1-flower"></div>
      <img src="./assets/logo-as-sunnah.svg" class="s1-logo" alt="Logo">
      <div class="s1-text-wrap">
        <h1 class="s1-title-1">WELCOME</h1>
        <h2 class="s1-title-2">HOME</h2>
        <div class="s1-divider">
          <div class="s1-div-line"></div>
          <div class="s1-div-diamond"></div>
          <div class="s1-div-line"></div>
        </div>
      </div>
      <div class="s1-bottom-fx"></div>
    `;
  } else if (id.startsWith('s2')) {
    let digits = [0, 0, 0, 0];
    if (id === 's2-state2') digits = [7, 0, 0, 0];
    if (id === 's2-state3') digits = [2, 0, 2, 6];

    return `
      <div class="counter-block">
        ${digits.map(d => `
          <div class="counter-slot">
            <svg viewBox="0 0 100 147">
              <defs>
                <clipPath id="clip-${d}"><path d="${DIGITS[d].path}" fill-rule="evenodd" /></clipPath>
              </defs>
              <g clip-path="url(#clip-${d})">
                <image href="./assets/photos/counter-photo1.webp" width="300%" height="100%" x="-50%" y="0" />
                <rect width="100" height="147" fill="rgba(242, 163, 102, 0.35)" />
              </g>
            </svg>
          </div>
        `).join('')}
      </div>
    `;
  } else if (id.startsWith('s3')) {
    if (id === 's3-state3') {
      return `
        <div class="poster-wrap">
          <img src="./assets/meet-greet-poster.webp" class="poster-img" alt="Poster">
        </div>
      `;
    }
    const scale = id === 's3-state1' ? '2.5' : '8.0';
    return `
      <div class="counter-block" style="transform: translate(-50%, -50%) scale(${scale}); transform-origin: 88% 69%;">
        <div class="counter-slot" style="opacity: ${id === 's3-state1' ? '0.3' : '0'};">
          <svg viewBox="0 0 100 147"><path d="${DIGITS[2].path}" fill="#3B1A6E" fill-rule="evenodd" /></svg>
        </div>
        <div class="counter-slot" style="opacity: ${id === 's3-state1' ? '0.3' : '0'};">
          <svg viewBox="0 0 100 147"><path d="${DIGITS[0].path}" fill="#3B1A6E" fill-rule="evenodd" /></svg>
        </div>
        <div class="counter-slot" style="opacity: ${id === 's3-state1' ? '0.3' : '0'};">
          <svg viewBox="0 0 100 147"><path d="${DIGITS[2].path}" fill="#3B1A6E" fill-rule="evenodd" /></svg>
        </div>
        <div class="counter-slot">
          <svg viewBox="0 0 100 147">
            <defs><clipPath id="clip-6"><path d="${DIGITS[6].path}" fill-rule="evenodd" /></clipPath></defs>
            <g clip-path="url(#clip-6)">
              <image href="./assets/meet-greet-poster.webp" width="100%" height="100%" opacity="${id === 's3-state1' ? '0.4' : '0.85'}" />
              <rect width="100" height="147" fill="#6B3AA8" opacity="${id === 's3-state1' ? '0.4' : '0.15'}" />
            </g>
          </svg>
        </div>
      </div>
    `;
  } else if (id === 's4') {
    return `
      <div class="wheel-system">
        <div class="wheel-border"></div>
        <div class="wheel-disc">
          <div>
            <h2 class="disc-title">WELCOME <span>HOME</span></h2>
            <p class="disc-script">Reunion 2026</p>
            <p class="disc-date">Wednesday, December 16th</p>
            <div class="disc-btn">RSVP</div>
          </div>
        </div>
      </div>
      <div class="s4-poster">
        <img src="./assets/meet-greet-poster.webp" class="poster-img" alt="Poster">
        <div class="s4-edge"></div>
      </div>
    `;
  } else if (id === 's5') {
    return `
      <div class="wheel-system">
        <div class="wheel-border"></div>
        ${Array.from({length: 10}).map((_, i) => `
          <div style="position: absolute; inset: 0; transform: rotate(${i * 36}deg); transform-origin: 50% 50%;">
            <div style="position: absolute; inset: 0; clip-path: polygon(50% 20.48%, 41.2% 21.92%, 34.9% 2.45%, 50% 0%, 65.1% 2.45%, 58.8% 21.92%);">
              <img src="./assets/photos/photo${(i % 5) + 1}.webp" style="position: absolute; top:0; left:28%; width:44%; height:32%; object-fit:cover; filter: contrast(120%) sepia(40%) hue-rotate(240deg);">
            </div>
            <div style="position: absolute; top: 4.8%; left: 50%; transform: translateX(-50%) ${i >= 3 && i <= 7 ? 'rotate(180deg)' : ''};">
              <div style="background: rgba(59,26,110,.88); border: 1px solid rgba(255,255,255,.45); border-radius: 9999px; padding: 3px 8px; color: white; font-size: 2.2vw; font-weight: 600; text-transform: uppercase;">
                Tile ${i+1}
              </div>
            </div>
          </div>
        `).join('')}
        <div class="wheel-disc">
          <div>
            <img src="./assets/logo-as-sunnah.svg" style="width: 38vw; max-width: 160px; margin-bottom: 0.5vh;" alt="Logo">
            <h2 class="disc-title">WELCOME <span>HOME</span></h2>
            <p class="disc-script">Reunion 2026</p>
            <p class="disc-date">Wednesday, December 16th</p>
            <p class="disc-lines">Network • Diversify • Connect • Expand • Evolve</p>
            <div class="disc-btn">RSVP</div>
          </div>
        </div>
      </div>
    `;
  }
}

const frames = [
  's1',
  's2-state1', 's2-state2', 's2-state3',
  's3-state1', 's3-state2', 's3-state3',
  's4',
  's5'
];

const sizes = [
  { name: '360x800', w: 360, h: 800 },
  { name: '720x1280', w: 720, h: 1280 }
];

console.log('Writing static HTML frames and rendering screenshots...');
for (const f of frames) {
  const htmlPath = path.join(HTML_TMP_DIR, `${f}.html`);
  fs.writeFileSync(htmlPath, generateFrameHTML(f));

  for (const s of sizes) {
    const out = path.join(FRAMES_DIR, `${f}_${s.name}.png`);
    execSync(`google-chrome --headless=new --no-sandbox --disable-gpu --user-data-dir=/tmp/ch-fr-profile --window-size=${s.w},${s.h} --screenshot="${out}" "file://${htmlPath}"`, { stdio: 'ignore' });
    console.log(`Rendered ${f} (${s.name})`);
  }
}

console.log('All Figma frames rendered successfully!');
