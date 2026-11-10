export interface WelcomeContent {
  line1: string;
  line2: string;
  finalNumber: number;
  counterPhotos?: string[];
  posterUrl?: string;
}

export interface CenterDiscContent {
  logoUrl: string;
  titleRegular: string;
  titleItalic: string;
  scriptSubtitle: string;
  dateLine: string;
  scheduleLine1: string;
  scheduleLine2: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface WheelTile {
  id: string;
  label: string;
  photoUrl: string;
  location?: string;
  locationName?: string;
}

export interface WheelContent {
  rotationDurationSec: number;
  tiles: WheelTile[];
}

export interface SiteContent {
  version: number;
  welcome: WelcomeContent;
  centerDisc: CenterDiscContent;
  wheel: WheelContent;
}
