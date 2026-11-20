import * as THREE from 'three';

/**
 * Toyota Innova AN140 (Revo Facelift) parametric dimensions (meters).
 * Coordinate system:
 *  +Z = Front nose (+2.36m)
 *  -Z = Rear tailgate (-2.36m)
 *  +Y = Up (ground = 0.0m, roof peak = 1.76m)
 *  +X = Vehicle Left (LHD Driver Side)
 *  -X = Vehicle Right (Passenger Side)
 */
export const INNOVA_DIMS = {
  length: 4.72,
  halfLength: 2.36,
  halfWidth: 0.915,
  frontAxleZ: 1.40,
  rearAxleZ: -1.35,
  wheelRadius: 0.355,
  wheelWidth: 0.225,
  trackHalfX: 0.785,
  archRadius: 0.415,
  frontDoorFrontZ: 0.93,
  frontDoorRearZ: -0.05,
  rearDoorRearZ: -0.98,
  cowlZ: 1.18,
  windshieldTopZ: 0.44,
  roofRearZ: -1.86,
  hoodTipZ: 1.96,
} as const;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Half-width of the body along Z (plan-view curvature at shoulder/beltline).
 */
export function bodyHalfWidthAtZ(z: number): number {
  const base = INNOVA_DIMS.halfWidth;
  let w = base;

  // Smooth aerodynamic fender taper toward rounded front nose corner (z = 1.96)
  if (z > 1.42) {
    const t = smoothstep(1.42, INNOVA_DIMS.hoodTipZ, z);
    w -= 0.088 * Math.pow(t, 1.55);
  }
  // Gentle rear taper toward rear bumper corners
  if (z < -1.55) {
    const t = smoothstep(-1.55, -2.36, z);
    w -= 0.115 * Math.pow(t, 1.8);
  }

  // Subtle muscular fender flares around front & rear wheel arches
  const dFront = (z - INNOVA_DIMS.frontAxleZ) / 0.48;
  const dRear = (z - INNOVA_DIMS.rearAxleZ) / 0.50;
  const frontFlare = Math.exp(-dFront * dFront * 2.1) * 0.032;
  const rearFlare = Math.exp(-dRear * dRear * 2.0) * 0.036;

  return w + frontFlare + rearFlare;
}

/**
 * Beltline (windowsill) Y height along Z — captures the signature Toyota Innova
 * sleek sloping hood toward the rounded nose, subtle upward door rise, and D-pillar kink.
 */
export function beltlineYAtZ(z: number): number {
  if (z >= INNOVA_DIMS.cowlZ) {
    const t = smoothstep(INNOVA_DIMS.cowlZ, INNOVA_DIMS.hoodTipZ, z);
    return 1.115 - 0.185 * Math.pow(t, 1.25);
  }
  if (z >= -0.96) {
    const t = (INNOVA_DIMS.cowlZ - z) / (INNOVA_DIMS.cowlZ + 0.96);
    return 1.115 + 0.032 * t;
  }
  if (z >= -1.94) {
    // Signature Innova upswept rear quarter window kink
    const t = smoothstep(-0.96, -1.94, z);
    return 1.147 + 0.173 * t;
  }
  const t = smoothstep(-1.94, -2.36, z);
  return 1.32 - 0.14 * t;
}

/**
 * Lower rocker / bumper bottom height along Z, carving exact circular wheel arch cutouts.
 */
export function lowerEdgeYAtZ(z: number, includeWheelArches = true): number {
  let y = 0.22;

  // Front chin rises smoothly ahead of front wheel toward nose seam
  if (z > 1.72) {
    const t = smoothstep(1.72, INNOVA_DIMS.hoodTipZ, z);
    y += 0.035 * t;
  }
  // Rear bumper clearance rises behind rear wheels
  if (z < -1.78) {
    const t = smoothstep(-1.78, -2.36, z);
    y += 0.095 * t;
  }

  if (includeWheelArches) {
    const r = INNOVA_DIMS.archRadius;
    const cy = INNOVA_DIMS.wheelRadius;

    const df = Math.abs(z - INNOVA_DIMS.frontAxleZ);
    if (df < r) {
      const archY = cy + Math.sqrt(Math.max(0, r * r - df * df));
      y = Math.max(y, archY);
    }

    const dr = Math.abs(z - INNOVA_DIMS.rearAxleZ);
    if (dr < r) {
      const archY = cy + Math.sqrt(Math.max(0, r * r - dr * dr));
      y = Math.max(y, archY);
    }
  }

  return y;
}

/**
 * Roofline height along Z (from windshield header to rear spoiler edge).
 */
export function roofYAtZ(z: number): number {
  const t = (z + 0.55) / 1.35;
  return 1.76 - 0.042 * t * t;
}

/**
 * Roof rail half-width along Z (authentic MPV tumblehome tapering inward from beltline).
 */
export function roofHalfWidthAtZ(z: number): number {
  const base = 0.655;
  const frontTaper = smoothstep(-0.2, 0.50, z) * 0.035;
  const rearTaper = smoothstep(-1.1, -1.96, z) * 0.055;
  return base - frontTaper - rearTaper;
}

/**
 * Shared exact A-pillar top rail height & half-width along Z in [windshieldTopZ, cowlZ]
 * so the A-pillar, windshield edge, triangular quarter glass, and front door frame kiss seamlessly.
 */
export function aPillarPointAtZ(z: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, (z - INNOVA_DIMS.windshieldTopZ) / (INNOVA_DIMS.cowlZ - INNOVA_DIMS.windshieldTopZ)));
  const yTop = roofYAtZ(INNOVA_DIMS.windshieldTopZ);
  const yBot = 1.11;
  const xTop = roofHalfWidthAtZ(INNOVA_DIMS.windshieldTopZ);
  const xBot = bodysideXAtZV(INNOVA_DIMS.cowlZ, 1.0) - 0.015;
  // Slight convex windshield rake bow
  const bowY = Math.sin(t * Math.PI) * 0.022;
  const bowX = Math.sin(t * Math.PI) * 0.012;
  return {
    x: xTop + (xBot - xTop) * t + bowX,
    y: yTop + (yBot - yTop) * t + bowY,
  };
}

/**
 * Cross-sectional side tumblehome & sculptural shoulder profile.
 * v in [0, 1] maps from lower rocker edge (0) to beltline (1).
 */
export function bodysideXAtZV(z: number, v: number): number {
  const wMax = bodyHalfWidthAtZ(z);
  const lowerTuck = -0.062 * Math.pow(1 - v, 2.2);
  const midBelly = 0.026 * Math.sin(v * Math.PI);
  const characterCrease = 0.014 * Math.exp(-Math.pow((v - 0.72) / 0.14, 2));
  const upperTuck = -0.020 * Math.pow(v, 3.0);

  const noseRound = z > 1.72 ? -0.022 * smoothstep(1.72, INNOVA_DIMS.hoodTipZ, z) * (1 - 0.35 * v) : 0;
  const rearRound = z < -2.02 ? -0.032 * smoothstep(-2.02, -2.36, z) * (1 - 0.3 * v) : 0;

  return wMax + lowerTuck + midBelly + characterCrease + upperTuck + noseRound + rearRound;
}

/**
 * Evaluates the exact tangent-continuous rounded & pointed aerodynamic Innova nose surface
 * for s in [-1, 1] (right fender to left fender) and v in [0, 1] (lower chin to hood lip).
 * Meets side fenders seamlessly at z = INNOVA_DIMS.hoodTipZ (1.96m) with 0° tangent corner
 * and sweeps smoothly forward into a rounded-pointy central prow at z ≈ 2.47m.
 */
export function frontFasciaPointAtSV(
  s: number,
  v: number,
  target: THREE.Vector3,
  includeGrilleRecess = true,
): void {
  const absS = Math.abs(s);
  const angle = s * (Math.PI * 0.5);
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);

  // Exact match to side fender bottom & top edges at |s| = 1, sloping smoothly down toward nose tip
  const cornerYBot = lowerEdgeYAtZ(INNOVA_DIMS.hoodTipZ, false);
  const cornerYTop = beltlineYAtZ(INNOVA_DIMS.hoodTipZ);
  const yBot = 0.242 + (cornerYBot - 0.242) * Math.pow(absS, 1.4);
  const yTop = 0.872 + (cornerYTop - 0.872) * Math.pow(absS, 1.35);
  const y = yBot + (yTop - yBot) * v;

  // Tangent-continuous elliptical wrap around the nose cheeks
  const edgeX = bodysideXAtZV(INNOVA_DIMS.hoodTipZ, v);
  const x = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.90) * edgeX;

  // Plan-view rounded + gently pointy central prow sweep (0m at fenders -> +0.44m at center)
  const planSweep = (0.62 * cosA + 0.38 * Math.pow(cosA, 2.25)) * 0.445;

  // Side-profile wedge prow: projects forward around mid-grille, rolls softly over hood lip, tucks under chin
  const centerFactor = Math.pow(Math.max(0, cosA), 1.2);
  const prowBulge =
    (Math.sin(Math.pow(v, 0.82) * Math.PI) * 0.095 - Math.pow(1 - v, 2.1) * 0.052) *
    centerFactor;

  // Deep recessed trapezoidal grille pocket so painted skin sits strictly behind dark grille backing
  let grilleRecess = 0;
  if (includeGrilleRecess) {
    const grilleHalfS = 0.245 + 0.062 * smoothstep(0.30, 0.94, v);
    const inGrilleX = smoothstep(grilleHalfS + 0.045, grilleHalfS - 0.018, absS);
    const inGrilleY = smoothstep(0.28, 0.36, v) * smoothstep(0.985, 0.905, v);
    grilleRecess = -0.095 * inGrilleX * inGrilleY;
  }

  const z = INNOVA_DIMS.hoodTipZ + planSweep + prowBulge + grilleRecess;
  target.set(x, y, z);
}

/**
 * Computes the local horizontal surface yaw angle (radians around Y) on the rounded front fascia
 * so headlamps, projectors, and triangular fog bezels sit flush with the curved cheek.
 */
export function frontFasciaYawAtSV(s: number, v: number): number {
  const eps = 0.015;
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  frontFasciaPointAtSV(Math.max(-0.99, s - eps), v, p0, false);
  frontFasciaPointAtSV(Math.min(0.99, s + eps), v, p1, false);
  return Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
}

/**
 * Evaluates a point on the sleek sloping Innova hood for u in [0, 1] (cowl -> curved nose lip)
 * and s in [-1, 1] (right fender -> left fender). Shared by hood shell & hood wordmark decal.
 */
export function evalHoodPoint(u: number, s: number, target: THREE.Vector3): void {
  const absS = Math.abs(s);
  const z0 = INNOVA_DIMS.cowlZ;
  const x0 = s * bodysideXAtZV(z0, 1.0);
  const y0 = beltlineYAtZ(z0) + (1 - s * s) * 0.042;

  const frontEdge = new THREE.Vector3();
  frontFasciaPointAtSV(s, 1.0, frontEdge, false);

  // Smooth aerodynamic blend from cowl to exact rounded-pointy front fascia top edge
  const z = z0 + (frontEdge.z - z0) * u;
  const clampedZ = Math.min(INNOVA_DIMS.hoodTipZ, z);
  const edgeXAtZ = bodysideXAtZV(clampedZ, 1.0);
  const xLinear = x0 + (frontEdge.x - x0) * Math.pow(u, 1.15);
  const edgeWeight = Math.pow(absS, 3.0);
  const x = xLinear * (1 - edgeWeight) + Math.sign(s) * edgeXAtZ * edgeWeight;

  // Center arch rolls smoothly down into pointed nose; outer edges match exact fender beltlineYAtZ with 0mm gap
  const centerY = y0 + (frontEdge.y - y0) * Math.pow(u, 1.22) + Math.sin(u * Math.PI) * 0.044;
  const edgeY = beltlineYAtZ(clampedZ);
  const baseY = centerY * (1 - absS * absS) + edgeY * (absS * absS);
  const powerRidge =
    0.011 *
    Math.exp(-Math.pow((absS - 0.40) / 0.13, 2)) *
    Math.sin(u * Math.PI * 0.92);

  target.set(x, baseY + powerRidge, z);
}

/**
 * Builds an indexed BufferGeometry from a parametric (u, v) surface evaluator.
 */
export function buildParametricSurface(
  nu: number,
  nv: number,
  evalPoint: (u: number, v: number, target: THREE.Vector3) => void,
  flipWinding = false,
): THREE.BufferGeometry {
  const vertCount = (nu + 1) * (nv + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const p = new THREE.Vector3();

  let ptr = 0;
  let uvPtr = 0;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      evalPoint(u, v, p);
      positions[ptr++] = p.x;
      positions[ptr++] = p.y;
      positions[ptr++] = p.z;
      uvs[uvPtr++] = u;
      uvs[uvPtr++] = v;
    }
  }

  const indices: number[] = [];
  const rowStride = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const v00 = i * rowStride + j;
      const v10 = (i + 1) * rowStride + j;
      const v01 = i * rowStride + (j + 1);
      const v11 = (i + 1) * rowStride + (j + 1);

      if (!flipWinding) {
        indices.push(v00, v10, v11);
        indices.push(v00, v11, v01);
      } else {
        indices.push(v00, v11, v10);
        indices.push(v00, v01, v11);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function sampleZWithArches(zStart: number, zEnd: number, baseSteps: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= baseSteps; i++) {
    pts.push(zStart + (zEnd - zStart) * (i / baseSteps));
  }

  const arches = [INNOVA_DIMS.frontAxleZ, INNOVA_DIMS.rearAxleZ];
  const r = INNOVA_DIMS.archRadius;
  for (const ax of arches) {
    const minA = ax - r;
    const maxA = ax + r;
    if (maxA >= zStart && minA <= zEnd) {
      const arcSamples = 20;
      for (let k = 0; k <= arcSamples; k++) {
        const theta = (k / arcSamples) * Math.PI;
        const za = ax - Math.cos(theta) * r;
        if (za >= zStart && za <= zEnd) {
          pts.push(za);
        }
      }
    }
  }

  pts.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const z of pts) {
    if (deduped.length === 0 || Math.abs(z - deduped[deduped.length - 1]) > 0.005) {
      deduped.push(z);
    }
  }
  return deduped;
}

/**
 * Builds a sculpted lower bodyside panel (front fender, hinged front door, or rear door + quarter).
 * side: -1 = Right Side (-X outward), +1 = Left Side (+X outward).
 */
export function buildSidePanelGeometry(
  zStart: number,
  zEnd: number,
  side: -1 | 1,
  includeArches = true,
  baseSteps = 14,
  nv = 8,
): THREE.BufferGeometry {
  const zList = sampleZWithArches(zStart, zEnd, baseSteps);
  const nu = zList.length - 1;

  return buildParametricSurface(
    nu,
    nv,
    (u, v, target) => {
      const idx = Math.min(nu, Math.round(u * nu));
      const z = zList[idx];
      const yBot = lowerEdgeYAtZ(z, includeArches);
      const yTop = beltlineYAtZ(z);
      const y = yBot + (yTop - yBot) * v;
      const xMag = bodysideXAtZV(z, v);
      target.set(side * xMag, y, z);
    },
    side === 1,
  );
}

/**
 * Builds the curved front hood bridging left & right fenders smoothly into the rounded-pointy nose.
 */
export function buildHoodGeometry(): THREE.BufferGeometry {
  return buildParametricSurface(
    18,
    20,
    (u, v, target) => {
      const s = v * 2 - 1;
      evalHoodPoint(u, s, target);
    },
    false,
  );
}

/**
 * Builds the wrap-around rounded & pointy front bumper nose & recessed grille surround cheeks.
 */
export function buildFrontFasciaSkinGeometry(): THREE.BufferGeometry {
  return buildParametricSurface(
    32,
    14,
    (u, v, target) => {
      const s = u * 2 - 1;
      frontFasciaPointAtSV(s, v, target, true);
    },
    false,
  );
}

/**
 * Builds the curved dark recessed trapezoidal grille cavity backing hugging the pointed nose contour.
 */
export function buildGrilleBackingGeometry(): THREE.BufferGeometry {
  return buildParametricSurface(
    16,
    10,
    (u, v, target) => {
      const fv = 0.325 + v * 0.635;
      const halfS = 0.252 + 0.060 * v;
      const s = (u * 2 - 1) * halfS;
      frontFasciaPointAtSV(s, fv, target, false);
      target.z -= 0.026;
    },
    false,
  );
}

/**
 * Builds a sleek flush swept-back headlamp outer contour shell tapering sharply along the rounded fender.
 * side: -1 = Right headlamp, +1 = Left headlamp.
 */
export function buildHeadlampShellGeometry(
  side: -1 | 1,
  pushOut = 0.012,
  vMin = 0.72,
  vMax = 0.945,
): THREE.BufferGeometry {
  // Runs from outer grille edge (|s| = 0.315) sweeping gracefully back along rounded cheek (|s| = 0.85)
  return buildParametricSurface(
    14,
    6,
    (u, v, target) => {
      const sMin = side === 1 ? 0.315 : -0.85;
      const sMax = side === 1 ? 0.85 : -0.315;
      const s = sMin + (sMax - sMin) * u;
      const tAlong = side === 1 ? u : 1 - u; // 0 near grille, 1 at swept outer blade tip

      // Tapered aggressive Innova headlamp blade narrows sharply toward the outer fender shoulder
      const localVMin = vMin + 0.095 * Math.pow(tAlong, 1.15);
      const localVMax = vMax + 0.028 * Math.sin(tAlong * Math.PI * 0.8);
      const fv = localVMin + (localVMax - localVMin) * v;

      frontFasciaPointAtSV(s, fv, target, false);
      const yaw = frontFasciaYawAtSV(s, fv);
      // Push outward cleanly along true surface normal
      target.x += Math.sin(yaw) * pushOut;
      target.z += Math.cos(yaw) * pushOut;
    },
    false,
  );
}

/**
 * Builds the sculpted wrap-around rear bumper panel below the tailgate.
 */
export function buildRearBumperGeometry(): THREE.BufferGeometry {
  return buildParametricSurface(
    20,
    8,
    (u, v, target) => {
      const s = u * 2 - 1;
      const absS = Math.abs(s);

      const tailSweep = (1 - absS * absS) * 0.075;
      const shelfBulge = 0.032 * Math.sin(v * Math.PI);
      const z = -2.31 - tailSweep - shelfBulge + 0.06 * Math.pow(absS, 2.4);

      const yBot = 0.305;
      const yTop = 0.675;
      const y = yBot + (yTop - yBot) * v;

      const edgeX = bodysideXAtZV(-2.31, 0.25 + v * 0.35);
      const x = s * edgeX;

      target.set(x, y, z);
    },
    true,
  );
}

/**
 * Builds the sculpted lower metal section of the hinged rear tailgate (below rear glass).
 */
export function buildTailgateLowerPanelGeometry(hingeY: number, hingeZ: number): THREE.BufferGeometry {
  return buildParametricSurface(
    18,
    10,
    (u, v, target) => {
      const s = u * 2 - 1;
      const absS = Math.abs(s);

      const yWorld = 0.665 + v * 0.485;
      const halfW = bodysideXAtZV(-2.26, 0.55 + v * 0.45) * 0.965;
      const x = s * halfW;

      const baseZ = -2.325 + v * 0.065;
      const convex = -(1 - absS * absS) * 0.048;
      const plateRecess =
        absS < 0.34 && v > 0.15 && v < 0.58
          ? 0.022 * Math.sin(((v - 0.15) / 0.43) * Math.PI) * (1 - Math.pow(absS / 0.34, 4))
          : 0;

      target.set(x, yWorld - hingeY, baseZ + convex + plateRecess - hingeZ);
    },
    true,
  );
}

/**
 * Builds the contoured curved rear tailgate glass window in LOCAL hinge coordinates.
 */
export function buildTailgateGlassGeometry(hingeY: number, hingeZ: number): THREE.BufferGeometry {
  return buildParametricSurface(
    14,
    8,
    (u, v, target) => {
      const s = u * 2 - 1;
      const yBot = 1.155;
      const yTop = 1.675;
      const yWorld = yBot + (yTop - yBot) * v;

      const wBot = 0.725;
      const wTop = 0.575;
      const halfW = wBot + (wTop - wBot) * v;
      const x = s * halfW;

      const zBot = -2.255;
      const zTop = -1.935;
      const curve = -(1 - s * s) * 0.042;
      const zWorld = zBot + (zTop - zBot) * v + curve;

      target.set(x, yWorld - hingeY, zWorld - hingeZ);
    },
    true,
  );
}

/**
 * Builds the arched cabin roof panel whose front header bows forward to kiss the curved windshield seamlessly.
 */
export function buildRoofGeometry(): THREE.BufferGeometry {
  const zStart = INNOVA_DIMS.roofRearZ;
  const zEnd = INNOVA_DIMS.windshieldTopZ;

  return buildParametricSurface(
    16,
    14,
    (u, v, target) => {
      const s = v * 2 - 1;
      // Front header bows gently forward (+0.046m at center) to match the curved windshield top edge!
      const frontBow = (1 - s * s) * 0.048 * Math.pow(u, 2.2);
      const z = zStart + (zEnd - zStart) * u + frontBow;
      const halfW = roofHalfWidthAtZ(Math.min(zEnd, z));
      const x = s * halfW;
      const crown = (1 - s * s) * 0.044;
      const y = roofYAtZ(Math.min(zEnd, z)) + crown;
      target.set(x, y, z);
    },
    false,
  );
}

/**
 * Builds the curved front windshield glass fitting flush between A-pillars, cowl, and curved roof header.
 */
export function buildWindshieldGeometry(): THREE.BufferGeometry {
  return buildParametricSurface(
    16,
    10,
    (u, v, target) => {
      const s = u * 2 - 1;
      const zBot = INNOVA_DIMS.cowlZ;
      const zTop = INNOVA_DIMS.windshieldTopZ;
      const zBase = zBot + (zTop - zBot) * v;

      const pillarPt = aPillarPointAtZ(zBase);
      const halfW = pillarPt.x - 0.015;
      const x = s * halfW;

      const bowZ = (1 - s * s) * (0.065 - 0.017 * v);
      const bowY = (1 - s * s) * 0.044;

      target.set(x, pillarPt.y + bowY, zBase + bowZ);
    },
    false,
  );
}

/**
 * Builds a contoured side window pane spanning [zStart, zEnd] with authentic MPV tumblehome curve.
 */
export function buildSideWindowGeometry(
  zStart: number,
  zEnd: number,
  side: -1 | 1,
  topCurveOverride?: (z: number) => number,
  xInset = 0.014,
): THREE.BufferGeometry {
  return buildParametricSurface(
    12,
    6,
    (u, v, target) => {
      const z = zStart + (zEnd - zStart) * u;
      const yBot = beltlineYAtZ(z) + 0.012;
      const yTop = topCurveOverride ? topCurveOverride(z) : roofYAtZ(z) - 0.032;
      const y = yBot + (yTop - yBot) * v;

      const xBot = bodysideXAtZV(z, 1.0) - xInset;
      const xTop =
        z > INNOVA_DIMS.windshieldTopZ
          ? aPillarPointAtZ(z).x - xInset
          : roofHalfWidthAtZ(z) - xInset + 0.008;
      const glassConvex = Math.sin(v * Math.PI) * 0.022;
      const xMag = xBot + (xTop - xBot) * Math.pow(v, 1.12) + glassConvex;

      target.set(side * xMag, y, z);
    },
    side === 1,
  );
}

/**
 * Curved decal sheet hugging the sloping front hood for "PANELCO III" in official logo green.
 */
export function buildHoodDecalGeometryFixed(): THREE.BufferGeometry {
  const uStart = 0.36;
  const uEnd = 0.80;
  const sHalfSpan = 0.64;

  return buildParametricSurface(
    14,
    8,
    (u, v, target) => {
      const s = (u * 2 - 1) * sHalfSpan;
      const uHood = uEnd + (uStart - uEnd) * v;
      evalHoodPoint(uHood, s, target);
      target.y += 0.008;
      target.z += 0.003;
    },
    false,
  );
}

/**
 * Builds a contoured door decal patch that reads naturally left-to-right on BOTH sides.
 */
export function buildSideDecalGeometry(
  zMin: number,
  zMax: number,
  vMin: number,
  vMax: number,
  side: -1 | 1,
  offsetX = 0.008,
  pivotZ = 0,
  pivotX = 0,
): THREE.BufferGeometry {
  return buildParametricSurface(
    10,
    6,
    (u, v, target) => {
      const z = side === -1 ? zMin + (zMax - zMin) * u : zMax - (zMax - zMin) * u;
      const bodyV = vMin + (vMax - vMin) * v;
      const yBot = lowerEdgeYAtZ(z, false);
      const yTop = beltlineYAtZ(z);
      const y = yBot + (yTop - yBot) * bodyV;
      const xMag = bodysideXAtZV(z, bodyV) + offsetX;
      target.set(side * xMag - pivotX, y, z - pivotZ);
    },
    false,
  );
}

/**
 * Builds a strictly horizontal side decal patch spanning across rear door & rear quarter panel
 * so long vinyl scripts stay dead-level parallel to the ground while hugging bodyside curvature.
 */
export function buildHorizontalSideDecalGeometry(
  zMin: number,
  zMax: number,
  yMin: number,
  yMax: number,
  side: -1 | 1,
  offsetX = 0.008,
): THREE.BufferGeometry {
  return buildParametricSurface(
    18,
    6,
    (u, v, target) => {
      const z = side === -1 ? zMin + (zMax - zMin) * u : zMax - (zMax - zMin) * u;
      const y = yMin + (yMax - yMin) * v;
      const yBot = lowerEdgeYAtZ(z, false);
      const yTop = beltlineYAtZ(z);
      const bodyV = Math.max(0, Math.min(1, (y - yBot) / Math.max(0.1, yTop - yBot)));
      const xMag = bodysideXAtZV(z, bodyV) + offsetX;
      target.set(side * xMag, y, z);
    },
    false,
  );
}

/**
 * Builds a contoured rear tailgate decal patch in LOCAL tailgate hinge space.
 */
export function buildTailgateDecalGeometry(
  xSpanHalf: number,
  yMinWorld: number,
  yMaxWorld: number,
  hingeY: number,
  hingeZ: number,
  xCenter = 0,
): THREE.BufferGeometry {
  return buildParametricSurface(
    10,
    6,
    (u, v, target) => {
      const x = xCenter + xSpanHalf * (1 - 2 * u);
      const yWorld = yMinWorld + (yMaxWorld - yMinWorld) * v;
      const tv = (yWorld - 0.665) / 0.485;
      const halfW = bodysideXAtZV(-2.26, 0.55 + tv * 0.45) * 0.965;
      const absS = Math.min(1, Math.abs(x / halfW));
      const baseZ = -2.325 + tv * 0.065;
      const convex = -(1 - absS * absS) * 0.048;

      target.set(x, yWorld - hingeY, baseZ + convex - 0.008 - hingeZ);
    },
    false,
  );
}

/**
 * Builds a realistic automotive tire profile via LatheGeometry (axis aligned along X).
 */
export function buildTireGeometry(): THREE.BufferGeometry {
  const outerR = INNOVA_DIMS.wheelRadius;
  const rimR = 0.228;
  const halfW = INNOVA_DIMS.wheelWidth * 0.5;

  const pts = [
    new THREE.Vector2(rimR, -halfW * 0.88),
    new THREE.Vector2(rimR + 0.03, -halfW * 0.96),
    new THREE.Vector2(outerR - 0.048, -halfW),
    new THREE.Vector2(outerR - 0.012, -halfW * 0.92),
    new THREE.Vector2(outerR, -halfW * 0.72),
    new THREE.Vector2(outerR + 0.002, 0),
    new THREE.Vector2(outerR, halfW * 0.72),
    new THREE.Vector2(outerR - 0.012, halfW * 0.92),
    new THREE.Vector2(outerR - 0.048, halfW),
    new THREE.Vector2(rimR + 0.03, halfW * 0.96),
    new THREE.Vector2(rimR, halfW * 0.88),
  ];

  const geom = new THREE.LatheGeometry(pts, 28);
  geom.rotateZ(Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a sleek 3D curved wheel arch flare trim lip hugging the top semicircle of a wheel opening.
 */
export function buildWheelArchFlareGeometry(axleZ: number, side: -1 | 1): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const r = INNOVA_DIMS.archRadius + 0.006;
  const cy = INNOVA_DIMS.wheelRadius;
  const steps = 20;

  for (let i = 0; i <= steps; i++) {
    const theta = -0.05 + (i / steps) * (Math.PI + 0.10);
    const z = axleZ - Math.cos(theta) * r;
    const y = Math.max(0.22, cy + Math.sin(theta) * r);
    const bodyYBot = lowerEdgeYAtZ(z, false);
    const bodyYTop = beltlineYAtZ(z);
    const v = Math.max(0, Math.min(1, (y - bodyYBot) / Math.max(0.1, bodyYTop - bodyYBot)));
    const xMag = bodysideXAtZV(z, v) + 0.006;
    pts.push(new THREE.Vector3(side * xMag, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 22, 0.015, 8, false);
}

/**
 * Builds a sleek 3D pillar strut sweeping smoothly between 3D anchor points.
 */
export function buildPillarGeometry(
  start: THREE.Vector3,
  mid: THREE.Vector3,
  end: THREE.Vector3,
  radius = 0.034,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  return new THREE.TubeGeometry(curve, 12, radius, 8, false);
}

/**
 * Builds the aerodynamic shark-fin roof antenna via ExtrudeGeometry with bevels.
 */
export function buildSharkFinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.08, 0);
  shape.quadraticCurveTo(-0.02, 0.068, 0.075, 0.072);
  shape.lineTo(0.088, 0.052);
  shape.lineTo(0.062, 0);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  geom.translate(0, 0, -0.012);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}
