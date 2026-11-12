import type {
  LngLatTuple,
  LocationsConfig,
  PlaceLocation,
  SessionAssignment,
  WalkingPath,
} from '../types/locations';

export type ScheduleState = 'LIVE' | 'LOCKED' | 'DONE';

export interface RawScheduleTile {
  id: string;
  label: string;
  time?: string;
  location?: string;
  locationName?: string;
}

export interface EvaluatedSession {
  id: string;
  label: string;
  timeLabel: string;
  timeMissing: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  status: ScheduleState;
}

export interface EvaluatedPlace {
  place: PlaceLocation;
  status: ScheduleState;
  sessions: EvaluatedSession[];
  primarySession: EvaluatedSession | null;
}

export interface SimulationClock {
  minutes: number;
  label: string;
  isSimulated: boolean;
  queryRaw: string | null;
}

export interface WalkingEstimate {
  isOrigin: boolean;
  isPathRoute: boolean;
  meters: number;
  minutes: number;
  summaryBn: string;
}

export interface AdminValidationReport {
  missingPins: PlaceLocation[];
  unassignedSessions: RawScheduleTile[];
  missingTimeSessions: RawScheduleTile[];
  canExport: boolean;
}

/**
 * Converts "7:45 AM" / "1:00 PM" / "14:30" into minutes since midnight (0..1439).
 */
export function parseTimeToMinutes(rawTime?: string): number | null {
  if (!rawTime) return null;
  const trimmed = rawTime.trim().toUpperCase();
  if (!trimmed) return null;

  const amPmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (amPmMatch) {
    let hh = Number(amPmMatch[1]);
    const mm = Number(amPmMatch[2]);
    const meridiem = amPmMatch[3];
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) {
      return null;
    }
    if (meridiem === 'AM' && hh === 12) hh = 0;
    if (meridiem === 'PM' && hh !== 12) hh += 12;
    return hh * 60 + mm;
  }

  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hh = Number(h24Match[1]);
    const mm = Number(h24Match[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return null;
    }
    return hh * 60 + mm;
  }

  return null;
}

export function formatMinutes12h(totalMinutes: number): string {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh24 = Math.floor(norm / 60);
  const mm = norm % 60;
  const meridiem = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${meridiem}`;
}

/**
 * Resolves either ?t=HH:MM simulation query param or the live device clock.
 */
export function resolveClock(
  searchStr: string = typeof window !== 'undefined' ? window.location.search : ''
): SimulationClock {
  const params = new URLSearchParams(searchStr);
  const tParam = params.get('t')?.trim() ?? null;
  if (tParam && /^\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?$/.test(tParam)) {
    const parsed = parseTimeToMinutes(tParam);
    if (parsed !== null) {
      return {
        minutes: parsed,
        label: formatMinutes12h(parsed),
        isSimulated: true,
        queryRaw: tParam,
      };
    }
  }

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return {
    minutes,
    label: formatMinutes12h(minutes),
    isSimulated: false,
    queryRaw: null,
  };
}

/**
 * Computes status for every schedule item reusing content.json timestamps and device clock.
 * Sessions without a timestamp (e.g. SALAH) keep startMinutes = null without inventing times.
 */
export function evaluateScheduleSessions(
  tiles: RawScheduleTile[],
  nowMinutes: number
): Map<string, EvaluatedSession> {
  const parsedStarts = new Map<string, number | null>();
  const distinctSortedStarts: number[] = [];

  for (const tile of tiles) {
    const start = parseTimeToMinutes(tile.time);
    parsedStarts.set(String(tile.id), start);
    if (start !== null && !distinctSortedStarts.includes(start)) {
      distinctSortedStarts.push(start);
    }
  }
  distinctSortedStarts.sort((a, b) => a - b);

  const result = new Map<string, EvaluatedSession>();

  for (const tile of tiles) {
    const id = String(tile.id);
    const label = (tile.label || '').trim() || `Session ${id}`;
    const start = parsedStarts.get(id) ?? null;

    if (start === null) {
      result.set(id, {
        id,
        label,
        timeLabel: 'সময় নির্ধারিত নয়',
        timeMissing: true,
        startMinutes: null,
        endMinutes: null,
        status: 'LOCKED',
      });
      continue;
    }

    const nextStart = distinctSortedStarts.find((candidate) => candidate > start);
    const end = nextStart !== undefined ? nextStart : Math.min(1439, start + 90);

    let status: ScheduleState;
    if (nowMinutes < start) {
      status = 'LOCKED';
    } else if (nowMinutes >= start && nowMinutes < end) {
      status = 'LIVE';
    } else {
      status = 'DONE';
    }

    result.set(id, {
      id,
      label,
      timeLabel: tile.time?.trim() || formatMinutes12h(start),
      timeMissing: false,
      startMinutes: start,
      endMinutes: end,
      status,
    });
  }

  return result;
}

/**
 * Normalizes session assignments from explicit `sessions` array or legacy `place.sessionIds`.
 */
export function resolveSessionsForPlace(
  place: PlaceLocation,
  assignments: SessionAssignment[]
): string[] {
  const fromArray = assignments
    .filter((item) => item.placeId === place.id)
    .map((item) => String(item.sessionId));
  if (fromArray.length > 0) return Array.from(new Set(fromArray));
  return Array.isArray(place.sessionIds) ? place.sessionIds.map(String) : [];
}

/**
 * Evaluates aggregate pin state (LIVE > LOCKED > DONE) across all sessions at a place.
 */
export function evaluateAllPlaces(
  places: PlaceLocation[],
  assignments: SessionAssignment[],
  scheduleTiles: RawScheduleTile[],
  nowMinutes: number
): EvaluatedPlace[] {
  const sessionMap = evaluateScheduleSessions(scheduleTiles, nowMinutes);

  return places.map((place) => {
    const ids = resolveSessionsForPlace(place, assignments);
    const sessions: EvaluatedSession[] = ids
      .map((sid) => sessionMap.get(String(sid)))
      .filter((item): item is EvaluatedSession => Boolean(item));

    const liveSession = sessions.find((s) => s.status === 'LIVE');
    const lockedSession = sessions.find((s) => s.status === 'LOCKED');

    let status: ScheduleState = 'DONE';
    if (liveSession) {
      status = 'LIVE';
    } else if (lockedSession) {
      status = 'LOCKED';
    } else if (sessions.length === 0) {
      status = 'LOCKED';
    }

    const primarySession = liveSession ?? lockedSession ?? sessions[0] ?? null;
    return {
      place,
      status,
      sessions,
      primarySession,
    };
  });
}

export function haversineMeters(a: LngLatTuple, b: LngLatTuple): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function polylineLengthMeters(coords: LngLatTuple[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1], coords[i]);
  }
  return total;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnNumber(num: number): string {
  return String(num).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/**
 * Formats walking distance cleanly in Bengali.
 */
export function formatDistanceBn(meters: number): string {
  if (meters >= 1000) {
    return `${toBnNumber(Number((meters / 1000).toFixed(1)))} কিমি`;
  }
  return `${toBnNumber(Math.round(meters))} মিটার`;
}

/**
 * Computes shortest walking path distance and minutes from the `reporting` place using
 * the drawn walking path graph in `locations.json`, falling back to straight-line distance.
 */
export function computeWalkingFromReporting(
  config: LocationsConfig,
  targetPlaceId: string
): WalkingEstimate | null {
  const anchorPlace =
    config.places.find((p) => p.id === 'stage') ??
    config.places.find((p) => p.id === 'adda') ??
    config.places.find((p) => p.id === 'reporting') ??
    config.places[0];
  const anchorId = anchorPlace?.id || 'stage';

  if (targetPlaceId === anchorId) {
    return {
      isOrigin: true,
      isPathRoute: true,
      meters: 0,
      minutes: 0,
      summaryBn: `এটিই মূল ${anchorPlace?.nameBn || 'ভেন্যু'} (এখান থেকেই অন্য স্থানের দূরত্ব হিসাব করা হয়েছে)`,
    };
  }

  const adj = new Map<string, Array<{ to: string; dist: number }>>();
  for (const path of config.paths || []) {
    if (!path.coordinates || path.coordinates.length < 2) continue;
    const dist = polylineLengthMeters(path.coordinates);
    if (!adj.has(path.from)) adj.set(path.from, []);
    if (!adj.has(path.to)) adj.set(path.to, []);
    adj.get(path.from)!.push({ to: path.to, dist });
    adj.get(path.to)!.push({ to: path.from, dist });
  }

  // Dijkstra from anchor venue
  const distMap = new Map<string, number>([[anchorId, 0]]);
  const visited = new Set<string>();
  while (true) {
    let bestId: string | null = null;
    let bestVal = Infinity;
    for (const [id, val] of distMap.entries()) {
      if (!visited.has(id) && val < bestVal) {
        bestVal = val;
        bestId = id;
      }
    }
    if (!bestId || bestId === targetPlaceId) break;
    visited.add(bestId);
    for (const edge of adj.get(bestId) || []) {
      const next = bestVal + edge.dist;
      if (next < (distMap.get(edge.to) ?? Infinity)) {
        distMap.set(edge.to, next);
      }
    }
  }

  const pathMeters = distMap.get(targetPlaceId);
  if (pathMeters !== undefined && Number.isFinite(pathMeters)) {
    const walkMin = Math.max(1, Math.round(pathMeters / 72));
    return {
      isOrigin: false,
      isPathRoute: true,
      meters: Math.round(pathMeters),
      minutes: walkMin,
      summaryBn: `${anchorPlace?.nameBn || 'স্টেজ'} থেকে হাঁটার পথ: প্রায় ${toBnNumber(walkMin)} মিনিট (${formatDistanceBn(pathMeters)})`,
    };
  }

  const origin = anchorPlace;
  const target = config.places.find((p) => p.id === targetPlaceId);
  if (
    !origin ||
    !target ||
    origin.lat === null ||
    origin.lng === null ||
    target.lat === null ||
    target.lng === null
  ) {
    return null;
  }

  const straight = haversineMeters([origin.lng, origin.lat], [target.lng, target.lat]);
  const walkMin = Math.max(1, Math.round(straight / 72));
  const modeHint = `${origin.nameBn} থেকে আনুমানিক দূরত্ব: প্রায় ${toBnNumber(walkMin)} মিনিট (${formatDistanceBn(straight)})`;

  return {
    isOrigin: false,
    isPathRoute: false,
    meters: Math.round(straight),
    minutes: walkMin,
    summaryBn: modeHint,
  };
}

/**
 * Validates places, session assignments, and missing times for the dev admin tool.
 */
export function validateLocationsConfig(
  config: LocationsConfig,
  scheduleTiles: RawScheduleTile[]
): AdminValidationReport {
  const missingPins = config.places.filter(
    (p) => p.lat === null || p.lng === null || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)
  );
  const validPlaceIds = new Set(config.places.map((p) => p.id));

  const assignedMap = new Map<string, string>();
  for (const s of config.sessions || []) {
    if (s.placeId && validPlaceIds.has(s.placeId)) {
      assignedMap.set(String(s.sessionId), s.placeId);
    }
  }

  const unassignedSessions = scheduleTiles.filter((t) => !assignedMap.has(String(t.id)));
  const missingTimeSessions = scheduleTiles.filter((t) => parseTimeToMinutes(t.time) === null);

  return {
    missingPins,
    unassignedSessions,
    missingTimeSessions,
    canExport: missingPins.length === 0 && unassignedSessions.length === 0,
  };
}
