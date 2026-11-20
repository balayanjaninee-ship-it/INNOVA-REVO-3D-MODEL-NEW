import type {
  CameraPose,
  CameraPresetId,
  QuadPaneId,
  QuadViewportRect,
} from '../types/viewer';

export const VEHICLE_LENGTH = 4.74;
export const VEHICLE_WIDTH = 1.84;
export const VEHICLE_HEIGHT = 1.80;
export const VEHICLE_CENTER_Y = 0.88;

export const MIN_EXTERIOR_DISTANCE = 1.25;
export const MAX_EXTERIOR_DISTANCE = 19.0;
export const MIN_INTERIOR_DISTANCE = 0.32;
export const MAX_INTERIOR_DISTANCE = 4.5;

export interface QuadPaneMeta {
  id: QuadPaneId;
  label: string;
  row: 0 | 1;
  col: 0 | 1;
}

/**
 * Exact 2x2 ordering from the PANELCO III Vehicle Sketch (Four View):
 * Top-Left: Right Side View | Top-Right: Left Side View
 * Bottom-Left: Front View   | Bottom-Right: Rear View
 */
export const QUAD_PANES: readonly QuadPaneMeta[] = [
  { id: 'right', label: 'Right Side View', row: 0, col: 0 },
  { id: 'left', label: 'Left Side View', row: 0, col: 1 },
  { id: 'front', label: 'Front View', row: 1, col: 0 },
  { id: 'rear', label: 'Rear View', row: 1, col: 1 },
] as const;

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Frame-rate independent exponential damping.
 */
export function dampValue(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  const safeDt = clamp(dt, 0, 0.1);
  const alpha = 1 - Math.exp(-lambda * safeDt);
  return current + (target - current) * alpha;
}

/**
 * Computes camera distance required to fit a bounding sphere or box projection
 * cleanly inside a viewport of the given FOV and aspect ratio without clipping.
 */
export function computeFitDistance(
  subjectWidth: number,
  subjectHeight: number,
  fovDeg: number,
  aspect: number,
  padding = 1.28,
): number {
  const safeAspect = Math.max(aspect, 0.35);
  const vFovRad = (fovDeg * Math.PI) / 180;
  const tanHalfV = Math.tan(vFovRad * 0.5);
  const tanHalfH = tanHalfV * safeAspect;

  const distForHeight = (subjectHeight * 0.5 * padding) / tanHalfV;
  const distForWidth = (subjectWidth * 0.5 * padding) / tanHalfH;

  return Math.max(distForHeight, distForWidth);
}

/**
 * Computes pixel rectangles (both CSS top-left and WebGL bottom-left) for the 4-view quad.
 */
export function computeQuadViewports(
  canvasWidth: number,
  canvasHeight: number,
  topInset = 52,
  bottomInset = 0,
): QuadViewportRect[] {
  const safeW = Math.max(1, Math.floor(canvasWidth));
  const safeH = Math.max(1, Math.floor(canvasHeight));
  const clampedTop = clamp(Math.floor(topInset), 0, Math.floor(safeH * 0.25));
  const clampedBottom = clamp(Math.floor(bottomInset), 0, Math.floor(safeH * 0.25));
  const usableH = Math.max(2, safeH - clampedTop - clampedBottom);

  const halfW = Math.floor(safeW / 2);
  const rightW = safeW - halfW;
  const topH = Math.floor(usableH / 2);
  const bottomH = usableH - topH;

  return QUAD_PANES.map((pane) => {
    const cssLeft = pane.col === 0 ? 0 : halfW;
    const width = pane.col === 0 ? halfW : rightW;
    const cssTop = pane.row === 0 ? clampedTop : clampedTop + topH;
    const height = pane.row === 0 ? topH : bottomH;
    const glX = cssLeft;
    // WebGL origin is bottom-left; cssTop + height is the bottom edge in CSS space.
    const glY = safeH - (cssTop + height);

    return {
      id: pane.id,
      label: pane.label,
      cssLeft,
      cssTop,
      glX,
      glY,
      width,
      height,
      aspect: width / Math.max(1, height),
    };
  });
}

/**
 * Hit-tests a pointer coordinate (relative to canvas CSS pixels) against quad viewports.
 */
export function hitTestQuadPane(
  x: number,
  y: number,
  rects: readonly QuadViewportRect[],
): QuadPaneId | null {
  for (const r of rects) {
    if (
      x >= r.cssLeft &&
      x < r.cssLeft + r.width &&
      y >= r.cssTop &&
      y < r.cssTop + r.height
    ) {
      return r.id;
    }
  }
  return null;
}

/**
 * Computes calibrated camera poses for all 4 orthographic-like elevations,
 * hero 3/4 view, top view, and interior cabin inspection viewpoints.
 *
 * Coordinate system:
 * +Z = Front nose, -Z = Rear tailgate, +Y = Up, +X = Vehicle Left (Driver LHD), -X = Vehicle Right
 */
export function getCameraPresetPose(
  preset: CameraPresetId,
  aspect: number,
  isQuadPane = false,
): CameraPose {
  const safeAspect = Math.max(aspect, 0.4);
  const isNarrowQuad = isQuadPane && safeAspect < 0.85;
  const pad = isQuadPane ? (isNarrowQuad ? 1.24 : 1.36) : 1.32;
  const quadFov = isNarrowQuad ? 42 : 26;

  switch (preset) {
    case 'right': {
      // Camera on -X looking toward +X: nose (+Z) points RIGHT on screen
      const fov = isQuadPane ? quadFov : 32;
      const dist = computeFitDistance(VEHICLE_LENGTH, VEHICLE_HEIGHT * 1.12, fov, safeAspect, pad);
      return {
        position: { x: -dist, y: 0.94, z: 0 },
        target: { x: 0, y: 0.86, z: 0 },
        fov,
        minDistance: MIN_EXTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
    case 'left': {
      // Camera on +X looking toward -X: nose (+Z) points LEFT on screen
      const fov = isQuadPane ? quadFov : 32;
      const dist = computeFitDistance(VEHICLE_LENGTH, VEHICLE_HEIGHT * 1.12, fov, safeAspect, pad);
      return {
        position: { x: dist, y: 0.94, z: 0 },
        target: { x: 0, y: 0.86, z: 0 },
        fov,
        minDistance: MIN_EXTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
    case 'front': {
      // Camera on +Z looking toward -Z: shows front grille, headlights, hood
      const fov = isQuadPane ? quadFov : 32;
      const dist = computeFitDistance(VEHICLE_WIDTH * 1.55, VEHICLE_HEIGHT * 1.18, fov, safeAspect, pad) + VEHICLE_LENGTH * 0.36;
      return {
        position: { x: 0, y: 0.96, z: dist },
        target: { x: 0, y: 0.86, z: 0.35 },
        fov,
        minDistance: MIN_EXTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
    case 'rear': {
      // Camera on -Z looking toward +Z: shows tailgate, lamps, underbody axle & exhaust
      const fov = isQuadPane ? quadFov : 32;
      const dist = computeFitDistance(VEHICLE_WIDTH * 1.55, VEHICLE_HEIGHT * 1.18, fov, safeAspect, pad) + VEHICLE_LENGTH * 0.36;
      return {
        position: { x: 0, y: 0.96, z: -dist },
        target: { x: 0, y: 0.86, z: -0.35 },
        fov,
        minDistance: MIN_EXTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
    case 'top': {
      const fov = 34;
      const dist = computeFitDistance(VEHICLE_WIDTH * 1.4, VEHICLE_LENGTH * 1.05, fov, safeAspect, 1.24);
      return {
        position: { x: 0.01, y: dist + 1.0, z: 0.01 },
        target: { x: 0, y: 0.85, z: 0 },
        fov,
        minDistance: MIN_EXTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
    case 'cockpit': {
      // Inside cabin at driver eye-point clear of seat backrest, viewing LHD wheel, Optitron gauges & infotainment
      return {
        position: { x: 0.34, y: 1.24, z: 0.08 },
        target: { x: 0.22, y: 1.03, z: 0.92 },
        fov: 56,
        minDistance: MIN_INTERIOR_DISTANCE,
        maxDistance: MAX_INTERIOR_DISTANCE,
      };
    }
    case 'dashboard': {
      // Centered cabin perspective showcasing full dual-tier dash, 8" infotainment & gear console
      return {
        position: { x: -0.06, y: 1.28, z: -0.42 },
        target: { x: 0.02, y: 1.03, z: 0.94 },
        fov: 56,
        minDistance: MIN_INTERIOR_DISTANCE,
        maxDistance: MAX_INTERIOR_DISTANCE,
      };
    }
    case 'secondRow': {
      // Looking rearward from front cabin toward 2nd-row captain seats & 3rd-row bench
      return {
        position: { x: 0.16, y: 1.34, z: 0.45 },
        target: { x: 0, y: 1.02, z: -1.12 },
        fov: 58,
        minDistance: MIN_INTERIOR_DISTANCE,
        maxDistance: MAX_INTERIOR_DISTANCE,
      };
    }
    case 'fullCabin': {
      // Open-door elevated cutaway angle peering cleanly across the open cabin interior
      const dist = computeFitDistance(3.0, 1.5, 42, safeAspect, 1.15);
      return {
        position: { x: dist * 0.72, y: 1.72, z: dist * 0.48 },
        target: { x: 0.08, y: 1.04, z: 0.12 },
        fov: 42,
        minDistance: MIN_INTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
    case 'hero':
    default: {
      // Classic automotive 3/4 front-left hero angle matching user photo references
      const fov = 34;
      const dist = computeFitDistance(VEHICLE_LENGTH * 0.88, VEHICLE_HEIGHT * 1.15, fov, safeAspect, 1.34);
      return {
        position: {
          x: dist * 0.68,
          y: 1.56,
          z: dist * 0.73,
        },
        target: { x: 0, y: 0.84, z: 0.08 },
        fov,
        minDistance: MIN_EXTERIOR_DISTANCE,
        maxDistance: MAX_EXTERIOR_DISTANCE,
      };
    }
  }
}

/**
 * Logarithmic mapping between intuitive UI zoom percent [25..300] and camera distance.
 * 100% = baseline distance, higher % = closer zoom (including deep interior close-ups).
 */
export function zoomPercentToDistance(
  zoomPercent: number,
  baseDistance: number,
  minDistance: number,
  maxDistance: number,
): number {
  const clampedZoom = clamp(zoomPercent, 25, 500);
  const raw = baseDistance * (100 / clampedZoom);
  return clamp(raw, minDistance, maxDistance);
}

export function distanceToZoomPercent(
  distance: number,
  baseDistance: number,
): number {
  const safeDist = Math.max(0.15, distance);
  const pct = Math.round((baseDistance / safeDist) * 100);
  return clamp(pct, 25, 500);
}
