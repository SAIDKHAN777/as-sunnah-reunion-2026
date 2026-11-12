import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import * as pmtiles from 'pmtiles';
import locationsRaw from '../data/locations.json';
import type {
  LngLatTuple,
  LocationsConfig,
  OverlayCategory,
  OverlayCollection,
  OverlayFeature,
  PlaceLocation,
} from '../types/locations';
import {
  buildRealisticMapStyle,
  registerRealisticTerrainPatterns,
  setMap3DMode,
  syncOverlaySources,
} from './map-style';
import {
  evaluateAllPlaces,
  formatDistanceBn,
  formatMinutes12h,
  parseTimeToMinutes,
  polylineLengthMeters,
  validateLocationsConfig,
  type RawScheduleTile,
} from './schedule-status';
import {
  getPinSpriteKey,
  preloadCustomIconMasks,
  registerMapPinSprites,
} from './map-sprites';

maplibregl.setWorkerUrl(workerUrl);

type AdminTab = 'places' | 'sessions' | 'paths';

let scheduleTiles: RawScheduleTile[] = [];

let state: LocationsConfig = structuredClone(locationsRaw) as LocationsConfig;
if (!state.overlay) state.overlay = { type: 'FeatureCollection', features: [] };
if (!Array.isArray(state.sessions)) state.sessions = [];
if (!Array.isArray(state.paths)) state.paths = [];

let activeTab: AdminTab = 'places';
let selectedPlaceId: string = state.places[0]?.id || 'reporting';
let previewMinutes = 530; // 8:50 AM default
let is3DActive = false;

// Path drawing state
let drawMode: 'none' | 'path' | 'overlay' = 'none';
let pathDraftCoords: LngLatTuple[] = [];
let editingPathIndex: number | null = null;
let overlayDraftCoords: LngLatTuple[] = [];

let map: maplibregl.Map | null = null;
const pinMarkers = new Map<string, maplibregl.Marker>();
const draftVertexMarkers: maplibregl.Marker[] = [];

function hasPinCoords(p: PlaceLocation): p is PlaceLocation & { lat: number; lng: number } {
  return (
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng)
  );
}

function showToast(msg: string) {
  const el = document.getElementById('admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  window.setTimeout(() => el.classList.add('hidden'), 2600);
}

function normalizeExportJSON(): LocationsConfig {
  const validPlaceIds = new Set(state.places.map((p) => p.id));
  const cleanPlaces = state.places.map((p) => ({
    id: p.id,
    nameBn: p.nameBn,
    nameEn: p.nameEn,
    lat: p.lat !== null ? Number(p.lat.toFixed(6)) : null,
    lng: p.lng !== null ? Number(p.lng.toFixed(6)) : null,
    icon: p.icon,
  }));

  const cleanSessions = state.sessions
    .filter((s) => s.placeId && validPlaceIds.has(s.placeId))
    .map((s) => ({
      sessionId: String(s.sessionId),
      placeId: String(s.placeId),
    }));

  const cleanPaths = state.paths.map((p) => ({
    from: p.from,
    to: p.to,
    coordinates: p.coordinates.map(([lng, lat]) => [
      Number(lng.toFixed(6)),
      Number(lat.toFixed(6)),
    ] as LngLatTuple),
  }));

  return {
    places: cleanPlaces,
    sessions: cleanSessions,
    paths: cleanPaths,
    mapArea: state.mapArea,
    overlay: state.overlay,
  };
}

function refreshValidationUI() {
  const banner = document.getElementById('validation-banner');
  const copyBtn = document.getElementById('btn-copy-json') as HTMLButtonElement | null;
  const dlBtn = document.getElementById('btn-download-json') as HTMLButtonElement | null;
  if (!banner) return;

  const report = validateLocationsConfig(state, scheduleTiles);
  banner.innerHTML = '';

  const hasBlockers = !report.canExport;
  banner.className = `validation-banner ${hasBlockers ? 'has-errors' : 'is-ok'}`;

  for (const mp of report.missingPins) {
    const pill = document.createElement('span');
    pill.className = 'val-pill is-error';
    pill.textContent = `Missing pin: ${mp.nameEn} (${mp.id})`;
    banner.appendChild(pill);
  }

  for (const us of report.unassignedSessions) {
    const pill = document.createElement('span');
    pill.className = 'val-pill is-error';
    pill.textContent = `Unassigned session: ${us.label.trim()} (${us.time || 'no time'})`;
    banner.appendChild(pill);
  }

  for (const mt of report.missingTimeSessions) {
    const pill = document.createElement('span');
    pill.className = 'val-pill is-warn';
    pill.textContent = `Warning — time missing in content.json: ${mt.label.trim()} (id: ${mt.id})`;
    banner.appendChild(pill);
  }

  if (!hasBlockers) {
    const okPill = document.createElement('span');
    okPill.className = 'val-pill is-ok';
    okPill.textContent = 'Ready to export (all pins set & all sessions assigned)';
    banner.appendChild(okPill);
  }

  if (copyBtn) copyBtn.disabled = hasBlockers;
  if (dlBtn) dlBtn.disabled = hasBlockers;
}

function syncMapPinsAndPaths() {
  if (!map) return;

  const evaluated = evaluateAllPlaces(
    state.places,
    state.sessions,
    scheduleTiles,
    previewMinutes
  );

  // Sync sprite pin GeoJSON source
  const pinSrc = map.getSource('admin-pins') as maplibregl.GeoJSONSource | undefined;
  if (pinSrc) {
    pinSrc.setData({
      type: 'FeatureCollection',
      features: evaluated
        .filter((item) => hasPinCoords(item.place))
        .map((item) => ({
          type: 'Feature',
          properties: {
            id: item.place.id,
            status: item.status,
            spriteKey: getPinSpriteKey(item.place.id, item.status),
            label: item.place.nameBn,
          },
          geometry: {
            type: 'Point',
            coordinates: [item.place.lng as number, item.place.lat as number],
          },
        })),
    });
  }

  // Sync draggable markers for placed pins
  for (const place of state.places) {
    const existing = pinMarkers.get(place.id);
    if (!hasPinCoords(place)) {
      if (existing) {
        existing.remove();
        pinMarkers.delete(place.id);
      }
      continue;
    }

    if (!existing) {
      const handleEl = document.createElement('div');
      handleEl.style.width = '20px';
      handleEl.style.height = '20px';
      handleEl.style.borderRadius = '50%';
      handleEl.style.border = '2px solid #FFFFFF';
      handleEl.style.background = place.id === selectedPlaceId ? '#F28C1E' : 'rgba(59,26,110,0.85)';
      handleEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.45)';
      handleEl.style.cursor = 'grab';
      handleEl.title = `Drag ${place.nameEn}`;

      const marker = new maplibregl.Marker({ element: handleEl, draggable: true, anchor: 'center' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        place.lat = Number(ll.lat.toFixed(6));
        place.lng = Number(ll.lng.toFixed(6));
        selectedPlaceId = place.id;
        renderPlacesList();
        refreshValidationUI();
        syncMapPinsAndPaths();
      });

      pinMarkers.set(place.id, marker);
    } else {
      existing.setLngLat([place.lng, place.lat]);
      const el = existing.getElement();
      el.style.background = place.id === selectedPlaceId ? '#F28C1E' : 'rgba(59,26,110,0.85)';
    }
  }

  // Sync saved walking paths
  const pathSrc = map.getSource('admin-paths') as maplibregl.GeoJSONSource | undefined;
  if (pathSrc) {
    pathSrc.setData({
      type: 'FeatureCollection',
      features: state.paths.map((p, idx) => ({
        type: 'Feature',
        properties: { idx },
        geometry: { type: 'LineString', coordinates: p.coordinates },
      })),
    });
  }

  // Sync draft geometry (path or overlay)
  const draftSrc = map.getSource('admin-draft') as maplibregl.GeoJSONSource | undefined;
  if (draftSrc) {
    const activeCoords = drawMode === 'path' ? pathDraftCoords : overlayDraftCoords;
    const features: GeoJSON.Feature[] = [];
    if (activeCoords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { kind: 'line' },
        geometry: { type: 'LineString', coordinates: activeCoords },
      });
    }
    if (
      drawMode === 'overlay' &&
      activeCoords.length >= 3 &&
      (document.getElementById('overlay-cat-select') as HTMLSelectElement | null)?.value !== 'dirt-road'
    ) {
      features.push({
        type: 'Feature',
        properties: { kind: 'poly' },
        geometry: { type: 'Polygon', coordinates: [[...activeCoords, activeCoords[0]]] },
      });
    }
    draftSrc.setData({ type: 'FeatureCollection', features });
  }

  // Sync vertex handles for active draft
  while (draftVertexMarkers.length > 0) {
    draftVertexMarkers.pop()?.remove();
  }
  const vertexCoords = drawMode === 'path' ? pathDraftCoords : overlayDraftCoords;
  if (drawMode !== 'none' && map) {
    vertexCoords.forEach((pt, idx) => {
      const dot = document.createElement('div');
      dot.style.width = '14px';
      dot.style.height = '14px';
      dot.style.borderRadius = '50%';
      dot.style.background = '#FFE8C8';
      dot.style.border = '2px solid #F28C1E';
      dot.style.cursor = 'grab';
      const vm = new maplibregl.Marker({ element: dot, draggable: true })
        .setLngLat(pt)
        .addTo(map!);
      vm.on('dragend', () => {
        const ll = vm.getLngLat();
        vertexCoords[idx] = [Number(ll.lng.toFixed(6)), Number(ll.lat.toFixed(6))];
        syncMapPinsAndPaths();
      });
      draftVertexMarkers.push(vm);
    });
  }

  syncOverlaySources(map, state.overlay);
}

function renderPlacesList() {
  const host = document.getElementById('places-list');
  if (!host) return;
  host.innerHTML = '';

  const evaluated = evaluateAllPlaces(
    state.places,
    state.sessions,
    scheduleTiles,
    previewMinutes
  );

  for (const item of evaluated) {
    const p = item.place;
    const isSet = hasPinCoords(p);
    const card = document.createElement('div');
    card.className = `admin-card ${p.id === selectedPlaceId ? 'is-selected' : ''}`;

    const top = document.createElement('div');
    top.className = 'admin-card-top';

    const titleWrap = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'admin-card-title';
    title.textContent = `${p.nameBn} (${p.id})`;
    const sub = document.createElement('p');
    sub.className = 'admin-card-sub';
    sub.textContent = `${p.nameEn} • ${item.status} (${item.sessions.length} sessions)`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const badge = document.createElement('span');
    badge.className = `pin-badge ${isSet ? 'is-set' : 'is-missing'}`;
    badge.textContent = isSet ? 'pin set' : 'missing';

    top.appendChild(titleWrap);
    top.appendChild(badge);
    card.appendChild(top);

    const coordsEl = document.createElement('div');
    coordsEl.className = 'coords-mono';
    coordsEl.textContent = isSet
      ? `lat: ${(p.lat as number).toFixed(6)}, lng: ${(p.lng as number).toFixed(6)}`
      : 'Coordinates missing — click row & tap map';
    card.appendChild(coordsEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'card-btn-row';

    const flyBtn = document.createElement('button');
    flyBtn.type = 'button';
    flyBtn.className = 'mini-btn is-primary';
    flyBtn.textContent = isSet ? 'Select & Fly' : 'Select to Place';
    flyBtn.addEventListener('click', () => {
      selectedPlaceId = p.id;
      drawMode = 'none';
      renderPlacesList();
      syncMapPinsAndPaths();
      updateModeBanner();
      if (isSet && map) {
        map.flyTo({ center: [p.lng as number, p.lat as number], zoom: 17.6, duration: 550 });
      }
    });
    btnRow.appendChild(flyBtn);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'mini-btn is-danger';
    clearBtn.textContent = 'Clear Pin';
    clearBtn.disabled = !isSet;
    clearBtn.addEventListener('click', () => {
      p.lat = null;
      p.lng = null;
      selectedPlaceId = p.id;
      renderPlacesList();
      refreshValidationUI();
      syncMapPinsAndPaths();
    });
    btnRow.appendChild(clearBtn);

    card.appendChild(btnRow);
    host.appendChild(card);
  }
}

function renderSessionsList() {
  const host = document.getElementById('sessions-list');
  if (!host) return;
  host.innerHTML = '';

  const assignMap = new Map<string, string>();
  for (const s of state.sessions) {
    assignMap.set(String(s.sessionId), s.placeId);
  }

  for (const tile of scheduleTiles) {
    const sid = String(tile.id);
    const currentPlaceId = assignMap.get(sid) || '';
    const timeMissing = parseTimeToMinutes(tile.time) === null;

    const card = document.createElement('div');
    card.className = 'admin-card';
    if (!currentPlaceId) card.style.borderColor = '#EF4444';

    const top = document.createElement('div');
    top.className = 'admin-card-top';

    const info = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'admin-card-title';
    title.textContent = `${tile.label.trim()} (#${sid})`;
    const sub = document.createElement('p');
    sub.className = 'admin-card-sub';
    sub.textContent = timeMissing ? 'time missing in content.json' : `Time: ${tile.time}`;
    if (timeMissing) sub.style.color = '#B45309';
    info.appendChild(title);
    info.appendChild(sub);

    const badge = document.createElement('span');
    badge.className = `pin-badge ${currentPlaceId ? 'is-set' : 'is-missing'}`;
    badge.textContent = currentPlaceId ? 'assigned' : 'unassigned';

    top.appendChild(info);
    top.appendChild(badge);
    card.appendChild(top);

    const select = document.createElement('select');
    select.className = 'field-select';
    select.setAttribute('aria-label', `Where is ${tile.label.trim()}?`);

    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = 'Where? -- Unassigned --';
    select.appendChild(blankOpt);

    for (const p of state.places) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.nameEn} (${p.nameBn})`;
      if (p.id === currentPlaceId) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const val = select.value;
      state.sessions = state.sessions.filter((s) => String(s.sessionId) !== sid);
      if (val) {
        state.sessions.push({ sessionId: sid, placeId: val });
      }
      renderSessionsList();
      renderPlacesList();
      refreshValidationUI();
      syncMapPinsAndPaths();
    });

    card.appendChild(select);
    host.appendChild(card);
  }
}

function populatePathPlaceSelects() {
  const fromEl = document.getElementById('path-from-select') as HTMLSelectElement | null;
  const toEl = document.getElementById('path-to-select') as HTMLSelectElement | null;
  if (!fromEl || !toEl) return;
  const prevFrom = fromEl.value || state.places[0]?.id || 'stage';
  const prevTo = toEl.value || state.places[1]?.id || 'adda';
  fromEl.innerHTML = '';
  toEl.innerHTML = '';
  for (const p of state.places) {
    const o1 = new Option(`${p.nameEn} (${p.id})`, p.id);
    const o2 = new Option(`${p.nameEn} (${p.id})`, p.id);
    fromEl.add(o1);
    toEl.add(o2);
  }
  fromEl.value = state.places.some((p) => p.id === prevFrom) ? prevFrom : state.places[0]?.id || '';
  toEl.value = state.places.some((p) => p.id === prevTo) ? prevTo : state.places[1]?.id || '';
}

function updatePathControlsUI() {
  const undoBtn = document.getElementById('btn-undo-path') as HTMLButtonElement | null;
  const saveBtn = document.getElementById('btn-save-path') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('btn-cancel-path');
  const statusEl = document.getElementById('path-draft-status');

  const drawingPath = drawMode === 'path';
  if (undoBtn) undoBtn.disabled = !drawingPath || pathDraftCoords.length === 0;
  if (saveBtn) saveBtn.disabled = !drawingPath || pathDraftCoords.length < 2;
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !drawingPath);
  if (statusEl) {
    if (!drawingPath) {
      statusEl.textContent = 'Not drawing.';
    } else {
      const len = polylineLengthMeters(pathDraftCoords);
      statusEl.textContent = `${pathDraftCoords.length} pts • ${Math.round(len)} m — tap map to add points, drag vertices to adjust.`;
    }
  }
}

function updateOverlayControlsUI() {
  const undoBtn = document.getElementById('btn-undo-overlay') as HTMLButtonElement | null;
  const saveBtn = document.getElementById('btn-save-overlay') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('btn-cancel-overlay');
  const statusEl = document.getElementById('overlay-draft-status');
  const cat = (document.getElementById('overlay-cat-select') as HTMLSelectElement | null)?.value;
  const minPts = cat === 'dirt-road' ? 2 : 3;

  const drawing = drawMode === 'overlay';
  if (undoBtn) undoBtn.disabled = !drawing || overlayDraftCoords.length === 0;
  if (saveBtn) saveBtn.disabled = !drawing || overlayDraftCoords.length < minPts;
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !drawing);
  if (statusEl) {
    statusEl.textContent = drawing
      ? `${overlayDraftCoords.length} pts placed (need >= ${minPts})`
      : 'Not drawing overlay.';
  }
}

function renderPathsAndOverlayLists() {
  const pathsHost = document.getElementById('paths-list');
  if (pathsHost) {
    pathsHost.innerHTML = '';
    state.paths.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'admin-card';
      const len = polylineLengthMeters(p.coordinates);
      const mins = Math.max(1, Math.round(len / 72));

      const top = document.createElement('div');
      top.className = 'admin-card-top';
      const title = document.createElement('p');
      title.className = 'admin-card-title';
      title.textContent = `${p.from} -> ${p.to}`;
      const sub = document.createElement('span');
      sub.className = 'coords-mono';
      sub.textContent = `${p.coordinates.length} pts • ${formatDistanceBn(len)} (~${mins}m)`;
      top.appendChild(title);
      top.appendChild(sub);
      card.appendChild(top);

      const row = document.createElement('div');
      row.className = 'card-btn-row';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'mini-btn is-primary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        drawMode = 'path';
        editingPathIndex = idx;
        pathDraftCoords = p.coordinates.map((c) => [...c] as LngLatTuple);
        const fromEl = document.getElementById('path-from-select') as HTMLSelectElement | null;
        const toEl = document.getElementById('path-to-select') as HTMLSelectElement | null;
        if (fromEl) fromEl.value = p.from;
        if (toEl) toEl.value = p.to;
        updatePathControlsUI();
        updateModeBanner();
        syncMapPinsAndPaths();
        if (map && pathDraftCoords[0]) {
          map.flyTo({ center: pathDraftCoords[0], zoom: 17.6, duration: 500 });
        }
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'mini-btn is-danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        state.paths.splice(idx, 1);
        renderPathsAndOverlayLists();
        syncMapPinsAndPaths();
      });

      row.appendChild(editBtn);
      row.appendChild(delBtn);
      card.appendChild(row);
      pathsHost.appendChild(card);
    });
  }

  const ovHost = document.getElementById('overlay-list');
  if (ovHost && state.overlay) {
    ovHost.innerHTML = '';
    state.overlay.features.forEach((feat, idx) => {
      const card = document.createElement('div');
      card.className = 'admin-card';
      const top = document.createElement('div');
      top.className = 'admin-card-top';

      const title = document.createElement('p');
      title.className = 'admin-card-title';
      title.textContent = `${feat.properties.category}${feat.properties.label ? ` — ${feat.properties.label}` : ''}`;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'mini-btn is-danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        state.overlay?.features.splice(idx, 1);
        renderPathsAndOverlayLists();
        syncMapPinsAndPaths();
      });

      top.appendChild(title);
      top.appendChild(delBtn);
      card.appendChild(top);
      ovHost.appendChild(card);
    });
  }
}

function updateModeBanner() {
  const banner = document.getElementById('admin-map-banner');
  if (!banner) return;
  if (drawMode === 'path') {
    banner.textContent = 'Drawing Path: tap map to add points, drag dots to refine, then click Save Path.';
  } else if (drawMode === 'overlay') {
    banner.textContent = 'Drawing Terrain Overlay: tap vertices on map, then click Add Shape.';
  } else if (activeTab === 'places') {
    const active = state.places.find((p) => p.id === selectedPlaceId);
    banner.textContent = `Places: Tap map to move "${active?.nameEn || selectedPlaceId}" or drag any pin.`;
  } else {
    banner.textContent = 'Preview active — adjust time slider or switch back to Places / Paths to edit.';
  }
}

function fitCampusView() {
  if (!map) return;
  const anchor =
    state.places.find((p) => (p.id === 'stage' || p.id === 'reporting') && hasPinCoords(p)) ??
    state.places.find(hasPinCoords);
  const near = state.places.filter(hasPinCoords).filter((p) => {
    if (!anchor || !hasPinCoords(anchor)) return true;
    const dx = (p.lng - anchor.lng) * 111000;
    const dy = (p.lat - anchor.lat) * 111000;
    return Math.hypot(dx, dy) <= 1500;
  });
  const b = new maplibregl.LngLatBounds();
  near.forEach((p) => b.extend([p.lng, p.lat]));
  if (!b.isEmpty()) map.fitBounds(b, { padding: 54, maxZoom: 17.6, duration: 450 });
}

function fitAllPinsView() {
  if (!map) return;
  const b = new maplibregl.LngLatBounds();
  state.places.filter(hasPinCoords).forEach((p) => b.extend([p.lng, p.lat]));
  if (!b.isEmpty()) map.fitBounds(b, { padding: 54, maxZoom: 17.5, duration: 450 });
}

function bindTabsAndActions() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab') as AdminTab;
      if (!target) return;
      activeTab = target;
      if (target !== 'paths') drawMode = 'none';

      document.querySelectorAll('.tab-btn').forEach((b) => {
        const isMe = b === btn;
        b.classList.toggle('is-active', isMe);
        b.setAttribute('aria-selected', String(isMe));
      });

      document.getElementById('tab-panel-places')?.classList.toggle('hidden', target !== 'places');
      document.getElementById('tab-panel-sessions')?.classList.toggle('hidden', target !== 'sessions');
      document.getElementById('tab-panel-paths')?.classList.toggle('hidden', target !== 'paths');
      updateModeBanner();
      syncMapPinsAndPaths();
    });
  });

  const slider = document.getElementById('preview-time-slider') as HTMLInputElement | null;
  const disp = document.getElementById('preview-time-display');
  const setPreviewMins = (m: number) => {
    previewMinutes = m;
    if (slider) slider.value = String(m);
    if (disp) disp.textContent = formatMinutes12h(m);
    renderPlacesList();
    syncMapPinsAndPaths();
  };

  slider?.addEventListener('input', () => {
    setPreviewMins(Number(slider.value));
  });

  document.querySelectorAll('.quick-t-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = Number(btn.getAttribute('data-mins'));
      if (Number.isFinite(m)) setPreviewMins(m);
    });
  });

  // Path drawing controls
  document.getElementById('btn-draw-path')?.addEventListener('click', () => {
    drawMode = 'path';
    editingPathIndex = null;
    const fromId = (document.getElementById('path-from-select') as HTMLSelectElement | null)?.value;
    const fromPlace = state.places.find((p) => p.id === fromId && hasPinCoords(p));
    pathDraftCoords =
      fromPlace && hasPinCoords(fromPlace)
        ? [[Number(fromPlace.lng.toFixed(6)), Number(fromPlace.lat.toFixed(6))]]
        : [];
    updatePathControlsUI();
    updateOverlayControlsUI();
    updateModeBanner();
    syncMapPinsAndPaths();
  });

  document.getElementById('btn-undo-path')?.addEventListener('click', () => {
    pathDraftCoords.pop();
    updatePathControlsUI();
    syncMapPinsAndPaths();
  });

  document.getElementById('btn-cancel-path')?.addEventListener('click', () => {
    drawMode = 'none';
    editingPathIndex = null;
    pathDraftCoords = [];
    updatePathControlsUI();
    updateModeBanner();
    syncMapPinsAndPaths();
  });

  document.getElementById('btn-save-path')?.addEventListener('click', () => {
    if (pathDraftCoords.length < 2) return;
    const from = (document.getElementById('path-from-select') as HTMLSelectElement).value;
    const to = (document.getElementById('path-to-select') as HTMLSelectElement).value;
    if (from === to) {
      showToast('Choose two different places for From and To.');
      return;
    }
    const newPath = {
      from,
      to,
      coordinates: pathDraftCoords.map((c) => [...c] as LngLatTuple),
    };
    if (editingPathIndex !== null && state.paths[editingPathIndex]) {
      state.paths[editingPathIndex] = newPath;
    } else {
      state.paths.push(newPath);
    }
    drawMode = 'none';
    editingPathIndex = null;
    pathDraftCoords = [];
    updatePathControlsUI();
    renderPathsAndOverlayLists();
    updateModeBanner();
    syncMapPinsAndPaths();
    showToast('Walking path saved.');
  });

  // Overlay drawing controls
  document.getElementById('btn-draw-overlay')?.addEventListener('click', () => {
    drawMode = 'overlay';
    overlayDraftCoords = [];
    updatePathControlsUI();
    updateOverlayControlsUI();
    updateModeBanner();
    syncMapPinsAndPaths();
  });

  document.getElementById('btn-undo-overlay')?.addEventListener('click', () => {
    overlayDraftCoords.pop();
    updateOverlayControlsUI();
    syncMapPinsAndPaths();
  });

  document.getElementById('btn-cancel-overlay')?.addEventListener('click', () => {
    drawMode = 'none';
    overlayDraftCoords = [];
    updateOverlayControlsUI();
    updateModeBanner();
    syncMapPinsAndPaths();
  });

  document.getElementById('btn-save-overlay')?.addEventListener('click', () => {
    const cat = ((document.getElementById('overlay-cat-select') as HTMLSelectElement).value ||
      'building') as OverlayCategory;
    const label = (document.getElementById('overlay-label-input') as HTMLInputElement).value.trim();
    if (!state.overlay) state.overlay = { type: 'FeatureCollection', features: [] };

    const id = `custom-${cat}-${Date.now().toString(36)}`;
    let feat: OverlayFeature;
    if (cat === 'dirt-road') {
      if (overlayDraftCoords.length < 2) return;
      feat = {
        type: 'Feature',
        properties: { id, category: cat, ...(label ? { label } : {}) },
        geometry: { type: 'LineString', coordinates: [...overlayDraftCoords] },
      };
    } else {
      if (overlayDraftCoords.length < 3) return;
      feat = {
        type: 'Feature',
        properties: {
          id,
          category: cat,
          ...(label ? { label } : {}),
          ...(cat === 'building' ? { heightM: 7, roofStyle: 'concrete' } : {}),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[...overlayDraftCoords, overlayDraftCoords[0]]],
        },
      };
    }

    state.overlay.features.push(feat);
    drawMode = 'none';
    overlayDraftCoords = [];
    updateOverlayControlsUI();
    renderPathsAndOverlayLists();
    updateModeBanner();
    syncMapPinsAndPaths();
    showToast('Overlay shape added.');
  });

  // Export & Import
  document.getElementById('btn-copy-json')?.addEventListener('click', async () => {
    const payload = JSON.stringify(normalizeExportJSON(), null, 2);
    await navigator.clipboard.writeText(payload);
    showToast('Copied locations.json to clipboard.');
  });

  document.getElementById('btn-download-json')?.addEventListener('click', () => {
    const payload = JSON.stringify(normalizeExportJSON(), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locations.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded locations.json');
  });

  const importInput = document.getElementById('import-json-input') as HTMLInputElement | null;
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as LocationsConfig & {
        places?: Array<PlaceLocation & { sessionIds?: string[] }>;
      };
      if (!Array.isArray(parsed.places)) throw new Error('Invalid schema: missing places[]');

      const importedSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      if (importedSessions.length === 0) {
        // Fallback migration from legacy place.sessionIds
        for (const p of parsed.places) {
          for (const sid of p.sessionIds || []) {
            importedSessions.push({ sessionId: String(sid), placeId: p.id });
          }
        }
      }

      state = {
        places: parsed.places.map((p) => ({
          id: p.id,
          nameBn: p.nameBn,
          nameEn: p.nameEn,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          icon: p.icon,
        })),
        sessions: importedSessions,
        paths: Array.isArray(parsed.paths) ? parsed.paths : [],
        mapArea: parsed.mapArea || state.mapArea,
        overlay: parsed.overlay || ({ type: 'FeatureCollection', features: [] } as OverlayCollection),
      };

      selectedPlaceId = state.places[0]?.id || 'reporting';
      registerMapPinSprites(map!, state.places, true);
      populatePathPlaceSelects();
      renderPlacesList();
      renderSessionsList();
      renderPathsAndOverlayLists();
      refreshValidationUI();
      syncMapPinsAndPaths();
      fitCampusView();
      showToast('Imported locations.json successfully.');
    } catch (err) {
      showToast(`Import failed: ${(err as Error).message}`);
    }
    importInput.value = '';
  });

  document.getElementById('admin-fit-campus')?.addEventListener('click', fitCampusView);
  document.getElementById('admin-fit-all')?.addEventListener('click', fitAllPinsView);
  document.getElementById('admin-toggle-3d')?.addEventListener('click', (e) => {
    if (!map) return;
    is3DActive = !is3DActive;
    const btn = e.currentTarget as HTMLButtonElement;
    btn.classList.toggle('is-active', is3DActive);
    btn.setAttribute('aria-pressed', String(is3DActive));
    setMap3DMode(map, is3DActive);
  });
}

async function initAdminStudio() {
  try {
    const res = await fetch('/content.json', { cache: 'no-cache' });
    if (res.ok) {
      const raw = (await res.json()) as { wheel?: { tiles?: RawScheduleTile[] } };
      if (Array.isArray(raw?.wheel?.tiles)) {
        scheduleTiles = raw.wheel.tiles;
      }
    }
  } catch {
    scheduleTiles = [];
  }

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const style = buildRealisticMapStyle({
    origin: window.location.origin,
    pmtilesPath: '/tiles/venue.pmtiles',
    overlay: state.overlay,
  });

  map = new maplibregl.Map({
    container: 'admin-map-gl',
    style,
    center: state.mapArea?.center || [90.45985, 23.79015],
    zoom: state.mapArea?.zoom || 17.2,
    minZoom: 11,
    maxZoom: 20,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  await new Promise<void>((resolve) => map!.once('load', () => resolve()));

  await preloadCustomIconMasks();
  registerRealisticTerrainPatterns(map);
  registerMapPinSprites(map, state.places, true);

  map.addSource('admin-paths', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({
    id: 'admin-paths-line',
    type: 'line',
    source: 'admin-paths',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#FFF4DC',
      'line-width': 3,
      'line-dasharray': [0.5, 1.5],
    },
  });

  map.addSource('admin-draft', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({
    id: 'admin-draft-fill',
    type: 'fill',
    source: 'admin-draft',
    filter: ['==', ['get', 'kind'], 'poly'],
    paint: {
      'fill-color': '#F28C1E',
      'fill-opacity': 0.25,
    },
  });
  map.addLayer({
    id: 'admin-draft-line',
    type: 'line',
    source: 'admin-draft',
    paint: {
      'line-color': '#F28C1E',
      'line-width': 3,
      'line-dasharray': [2, 1.5],
    },
  });

  map.addSource('admin-pins', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addLayer({
    id: 'admin-pins-layer',
    type: 'symbol',
    source: 'admin-pins',
    layout: {
      'icon-image': ['get', 'spriteKey'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'label'],
      'text-font': ['noto-sans'],
      'text-offset': [0, 1.9],
      'text-size': 11,
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#23281A',
      'text-halo-width': 1.6,
    },
  });

  map.on('click', (e) => {
    const lngLat: LngLatTuple = [
      Number(e.lngLat.lng.toFixed(6)),
      Number(e.lngLat.lat.toFixed(6)),
    ];

    if (drawMode === 'path') {
      pathDraftCoords.push(lngLat);
      updatePathControlsUI();
      syncMapPinsAndPaths();
      return;
    }

    if (drawMode === 'overlay') {
      overlayDraftCoords.push(lngLat);
      updateOverlayControlsUI();
      syncMapPinsAndPaths();
      return;
    }

    if (activeTab === 'places') {
      const target = state.places.find((p) => p.id === selectedPlaceId);
      if (target) {
        target.lng = lngLat[0];
        target.lat = lngLat[1];
        renderPlacesList();
        refreshValidationUI();
        syncMapPinsAndPaths();
      }
    }
  });

  populatePathPlaceSelects();
  renderPlacesList();
  renderSessionsList();
  renderPathsAndOverlayLists();
  refreshValidationUI();
  updateModeBanner();
  bindTabsAndActions();
  syncMapPinsAndPaths();
  fitCampusView();
}

initAdminStudio();
