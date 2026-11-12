export type PlaceIconId =
  | 'stage'
  | 'adda'
  | 'mosque'
  | 'football'
  | 'cricket'
  | 'food'
  | 'reporting'
  | 'auditorium'
  | 'indoor-games'
  | 'gate';

export type LngLatTuple = [number, number];

export interface PlaceLocation {
  id: string;
  nameBn: string;
  nameEn: string;
  lat: number | null;
  lng: number | null;
  icon: PlaceIconId;
  /** Optional legacy fallback when importing older v1 locations.json */
  sessionIds?: string[];
}

export interface SessionAssignment {
  sessionId: string;
  placeId: string;
}

export interface WalkingPath {
  from: string;
  to: string;
  coordinates: LngLatTuple[];
}

export interface MapAreaConfig {
  center: LngLatTuple;
  zoom: number;
  bounds: [LngLatTuple, LngLatTuple];
}

export type OverlayCategory =
  | 'dirt-road'
  | 'scrub-patch'
  | 'vegetation'
  | 'flower-bed'
  | 'building'
  | 'stage-zone'
  | 'adda-zone'
  | 'football-field'
  | 'cricket-field'
  | 'playground'
  | 'water';

export interface OverlayFeatureProperties {
  id?: string;
  category: OverlayCategory;
  label?: string;
  heightM?: number;
  roofStyle?: 'concrete' | 'tin';
}

export interface OverlayFeature {
  type: 'Feature';
  id?: string;
  properties: OverlayFeatureProperties;
  geometry:
    | { type: 'Point'; coordinates: LngLatTuple }
    | { type: 'LineString'; coordinates: LngLatTuple[] }
    | { type: 'Polygon'; coordinates: LngLatTuple[][] };
}

export interface OverlayCollection {
  type: 'FeatureCollection';
  features: OverlayFeature[];
}

export interface LocationsConfig {
  places: PlaceLocation[];
  sessions: SessionAssignment[];
  paths: WalkingPath[];
  mapArea: MapAreaConfig;
  overlay?: OverlayCollection;
}
