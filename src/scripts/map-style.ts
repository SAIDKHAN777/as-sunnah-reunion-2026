import type * as maplibregl from 'maplibre-gl';
import * as protomapsBasemaps from '@protomaps/basemaps';
import type { LngLatTuple, OverlayCollection } from '../types/locations';

export interface RealisticMapStyleOptions {
  origin: string;
  pmtilesPath?: string;
  overlay?: OverlayCollection;
}

/**
 * Golden-Hour Lush Botanical Park flavor inspired by sunlit meadow lawns,
 * cream sandstone gravel paths, layered emerald-gold canopy trees, and floral beds.
 */
const SCRUB_REALISTIC_FLAVOR: protomapsBasemaps.Flavor = {
  ...protomapsBasemaps.LIGHT,
  background: '#538231',
  earth: '#5B8B36',
  park_a: '#63973B',
  park_b: '#4E7D2D',
  hospital: '#6A9442',
  industrial: '#668848',
  school: '#669440',
  wood_a: '#2A581B',
  wood_b: '#204715',
  pedestrian: '#E2CFA9',
  scrub_a: '#5A8B34',
  scrub_b: '#4C7A2A',
  sand: '#DEC9A0',
  beach: '#E5D3AE',
  water: '#457D8F',
  pier: '#C7B695',
  buildings: '#D4D6CE',
  minor_service_casing: '#B59B6F',
  minor_casing: '#B09568',
  link_casing: '#A88D60',
  major_casing_late: '#9E8357',
  highway_casing_late: '#967B50',
  other: '#E6D4B0',
  minor_service: '#EADAC0',
  minor_a: '#ECDCBD',
  minor_b: '#EFE1C4',
  link: '#F2E5CB',
  major_casing_early: '#9E8357',
  major: '#F2E6CE',
  highway_casing_early: '#967B50',
  highway: '#F6ECD8',
  bridges_other_casing: '#B59B6F',
  bridges_minor_casing: '#B09568',
  bridges_link_casing: '#A88D60',
  bridges_major_casing: '#9E8357',
  bridges_highway_casing: '#967B50',
  bridges_other: '#E6D4B0',
  bridges_minor: '#EFE1C4',
  bridges_link: '#F2E5CB',
  bridges_major: '#F2E6CE',
  bridges_highway: '#F6ECD8',
  railway: '#8C8B7D',
  boundaries: '#597C39',
  roads_label_minor: '#FFF9EC',
  roads_label_minor_halo: '#243C18',
  roads_label_major: '#FFFFFF',
  roads_label_major_halo: '#203614',
  subplace_label: '#FFF7E4',
  subplace_label_halo: '#1F3414',
  city_label: '#FFF7E4',
  city_label_halo: '#1F3414',
  regular: 'noto-sans',
  bold: 'noto-sans',
  italic: 'noto-sans',
  landcover: {
    grassland: 'rgba(99, 152, 57, 1)',
    barren: 'rgba(130, 146, 86, 1)',
    urban_area: 'rgba(92, 138, 56, 0.55)',
    farmland: 'rgba(104, 156, 62, 1)',
    glacier: 'rgba(205, 220, 214, 1)',
    scrub: 'rgba(90, 140, 52, 1)',
    forest: 'rgba(42, 88, 27, 1)',
  },
};

function deterministicNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Registers high-DPI procedural textures matching the sunlit park aesthetic:
 * golden-lit meadow lawn, striped stadium football turf, emerald cricket outfield,
 * sunlit dappled foliage canopy, colorful flower beds, sandstone courtyard pavers, and tin roofs.
 */
export function registerRealisticTerrainPatterns(map: maplibregl.Map): void {
  const registerCanvasPattern = (
    name: string,
    size: number,
    drawFn: (ctx: CanvasRenderingContext2D, s: number) => void
  ) => {
    if (map.hasImage(name)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFn(ctx, size);
    const data = ctx.getImageData(0, 0, size, size);
    map.addImage(name, data, { pixelRatio: 2 });
  };

  // 1. Sunlit golden-green lush park lawn texture
  registerCanvasPattern('tex-scrub', 64, (ctx, s) => {
    ctx.fillStyle = '#5F9236';
    ctx.fillRect(0, 0, s, s);
    // Warm sunlit grass highlights & deeper meadow bands
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const r = deterministicNoise(x, y, 1);
        if (r > 0.7) {
          ctx.fillStyle = 'rgba(164, 208, 82, 0.28)';
          ctx.fillRect(x, y, 2, 2);
        } else if (r < 0.25) {
          ctx.fillStyle = 'rgba(46, 84, 24, 0.24)';
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  });

  // 2. Crisp striped stadium football turf
  registerCanvasPattern('tex-turf', 48, (ctx, s) => {
    ctx.fillStyle = '#2E7230';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#40903E';
    ctx.fillRect(0, 0, s / 2, s);
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const r = deterministicNoise(x, y, 7);
        if (r > 0.76) {
          ctx.fillStyle = 'rgba(210, 246, 150, 0.09)';
          ctx.fillRect(x, y, 2, 2);
        } else if (r < 0.18) {
          ctx.fillStyle = 'rgba(18, 48, 20, 0.14)';
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  });

  // 3. Rich emerald manicured cricket outfield turf
  registerCanvasPattern('tex-cricket-oval', 64, (ctx, s) => {
    ctx.fillStyle = '#468E3B';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(130, 198, 72, 0.18)';
    for (let y = 0; y < s; y += 16) {
      ctx.fillRect(0, y, s, 8);
    }
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const r = deterministicNoise(x, y, 13);
        if (r > 0.8) {
          ctx.fillStyle = 'rgba(195, 232, 112, 0.16)';
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  });

  // 4. Layered golden-hour sunlit tree canopy
  registerCanvasPattern('tex-canopy', 64, (ctx, s) => {
    ctx.fillStyle = '#234C1A';
    ctx.fillRect(0, 0, s, s);
    const blobs: Array<[number, number, number, string]> = [
      [14, 14, 14, '#2F6521'],
      [44, 18, 15, '#1D4116'],
      [26, 44, 16, '#2A5C1E'],
      [52, 48, 13, '#3B7827'],
      [9, 50, 12, '#1A3B14'],
      [19, 10, 9, '#6EA334'],
      [49, 43, 8, '#7EB43C'],
      [29, 39, 9, '#5E932B'],
    ];
    for (const [cx, cy, rad, color] of blobs) {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });

  // 5. Blooming botanical flower beds (rose crimson, marigold, pink, ivory)
  registerCanvasPattern('tex-flowers', 48, (ctx, s) => {
    ctx.fillStyle = '#3B5C24';
    ctx.fillRect(0, 0, s, s);
    const blossoms = ['#E14B5A', '#F39C2E', '#FFF6DC', '#EA7AA6', '#FFD25A'];
    for (let y = 4; y < s; y += 6) {
      for (let x = 4; x < s; x += 6) {
        const r = deterministicNoise(x, y, 29);
        const col = blossoms[Math.floor(r * blossoms.length) % blossoms.length];
        ctx.beginPath();
        ctx.arc(x + (r - 0.5) * 3, y + (deterministicNoise(y, x, 31) - 0.5) * 3, 1.9, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
  });

  // 6. Warm park sandstone plaza pavers
  registerCanvasPattern('tex-plaza', 32, (ctx, s) => {
    ctx.fillStyle = '#E6D6B5';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(155, 134, 96, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, s / 2 - 1, s / 2 - 1);
    ctx.strokeRect(s / 2 + 0.5, s / 2 + 0.5, s / 2 - 1, s / 2 - 1);
    ctx.fillStyle = 'rgba(255, 248, 232, 0.25)';
    ctx.fillRect(2, 2, s / 2 - 4, s / 2 - 4);
  });

  // 7. Corrugated tin & metallic hall roof grain
  registerCanvasPattern('tex-roof-tin', 32, (ctx, s) => {
    ctx.fillStyle = '#7F8C99';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = 'rgba(28, 36, 44, 0.16)';
      ctx.fillRect(x + 2, 0, 1, s);
    }
  });
}

function sanitizeOverlayFeatureCollection(overlay?: OverlayCollection): GeoJSON.FeatureCollection {
  if (!overlay || !Array.isArray(overlay.features)) {
    return { type: 'FeatureCollection', features: [] };
  }
  return overlay as unknown as GeoJSON.FeatureCollection;
}

function makeCirclePolygon(cx: number, cy: number, rx: number, ry: number, steps = 28): LngLatTuple[][] {
  const ring: LngLatTuple[] = [];
  for (let i = 0; i <= steps; i++) {
    const ang = (i / steps) * Math.PI * 2;
    ring.push([cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry]);
  }
  return [ring];
}

function makeRectPolygon(l: number, b: number, r: number, t: number): LngLatTuple[][] {
  return [[[l, b], [r, b], [r, t], [l, t], [l, b]]];
}

/**
 * Generates crisp miniature architectural & field vector geometry directly from zone polygons:
 * - FIFA football pitch (touchlines, halfway line, center circle + spot, 18yd & 6yd boxes, goal nets, corner arcs)
 * - Cricket stadium oval (outer boundary rope, 30-yard inner fielding circle, 22-yard center pitch + creases)
 * - Miniature Main Stage (raised wooden/purple stage deck, canopy arch, stage spotlights, audience carpet)
 * - Adda Park Courtyard (central water fountain pool + rim + 4 garden benches)
 * - Indoor Hall center gable ridge & Masjid dome architecture ring
 */
export function buildSportMarkingsGeoJSON(overlay?: OverlayCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (!overlay || !Array.isArray(overlay.features)) {
    return { type: 'FeatureCollection', features };
  }

  for (const feat of overlay.features) {
    if (feat.geometry.type !== 'Polygon' || !feat.geometry.coordinates[0]?.length) continue;
    const cat = feat.properties?.category;
    const featId = feat.properties?.id || '';

    const ring = feat.geometry.coordinates[0];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [lng, lat] of ring) {
      if (lng < minX) minX = lng;
      if (lng > maxX) maxX = lng;
      if (lat < minY) minY = lat;
      if (lat > maxY) maxY = lat;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) continue;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    if (cat === 'football-field') {
      const px = w * 0.08;
      const py = h * 0.09;
      const l = minX + px;
      const r = maxX - px;
      const b = minY + py;
      const t = maxY - py;
      const fw = r - l;
      const fh = t - b;

      // Touchline rectangle
      features.push({
        type: 'Feature',
        properties: { mark: 'line' },
        geometry: { type: 'LineString', coordinates: makeRectPolygon(l, b, r, t)[0] },
      });

      // Halfway line + 18-yard + 6-yard penalty areas + goals
      if (fw >= fh) {
        features.push({
          type: 'Feature',
          properties: { mark: 'line' },
          geometry: { type: 'LineString', coordinates: [[cx, b], [cx, t]] },
        });
        const p18W = fw * 0.16;
        const p18H = fh * 0.58;
        const g6W = fw * 0.065;
        const g6H = fh * 0.28;
        const netW = fw * 0.032;
        const netH = fh * 0.16;

        // Left boxes & goal net
        features.push(
          {
            type: 'Feature',
            properties: { mark: 'line' },
            geometry: {
              type: 'LineString',
              coordinates: [[l, cy - p18H / 2], [l + p18W, cy - p18H / 2], [l + p18W, cy + p18H / 2], [l, cy + p18H / 2]],
            },
          },
          {
            type: 'Feature',
            properties: { mark: 'line' },
            geometry: {
              type: 'LineString',
              coordinates: [[l, cy - g6H / 2], [l + g6W, cy - g6H / 2], [l + g6W, cy + g6H / 2], [l, cy + g6H / 2]],
            },
          },
          {
            type: 'Feature',
            properties: { mark: 'goal-net' },
            geometry: { type: 'Polygon', coordinates: makeRectPolygon(l - netW, cy - netH / 2, l, cy + netH / 2) },
          },
          // Right boxes & goal net
          {
            type: 'Feature',
            properties: { mark: 'line' },
            geometry: {
              type: 'LineString',
              coordinates: [[r, cy - p18H / 2], [r - p18W, cy - p18H / 2], [r - p18W, cy + p18H / 2], [r, cy + p18H / 2]],
            },
          },
          {
            type: 'Feature',
            properties: { mark: 'line' },
            geometry: {
              type: 'LineString',
              coordinates: [[r, cy - g6H / 2], [r - g6W, cy - g6H / 2], [r - g6W, cy + g6H / 2], [r, cy + g6H / 2]],
            },
          },
          {
            type: 'Feature',
            properties: { mark: 'goal-net' },
            geometry: { type: 'Polygon', coordinates: makeRectPolygon(r, cy - netH / 2, r + netW, cy + netH / 2) },
          }
        );
      }

      // Center circle & center spot
      const radX = Math.min(fw, fh) * 0.2;
      const radY = Math.min(fw, fh) * 0.2 * 0.92;
      features.push({
        type: 'Feature',
        properties: { mark: 'line' },
        geometry: { type: 'LineString', coordinates: makeCirclePolygon(cx, cy, radX, radY, 24)[0] },
      });
      features.push({
        type: 'Feature',
        properties: { mark: 'spot' },
        geometry: { type: 'Polygon', coordinates: makeCirclePolygon(cx, cy, fw * 0.012, fh * 0.016, 10) },
      });
    } else if (cat === 'cricket-field') {
      // Outer stadium oval boundary & 30-yard inner fielding circle
      features.push({
        type: 'Feature',
        properties: { mark: 'boundary' },
        geometry: { type: 'LineString', coordinates: makeCirclePolygon(cx, cy, w * 0.44, h * 0.42, 32)[0] },
      });
      features.push({
        type: 'Feature',
        properties: { mark: 'inner-circle' },
        geometry: { type: 'LineString', coordinates: makeCirclePolygon(cx, cy, w * 0.24, h * 0.27, 28)[0] },
      });

      // 22-yard center pitch strip + batting creases
      const pw = Math.max(w * 0.13, 0.000085);
      const ph = Math.max(h * 0.22, 0.000042);
      features.push({
        type: 'Feature',
        properties: { mark: 'pitch' },
        geometry: { type: 'Polygon', coordinates: makeRectPolygon(cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2) },
      });
      // Crease lines inside pitch
      const cOff = pw * 0.34;
      features.push(
        {
          type: 'Feature',
          properties: { mark: 'line' },
          geometry: { type: 'LineString', coordinates: [[cx - cOff, cy - ph * 0.45], [cx - cOff, cy + ph * 0.45]] },
        },
        {
          type: 'Feature',
          properties: { mark: 'line' },
          geometry: { type: 'LineString', coordinates: [[cx + cOff, cy - ph * 0.45], [cx + cOff, cy + ph * 0.45]] },
        }
      );
    } else if (cat === 'stage-zone') {
      // Audience carpet mat in front (south/center of stage polygon) + raised purple-gold main stage deck at north!
      features.push({
        type: 'Feature',
        properties: { mark: 'audience-mat' },
        geometry: {
          type: 'Polygon',
          coordinates: makeRectPolygon(minX + w * 0.14, minY + h * 0.08, maxX - w * 0.14, minY + h * 0.56),
        },
      });
      // Raised miniature Stage platform at top edge
      features.push({
        type: 'Feature',
        properties: { mark: 'stage-deck' },
        geometry: {
          type: 'Polygon',
          coordinates: makeRectPolygon(minX + w * 0.16, minY + h * 0.58, maxX - w * 0.16, maxY - h * 0.1),
        },
      });
      // Warm golden stage backdrop arch & proscenium trim
      features.push({
        type: 'Feature',
        properties: { mark: 'stage-arch' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [minX + w * 0.16, minY + h * 0.58],
            [minX + w * 0.16, maxY - h * 0.1],
            [maxX - w * 0.16, maxY - h * 0.1],
            [maxX - w * 0.16, minY + h * 0.58],
          ],
        },
      });
      // Center podium dot + twin spotlight cones
      features.push({
        type: 'Feature',
        properties: { mark: 'spot' },
        geometry: {
          type: 'Polygon',
          coordinates: makeCirclePolygon(cx, minY + h * 0.67, w * 0.032, h * 0.04, 12),
        },
      });
    } else if (cat === 'adda-zone') {
      // Botanical park roundabout plaza with miniature circular water fountain + 4 wooden benches
      features.push({
        type: 'Feature',
        properties: { mark: 'fountain-water' },
        geometry: { type: 'Polygon', coordinates: makeCirclePolygon(cx, cy, w * 0.15, h * 0.23, 24) },
      });
      features.push({
        type: 'Feature',
        properties: { mark: 'fountain-rim' },
        geometry: { type: 'LineString', coordinates: makeCirclePolygon(cx, cy, w * 0.15, h * 0.23, 24)[0] },
      });
      // Four park wooden benches around fountain
      const bw = w * 0.13;
      const bh = h * 0.065;
      const offY = h * 0.34;
      const offX = w * 0.26;
      features.push(
        { type: 'Feature', properties: { mark: 'bench' }, geometry: { type: 'Polygon', coordinates: makeRectPolygon(cx - bw / 2, cy + offY - bh / 2, cx + bw / 2, cy + offY + bh / 2) } },
        { type: 'Feature', properties: { mark: 'bench' }, geometry: { type: 'Polygon', coordinates: makeRectPolygon(cx - bw / 2, cy - offY - bh / 2, cx + bw / 2, cy - offY + bh / 2) } },
        { type: 'Feature', properties: { mark: 'bench' }, geometry: { type: 'Polygon', coordinates: makeRectPolygon(cx - offX - bh / 2, cy - bw * 0.6, cx - offX + bh / 2, cy + bw * 0.6) } },
        { type: 'Feature', properties: { mark: 'bench' }, geometry: { type: 'Polygon', coordinates: makeRectPolygon(cx + offX - bh / 2, cy - bw * 0.6, cx + offX + bh / 2, cy + bw * 0.6) } }
      );
    } else if (cat === 'building') {
      if (featId.includes('masjid')) {
        // Central Masjid architectural dome ring & golden crescent trim
        features.push({
          type: 'Feature',
          properties: { mark: 'masjid-dome' },
          geometry: { type: 'Polygon', coordinates: makeCirclePolygon(cx, cy, w * 0.26, h * 0.34, 24) },
        });
        features.push({
          type: 'Feature',
          properties: { mark: 'fountain-rim' },
          geometry: { type: 'LineString', coordinates: makeCirclePolygon(cx, cy, w * 0.26, h * 0.34, 24)[0] },
        });
      } else if (featId.includes('indoor')) {
        // Indoor Hall central skylight ridge
        features.push({
          type: 'Feature',
          properties: { mark: 'line' },
          geometry: {
            type: 'LineString',
            coordinates: [[cx, minY + h * 0.08], [cx, maxY - h * 0.08]],
          },
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

function buildSanitizedProtomapsLayers(): maplibregl.LayerSpecification[] {
  const raw = protomapsBasemaps.layers('protomaps', SCRUB_REALISTIC_FLAVOR, {
    lang: 'en',
  }) as unknown as maplibregl.LayerSpecification[];

  const kept: maplibregl.LayerSpecification[] = [];
  for (const layer of raw) {
    const id = layer.id || '';
    const layout = (layer as { layout?: Record<string, unknown> }).layout;

    if (
      id.startsWith('pois') ||
      id.startsWith('address') ||
      id.includes('oneway') ||
      id.includes('shield') ||
      (layout && 'icon-image' in layout)
    ) {
      continue;
    }

    if (layer.type === 'symbol' && layout) {
      kept.push({
        ...layer,
        layout: {
          ...layout,
          'text-font': ['noto-sans'],
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ''],
        },
      } as maplibregl.LayerSpecification);
      continue;
    }

    if (id === 'landuse_urban_green' || id === 'landuse_residential') {
      kept.push({
        ...layer,
        paint: {
          ...((layer as { paint?: Record<string, unknown> }).paint || {}),
          'fill-color': '#5C8D36',
          'fill-opacity': 0.55,
        },
      } as maplibregl.LayerSpecification);
      continue;
    }

    kept.push(layer);
  }
  return kept;
}

/**
 * Builds the sunlit park-themed realistic MapLibre style shared by the User Map and Dev Admin.
 */
export function buildRealisticMapStyle(
  options: RealisticMapStyleOptions
): maplibregl.StyleSpecification {
  const pmtilesPath = options.pmtilesPath || '/tiles/venue.pmtiles';
  const cleanOrigin = options.origin.replace(/\/$/, '');

  const basemapLayers = buildSanitizedProtomapsLayers();
  const geometryBaseLayers = basemapLayers.filter((l) => l.type !== 'symbol');
  const labelBaseLayers = basemapLayers.filter((l) => l.type === 'symbol');

  const overlayLayers: maplibregl.LayerSpecification[] = [
    // 1. Sunlit meadow park lawns
    {
      id: 'overlay-scrub-patch',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'scrub-patch'],
      paint: {
        'fill-pattern': 'tex-scrub',
        'fill-opacity': 0.96,
      },
    },
    // 2. Sandstone plaza bases (Stage courtyard & Adda park fountain courtyard)
    {
      id: 'overlay-courtyard-plaza',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['in', ['get', 'category'], ['literal', ['stage-zone', 'adda-zone', 'playground']]],
      paint: {
        'fill-pattern': 'tex-plaza',
        'fill-opacity': 0.95,
      },
    },
    {
      id: 'overlay-courtyard-rim',
      type: 'line',
      source: 'campus-overlay',
      filter: ['in', ['get', 'category'], ['literal', ['stage-zone', 'adda-zone', 'playground']]],
      paint: {
        'line-color': '#9E8558',
        'line-width': 1.6,
      },
    },
    // 3. Dedicated Striped Football Turf & Emerald Cricket Ground
    {
      id: 'overlay-football-turf',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'football-field'],
      paint: {
        'fill-pattern': 'tex-turf',
        'fill-opacity': 0.98,
      },
    },
    {
      id: 'overlay-cricket-turf',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'cricket-field'],
      paint: {
        'fill-pattern': 'tex-cricket-oval',
        'fill-opacity': 0.98,
      },
    },
    {
      id: 'overlay-sports-rim',
      type: 'line',
      source: 'campus-overlay',
      filter: ['in', ['get', 'category'], ['literal', ['football-field', 'cricket-field']]],
      paint: {
        'line-color': '#C6E09B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 18, 2.2],
        'line-opacity': 0.9,
      },
    },
    // 4. Colorful botanical flower beds
    {
      id: 'overlay-flower-bed',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'flower-bed'],
      paint: {
        'fill-pattern': 'tex-flowers',
        'fill-opacity': 0.98,
      },
    },
    {
      id: 'overlay-flower-rim',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'flower-bed'],
      paint: {
        'line-color': '#2E4C1B',
        'line-width': 1.2,
      },
    },
    // 5. Detailed miniature architectural marks (pitches, stage deck, fountain, benches, goal nets)
    {
      id: 'overlay-cricket-pitch-fill',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'pitch'],
      paint: {
        'fill-color': '#E3CB9F',
        'fill-opacity': 0.96,
      },
    },
    {
      id: 'overlay-stage-audience-mat',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'audience-mat'],
      paint: {
        'fill-color': 'rgba(72, 126, 48, 0.35)',
      },
    },
    {
      id: 'overlay-stage-deck-fill',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'stage-deck'],
      paint: {
        'fill-color': '#4B2276',
        'fill-opacity': 0.96,
      },
    },
    {
      id: 'overlay-stage-arch-line',
      type: 'line',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'stage-arch'],
      paint: {
        'line-color': '#F28C1E',
        'line-width': 2.6,
      },
    },
    {
      id: 'overlay-fountain-water',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'fountain-water'],
      paint: {
        'fill-color': '#4F93A6',
        'fill-opacity': 0.96,
      },
    },
    {
      id: 'overlay-bench-fill',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'bench'],
      paint: {
        'fill-color': '#7A4F26',
        'fill-opacity': 0.94,
      },
    },
    {
      id: 'overlay-goal-net-fill',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'goal-net'],
      paint: {
        'fill-color': 'rgba(255, 255, 255, 0.72)',
      },
    },
    {
      id: 'overlay-sport-inner-circle',
      type: 'line',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'inner-circle'],
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.65)',
        'line-width': 1.2,
        'line-dasharray': [3, 3],
      },
    },
    {
      id: 'overlay-sport-mark-lines',
      type: 'line',
      source: 'campus-sport-markings',
      filter: ['in', ['get', 'mark'], ['literal', ['line', 'boundary', 'fountain-rim']]],
      paint: {
        'line-color': 'rgba(255, 255, 252, 0.92)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 17, 1.5, 19, 2.2],
      },
    },
    {
      id: 'overlay-spot-fill',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'spot'],
      paint: {
        'fill-color': '#FFFDF5',
      },
    },
    // 6. Sunlit canal / water
    {
      id: 'overlay-water-bank',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'water'],
      paint: {
        'line-color': '#759B5C',
        'line-width': 5,
      },
    },
    {
      id: 'overlay-water-fill',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'water'],
      paint: {
        'fill-color': '#457D8F',
        'fill-opacity': 0.95,
      },
    },
    // 7. Cream sunlit botanical park pathways
    {
      id: 'overlay-road-embankment',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'dirt-road'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#3A5E21',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 3.6, 17, 12, 19, 22],
        'line-opacity': 0.42,
      },
    },
    {
      id: 'overlay-road-curb',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'dirt-road'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#B69D72',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 2.8, 17, 9.4, 19, 17.5],
      },
    },
    {
      id: 'overlay-road-surface',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'dirt-road'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#EDE0C2',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 2.0, 17, 7.4, 19, 14.0],
      },
    },
    {
      id: 'overlay-road-camber',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'dirt-road'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': 'rgba(255, 250, 236, 0.55)',
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 0.5, 17, 1.8, 19, 3.2],
        'line-dasharray': [3, 4],
      },
    },
    // 8. Golden-lit park tree groves with dappled ground shadows
    {
      id: 'overlay-vegetation-shadow',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'vegetation'],
      paint: {
        'fill-color': '#234217',
        'fill-opacity': 0.42,
        'fill-translate': [5, 4],
      },
    },
    {
      id: 'overlay-vegetation-canopy',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'vegetation'],
      paint: {
        'fill-pattern': 'tex-canopy',
        'fill-opacity': 0.97,
      },
    },
    {
      id: 'overlay-vegetation-outline',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'vegetation'],
      paint: {
        'line-color': '#356621',
        'line-width': 1.2,
      },
    },
    // 9. Masjid Concrete Hall & Indoor Tin Shed + soft shadows + 3D extrusion
    {
      id: 'overlay-building-shadow',
      type: 'fill',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'building'],
      paint: {
        'fill-color': '#243C18',
        'fill-opacity': 0.45,
        'fill-translate': [4, 4],
      },
    },
    {
      id: 'overlay-building-concrete',
      type: 'fill',
      source: 'campus-overlay',
      filter: [
        'all',
        ['==', ['get', 'category'], 'building'],
        ['!=', ['get', 'roofStyle'], 'tin'],
      ],
      paint: {
        'fill-color': '#E4E2D8',
        'fill-opacity': 0.98,
      },
    },
    {
      id: 'overlay-building-tin',
      type: 'fill',
      source: 'campus-overlay',
      filter: [
        'all',
        ['==', ['get', 'category'], 'building'],
        ['==', ['get', 'roofStyle'], 'tin'],
      ],
      paint: {
        'fill-pattern': 'tex-roof-tin',
        'fill-opacity': 0.98,
      },
    },
    {
      id: 'overlay-masjid-dome-fill',
      type: 'fill',
      source: 'campus-sport-markings',
      filter: ['==', ['get', 'mark'], 'masjid-dome'],
      paint: {
        'fill-color': '#629E7C',
        'fill-opacity': 0.92,
      },
    },
    {
      id: 'overlay-building-outline',
      type: 'line',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'building'],
      paint: {
        'line-color': '#566470',
        'line-width': 1.5,
      },
    },
    {
      id: 'campus-buildings-3d',
      type: 'fill-extrusion',
      source: 'campus-overlay',
      filter: ['==', ['get', 'category'], 'building'],
      layout: {
        visibility: 'none',
      },
      paint: {
        'fill-extrusion-color': [
          'case',
          ['==', ['get', 'roofStyle'], 'tin'],
          '#83929E',
          '#DCDAD0',
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'heightM'], 7],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.92,
      },
    },
  ];

  return {
    version: 8,
    glyphs: `${cleanOrigin}/tiles/fonts/{fontstack}/{range}.pbf`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesPath}`,
        attribution: 'OpenStreetMap contributors',
      },
      'campus-overlay': {
        type: 'geojson',
        data: sanitizeOverlayFeatureCollection(options.overlay),
      },
      'campus-sport-markings': {
        type: 'geojson',
        data: buildSportMarkingsGeoJSON(options.overlay),
      },
    },
    layers: [...geometryBaseLayers, ...overlayLayers, ...labelBaseLayers],
  };
}

export function syncOverlaySources(map: maplibregl.Map, overlay?: OverlayCollection): void {
  const overlaySrc = map.getSource('campus-overlay') as maplibregl.GeoJSONSource | undefined;
  const markingsSrc = map.getSource('campus-sport-markings') as maplibregl.GeoJSONSource | undefined;
  if (overlaySrc) {
    overlaySrc.setData(sanitizeOverlayFeatureCollection(overlay));
  }
  if (markingsSrc) {
    markingsSrc.setData(buildSportMarkingsGeoJSON(overlay));
  }
}

export function setMap3DMode(map: maplibregl.Map, enabled: boolean): void {
  if (map.getLayer('campus-buildings-3d')) {
    map.setLayoutProperty('campus-buildings-3d', 'visibility', enabled ? 'visible' : 'none');
  }
  map.easeTo({
    pitch: enabled ? 42 : 0,
    bearing: enabled ? 12 : 0,
    duration: 420,
  });
}
