import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import * as pmtiles from 'pmtiles';
import locationsRaw from '../data/locations.json';
import type { LocationsConfig, PlaceLocation } from '../types/locations';
import {
  buildRealisticMapStyle,
  registerRealisticTerrainPatterns,
  setMap3DMode,
} from './map-style';
import {
  computeWalkingFromReporting,
  evaluateAllPlaces,
  formatDistanceBn,
  haversineMeters,
  resolveClock,
  resolveSessionsForPlace,
  type EvaluatedPlace,
  type RawScheduleTile,
  type ScheduleState,
  type SimulationClock,
} from './schedule-status';
import {
  getPinSpriteKey,
  preloadCustomIconMasks,
  registerMapPinSprites,
  registerUserLocationSprite,
} from './map-sprites';

maplibregl.setWorkerUrl(workerUrl);

export interface OpenMapDetail {
  tileId?: string;
  dest?: string;
  label?: string;
  placeId?: string;
}

const locConfig = locationsRaw as LocationsConfig;
const fallbackTiles: RawScheduleTile[] = [];

let mapInstance: maplibregl.Map | null = null;
let initPromise: Promise<maplibregl.Map> | null = null;
let pmtilesProtocolRegistered = false;
let controlsBound = false;
let currentEvaluated: EvaluatedPlace[] = [];
let currentClock: SimulationClock = resolveClock();
let activeTiles: RawScheduleTile[] = fallbackTiles;
let selectedPlaceId: string | null = null;
let userCoords: [number, number] | null = null;
let is3DActive = false;
let labelRafId: number | null = null;
let slowFrameStreak = 0;
let lastFrameTs = 0;

function hasValidCoords(place: PlaceLocation): place is PlaceLocation & { lat: number; lng: number } {
  return (
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng)
  );
}

function getValidPlaces(): Array<PlaceLocation & { lat: number; lng: number }> {
  return (locConfig.places || []).filter(hasValidCoords);
}

function showMapNotice(message: string, tone: 'warn' | 'info' = 'warn') {
  const noticeEl = document.getElementById('event-map-geo-notice');
  const textEl = document.getElementById('event-map-geo-text');
  if (!noticeEl || !textEl) return;
  textEl.textContent = message;
  noticeEl.classList.remove('hidden', 'is-info');
  if (tone === 'info') noticeEl.classList.add('is-info');
}

function hideMapNotice() {
  document.getElementById('event-map-geo-notice')?.classList.add('hidden');
}

function updateUserLocateButtonState(located: boolean) {
  const btn = document.getElementById('event-map-locate-btn');
  if (!btn) return;
  btn.classList.toggle('is-located', located);
}

function isDeviceWeakFor3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return cores <= 2 || (typeof mem === 'number' && mem <= 2);
}

function sync3DButtonUI() {
  const btn = document.getElementById('event-map-3d-btn');
  if (!btn) return;
  btn.classList.toggle('is-active', is3DActive);
  btn.setAttribute('aria-pressed', String(is3DActive));
}

function requestUserLocation(map: maplibregl.Map, silentIfUnavailable = false) {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    if (!silentIfUnavailable) {
      showMapNotice('আপনার ডিভাইসে লোকেশন সার্ভিস পাওয়া যায়নি। ম্যাপের ভেন্যু পিনগুলো স্বাভাবিকভাবে ব্যবহার করতে পারবেন।');
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      userCoords = coords;
      hideMapNotice();
      updateUserLocateButtonState(true);

      const userSrc = map.getSource('user-location') as maplibregl.GeoJSONSource | undefined;
      if (userSrc) {
        userSrc.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { label: 'আপনি এখানে' },
              geometry: { type: 'Point', coordinates: coords },
            },
          ],
        });
      }

      if (!silentIfUnavailable) {
        const campusCenter: [number, number] = locConfig.mapArea?.center || [90.45985, 23.79015];
        const distMeters = haversineMeters(coords, campusCenter);
        if (distMeters <= 12000) {
          map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 17.2), duration: 700 });
        } else {
          showMapNotice(
            `আপনার অবস্থান ভেন্যু থেকে প্রায় ${formatDistanceBn(distMeters)} দূরে দেখা যাচ্ছে। নীল বিন্দুতে আপনার অবস্থান চিহ্নিত হয়েছে।`,
            'info'
          );
          const bounds = new maplibregl.LngLatBounds(coords, coords);
          for (const p of getCoreCampusPlaces()) {
            bounds.extend([p.lng, p.lat]);
          }
          map.fitBounds(bounds, { padding: 56, maxZoom: 16.5, duration: 750 });
        }
      }
    },
    (err) => {
      updateUserLocateButtonState(false);
      if (silentIfUnavailable) return;
      if (err.code === err.PERMISSION_DENIED) {
        showMapNotice(
          'লোকেশন অনুমতি বন্ধ রয়েছে। আপনার অবস্থান দেখতে চাইলে ব্রাউজার সেটিংস থেকে লোকেশন পারমিশন চালু করুন।'
        );
      } else {
        showMapNotice(
          'এই মুহূর্তে আপনার অবস্থান নির্ণয় করা যায়নি। ভেন্যুর পিনগুলোতে ট্যাপ করে সব সময় ও পথ দেখতে পারবেন।'
        );
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

/**
 * Returns core campus places (within ~1.5 km of reporting) so fitBounds keeps camp readable
 * when Auditorium or another venue sits multiple kilometers away.
 */
function getCoreCampusPlaces(): Array<PlaceLocation & { lat: number; lng: number }> {
  const valid = getValidPlaces();
  if (valid.length <= 1) return valid;
  const anchor =
    valid.find((p) => p.id === 'stage') ??
    valid.find((p) => p.id === 'reporting') ??
    valid[0];
  const near = valid.filter(
    (p) => haversineMeters([anchor.lng, anchor.lat], [p.lng, p.lat]) <= 1500
  );
  return near.length > 0 ? near : valid;
}

function fitInitialCampusBounds(map: maplibregl.Map, animate = true) {
  const valid = getValidPlaces();
  if (valid.length === 0) return;
  const anchor =
    valid.find((p) => p.id === 'stage') ??
    valid.find((p) => p.id === 'reporting') ??
    valid[0];
  const hasDistantPin = valid.some(
    (p) => haversineMeters([anchor.lng, anchor.lat], [p.lng, p.lat]) > 1500
  );
  const targets = hasDistantPin ? getCoreCampusPlaces() : valid;

  const bounds = new maplibregl.LngLatBounds();
  for (const p of targets) {
    bounds.extend([p.lng, p.lat]);
  }
  for (const feat of locConfig.overlay?.features || []) {
    if (
      feat.properties?.category &&
      feat.properties.category !== 'scrub-patch' &&
      feat.properties.category !== 'water' &&
      feat.geometry.type === 'Polygon' &&
      feat.geometry.coordinates[0]
    ) {
      for (const [lng, lat] of feat.geometry.coordinates[0]) {
        if (haversineMeters([anchor.lng, anchor.lat], [lng, lat]) <= 400) {
          bounds.extend([lng, lat]);
        }
      }
    }
  }

  map.fitBounds(bounds, {
    padding: { top: 88, right: 48, bottom: 72, left: 48 },
    maxZoom: 17.9,
    duration: animate ? 550 : 0,
  });
}

async function loadLatestScheduleTiles(): Promise<RawScheduleTile[]> {
  try {
    if (typeof window !== 'undefined' && window.location.search.includes('preview=draft')) {
      const draftRaw = localStorage.getItem('as_sunnah_admin_content');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (Array.isArray(draft?.wheel?.tiles)) return draft.wheel.tiles;
      }
    }
    const res = await fetch('/content.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.wheel?.tiles)) return json.wheel.tiles;
    }
  } catch {
    // Offline/static fallback keeps baked-in content.json
  }
  return fallbackTiles;
}

function buildPinsGeoJSON(evaluated: EvaluatedPlace[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: evaluated
      .filter((item) => hasValidCoords(item.place))
      .map((item) => ({
        type: 'Feature',
        id: item.place.id,
        properties: {
          id: item.place.id,
          nameBn: item.place.nameBn,
          nameEn: item.place.nameEn,
          status: item.status,
          spriteKey: getPinSpriteKey(item.place.id, item.status),
          selected: item.place.id === selectedPlaceId ? 1 : 0,
        },
        geometry: {
          type: 'Point',
          coordinates: [item.place.lng as number, item.place.lat as number],
        },
      })),
  };
}

function buildPathsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (locConfig.paths || [])
      .filter((p) => Array.isArray(p.coordinates) && p.coordinates.length >= 2)
      .map((p, idx) => ({
        type: 'Feature',
        properties: {
          id: `${p.from}-${p.to}-${idx}`,
          from: p.from,
          to: p.to,
        },
        geometry: {
          type: 'LineString',
          coordinates: p.coordinates,
        },
      })),
  };
}

function formatStatusLabel(status: ScheduleState): string {
  if (status === 'LIVE') return 'LIVE NOW';
  if (status === 'LOCKED') return 'LOCKED';
  return 'DONE';
}

function closeBottomSheet() {
  document.getElementById('event-map-bottom-sheet')?.classList.add('hidden');
  selectedPlaceId = null;
  if (mapInstance) {
    const src = mapInstance.getSource('campus-pins') as maplibregl.GeoJSONSource | undefined;
    src?.setData(buildPinsGeoJSON(currentEvaluated));
    scheduleOverlayProjection();
  }
}

export function selectPlaceOnMap(placeId: string, flyToPin = false): void {
  const item = currentEvaluated.find((entry) => entry.place.id === placeId);
  if (!item) return;

  selectedPlaceId = placeId;
  if (mapInstance) {
    const src = mapInstance.getSource('campus-pins') as maplibregl.GeoJSONSource | undefined;
    src?.setData(buildPinsGeoJSON(currentEvaluated));
  }

  const sheet = document.getElementById('event-map-bottom-sheet');
  const bnEl = document.getElementById('sheet-place-bn');
  const enEl = document.getElementById('sheet-place-en');
  const badgeEl = document.getElementById('sheet-status-badge');
  const walkEl = document.getElementById('sheet-walk-info');
  const listEl = document.getElementById('sheet-sessions-list');
  const gmapWrap = document.getElementById('sheet-reporting-gmap-wrap');
  const gmapLink = document.getElementById('sheet-reporting-gmap-link') as HTMLAnchorElement | null;

  if (!sheet || !bnEl || !enEl || !badgeEl || !listEl) return;

  bnEl.textContent = item.place.nameBn;
  enEl.textContent = item.place.nameEn;

  badgeEl.className = `sheet-status-pill is-${item.status.toLowerCase()}`;
  badgeEl.textContent = formatStatusLabel(item.status);

  if (walkEl) {
    const walk = computeWalkingFromReporting(locConfig, item.place.id);
    if (walk) {
      walkEl.textContent = walk.summaryBn;
      walkEl.classList.remove('hidden');
    } else {
      walkEl.classList.add('hidden');
    }
  }

  listEl.innerHTML = '';
  if (item.sessions.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'sheet-session-row';
    emptyRow.textContent = 'এই স্থানে এখনো কোনো সেশন নির্ধারিত হয়নি।';
    listEl.appendChild(emptyRow);
  } else {
    for (const s of item.sessions) {
      const row = document.createElement('div');
      row.className = 'sheet-session-row';

      const info = document.createElement('div');
      info.className = 'sheet-session-info';

      const nameEl = document.createElement('p');
      nameEl.className = 'sheet-session-name';
      nameEl.textContent = s.label;

      const timeEl = document.createElement('p');
      timeEl.className = 'sheet-session-time';
      timeEl.textContent = s.timeLabel;

      info.appendChild(nameEl);
      info.appendChild(timeEl);

      const stateEl = document.createElement('span');
      stateEl.className = `sheet-session-state is-${s.status.toLowerCase()}`;
      stateEl.textContent = s.timeMissing ? 'সময় নেই' : s.status;

      row.appendChild(info);
      row.appendChild(stateEl);
      listEl.appendChild(row);
    }
  }

  // Only show Google Maps link inside the main stage card
  if (gmapWrap && gmapLink) {
    const isHub = item.place.id === 'stage' || item.place.id === 'reporting';
    gmapWrap.classList.toggle('hidden', !isHub);
    if (isHub && hasValidCoords(item.place)) {
      gmapLink.href = `https://www.google.com/maps/search/?api=1&query=${item.place.lat},${item.place.lng}`;
    }
  }

  sheet.classList.remove('hidden');

  if (flyToPin && mapInstance && hasValidCoords(item.place)) {
    mapInstance.easeTo({
      center: [item.place.lng, item.place.lat],
      zoom: Math.max(mapInstance.getZoom(), 17.5),
      duration: 600,
    });
  }

  scheduleOverlayProjection();
}

function findMatchingPlaceId(detail: OpenMapDetail): string | null {
  if (detail.placeId) {
    const byId = locConfig.places.find((p) => p.id === detail.placeId);
    if (byId) return byId.id;
  }
  if (detail.tileId) {
    for (const place of locConfig.places) {
      const ids = resolveSessionsForPlace(place, locConfig.sessions || []);
      if (ids.includes(String(detail.tileId))) return place.id;
    }
  }
  return null;
}

interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boxesCollide(a: ScreenBox, b: ScreenBox, pad = 6): boolean {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

/**
 * Renders non-overlapping projected Bengali label chips and off-screen Auditorium directional chip.
 * Rule: Label chips never overlap; if crowded, show only the tapped pin's label.
 */
function updateViewportLabelsAndEdgeChip() {
  labelRafId = null;
  const map = mapInstance;
  const labelsHost = document.getElementById('event-map-labels');
  const canvasEl = document.getElementById('event-map-canvas');
  const edgeBtn = document.getElementById('event-map-edge-chip') as HTMLButtonElement | null;
  const edgeText = document.getElementById('event-map-edge-text');
  if (!map || !labelsHost || !canvasEl) return;

  const w = canvasEl.clientWidth;
  const h = canvasEl.clientHeight;
  if (w === 0 || h === 0) return;

  const sheetEl = document.getElementById('event-map-bottom-sheet');
  const sheetH =
    sheetEl && !sheetEl.classList.contains('hidden') ? sheetEl.offsetHeight + 16 : 16;

  interface ProjectedItem {
    ev: EvaluatedPlace;
    lat: number;
    lng: number;
    x: number;
    y: number;
    inView: boolean;
  }

  const projected: ProjectedItem[] = [];
  for (const ev of currentEvaluated) {
    if (!hasValidCoords(ev.place)) continue;
    const pt = map.project([ev.place.lng, ev.place.lat]);
    const inView = pt.x >= 20 && pt.x <= w - 20 && pt.y >= 56 && pt.y <= h - sheetH - 12;
    projected.push({ ev, lat: ev.place.lat, lng: ev.place.lng, x: pt.x, y: pt.y, inView });
  }

  // Smart multi-slot collision-free placement so all zone labels show clearly without overlap
  const visiblePins = projected.filter((p) => p.inView);
  const score = (p: ProjectedItem) =>
    (p.ev.place.id === selectedPlaceId ? 1000 : 0) +
    (p.ev.status === 'LIVE' ? 100 : p.ev.status === 'LOCKED' ? 20 : 0);
  const ordered = [...visiblePins].sort((a, b) => score(b) - score(a));

  const pinIconBoxes: ScreenBox[] = visiblePins.map((p) => ({
    left: p.x - 20,
    top: p.y - 20,
    right: p.x + 20,
    bottom: p.y + 20,
  }));
  const placedChipBoxes: ScreenBox[] = [];

  labelsHost.innerHTML = '';

  for (const item of ordered) {
    const isSelected = item.ev.place.id === selectedPlaceId;
    const chipText = item.ev.place.nameBn || item.ev.place.nameEn;
    const approxWidth = Math.min(180, Math.max(54, chipText.length * 7.5 + 18));
    const approxHeight = 24;

    const minCenterX = approxWidth / 2 + 8;
    const maxCenterX = w - approxWidth / 2 - 8;
    const clampX = (cx: number) => Math.max(minCenterX, Math.min(maxCenterX, cx));

    const slotBelow = { cx: clampX(item.x), top: item.y + 25 };
    const slotAbove = { cx: clampX(item.x), top: item.y - 49 };
    const slotRight = { cx: item.x + 25 + approxWidth / 2, top: item.y - 12 };
    const slotLeft = { cx: item.x - 25 - approxWidth / 2, top: item.y - 12 };

    // Stagger nearby horizontal neighbors cleanly (e.g. adda & indoor prefer above/right first)
    const id = item.ev.place.id;
    const candidates =
      id === 'adda' || id === 'indoor'
        ? [slotAbove, slotRight, slotBelow, slotLeft]
        : [slotBelow, slotAbove, slotLeft, slotRight];

    let chosen: { cx: number; top: number; box: ScreenBox } | null = null;
    for (const cand of candidates) {
      if (cand.top < 58 || cand.top + approxHeight > h - sheetH) continue;
      if (cand.cx - approxWidth / 2 < 6 || cand.cx + approxWidth / 2 > w - 6) continue;
      const box: ScreenBox = {
        left: cand.cx - approxWidth / 2,
        top: cand.top,
        right: cand.cx + approxWidth / 2,
        bottom: cand.top + approxHeight,
      };
      const hitsPin = pinIconBoxes.some((pb) => boxesCollide(box, pb, 2));
      const hitsChip = placedChipBoxes.some((cb) => boxesCollide(box, cb, 4));
      if (!hitsPin && !hitsChip) {
        chosen = { cx: cand.cx, top: cand.top, box };
        break;
      }
    }

    if (!chosen && isSelected) {
      const fbTop = Math.min(Math.max(60, slotBelow.top), h - sheetH - approxHeight);
      chosen = {
        cx: slotBelow.cx,
        top: fbTop,
        box: {
          left: slotBelow.cx - approxWidth / 2,
          top: fbTop,
          right: slotBelow.cx + approxWidth / 2,
          bottom: fbTop + approxHeight,
        },
      };
    }

    if (!chosen) continue;

    placedChipBoxes.push(chosen.box);

    const chipBtn = document.createElement('button');
    chipBtn.type = 'button';
    chipBtn.className = `map-chip-label is-${item.ev.status.toLowerCase()}${isSelected ? ' is-selected' : ''}`;
    chipBtn.style.left = `${chosen.cx}px`;
    chipBtn.style.top = `${chosen.top}px`;
    chipBtn.textContent = chipText;
    chipBtn.setAttribute('aria-label', `${chipText} বিস্তারিত`);
    chipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectPlaceOnMap(item.ev.place.id, true);
    });
    labelsHost.appendChild(chipBtn);
  }

  // Off-screen Auditorium edge indicator (prioritizes auditorium if off-screen)
  if (edgeBtn && edgeText) {
    const offscreenCandidates = projected
      .filter((p) => !p.inView)
      .sort((a, b) => (a.ev.place.id === 'auditorium' ? -1 : b.ev.place.id === 'auditorium' ? 1 : 0));

    const target = offscreenCandidates[0];
    if (!target) {
      edgeBtn.classList.add('hidden');
      edgeBtn.removeAttribute('data-place-id');
    } else {
      const cLngLat = map.getCenter();
      const dist = haversineMeters([cLngLat.lng, cLngLat.lat], [target.lng, target.lat]);

      // Geographic azimuth -> screen angle (accounting for map bearing cleanly)
      const rad = Math.PI / 180;
      const dLon = (target.lng - cLngLat.lng) * Math.cos(cLngLat.lat * rad);
      const dLat = target.lat - cLngLat.lat;
      const geoAngleRad = Math.atan2(dLon, dLat); // 0 = North, +PI/2 = East
      const screenAngleFromNorth = geoAngleRad - map.getBearing() * rad;
      const vx = Math.sin(screenAngleFromNorth);
      const vy = -Math.cos(screenAngleFromNorth);

      const chipW = 148;
      const chipH = 44;
      const padLeft = 10;
      const padRight = w - chipW - 10;
      const padTop = 62;
      const padBot = Math.max(padTop + 10, h - sheetH - chipH - 8);

      const cx = w / 2;
      const cy = (padTop + padBot) / 2;
      const halfW = Math.max(20, (padRight - padLeft) / 2 + chipW / 2 - 4);
      const halfH = Math.max(20, (padBot - padTop) / 2 + chipH / 2 - 4);

      const tx = Math.abs(vx) > 0.001 ? halfW / Math.abs(vx) : 1e6;
      const ty = Math.abs(vy) > 0.001 ? halfH / Math.abs(vy) : 1e6;
      const t = Math.min(tx, ty);

      const posX = Math.max(padLeft, Math.min(padRight, cx + vx * t - chipW / 2));
      let posY = Math.max(padTop, Math.min(padBot, cy + vy * t - chipH / 2));

      const edgeBox: ScreenBox = {
        left: posX,
        top: posY,
        right: posX + chipW,
        bottom: posY + chipH,
      };
      for (const cb of placedChipBoxes) {
        if (boxesCollide(edgeBox, cb, 6)) {
          posY = Math.max(padTop, cb.top - chipH - 10);
          break;
        }
      }

      const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
      const arrowWrap = edgeBtn.querySelector('.edge-arrow-wrap') as HTMLElement | null;
      if (arrowWrap) arrowWrap.style.transform = `rotate(${deg.toFixed(1)}deg)`;

      edgeText.textContent = `${target.ev.place.nameBn} • ${formatDistanceBn(dist)}`;
      edgeBtn.style.left = `${posX.toFixed(0)}px`;
      edgeBtn.style.top = `${posY.toFixed(0)}px`;
      edgeBtn.setAttribute('data-place-id', target.ev.place.id);
      edgeBtn.classList.remove('hidden');
    }
  }
}

function scheduleOverlayProjection() {
  if (labelRafId !== null || typeof window === 'undefined') return;
  labelRafId = window.requestAnimationFrame(updateViewportLabelsAndEdgeChip);
}

function updateClockBanner(clock: SimulationClock) {
  const banner = document.getElementById('event-map-clock-banner');
  if (!banner) return;
  banner.textContent = clock.isSimulated
    ? `সিমুলেটেড সময়: ${clock.label} (?t=${clock.queryRaw})`
    : `লাইভ সময়: ${clock.label}`;
}

export function bindEventMapControls(): void {
  if (controlsBound) return;
  controlsBound = true;

  document.getElementById('sheet-close-btn')?.addEventListener('click', closeBottomSheet);
  document.getElementById('event-map-geo-dismiss')?.addEventListener('click', hideMapNotice);

  document.getElementById('event-map-locate-btn')?.addEventListener('click', () => {
    if (mapInstance) requestUserLocation(mapInstance, false);
  });

  document.getElementById('event-map-campus-btn')?.addEventListener('click', () => {
    if (mapInstance) {
      closeBottomSheet();
      fitInitialCampusBounds(mapInstance, true);
    }
  });

  document.getElementById('event-map-zoom-in')?.addEventListener('click', () => {
    mapInstance?.zoomIn({ duration: 240 });
  });

  document.getElementById('event-map-zoom-out')?.addEventListener('click', () => {
    mapInstance?.zoomOut({ duration: 240 });
  });

  document.getElementById('event-map-3d-btn')?.addEventListener('click', () => {
    if (!mapInstance) return;
    if (!is3DActive && isDeviceWeakFor3D()) {
      showMapNotice(
        'লো-পাওয়ার বা রিডিউসড মোশন ডিভাইসে দ্রুত পারফরম্যান্সের জন্য 2D মোড সচল রাখা হয়েছে।',
        'info'
      );
      return;
    }
    is3DActive = !is3DActive;
    slowFrameStreak = 0;
    sync3DButtonUI();
    setMap3DMode(mapInstance, is3DActive);
  });

  document.getElementById('event-map-edge-chip')?.addEventListener('click', (e) => {
    const pid = (e.currentTarget as HTMLElement).getAttribute('data-place-id') || 'auditorium';
    selectPlaceOnMap(pid, true);
  });
}

async function ensureMapInitialized(): Promise<maplibregl.Map> {
  if (mapInstance) return mapInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const container = document.getElementById('event-map-gl');
    const placeholder = document.getElementById('event-map-placeholder');
    const statusText = document.getElementById('event-map-placeholder-status');
    const canvasWrap = document.getElementById('event-map-canvas');
    if (!container) throw new Error('Map container #event-map-gl not found');

    if (canvasWrap) canvasWrap.setAttribute('aria-busy', 'true');
    if (statusText) statusText.textContent = 'ম্যাপ ও রুট প্রস্তুত হচ্ছে...';

    activeTiles = await loadLatestScheduleTiles();
    currentClock = resolveClock();
    currentEvaluated = evaluateAllPlaces(
      locConfig.places,
      locConfig.sessions || [],
      activeTiles,
      currentClock.minutes
    );
    updateClockBanner(currentClock);

    if (!pmtilesProtocolRegistered) {
      const protocol = new pmtiles.Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      pmtilesProtocolRegistered = true;
    }

    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const mapStyle = buildRealisticMapStyle({
      origin: window.location.origin,
      pmtilesPath: '/tiles/venue.pmtiles',
      overlay: locConfig.overlay,
    });

    const map = new maplibregl.Map({
      container,
      style: mapStyle,
      center: locConfig.mapArea?.center || [90.45985, 23.79015],
      zoom: locConfig.mapArea?.zoom || 17.2,
      minZoom: 11,
      maxZoom: 19.5,
      attributionControl: { compact: true },
    });

    await new Promise<void>((resolve) => {
      map.once('load', () => resolve());
    });

    await preloadCustomIconMasks();
    registerRealisticTerrainPatterns(map);
    registerMapPinSprites(map, locConfig.places, reducedMotion);
    registerUserLocationSprite(map, reducedMotion);

    // Dotted walking paths (light warm ivory visible on dark olive/green terrain)
    map.addSource('campus-paths', {
      type: 'geojson',
      data: buildPathsGeoJSON(),
    });

    map.addLayer({
      id: 'campus-paths-casing',
      type: 'line',
      source: 'campus-paths',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': 'rgba(26, 30, 20, 0.72)',
        'line-width': 5.6,
      },
    });

    map.addLayer({
      id: 'campus-paths-line',
      type: 'line',
      source: 'campus-paths',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#FFF4DC',
        'line-width': 3,
        'line-dasharray': [0.4, 1.7],
      },
    });

    map.addSource('campus-pins', {
      type: 'geojson',
      data: buildPinsGeoJSON(currentEvaluated),
    });

    map.addLayer({
      id: 'campus-pins-pulse',
      type: 'symbol',
      source: 'campus-pins',
      filter: ['==', ['get', 'status'], 'LIVE'],
      layout: {
        'icon-image': 'live-pin-pulse',
        'icon-size': 1,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    map.addLayer({
      id: 'campus-pins-layer',
      type: 'symbol',
      source: 'campus-pins',
      layout: {
        'icon-image': ['get', 'spriteKey'],
        'icon-size': ['case', ['==', ['get', 'selected'], 1], 1.12, 1.0],
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    map.addSource('user-location', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'user-location-layer',
      type: 'symbol',
      source: 'user-location',
      layout: {
        'icon-image': 'you-are-here-pulse',
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    map.on('click', 'campus-pins-layer', (e) => {
      const feature = e.features?.[0];
      const placeId = feature?.properties?.id;
      if (typeof placeId === 'string') {
        selectPlaceOnMap(placeId, true);
      }
    });

    map.on('mouseenter', 'campus-pins-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'campus-pins-layer', () => {
      map.getCanvas().style.cursor = '';
    });

    // Mid-range phone auto-guard when 3D pitch causes slow rendering frames
    map.on('render', () => {
      scheduleOverlayProjection();
      if (!is3DActive) {
        lastFrameTs = 0;
        slowFrameStreak = 0;
        return;
      }
      const now = performance.now();
      if (lastFrameTs > 0) {
        const dt = now - lastFrameTs;
        if (dt > 55 && dt < 450) {
          slowFrameStreak++;
          if (slowFrameStreak >= 12) {
            is3DActive = false;
            slowFrameStreak = 0;
            sync3DButtonUI();
            setMap3DMode(map, false);
            showMapNotice(
              'মসৃণ পারফরম্যান্স বজায় রাখতে ম্যাপ স্বয়ংক্রিয়ভাবে 2D মোডে ফিরে এসেছে।',
              'info'
            );
          }
        } else {
          slowFrameStreak = 0;
        }
      }
      lastFrameTs = now;
    });

    map.on('move', scheduleOverlayProjection);
    map.on('zoom', scheduleOverlayProjection);
    map.on('resize', scheduleOverlayProjection);

    fitInitialCampusBounds(map, false);

    if (placeholder) placeholder.classList.add('hidden');
    if (canvasWrap) canvasWrap.setAttribute('aria-busy', 'false');

    mapInstance = map;
    scheduleOverlayProjection();
    requestUserLocation(map, true);

    return map;
  })().catch((err) => {
    initPromise = null;
    const statusText = document.getElementById('event-map-placeholder-status');
    const canvasWrap = document.getElementById('event-map-canvas');
    if (statusText) statusText.textContent = 'ম্যাপ লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
    if (canvasWrap) canvasWrap.setAttribute('aria-busy', 'false');
    throw err;
  });

  return initPromise;
}

export async function openEventMapSheet(detail: OpenMapDetail = {}): Promise<void> {
  const map = await ensureMapInitialized();
  map.resize();

  currentClock = resolveClock();
  currentEvaluated = evaluateAllPlaces(
    locConfig.places,
    locConfig.sessions || [],
    activeTiles,
    currentClock.minutes
  );
  updateClockBanner(currentClock);

  const src = map.getSource('campus-pins') as maplibregl.GeoJSONSource | undefined;
  src?.setData(buildPinsGeoJSON(currentEvaluated));

  const targetPlaceId = findMatchingPlaceId(detail);
  if (targetPlaceId) {
    selectPlaceOnMap(targetPlaceId, true);
  } else {
    fitInitialCampusBounds(map, false);
    scheduleOverlayProjection();
  }
}

export type { LocationsConfig, PlaceLocation, RawScheduleTile };
