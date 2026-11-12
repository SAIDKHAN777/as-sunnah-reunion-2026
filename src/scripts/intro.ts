/**
 * AS-SUNNAH REUNION MASTER TIMELINE ENGINE (intro.ts)
 * 
 * Timeline (absolute seconds):
 * 0.00 - 1.00: S1 Welcome card holds (slow zoom 1.00 -> 1.05 across 0-1.9s)
 * 1.00 - 1.87: S1 slides UP and off (cubic-bezier(.65, 0, .35, 1), translateY to -104.7%)
 *              S2 Counter starts underneath at t=1.00 (c = t - 1.00)
 * c 0 - 3.6  : Number runs 0 -> 7000 -> 2035 -> 2030 -> 2026 (S2)
 * c 3.6 - 3.9: Holds 2026
 * c 3.9 - 4.75 (t 4.90 - 5.75): S3 Digit "6" zooms to full screen and becomes poster
 * t 5.75 - 7.00: Poster holds as the last intro card
 * t 7.00 - 7.87: S4 Poster slides LEFT off screen revealing S5 Main Page
 * t >= 7.87  : Intro complete, S5 runs forever
 */

import { counterCurve } from './curve';
import { DIGITS } from './digits';

/**
 * Exact cubic-bezier(0.65, 0, 0.35, 1) solver using Newton-Raphson
 */
function solveCubicBezier(xTarget: number, p1x = 0.65, p1y = 0.0, p2x = 0.35, p2y = 1.0): number {
  if (xTarget <= 0) return 0.0;
  if (xTarget >= 1) return 1.0;
  let t = xTarget;
  for (let i = 0; i < 8; i++) {
    const oneMinusT = 1 - t;
    const xt = 3 * oneMinusT * oneMinusT * t * p1x + 3 * oneMinusT * t * t * p2x + t * t * t;
    const dxdt = 3 * oneMinusT * oneMinusT * p1x + 6 * oneMinusT * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
    const diff = xt - xTarget;
    if (Math.abs(diff) < 1e-6 || Math.abs(dxdt) < 1e-6) break;
    t -= diff / dxdt;
    t = Math.max(0.0, Math.min(1.0, t));
  }
  const oneMinusT = 1 - t;
  return 3 * oneMinusT * oneMinusT * t * p1y + 3 * oneMinusT * t * t * p2y + t * t * t;
}

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export function initIntro() {
  const welcomeCard = document.getElementById('welcome-card');
  const counterContainer = document.getElementById('counter-container');
  const counterCanvas = document.getElementById('counter-canvas') as HTMLCanvasElement | null;
  const posterCard = document.getElementById('poster-card');
  const skipButton = document.getElementById('skip-intro-btn');
  const wheelSystem = document.querySelector<HTMLElement>('.wheel-system');
  const wheelRotator = document.getElementById('wheel-rotator');

  function setWheelPlayState(running: boolean) {
    const state = running ? 'running' : 'paused';
    if (wheelRotator) {
      wheelRotator.style.animationPlayState = state;
    }
    if (wheelSystem) {
      wheelSystem.style.setProperty('--wheel-play-state', state);
    }
  }

  // Core state & resource arrays (declared before any early returns or cleanupIntro)
  let isDone = false;
  let rafId: number | null = null;
  let wheelImagesActivated = false;
  const photos: HTMLImageElement[] = [];
  const posterImg = new Image();

  function activateWheelImages() {
    if (wheelImagesActivated) return;
    wheelImagesActivated = true;
    document.querySelectorAll<HTMLImageElement>('.tile-img').forEach((img) => {
      const pending = img.dataset.src;
      if (pending && !img.getAttribute('src')) {
        img.src = pending;
      }
    });
  }

  // Wire dynamic /content.json with baked-in defaults as fallback
  async function syncDynamicContent() {
    let content: any = null;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params && params.get('preview') === 'draft') {
      try {
        const draft = localStorage.getItem('as_sunnah_admin_content');
        if (draft) content = JSON.parse(draft);
      } catch {}
    }

    if (!content && typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/content.json', { cache: 'no-cache' });
        if (res.ok) content = await res.json();
      } catch {}
    }

    if (!content) return;

    // S5 Center Disc updates
    if (content.centerDisc) {
      const logoImgEl = document.querySelector<HTMLImageElement>('.disc-logo img');
      if (logoImgEl && content.centerDisc.logoUrl && logoImgEl.getAttribute('src') !== content.centerDisc.logoUrl) {
        logoImgEl.src = content.centerDisc.logoUrl;
      }
      const titleEl = document.querySelector('.disc-title');
      if (titleEl) {
        titleEl.innerHTML = `${content.centerDisc.titleRegular || 'WELCOME'} <span class="italic-word">${content.centerDisc.titleItalic || 'HOME'}</span>`;
      }
      const scriptEl = document.querySelector('.disc-script');
      if (scriptEl && content.centerDisc.scriptSubtitle) scriptEl.textContent = content.centerDisc.scriptSubtitle;
      const dateEl = document.querySelector('.disc-date');
      if (dateEl && content.centerDisc.dateLine) dateEl.textContent = content.centerDisc.dateLine;
      const sched1El = document.querySelector('.schedule-line-1');
      if (sched1El && content.centerDisc.scheduleLine1) sched1El.textContent = content.centerDisc.scheduleLine1;
      const sched2El = document.querySelector('.schedule-line-2');
      if (sched2El && content.centerDisc.scheduleLine2) sched2El.textContent = content.centerDisc.scheduleLine2;
    }

    // S1 Welcome Card & S3/S4 Poster updates
    if (content.welcome) {
      const text1 = document.querySelector('.welcome-text-1');
      const text2 = document.querySelector('.welcome-text-2');
      if (text1 && content.welcome.line1) text1.textContent = content.welcome.line1;
      if (text2 && content.welcome.line2) text2.textContent = content.welcome.line2;
      if (content.welcome.posterUrl) {
        posterImg.src = content.welcome.posterUrl;
        const posterDomImg = document.querySelector<HTMLImageElement>('.poster-img');
        if (posterDomImg && posterDomImg.getAttribute('src') !== content.welcome.posterUrl) {
          posterDomImg.src = content.welcome.posterUrl;
        }
      }
    }

    // S5 Wheel updates
    if (content.wheel) {
      if (wheelRotator && content.wheel.rotationDurationSec) {
        wheelRotator.style.setProperty('--wheel-rotation-duration', `${content.wheel.rotationDurationSec}s`);
      }
      if (content.wheel.tiles && Array.isArray(content.wheel.tiles)) {
        const tileImgs = document.querySelectorAll<HTMLImageElement>('.tile-img');
        const chipLabels = document.querySelectorAll<HTMLSpanElement>('.label-chip-title');
        const chipTimes = document.querySelectorAll<HTMLSpanElement>('.label-chip-time');
        const tileClippers = document.querySelectorAll<HTMLElement>('.tile-photo-clipper');
        const chipWrappers = document.querySelectorAll<HTMLElement>('.label-chip-wrapper');
        content.wheel.tiles.forEach((tile: any, idx: number) => {
          if (tileImgs[idx] && tile.photoUrl) {
            if (wheelImagesActivated || tileImgs[idx].getAttribute('src')) {
              if (tileImgs[idx].getAttribute('src') !== tile.photoUrl) {
                tileImgs[idx].src = tile.photoUrl;
              }
            } else {
              tileImgs[idx].dataset.src = tile.photoUrl;
            }
          }
          if (chipLabels[idx] && tile.label) {
            chipLabels[idx].textContent = tile.label;
          }
          if (chipTimes[idx]) {
            const tStr = typeof tile.time === 'string' ? tile.time.trim() : '';
            chipTimes[idx].textContent = tStr;
            chipTimes[idx].classList.toggle('hidden', !tStr);
          }
          const loc = typeof tile.location === 'string' ? tile.location.trim() : '';
          const locName = typeof tile.locationName === 'string' && tile.locationName.trim() ? tile.locationName.trim() : loc;
          const tid = tile.id !== undefined ? String(tile.id) : '';
          if (tileClippers[idx]) {
            tileClippers[idx].dataset.tileId = tid;
            tileClippers[idx].dataset.location = loc;
            tileClippers[idx].dataset.locationName = locName;
            tileClippers[idx].dataset.label = tile.label || `Tile #${idx + 1}`;
            tileClippers[idx].classList.toggle('is-clickable', Boolean(loc));
            if (loc) {
              tileClippers[idx].setAttribute('role', 'button');
              tileClippers[idx].setAttribute('tabindex', '0');
              tileClippers[idx].setAttribute('aria-label', `View campus map for ${locName}`);
            } else {
              tileClippers[idx].removeAttribute('role');
              tileClippers[idx].removeAttribute('tabindex');
              tileClippers[idx].removeAttribute('aria-label');
            }
          }
          if (chipWrappers[idx]) {
            chipWrappers[idx].dataset.tileId = tid;
            chipWrappers[idx].dataset.location = loc;
            chipWrappers[idx].dataset.locationName = locName;
            chipWrappers[idx].dataset.label = tile.label || `Tile #${idx + 1}`;
            chipWrappers[idx].classList.toggle('is-clickable', Boolean(loc));
          }
        });
      }
    }
  }

  // Trigger sync asynchronously
  syncDynamicContent();

  // Reduced motion check (hoisted so wheel map handler respects it)
  const isReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let suppressNextClickUntil = 0;

  function handleTileSelection(targetEl: HTMLElement | null) {
    const clickable = targetEl?.closest('.tile-photo-clipper.is-clickable, .label-chip-wrapper.is-clickable') as HTMLElement | null;
    if (!clickable) return;
    const tileId = clickable.dataset.tileId?.trim() || '';
    const dest = clickable.dataset.location?.trim() || '';
    const label = clickable.dataset.label?.trim() || '';
    window.dispatchEvent(
      new CustomEvent('as-sunnah:open-map', {
        detail: { tileId, dest, label },
      })
    );
  }

  if (wheelRotator) {
    wheelRotator.addEventListener('click', (e) => {
      if (performance.now() < suppressNextClickUntil) return;
      handleTileSelection(e.target as HTMLElement);
    });
    wheelRotator.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const clickable = (e.target as HTMLElement)?.closest('.tile-photo-clipper.is-clickable') as HTMLElement | null;
        if (clickable) {
          e.preventDefault();
          handleTileSelection(clickable);
        }
      }
    });
  }

  // Interactive Scroll, Angular Touch/Mouse Drag & Keyboard Wheel Spin (60fps Compositor Layer)
  const mainPage = document.getElementById('main-page');
  const wheelScrollWrap = document.getElementById('wheel-scroll-wrap');

  let manualAngleDeg = 0;
  let angularVelocity = 0;
  let inertiaRafId: number | null = null;
  let isDraggingWheel = false;
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragTotalDistSq = 0;
  let wheelCenterX = 0;
  let wheelCenterY = 0;
  let lastPointerAngleRad = 0;
  let lastMoveTime = 0;
  let lastInertiaTs = 0;

  function isWheelInteractive(): boolean {
    if (!wheelScrollWrap) return false;
    return isDone || (isDebugFreeze && freezeTime >= 7.87);
  }

  function applyManualWheelRotation() {
    const degStr = `${manualAngleDeg.toFixed(2)}deg`;
    if (wheelScrollWrap) {
      wheelScrollWrap.style.transform = `rotate(${degStr})`;
    }
    if (wheelSystem) {
      wheelSystem.style.setProperty('--wheel-scroll-deg', degStr);
    }
  }

  function stepInertia(now: number) {
    if (isDraggingWheel) {
      inertiaRafId = null;
      angularVelocity = 0;
      return;
    }
    if (!lastInertiaTs) lastInertiaTs = now;
    const dtScale = Math.min(2.5, Math.max(0.25, (now - lastInertiaTs) / 16.667));
    lastInertiaTs = now;

    manualAngleDeg += angularVelocity * dtScale;
    angularVelocity *= Math.pow(0.92, dtScale);
    applyManualWheelRotation();

    if (Math.abs(angularVelocity) >= 0.02) {
      inertiaRafId = requestAnimationFrame(stepInertia);
    } else {
      angularVelocity = 0;
      inertiaRafId = null;
    }
  }

  function kickInertia() {
    if (inertiaRafId === null && Math.abs(angularVelocity) >= 0.02) {
      lastInertiaTs = 0;
      inertiaRafId = requestAnimationFrame(stepInertia);
    }
  }

  // Passive mouse wheel / trackpad scroll spin
  mainPage?.addEventListener('wheel', (e) => {
    if (!isWheelInteractive()) return;
    const rawDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (rawDelta === 0) return;

    const pxDelta = e.deltaMode === 1 ? rawDelta * 28 : (e.deltaMode === 2 ? rawDelta * 300 : rawDelta);
    const impulse = Math.max(-22, Math.min(22, pxDelta * 0.14));

    if (isReducedMotion) {
      manualAngleDeg += impulse;
      applyManualWheelRotation();
    } else {
      manualAngleDeg += impulse * 0.45;
      angularVelocity = Math.max(-14, Math.min(14, angularVelocity * 0.5 + impulse * 0.35));
      applyManualWheelRotation();
      kickInertia();
    }
  }, { passive: true });

  // Angular 1:1 Pointer / Touch Drag-to-Spin (cached wheel rect on pointerdown to prevent reflows)
  mainPage?.addEventListener('pointerdown', (e) => {
    if (!isWheelInteractive() || !wheelSystem) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest('.center-disc a, .center-disc button')) return;

    isDraggingWheel = true;
    dragPointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragTotalDistSq = 0;
    angularVelocity = 0;
    if (inertiaRafId !== null) {
      cancelAnimationFrame(inertiaRafId);
      inertiaRafId = null;
    }

    const rect = wheelSystem.getBoundingClientRect();
    wheelCenterX = rect.left + rect.width / 2;
    wheelCenterY = rect.top + rect.height / 2;
    lastPointerAngleRad = Math.atan2(e.clientY - wheelCenterY, e.clientX - wheelCenterX);
    lastMoveTime = performance.now();
  }, { passive: true });

  window.addEventListener('pointermove', (e) => {
    if (!isDraggingWheel || e.pointerId !== dragPointerId) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const distSq = dx * dx + dy * dy;
    if (distSq > dragTotalDistSq) dragTotalDistSq = distSq;

    const currentAngleRad = Math.atan2(e.clientY - wheelCenterY, e.clientX - wheelCenterX);
    let deltaRad = currentAngleRad - lastPointerAngleRad;
    if (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
    if (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
    lastPointerAngleRad = currentAngleRad;

    // Movement threshold (8px -> distSq >= 64) distinguishes drag from tap cleanly
    if (dragTotalDistSq >= 64) {
      mainPage?.classList.add('is-grabbing');
      const deltaDeg = (deltaRad * 180) / Math.PI;
      manualAngleDeg += deltaDeg;
      applyManualWheelRotation();

      const now = performance.now();
      const dt = Math.max(8, now - lastMoveTime);
      lastMoveTime = now;
      const instVel = (deltaDeg / dt) * 16.667;
      angularVelocity = angularVelocity * 0.4 + Math.max(-18, Math.min(18, instVel)) * 0.6;
    }
  }, { passive: true });

  function finishWheelDrag(e: PointerEvent) {
    if (!isDraggingWheel || e.pointerId !== dragPointerId) return;
    isDraggingWheel = false;
    dragPointerId = null;
    mainPage?.classList.remove('is-grabbing');

    if (dragTotalDistSq >= 64) {
      suppressNextClickUntil = performance.now() + 300;
      if (!isReducedMotion && (performance.now() - lastMoveTime < 120)) {
        kickInertia();
      } else {
        angularVelocity = 0;
      }
    }
  }

  window.addEventListener('pointerup', finishWheelDrag, { passive: true });
  window.addEventListener('pointercancel', finishWheelDrag, { passive: true });

  // Accessible Keyboard Step Rotation Alternative (WCAG 2.2 AA Dragging Movements)
  document.addEventListener('keydown', (e) => {
    if (!isWheelInteractive()) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      manualAngleDeg += 12;
      applyManualWheelRotation();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      manualAngleDeg -= 12;
      applyManualWheelRotation();
    }
  });

  // Check query parameter ?t=SECONDS for deterministic testing / screenshots (only in debug/dev mode)
  // Ignore HH:MM values so ?t=08:50 can simulate the map schedule clock cleanly.
  const isDebugMode = import.meta.env.DEV || import.meta.env.PUBLIC_DEBUG_MODE === 'true';
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const tParam = (isDebugMode && urlParams) ? urlParams.get('t') : null;
  const isNumericDebugParam = tParam !== null && /^\d+(?:\.\d+)?$/.test(tParam.trim());
  const isDebugFreeze = isDebugMode && isNumericDebugParam;
  const freezeTime = isDebugFreeze ? Math.max(0, parseFloat(tParam!)) : 0;

  // Session played check
  const isSessionSeen = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('as_sunnah_intro_seen') === 'true';

  function cleanupIntro(stopRotation = false) {
    if (isDone) return;
    isDone = true;
    activateWheelImages();

    // 1. Cancel requestAnimationFrame clock
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // 2. Reclaim Canvas 2D backing buffer
    if (counterCanvas) {
      counterCanvas.width = 0;
      counterCanvas.height = 0;
    }

    // 3. Clear image cache
    photos.forEach((img) => {
      img.src = '';
    });
    photos.length = 0;
    posterImg.src = '';

    // 4. Detach all intro DOM elements to reclaim DOM tree memory
    welcomeCard?.remove();
    counterContainer?.remove();
    posterCard?.remove();
    skipButton?.remove();

    // 5. Unpause wheel rotation on Main Page
    if (wheelRotator) {
      if (stopRotation) {
        setWheelPlayState(false);
      } else {
        wheelRotator.classList.add('is-rotating');
        setWheelPlayState(true);
      }
    }

    // 6. Record session state
    try {
      sessionStorage.setItem('as_sunnah_intro_seen', 'true');
    } catch {
      // Ignore private browsing quota errors
    }

    console.log('[intro.ts] Intro cleaned up: DOM nodes removed, canvas freed, memory reclaimed.');
  }

  // If reduced motion or session already played (and not debugging ?t=)
  if (!isDebugFreeze && (isReducedMotion || isSessionSeen)) {
    cleanupIntro(isReducedMotion);
    return;
  }

  if (skipButton) {
    skipButton.addEventListener('click', (e) => {
      e.preventDefault();
      cleanupIntro(isReducedMotion);
    });
  }

  if (!counterCanvas) return;
  const ctx = counterCanvas.getContext('2d');
  if (!ctx) return;

  // Pre-compile Path2D objects for numerals 0-9
  const pathMap: Record<number, Path2D> = {};
  for (let d = 0; d <= 9; d++) {
    const glyph = DIGITS[d];
    if (glyph && glyph.path) {
      pathMap[d] = new Path2D(glyph.path);
    }
  }

  // Preload counter & poster photos progressively AFTER initial Welcome load (keeps S1 instantaneous)
  const photoUrls = [
    '/assets/photos/counter-photo1.webp',
    '/assets/photos/counter-photo2.webp',
    '/assets/photos/counter-photo3.webp',
    '/assets/photos/counter-photo4.webp',
    '/assets/photos/counter-photo5.webp',
  ];
  let introMediaStarted = false;
  function loadIntroMedia() {
    if (isDone || introMediaStarted) return;
    introMediaStarted = true;
    photoUrls.forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      photos.push(img);
    });
    if (!posterImg.src) {
      posterImg.src = document.querySelector<HTMLImageElement>('.poster-img')?.getAttribute('src') || '/assets/meet-greet-poster.webp';
    }
  }
  if (isDebugFreeze) {
    loadIntroMedia();
    if (freezeTime >= 6.5) activateWheelImages();
  } else if (document.readyState === 'complete') {
    setTimeout(loadIntroMedia, 20);
  } else {
    window.addEventListener('load', () => setTimeout(loadIntroMedia, 20), { once: true });
  }

  let startTime: number | null = null;

  function resizeCanvas() {
    if (!counterCanvas) return;
    const rect = counterCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (counterCanvas.width !== targetW || counterCanvas.height !== targetH) {
      counterCanvas.width = targetW;
      counterCanvas.height = targetH;
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Primary Timeline Render Function
  function renderFrame(t: number) {
    if (!wheelImagesActivated && t >= 0.40) {
      activateWheelImages();
    }
    resizeCanvas();
    const width = counterCanvas!.width;
    const height = counterCanvas!.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ==========================================
    // S1 WELCOME CARD (0.00s - 1.87s)
    // ==========================================
    if (welcomeCard) {
      const scale = 1.00 + 0.05 * Math.min(1.0, t / 1.9);

      if (t < 1.00) {
        welcomeCard.style.display = 'block';
        welcomeCard.style.transform = `scale(${scale.toFixed(4)})`;
      } else if (t >= 1.00 && t <= 1.87) {
        const p = (t - 1.00) / 0.87;
        const eased = solveCubicBezier(p, 0.65, 0.0, 0.35, 1.0);
        const translateY = -104.7 * eased;
        welcomeCard.style.display = 'block';
        welcomeCard.style.transform = `translate3d(0, ${translateY.toFixed(3)}%, 0) scale(${scale.toFixed(4)})`;
      } else {
        welcomeCard.style.display = 'none';
      }
    }

    // ==========================================
    // S2 & S3 COUNTER REEL TIMELINE (t >= 1.00s)
    // ==========================================
    const c = t - 1.00;

    // S3 Digit 6 Zoom Clock: z = (c - 3.9) / 0.85 in [0, 1] (t in [4.90, 5.75s])
    const z = c >= 3.90 ? Math.min(1.0, (c - 3.90) / 0.85) : 0.0;

    if (c >= 0 && c <= 4.75) {
      if (counterContainer) counterContainer.style.display = 'block';

      ctx!.save();
      ctx!.setTransform(1, 0, 0, 1, 0, 0);

      // Clean background transitioning to pure #FFFFFF at full zoom
      if (z > 0) {
        const bgWhite = Math.min(255, Math.round(253 + 2 * z));
        ctx!.fillStyle = `rgb(${bgWhite}, ${bgWhite}, ${Math.min(255, Math.round(248 + 7 * z))})`;
      } else {
        ctx!.fillStyle = '#FDFDF8';
      }
      ctx!.fillRect(0, 0, width, height);
      ctx!.restore();

      // Continuous number curve N(c)
      const N = counterCurve.interpolate(c);

      // Odometer Mechanics: Higher digits roll ONLY in the last 10% of lower cycles
      const u = N % 10;
      const tensBase = Math.floor(N / 10) % 10;
      const tensRoll = smoothstep(9.0, 10.0, u);
      const tensPos = tensBase + tensRoll;

      const hundBase = Math.floor(N / 100) % 10;
      const hundRoll = smoothstep(90.0, 100.0, N % 100);
      const hundPos = hundBase + hundRoll;

      const thouBase = Math.floor(N / 1000) % 10;
      const thouRoll = smoothstep(900.0, 1000.0, N % 1000);
      const thouPos = thouBase + thouRoll;

      const reelPositions = [thouPos, hundPos, tensPos, u];

      // Geometry: 85vw wide, height = 0.428 * width
      const blockWidth = width * 0.85;
      const blockHeight = blockWidth * 0.428;
      const blockX = (width - blockWidth) / 2;
      const blockY = (height - blockHeight) / 2;

      const gap = width * 0.019;
      const digitWidth = (blockWidth - gap * 3) / 4;
      const digitHeight = blockHeight;

      // Speed-based vertical motion blur
      const speed = Math.abs(counterCurve.derivative(c));
      const blurPx = Math.min(6.0, (speed / 12000.0) * 6.0) * dpr;

      // S3 Camera Zoom Anchor & Scale (z^3 easing)
      // Anchor = center of largest inscribed circle in thickest stroke (lower-left of the bowl of glyph "6")
      // Measured exact coords: relX = 0.256, relY = 0.5306 in (100 x 147), radius = 16.2
      const zEased = z * z * z;
      const r_screen = 16.2 * (digitWidth / 100);
      const halfDiagonal = 0.5 * Math.hypot(width, height);
      // S_end ensures the inscribed circle covers >= 1.05 x half the viewport diagonal
      const S_end = Math.max(27.0, (1.05 * halfDiagonal) / r_screen);
      const zoomScale = 1.0 + (S_end - 1.0) * zEased;

      const reelX3 = blockX + 3 * (digitWidth + gap);
      const reelY3 = blockY;
      const anchorStartX = reelX3 + digitWidth * 0.256;
      const anchorStartY = reelY3 + digitHeight * 0.5306;
      const targetAnchorX = width / 2;
      const targetAnchorY = height / 2;

      const currentAnchorX = anchorStartX * (1 - zEased) + targetAnchorX * zEased;
      const currentAnchorY = anchorStartY * (1 - zEased) + targetAnchorY * zEased;

      // Digits 2, 0, 2 fade out: opacity = clamp(1 - 5*z, 0, 1)
      const fadeDigits = Math.max(0, Math.min(1, 1 - 5 * z));

      // Photo Slideshow Setup (153vw display width)
      const photoDuration = 0.78;
      const photoIdx = Math.floor(c / photoDuration) % photos.length;
      const nextPhotoIdx = (photoIdx + 1) % photos.length;
      const photoProgress = (c % photoDuration) / photoDuration;
      const crossfadeStart = (photoDuration - 0.14) / photoDuration;

      const activePhoto = photos[photoIdx];
      const nextPhoto = photos[nextPhotoIdx];

      const photoDisplayW = 1.53 * width;
      const photoDisplayH = photoDisplayW * (1466 / 1100);
      const kbScale = 1.00 + 0.08 * photoProgress;
      const kbDrift = 0.35 + 0.30 * photoProgress;

      const photoScreenX = width / 2 - kbDrift * photoDisplayW * kbScale;
      const photoScreenY = height / 2 - 0.50 * photoDisplayH * kbScale;
      const photoW = photoDisplayW * kbScale;
      const photoH = photoDisplayH * kbScale;

      // Poster Fullscreen Destination Fit (100vw wide, 2:3 aspect ratio, centered with white letterbox)
      const posterW = width;
      const posterH = width * 1.5;
      const posterX = 0;
      const posterY = (height - posterH) / 2;

      // Crossfade parameters for digit 6 (z in [0.10, 0.70])
      const crossfadePosterAlpha = smoothstep(0.10, 0.70, z);
      const photoAlpha = Math.max(0, 1.0 - crossfadePosterAlpha);

      // --- Draw Reels 0, 1, 2 (Thousands, Hundreds, Tens) ---
      if (fadeDigits > 0) {
        ctx!.save();

        if (blurPx > 0.6) {
          ctx!.filter = `blur(${blurPx.toFixed(1)}px)`;
        }

        if (fadeDigits < 1.0) {
          ctx!.globalAlpha = fadeDigits;
        }

        for (let r = 0; r < 3; r++) {
          const reelX = blockX + r * (digitWidth + gap);
          const reelY = blockY;

          ctx!.save();
          ctx!.beginPath();
          ctx!.rect(reelX, reelY, digitWidth, digitHeight);
          ctx!.clip();

          const currentPos = reelPositions[r];
          const lowerDigit = Math.floor(currentPos) % 10;
          const upperDigit = (lowerDigit + 1) % 10;
          const fraction = currentPos - Math.floor(currentPos);
          const rowSpacing = 1.30 * digitHeight;

          const digitsToDraw = [
            { digit: lowerDigit, offsetY: -fraction * rowSpacing },
            { digit: upperDigit, offsetY: (1 - fraction) * rowSpacing },
          ];

          for (const { digit, offsetY } of digitsToDraw) {
            const dy = reelY + offsetY;
            if (dy + digitHeight < reelY - 0.60 * digitHeight || dy > reelY + 1.60 * digitHeight) {
              continue;
            }

            ctx!.save();
            ctx!.translate(reelX, dy);
            ctx!.scale(digitWidth / 100, digitHeight / 147);

            const path = pathMap[digit];
            if (path) {
              ctx!.save();
              ctx!.clip(path, 'evenodd');

              if (activePhoto && activePhoto.complete && activePhoto.naturalWidth > 0) {
                ctx!.save();
                ctx!.setTransform(1, 0, 0, 1, 0, 0);
                ctx!.drawImage(activePhoto, photoScreenX, photoScreenY, photoW, photoH);

                if (photoProgress > crossfadeStart && nextPhoto && nextPhoto.complete) {
                  const fadeAlpha = smoothstep(crossfadeStart, 1.0, photoProgress);
                  ctx!.globalAlpha = fadeAlpha;
                  ctx!.drawImage(nextPhoto, photoScreenX, photoScreenY, photoW, photoH);
                }
                ctx!.restore();
              } else {
                const grad = ctx!.createLinearGradient(0, 0, 100, 147);
                grad.addColorStop(0, '#3B1A6E');
                grad.addColorStop(1, '#F28C1E');
                ctx!.fillStyle = grad;
                ctx!.fill(path, 'evenodd');
              }
              ctx!.restore();
            }
            ctx!.restore();
          }
          ctx!.restore();
        }
        ctx!.restore();
      }

      // --- Draw Reel 3 (Digit "6" - Zooming and Morphing into Poster) ---
      const r = 3;
      const reelX = blockX + r * (digitWidth + gap);
      const reelY = blockY;

      ctx!.save();

      // Camera Zoom Transform: anchor travels from its reel position to screen center with z^3 easing
      if (z > 0) {
        ctx!.translate(currentAnchorX, currentAnchorY);
        ctx!.scale(zoomScale, zoomScale);
        ctx!.translate(-anchorStartX, -anchorStartY);
      } else if (blurPx > 0.6) {
        ctx!.filter = `blur(${blurPx.toFixed(1)}px)`;
      }

      if (z > 0) {
        // During S3 zoom, ONLY digit 6 is drawn (no odometer reels, no upper/lower pairs)
        ctx!.save();
        ctx!.translate(reelX, reelY);
        ctx!.scale(digitWidth / 100, digitHeight / 147);

        const path = pathMap[6];
        if (path) {
          ctx!.save();
          // Crisp vector clipping mask at any zoom level
          ctx!.clip(path, 'evenodd');

          // Reset to screen coordinates to draw photo and/or poster
          ctx!.save();
          ctx!.setTransform(1, 0, 0, 1, 0, 0);

          // 1. Draw Photo (fades out across z in [0.10, 0.70])
          if (photoAlpha > 0 && activePhoto && activePhoto.complete) {
            ctx!.save();
            ctx!.globalAlpha = photoAlpha;
            ctx!.drawImage(activePhoto, photoScreenX, photoScreenY, photoW, photoH);
            ctx!.restore();
          }

          // 2. Draw Poster (fades in across z in [0.10, 0.70])
          if (crossfadePosterAlpha > 0 && posterImg.complete && posterImg.naturalWidth > 0) {
            ctx!.save();
            ctx!.globalAlpha = crossfadePosterAlpha;
            ctx!.drawImage(posterImg, posterX, posterY, posterW, posterH);

            // 3. Lavender tint (0.86, 0.78, 0.96) easing to white (1, 1, 1) as smoothstep(z, 0.55, 1.00)
            const lavenderT = smoothstep(0.55, 1.00, z);
            if (lavenderT < 1.0) {
              ctx!.save();
              ctx!.globalCompositeOperation = 'multiply';
              const rMult = Math.round((0.86 + 0.14 * lavenderT) * 255);
              const gMult = Math.round((0.78 + 0.22 * lavenderT) * 255);
              const bMult = Math.round((0.96 + 0.04 * lavenderT) * 255);
              ctx!.fillStyle = `rgb(${rMult}, ${gMult}, ${bMult})`;
              ctx!.fillRect(posterX, posterY, posterW, posterH);
              ctx!.restore();
            }
            ctx!.restore();
          } else if (photoAlpha <= 0) {
            ctx!.fillStyle = '#3B1A6E';
            ctx!.fillRect(0, 0, width, height);
          }

          ctx!.restore(); // restore screen coords
          ctx!.restore(); // restore clip
        }
        ctx!.restore(); // restore digit translate
      } else {
        // Normal odometer reel for units digit when z === 0
        ctx!.beginPath();
        ctx!.rect(reelX, reelY, digitWidth, digitHeight);
        ctx!.clip();

        const currentPos = reelPositions[r];
        const lowerDigit = Math.floor(currentPos) % 10;
        const upperDigit = (lowerDigit + 1) % 10;
        const fraction = currentPos - Math.floor(currentPos);
        const rowSpacing = 1.30 * digitHeight;

        const digitsToDraw = [
          { digit: lowerDigit, offsetY: -fraction * rowSpacing },
        ];
        if (fraction > 0.001) {
          digitsToDraw.push({ digit: upperDigit, offsetY: (1 - fraction) * rowSpacing });
        }

        for (const { digit, offsetY } of digitsToDraw) {
          const dy = reelY + offsetY;
          if (dy + digitHeight < reelY - 0.60 * digitHeight || dy > reelY + 1.60 * digitHeight) {
            continue;
          }

          ctx!.save();
          ctx!.translate(reelX, dy);
          ctx!.scale(digitWidth / 100, digitHeight / 147);

          const path = pathMap[digit];
          if (path) {
            ctx!.save();
            ctx!.clip(path, 'evenodd');

            ctx!.save();
            ctx!.setTransform(1, 0, 0, 1, 0, 0);

            if (activePhoto && activePhoto.complete && activePhoto.naturalWidth > 0) {
              ctx!.save();
              ctx!.drawImage(activePhoto, photoScreenX, photoScreenY, photoW, photoH);
              if (photoProgress > crossfadeStart && nextPhoto && nextPhoto.complete) {
                const fadeAlpha = smoothstep(crossfadeStart, 1.0, photoProgress);
                ctx!.globalAlpha = fadeAlpha;
                ctx!.drawImage(nextPhoto, photoScreenX, photoScreenY, photoW, photoH);
              }
              ctx!.restore();
            } else {
              const grad = ctx!.createLinearGradient(0, 0, 100, 147);
              grad.addColorStop(0, '#3B1A6E');
              grad.addColorStop(1, '#F28C1E');
              ctx!.fillStyle = grad;
              ctx!.fill(path, 'evenodd');
            }

            ctx!.restore();
            ctx!.restore();
          }
          ctx!.restore();
        }
      }

      ctx!.restore(); // restore camera zoom
    } else if (c > 4.75 && counterContainer) {
      counterContainer.style.display = 'none';
    }

    // ==========================================
    // S3 & S4 POSTER CARD TIMELINE (t >= 5.75s)
    // ==========================================
    if (posterCard) {
      if (t >= 5.75 && t < 7.00) {
        // Poster holds as the last intro card (100vw wide, centered, white letterbox)
        posterCard.style.display = 'flex';
        posterCard.style.opacity = '1';
        posterCard.style.transform = 'translate3d(0, 0, 0)';
        posterCard.style.filter = 'none';
        const edgeFx = posterCard.querySelector('.right-edge-fx') as HTMLElement | null;
        if (edgeFx) edgeFx.style.opacity = '0';
      } else if (t >= 7.00 && t <= 7.87) {
        // S4: Poster slides LEFT off screen (easeInOutCubic) to -108.3vw
        const p = (t - 7.00) / 0.87;
        const eased = solveCubicBezier(p, 0.65, 0.0, 0.35, 1.0);
        const translateX = -108.3 * eased;
        posterCard.style.display = 'flex';
        posterCard.style.opacity = '1';
        posterCard.style.transform = `translate3d(${translateX.toFixed(2)}vw, 0, 0)`;

        // 3px Gradient Line + Glow + Shadow along right edge
        const edgeFx = posterCard.querySelector('.right-edge-fx') as HTMLElement | null;
        if (edgeFx) edgeFx.style.opacity = '1';

        // Light horizontal blur in the middle 60% (optional, <= 10px)
        if (p > 0.20 && p < 0.80) {
          const blurPx = Math.sin(((p - 0.20) / 0.60) * Math.PI) * 4.0;
          posterCard.style.filter = `blur(${blurPx.toFixed(1)}px)`;
        } else {
          posterCard.style.filter = 'none';
        }

        // Mount / Unpause Main Page underneath starting at rotation 0 at t = 7.00s
        if (wheelRotator) {
          if (isDebugFreeze) {
            const elapsed = Math.max(0, t - 7.00);
            const deg = elapsed * 8; // 8 deg/s
            wheelRotator.style.animation = 'none';
            wheelRotator.style.transform = `rotate(${deg.toFixed(2)}deg)`;
            wheelSystem?.style.setProperty('--wheel-counter-animation', 'none');
            wheelSystem?.style.setProperty('--wheel-rotator-deg', `${deg.toFixed(2)}deg`);
          } else if (!wheelRotator.classList.contains('is-rotating')) {
            wheelRotator.classList.add('is-rotating');
            setWheelPlayState(!isReducedMotion);
          }
        }
      } else if (t > 7.87) {
        if (!isDebugFreeze) {
          cleanupIntro(isReducedMotion);
        } else {
          posterCard.style.display = 'none';
          if (skipButton) skipButton.style.display = 'none';
          if (welcomeCard) welcomeCard.style.display = 'none';
          if (counterContainer) counterContainer.style.display = 'none';
          if (wheelRotator) {
            const elapsed = Math.max(0, t - 7.00);
            const deg = elapsed * 8;
            wheelRotator.style.animation = 'none';
            wheelRotator.style.transform = `rotate(${deg.toFixed(2)}deg)`;
            wheelSystem?.style.setProperty('--wheel-counter-animation', 'none');
            wheelSystem?.style.setProperty('--wheel-rotator-deg', `${deg.toFixed(2)}deg`);
          }
        }
      }
    }
  }

  // Pause wheel rotation when the browser tab is hidden
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      const rotator = document.getElementById('wheel-rotator');
      if (!rotator) return;
      if (document.visibilityState === 'hidden') {
        setWheelPlayState(false);
      } else {
        if (!isReducedMotion && rotator.classList.contains('is-rotating')) {
          setWheelPlayState(true);
        }
      }
    });
  }

  // Expose __seekTime on window ONLY in debug/dev mode behind build flag
  if (isDebugMode && typeof window !== 'undefined') {
    (window as any).__seekTime = (timeInSeconds: number) => {
      renderFrame(timeInSeconds);
    };
  }

  // Debug freeze execution vs requestAnimationFrame loop
  if (isDebugFreeze) {
    console.log(`[intro.ts] Debug mode active: frozen at t=${freezeTime}s`);
    renderFrame(freezeTime);
    window.addEventListener('resize', () => renderFrame(freezeTime));
    return;
  }

  function tick(now: number) {
    if (isDone) return;
    if (!startTime) startTime = now;
    const t = (now - startTime) / 1000.0;

    renderFrame(t);

    if (!isDone) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
}

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntro);
  } else {
    initIntro();
  }
}
