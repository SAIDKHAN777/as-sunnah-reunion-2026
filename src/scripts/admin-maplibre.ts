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
  getPinSpriteKey,
  preloadCustomIconMasks,
  registerMapPinSprites,
} from './map-sprites';
import {
  evaluateAllPlaces,
  resolveClock,
  type RawScheduleTile,
} from './schedule-status';

maplibregl.setWorkerUrl(workerUrl);

let pmtilesRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
}

function cloneLocationsConfig(): LocationsConfig {
  return JSON.parse(JSON.stringify(locationsRaw)) as LocationsConfig;
}

function buildCampusPathsGeoJSON(config: LocationsConfig): GeoJSON.FeatureCollection {
  const byId = new Map(config.places.map((p) => [p.id, p]));
  const features: GeoJSON.Feature[] = [];

  for (const p of config.paths || []) {
    const coords = Array.isArray(p.coordinates) ? p.coordinates : [];
    const fromP = p.from ? byId.get(p.from) : null;
    const toP = p.to ? byId.get(p.to) : null;

    let finalCoords = coords;
    if (finalCoords.length < 2 && fromP?.lng != null && fromP?.lat != null && toP?.lng != null && toP?.lat != null) {
      finalCoords = [
        [fromP.lng, fromP.lat],
        [toP.lng, toP.lat],
      ];
    }

    if (finalCoords.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { from: p.from, to: p.to },
        geometry: { type: 'LineString', coordinates: finalCoords },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

function buildPlacesGeoJSON(
  config: LocationsConfig,
  scheduleTiles: RawScheduleTile[],
  simTime: string
): GeoJSON.FeatureCollection {
  const clock = resolveClock(`?t=${simTime}`);
  const evaluated = evaluateAllPlaces(config.places, config.sessions, scheduleTiles, clock.minutes);
  const statusById = new Map(evaluated.map((e) => [e.place.id, e.status]));

  return {
    type: 'FeatureCollection',
    features: config.places
      .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map((p) => {
        const status = statusById.get(p.id) || 'LOCKED';
        return {
          type: 'Feature',
          properties: {
            id: p.id,
            nameBn: p.nameBn,
            nameEn: p.nameEn,
            iconKey: getPinSpriteKey(p.id, status),
          },
          geometry: {
            type: 'Point',
            coordinates: [p.lng as number, p.lat as number],
          },
        };
      }),
  };
}

interface CampusMapInstance {
  map: maplibregl.Map;
  config: LocationsConfig;
  refreshPins: (simTime?: string) => void;
  flyToCampus: () => void;
  flyToCoords: (lat: number, lng: number, zoom?: number) => void;
  set3D: (enabled: boolean) => void;
}

async function createCampusMapInstance(options: {
  container: string | HTMLElement;
  config: LocationsConfig;
  scheduleTiles: RawScheduleTile[];
  simTime?: string;
  onPlaceClick?: (place: PlaceLocation) => void;
  onMapClick?: (lat: number, lng: number) => void;
}): Promise<CampusMapInstance> {
  ensurePmtilesProtocol();

  const style = buildRealisticMapStyle({
    origin: window.location.origin,
    pmtilesPath: '/tiles/venue.pmtiles',
    overlay: options.config.overlay,
  });

  const map = new maplibregl.Map({
    container: options.container,
    style,
    center: options.config.mapArea?.center || [90.45985, 23.79015],
    zoom: options.config.mapArea?.zoom || 17.2,
    minZoom: 11,
    maxZoom: 20,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  await new Promise<void>((resolve) => {
    map.once('load', () => resolve());
  });

  await preloadCustomIconMasks();
  registerRealisticTerrainPatterns(map);
  registerMapPinSprites(map, options.config.places, true);

  map.addSource('campus-paths', {
    type: 'geojson',
    data: buildCampusPathsGeoJSON(options.config),
  });

  map.addLayer({
    id: 'campus-paths-casing',
    type: 'line',
    source: 'campus-paths',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#1F3A1D',
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 5, 18, 7.5],
      'line-opacity': 0.5,
    },
  });

  map.addLayer({
    id: 'campus-paths-dash',
    type: 'line',
    source: 'campus-paths',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#F3F7E8',
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2.4, 18, 3.8],
      'line-dasharray': [2.2, 2.4],
      'line-opacity': 0.96,
    },
  });

  let currentSimTime = options.simTime || '08:50';

  map.addSource('campus-places', {
    type: 'geojson',
    data: buildPlacesGeoJSON(options.config, options.scheduleTiles, currentSimTime),
  });

  map.addLayer({
    id: 'campus-places-pins',
    type: 'symbol',
    source: 'campus-places',
    layout: {
      'icon-image': ['get', 'iconKey'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.72, 17, 0.88, 19, 1.0],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'nameBn'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#FDFDF8',
      'text-halo-color': '#2E1357',
      'text-halo-width': 2.2,
    },
  });

  map.on('mouseenter', 'campus-places-pins', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'campus-places-pins', () => {
    map.getCanvas().style.cursor = '';
  });

  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: ['campus-places-pins'] });
    if (hits.length > 0 && options.onPlaceClick) {
      const placeId = hits[0].properties?.id;
      const found = options.config.places.find((p) => p.id === placeId);
      if (found) {
        options.onPlaceClick(found);
        return;
      }
    }
    options.onMapClick?.(e.lngLat.lat, e.lngLat.lng);
  });

  const refreshPins = (simTime?: string) => {
    if (simTime) currentSimTime = simTime;
    const src = map.getSource('campus-places') as maplibregl.GeoJSONSource | undefined;
    src?.setData(buildPlacesGeoJSON(options.config, options.scheduleTiles, currentSimTime));
  };

  const flyToCampus = () => {
    const coords = options.config.places
      .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map((p) => [p.lng as number, p.lat as number] as [number, number]);
    if (coords.length >= 2) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 68, maxZoom: 17.5, bearing: 0, pitch: 0, duration: 480 });
      return;
    }
    map.easeTo({
      center: options.config.mapArea?.center || [90.45985, 23.79015],
      zoom: options.config.mapArea?.zoom || 17.0,
      bearing: 0,
      pitch: 0,
      duration: 500,
    });
  };

  const flyToCoords = (lat: number, lng: number, zoom = 17.6) => {
    map.easeTo({ center: [lng, lat], zoom, duration: 480 });
  };

  const set3D = (enabled: boolean) => {
    setMap3DMode(map, enabled);
  };

  return {
    map,
    config: options.config,
    refreshPins,
    flyToCampus,
    flyToCoords,
    set3D,
  };
}

let cachedScheduleTiles: RawScheduleTile[] = [];
async function loadScheduleTiles(): Promise<RawScheduleTile[]> {
  if (cachedScheduleTiles.length > 0) return cachedScheduleTiles;
  try {
    const res = await fetch('/content.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = (await res.json()) as { wheel?: { tiles?: RawScheduleTile[] } };
      if (Array.isArray(json?.wheel?.tiles)) {
        cachedScheduleTiles = json.wheel.tiles;
      }
    }
  } catch {
    // Keep empty fallback if offline/blocked
  }
  return cachedScheduleTiles;
}

// =========================================================================
// 1) MODAL PICKER INSTANCE (replaces old Leaflet OpenStreetMap inside /admin)
// =========================================================================
let pickerInstance: CampusMapInstance | null = null;
let pickerMarker: maplibregl.Marker | null = null;
let pickerLoadingPromise: Promise<CampusMapInstance> | null = null;
let onPickerCoordChange: ((lat: number, lng: number, presetName: string | null) => void) | null = null;

async function ensurePickerMap(options: {
  containerId: string;
  initialLat: number;
  initialLng: number;
  onChange: (lat: number, lng: number, presetName: string | null) => void;
}): Promise<CampusMapInstance> {
  onPickerCoordChange = options.onChange;

  if (pickerInstance) {
    setTimeout(() => pickerInstance?.map.resize(), 60);
    return pickerInstance;
  }
  if (pickerLoadingPromise) return pickerLoadingPromise;

  pickerLoadingPromise = (async () => {
    const container = document.getElementById(options.containerId);
    if (!container) throw new Error(`Missing container #${options.containerId}`);
    const config = cloneLocationsConfig();
    const tiles = await loadScheduleTiles();

    const inst = await createCampusMapInstance({
      container,
      config,
      scheduleTiles: tiles,
      simTime: '08:50',
      onPlaceClick: (place) => {
        if (typeof place.lat === 'number' && typeof place.lng === 'number') {
          movePickerPin(place.lat, place.lng, 17.8);
          onPickerCoordChange?.(place.lat, place.lng, `${place.nameBn} (${place.nameEn})`);
        }
      },
      onMapClick: (lat, lng) => {
        if (pickerMarker) pickerMarker.setLngLat([lng, lat]);
        onPickerCoordChange?.(lat, lng, null);
      },
    });

    pickerMarker = new maplibregl.Marker({
      color: '#F28C1E',
      draggable: true,
    })
      .setLngLat([options.initialLng, options.initialLat])
      .addTo(inst.map);

    pickerMarker.on('dragend', () => {
      const pos = pickerMarker!.getLngLat();
      onPickerCoordChange?.(pos.lat, pos.lng, null);
    });

    pickerInstance = inst;
    return inst;
  })();

  return pickerLoadingPromise;
}

function movePickerPin(lat: number, lng: number, zoom = 17.4): void {
  if (!pickerInstance) return;
  pickerMarker?.setLngLat([lng, lat]);
  pickerInstance.flyToCoords(lat, lng, zoom);
}

function getCampusPlacesSummary(): PlaceLocation[] {
  return cloneLocationsConfig().places;
}

function flyPickerToCampus(): void {
  pickerInstance?.flyToCampus();
}

// =========================================================================
// 2) TAB 4 OVERVIEW MAP INSTANCE (inside /admin "MapLibre Map" tab)
// =========================================================================
let tabInstance: CampusMapInstance | null = null;
let tabConfig: LocationsConfig = cloneLocationsConfig();
let selectedTabPlaceId = tabConfig.places[0]?.id || 'stage';
let tab3DEnabled = false;
let tabSimTime = '08:50';
let tabMounted = false;

function renderTabPlacesList(): void {
  const listEl = document.getElementById('tab-maplibre-places-list');
  if (!listEl) return;

  listEl.innerHTML = tabConfig.places
    .map((p) => {
      const isSelected = p.id === selectedTabPlaceId;
      const lat = typeof p.lat === 'number' ? p.lat : 23.79015;
      const lng = typeof p.lng === 'number' ? p.lng : 90.45985;
      const gmapUrl = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
      return `
        <div class="tile-card ${isSelected ? 'active-tile' : ''}" data-maplibre-place="${p.id}" style="padding: 12px; cursor: pointer;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div>
              <strong style="font-size: 14px; color: #3B1A6E;">${p.nameBn}</strong>
              <span style="font-size: 12px; color: #623096; margin-left: 6px;">(${p.nameEn})</span>
            </div>
            <span class="badge-purple">${p.id}</span>
          </div>
          <div style="margin-top: 6px; font-size: 11px; color: #623096;">
            Coordinates: <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button type="button" class="btn-upload-inline small js-tab-fly-place" data-place-id="${p.id}">
              Focus on MapLibre
            </button>
            <a href="${gmapUrl}" target="_blank" rel="noopener noreferrer" class="btn-upload-inline small">
              Google Maps
            </a>
          </div>
        </div>
      `;
    })
    .join('');

  listEl.querySelectorAll('[data-maplibre-place]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      const pid = (card as HTMLElement).dataset.maplibrePlace || '';
      if (!pid) return;
      selectedTabPlaceId = pid;
      renderTabPlacesList();
      const place = tabConfig.places.find((item) => item.id === pid);
      if (place && typeof place.lat === 'number' && typeof place.lng === 'number') {
        tabInstance?.flyToCoords(place.lat, place.lng, 18.0);
      }
    });
  });
}

async function mountTabMap(): Promise<void> {
  renderTabPlacesList();

  if (tabMounted && tabInstance) {
    setTimeout(() => tabInstance?.map.resize(), 60);
    return;
  }
  tabMounted = true;

  const container = document.getElementById('tab-maplibre-canvas');
  if (!container) return;

  const tiles = await loadScheduleTiles();
  tabInstance = await createCampusMapInstance({
    container,
    config: tabConfig,
    scheduleTiles: tiles,
    simTime: tabSimTime,
    onPlaceClick: (place) => {
      selectedTabPlaceId = place.id;
      renderTabPlacesList();
      if (typeof place.lat === 'number' && typeof place.lng === 'number') {
        tabInstance?.flyToCoords(place.lat, place.lng, 18.0);
      }
    },
    onMapClick: (lat, lng) => {
      const target = tabConfig.places.find((p) => p.id === selectedTabPlaceId);
      if (!target) return;
      target.lat = Number(lat.toFixed(6));
      target.lng = Number(lng.toFixed(6));
      tabInstance?.refreshPins(tabSimTime);
      renderTabPlacesList();
    },
  });
  tabInstance.flyToCampus();

  document.getElementById('tab-maplibre-campus-btn')?.addEventListener('click', () => {
    tabInstance?.flyToCampus();
  });

  document.getElementById('tab-maplibre-3d-btn')?.addEventListener('click', (e) => {
    tab3DEnabled = !tab3DEnabled;
    const btn = e.currentTarget as HTMLButtonElement;
    btn.classList.toggle('is-active', tab3DEnabled);
    btn.setAttribute('aria-pressed', String(tab3DEnabled));
    tabInstance?.set3D(tab3DEnabled);
  });

  document.querySelectorAll('.js-tab-map-time').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      tabSimTime = el.dataset.simTime || '08:50';
      document.querySelectorAll('.js-tab-map-time').forEach((b) => b.classList.remove('active'));
      el.classList.add('active');
      tabInstance?.refreshPins(tabSimTime);
    });
  });

  document.getElementById('tab-maplibre-download-btn')?.addEventListener('click', () => {
    const json = JSON.stringify(tabConfig, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locations.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

export interface AdminMapLibreBridge {
  ensurePickerMap: typeof ensurePickerMap;
  movePickerPin: typeof movePickerPin;
  flyPickerToCampus: typeof flyPickerToCampus;
  getCampusPlacesSummary: typeof getCampusPlacesSummary;
  mountTabMap: typeof mountTabMap;
}

declare global {
  interface Window {
    __adminMapLibre?: AdminMapLibreBridge;
  }
}

window.__adminMapLibre = {
  ensurePickerMap,
  movePickerPin,
  flyPickerToCampus,
  getCampusPlacesSummary,
  mountTabMap,
};
