import type * as maplibregl from 'maplibre-gl';
import type { PlaceIconId, PlaceLocation } from '../types/locations';
import type { ScheduleState } from './schedule-status';

const SPRITE_PIXEL_RATIO = 2;
const PIN_LOGICAL_SIZE = 54;

const ICON_MASK_URLS: Partial<Record<PlaceIconId, string>> = {
  stage: '/assets/map-icons/stage.png',
  cricket: '/assets/map-icons/cricket.png',
  football: '/assets/map-icons/football.png',
  adda: '/assets/map-icons/adda.png',
  mosque: '/assets/map-icons/mosque.png',
  'indoor-games': '/assets/map-icons/indoor-games.png',
};

const loadedIconMasks = new Map<PlaceIconId, HTMLImageElement>();
let preloadMasksPromise: Promise<void> | null = null;

/**
 * Preloads the user-supplied PNG icon masks once before rendering MapLibre pin sprites.
 */
export function preloadCustomIconMasks(): Promise<void> {
  if (preloadMasksPromise) return preloadMasksPromise;

  const entries = Object.entries(ICON_MASK_URLS) as Array<[PlaceIconId, string]>;
  preloadMasksPromise = Promise.all(
    entries.map(
      ([iconId, url]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            loadedIconMasks.set(iconId, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  ).then(() => undefined);

  return preloadMasksPromise;
}

function drawTintedCustomMask(
  ctx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement,
  cx: number,
  cy: number,
  tintColor: string
): void {
  const iconLogicalSize = 23;
  const offPx = Math.round(iconLogicalSize * SPRITE_PIXEL_RATIO);
  const offCanvas = document.createElement('canvas');
  offCanvas.width = offPx;
  offCanvas.height = offPx;
  const offCtx = offCanvas.getContext('2d');
  if (!offCtx) return;

  offCtx.drawImage(maskImg, 0, 0, offPx, offPx);
  offCtx.globalCompositeOperation = 'source-in';
  offCtx.fillStyle = tintColor;
  offCtx.fillRect(0, 0, offPx, offPx);

  ctx.save();
  ctx.drawImage(
    offCanvas,
    cx - iconLogicalSize / 2,
    cy - iconLogicalSize / 2,
    iconLogicalSize,
    iconLogicalSize
  );
  ctx.restore();
}

/**
 * Generates deterministic MapLibre sprite image key per place and state.
 */
export function getPinSpriteKey(placeId: string, status: ScheduleState): string {
  return `pin-${placeId}-${status.toLowerCase()}`;
}

function drawSemanticGlyph(
  ctx: CanvasRenderingContext2D,
  icon: PlaceIconId,
  cx: number,
  cy: number,
  strokeColor: string
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (icon) {
    case 'mosque': {
      // Mosque dome + minaret finial + base
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 7);
      ctx.lineTo(cx - 8, cy + 1);
      ctx.arc(cx, cy + 1, 8, Math.PI, 0, false);
      ctx.lineTo(cx + 8, cy + 7);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy - 11);
      ctx.lineTo(cx, cy - 7);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 7);
      ctx.lineTo(cx + 10, cy + 7);
      ctx.stroke();
      break;
    }
    case 'football': {
      // Football pentagon ball emblem
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = cx + Math.cos(ang) * 4.2;
        const py = cy + Math.sin(ang) * 4.2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'indoor-games': {
      // Indoor game board / hall roof with diagonal game diamond
      ctx.beginPath();
      ctx.roundRect(cx - 8, cy - 7, 16, 14, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 4.5, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 4.5, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'stage':
    case 'auditorium': {
      // Stage arch + podium speaker
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy + 7);
      ctx.lineTo(cx - 9, cy - 1);
      ctx.quadraticCurveTo(cx, cy - 10, cx + 9, cy - 1);
      ctx.lineTo(cx + 9, cy + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 7);
      ctx.lineTo(cx + 4, cy + 7);
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx, cy + 7);
      ctx.stroke();
      break;
    }
    case 'adda': {
      // Friendly hangout / canopy chat emblem
      ctx.beginPath();
      ctx.roundRect(cx - 8, cy - 6, 16, 10, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 4);
      ctx.lineTo(cx - 5, cy + 8);
      ctx.lineTo(cx + 2, cy + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 3.2, cy - 1, 1.3, 0, Math.PI * 2);
      ctx.arc(cx, cy - 1, 1.3, 0, Math.PI * 2);
      ctx.arc(cx + 3.2, cy - 1, 1.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cricket': {
      // Three cricket stumps + bails + ball
      for (const offsetX of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.moveTo(cx + offsetX - 2, cy - 6);
        ctx.lineTo(cx + offsetX - 2, cy + 7);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 6);
      ctx.lineTo(cx + 5, cy - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 6.5, cy + 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'food': {
      // Serving cloche / platter
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 8.5, Math.PI, 0, false);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 7.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 6);
      ctx.lineTo(cx + 10, cy + 6);
      ctx.stroke();
      break;
    }
    case 'reporting':
    case 'gate':
    default: {
      // Welcome archway + check-in desk emblem
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 7);
      ctx.lineTo(cx - 8, cy - 4);
      ctx.lineTo(cx + 8, cy - 4);
      ctx.lineTo(cx + 8, cy + 7);
      ctx.moveTo(cx - 10, cy - 4);
      ctx.lineTo(cx + 10, cy - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

function drawStatusCornerBadge(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  status: ScheduleState
) {
  ctx.save();
  if (status === 'LOCKED') {
    // Purple badge with lock icon
    ctx.beginPath();
    ctx.arc(bx, by, 8.2, 0, Math.PI * 2);
    ctx.fillStyle = '#3B1A6E';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bx, by - 1.5, 2.3, Math.PI, 0, false);
    ctx.strokeStyle = '#FFE8C8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#FFE8C8';
    ctx.fillRect(bx - 3.3, by - 1, 6.6, 4.6);
  } else if (status === 'LIVE') {
    // Glowing orange beacon dot
    ctx.beginPath();
    ctx.arc(bx, by, 7.2, 0, Math.PI * 2);
    ctx.fillStyle = '#F28C1E';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  } else {
    // Grey checkmark badge for DONE
    ctx.beginPath();
    ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#6B7280';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx - 3, by + 0.2);
    ctx.lineTo(bx - 0.8, by + 2.4);
    ctx.lineTo(bx + 3.4, by - 2.2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function renderPinSpriteData(place: PlaceLocation, status: ScheduleState): ImageData {
  const pxSize = PIN_LOGICAL_SIZE * SPRITE_PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = pxSize;
  canvas.height = pxSize;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SPRITE_PIXEL_RATIO, SPRITE_PIXEL_RATIO);

  const cx = PIN_LOGICAL_SIZE / 2;
  const cy = PIN_LOGICAL_SIZE / 2;

  // LIVE (orange, pulsing), LOCKED (purple, lock badge), DONE (grey, check)
  const palette =
    status === 'LIVE'
      ? {
          bg: '#F28C1E',
          ring: '#FFFFFF',
          innerRing: '#3B1A6E',
          icon: '#FFFFFF',
          shadow: 'rgba(242, 140, 30, 0.45)',
        }
      : status === 'LOCKED'
      ? {
          bg: '#6B3AA8',
          ring: '#FFFFFF',
          innerRing: '#3B1A6E',
          icon: '#FFE8C8',
          shadow: 'rgba(59, 26, 110, 0.35)',
        }
      : {
          bg: '#6B7280',
          ring: '#E5E7EB',
          innerRing: '#4B5563',
          icon: '#F9FAFB',
          shadow: 'rgba(31, 41, 55, 0.25)',
        };

  // Ground drop shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy + 2.5, 19, 0, Math.PI * 2);
  ctx.fillStyle = palette.shadow;
  ctx.fill();
  ctx.restore();

  // Outer pin circle (40px visible circle inside 54px hit sprite)
  ctx.beginPath();
  ctx.arc(cx, cy, 18.5, 0, Math.PI * 2);
  ctx.fillStyle = palette.bg;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = palette.ring;
  ctx.stroke();

  // Subtle inner contrast ring
  ctx.beginPath();
  ctx.arc(cx, cy, 15.8, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.innerRing;
  ctx.globalAlpha = 0.28;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const customMask = loadedIconMasks.get(place.icon);
  if (customMask) {
    drawTintedCustomMask(ctx, customMask, cx, cy, palette.icon);
  } else {
    drawSemanticGlyph(ctx, place.icon, cx, cy, palette.icon);
  }
  drawStatusCornerBadge(ctx, cx + 14.5, cy - 13.5, status);

  return ctx.getImageData(0, 0, pxSize, pxSize);
}

/**
 * Registers pulsing halo StyleImageInterface + all place/state icon sprites into MapLibre.
 */
export function registerMapPinSprites(
  map: maplibregl.Map,
  places: PlaceLocation[],
  reducedMotion: boolean
): void {
  if (!map.hasImage('live-pin-pulse')) {
    const pulseSize = 148;
    const pulseImage: maplibregl.StyleImageInterface & { context?: CanvasRenderingContext2D | null } = {
      width: pulseSize,
      height: pulseSize,
      data: new Uint8Array(pulseSize * pulseSize * 4),
      onAdd() {
        const canvas = document.createElement('canvas');
        canvas.width = pulseSize;
        canvas.height = pulseSize;
        this.context = canvas.getContext('2d');
      },
      render() {
        const ctx = this.context;
        if (!ctx) return false;
        const duration = 1500;
        const t = reducedMotion ? 0.45 : (performance.now() % duration) / duration;
        const minR = 26;
        const outerR = minR + (pulseSize / 2 - minR - 6) * t;
        const alpha = reducedMotion ? 0.35 : 0.65 * (1 - t);

        ctx.clearRect(0, 0, pulseSize, pulseSize);
        ctx.beginPath();
        ctx.arc(pulseSize / 2, pulseSize / 2, outerR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242, 140, 30, ${alpha.toFixed(3)})`;
        ctx.fill();

        this.data = ctx.getImageData(0, 0, pulseSize, pulseSize).data;
        if (!reducedMotion) {
          map.triggerRepaint();
        }
        return true;
      },
    };
    map.addImage('live-pin-pulse', pulseImage, { pixelRatio: 2 });
  }

  const statuses: ScheduleState[] = ['LIVE', 'LOCKED', 'DONE'];
  for (const place of places) {
    for (const status of statuses) {
      const key = getPinSpriteKey(place.id, status);
      if (!map.hasImage(key)) {
        const imageData = renderPinSpriteData(place, status);
        map.addImage(key, imageData, { pixelRatio: SPRITE_PIXEL_RATIO });
      }
    }
  }
}

/**
 * Registers animated blue "You are here" pulsing dot sprite (Canvas2D + StyleImageInterface).
 */
export function registerUserLocationSprite(
  map: maplibregl.Map,
  reducedMotion: boolean
): void {
  if (map.hasImage('you-are-here-pulse')) return;

  const w = 160;
  const h = 112;
  const userImage: maplibregl.StyleImageInterface & { context?: CanvasRenderingContext2D | null } = {
    width: w,
    height: h,
    data: new Uint8Array(w * h * 4),
    onAdd() {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      this.context = canvas.getContext('2d');
    },
    render() {
      const ctx = this.context;
      if (!ctx) return false;

      const duration = 1600;
      const t = reducedMotion ? 0.45 : (performance.now() % duration) / duration;
      const cx = w / 2;
      const cy = 40;
      const minR = 14;
      const pulseR = minR + 22 * t;
      const pulseAlpha = reducedMotion ? 0.25 : 0.48 * (1 - t);

      ctx.clearRect(0, 0, w, h);

      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(37, 99, 235, ${pulseAlpha.toFixed(3)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563EB';
      ctx.fill();

      ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Noto Sans Bengali", "Segoe UI", sans-serif';
      const label = 'আপনি এখানে';
      const pillW = Math.ceil(ctx.measureText(label).width) + 20;
      const pillH = 30;
      const pillX = cx - pillW / 2;
      const pillY = 66;

      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 10);
      ctx.fillStyle = '#1D4ED8';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, pillY + pillH / 2 + 1);

      this.data = ctx.getImageData(0, 0, w, h).data;
      if (!reducedMotion) {
        map.triggerRepaint();
      }
      return true;
    },
  };

  map.addImage('you-are-here-pulse', userImage, { pixelRatio: 2 });
}
