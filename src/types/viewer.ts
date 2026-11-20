export type ViewMode = 'quad' | 'single' | 'interior';

export type QuadPaneId = 'right' | 'left' | 'front' | 'rear';

export type CameraPresetId =
  | 'hero'
  | 'right'
  | 'left'
  | 'front'
  | 'rear'
  | 'top'
  | 'cockpit'
  | 'dashboard'
  | 'secondRow'
  | 'fullCabin';

export type InteriorSpotId = 'cockpit' | 'dashboard' | 'secondRow' | 'fullCabin';

export type PaintId = 'superWhite' | 'silverMetallic' | 'pearlWhite' | 'greyMetallic' | 'attitudeBlack';

export interface PaintFinish {
  id: PaintId;
  name: string;
  swatchHex: string;
  bodyHex: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  decalInk: 'dark' | 'light';
}

export const PAINT_FINISHES: readonly PaintFinish[] = [
  {
    id: 'superWhite',
    name: 'Super White II',
    swatchHex: '#f4f6f8',
    bodyHex: 0xf4f6f8,
    metalness: 0.12,
    roughness: 0.20,
    clearcoat: 0.96,
    clearcoatRoughness: 0.07,
    decalInk: 'dark',
  },
  {
    id: 'silverMetallic',
    name: 'Silver Metallic',
    swatchHex: '#c6ccd2',
    bodyHex: 0xc2c8ce,
    metalness: 0.62,
    roughness: 0.24,
    clearcoat: 0.95,
    clearcoatRoughness: 0.09,
    decalInk: 'dark',
  },
  {
    id: 'pearlWhite',
    name: 'White Pearl Crystal',
    swatchHex: '#e7e6e1',
    bodyHex: 0xe8e6df,
    metalness: 0.3,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    decalInk: 'dark',
  },
  {
    id: 'greyMetallic',
    name: 'Alumina Grey',
    swatchHex: '#7d858c',
    bodyHex: 0x767e85,
    metalness: 0.68,
    roughness: 0.25,
    clearcoat: 0.95,
    clearcoatRoughness: 0.09,
    decalInk: 'light',
  },
  {
    id: 'attitudeBlack',
    name: 'Attitude Black Mica',
    swatchHex: '#20242b',
    bodyHex: 0x1b1f26,
    metalness: 0.55,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    decalInk: 'light',
  },
] as const;

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  position: Vec3Tuple;
  target: Vec3Tuple;
  fov: number;
  minDistance: number;
  maxDistance: number;
}

export interface QuadViewportRect {
  id: QuadPaneId;
  label: string;
  /** CSS top-left coordinates for overlay positioning */
  cssLeft: number;
  cssTop: number;
  /** WebGL bottom-left coordinates for setViewport / setScissor */
  glX: number;
  glY: number;
  width: number;
  height: number;
  aspect: number;
}

export interface ViewerState {
  viewMode: ViewMode;
  activePreset: CameraPresetId;
  interiorSpot: InteriorSpotId;
  paintId: PaintId;
  liveryEnabled: boolean;
  doorsOpen: boolean;
  lightsOn: boolean;
  turntable: boolean;
  zoomPercent: number;
  activeQuadPane: QuadPaneId;
  hudCollapsed: boolean;
}
