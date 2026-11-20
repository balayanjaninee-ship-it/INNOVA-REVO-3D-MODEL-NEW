import * as THREE from 'three';
import { PAINT_FINISHES, type PaintId } from '../types/viewer';
import {
  INNOVA_DIMS,
  aPillarPointAtZ,
  beltlineYAtZ,
  bodysideXAtZV,
  buildFrontFasciaSkinGeometry,
  buildGrilleBackingGeometry,
  buildHeadlampShellGeometry,
  buildHoodDecalGeometryFixed,
  buildHoodGeometry,
  buildHorizontalSideDecalGeometry,
  buildPillarGeometry,
  buildRearBumperGeometry,
  buildRoofGeometry,
  buildSharkFinGeometry,
  buildSideDecalGeometry,
  buildSidePanelGeometry,
  buildSideWindowGeometry,
  buildTailgateDecalGeometry,
  buildTailgateGlassGeometry,
  buildTailgateLowerPanelGeometry,
  buildTireGeometry,
  buildWheelArchFlareGeometry,
  buildWindshieldGeometry,
  frontFasciaPointAtSV,
  frontFasciaYawAtSV,
  roofHalfWidthAtZ,
  roofYAtZ,
} from './innovaGeometry';
import type { InnovaTextureSet } from './textures';

export interface InnovaModelController {
  root: THREE.Group;
  setPaint: (paintId: PaintId) => void;
  setLiveryVisible: (visible: boolean) => void;
  setLightsOn: (on: boolean) => void;
  setDoorOpenAmount: (amount: number) => void;
  setInteriorVisibilityBoost: (boost: number) => void;
  spinWheels: (deltaAngle: number) => void;
  dispose: () => void;
}

/**
 * Creates a sculpted 3D Toyota three-oval emblem group.
 */
function createToyotaEmblem(
  chromeMat: THREE.Material,
  scale: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.062, 0.008, 8, 24)), chromeMat);
  outer.scale.set(1.36, 0.92, 0.65);
  g.add(outer);

  const innerVert = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.050, 0.0068, 8, 20)), chromeMat);
  innerVert.scale.set(0.46, 0.96, 0.65);
  g.add(innerVert);

  const innerHoriz = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.042, 0.0062, 8, 20)), chromeMat);
  innerHoriz.scale.set(1.18, 0.42, 0.65);
  innerHoriz.position.set(0, 0.021, 0.003);
  g.add(innerHoriz);

  g.scale.setScalar(scale);
  return g;
}

/**
 * Builds one high-detail two-tone 10-spoke machined Innova alloy wheel + tire + brake assembly.
 */
function createWheelAssembly(
  side: -1 | 1,
  tireGeom: THREE.BufferGeometry,
  mats: {
    tire: THREE.Material;
    alloyMachined: THREE.Material;
    alloyDark: THREE.Material;
    chrome: THREE.Material;
    rotor: THREE.Material;
    caliper: THREE.Material;
  },
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const wheelRoot = new THREE.Group();
  const spinGroup = new THREE.Group();
  spinGroup.name = 'wheelSpin';
  wheelRoot.add(spinGroup);

  const tire = new THREE.Mesh(tireGeom, mats.tire);
  tire.castShadow = true;
  tire.receiveShadow = true;
  spinGroup.add(tire);

  const rimR = 0.232;
  const halfW = INNOVA_DIMS.wheelWidth * 0.5;
  const faceX = side * (halfW - 0.022);

  // Dark inner alloy barrel
  const barrelGeom = trackGeo(new THREE.CylinderGeometry(rimR, rimR, INNOVA_DIMS.wheelWidth * 0.80, 24, 1, true));
  barrelGeom.rotateZ(Math.PI / 2);
  spinGroup.add(new THREE.Mesh(barrelGeom, mats.alloyDark));

  // Outer machined rim lip ring
  const lipGeom = trackGeo(new THREE.TorusGeometry(rimR - 0.007, 0.012, 8, 28));
  lipGeom.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeom, mats.alloyMachined);
  lip.position.x = faceX;
  spinGroup.add(lip);

  // Recessed inner dark dish backing
  const dishGeom = trackGeo(new THREE.CylinderGeometry(rimR - 0.016, rimR - 0.020, 0.016, 20));
  dishGeom.rotateZ(Math.PI / 2);
  const dish = new THREE.Mesh(dishGeom, mats.alloyDark);
  dish.position.x = side * (halfW - 0.072);
  spinGroup.add(dish);

  // 5 Twin-Spoke (10 machined & gloss-black sculpted blades) Innova facelift alloy design
  const spokeMachinedGeom = trackGeo(new THREE.BoxGeometry(0.022, rimR - 0.052, 0.026));
  const spokeAccentGeom = trackGeo(new THREE.BoxGeometry(0.018, rimR - 0.056, 0.018));
  for (let i = 0; i < 5; i++) {
    const baseAngle = (i / 5) * Math.PI * 2;
    for (const pairOffset of [-0.21, 0.21]) {
      const a = baseAngle + pairOffset;
      const spoke = new THREE.Mesh(
        pairOffset > 0 ? spokeMachinedGeom : spokeAccentGeom,
        pairOffset > 0 ? mats.alloyMachined : mats.alloyDark,
      );
      const midR = (rimR + 0.052) * 0.5;
      spoke.position.set(faceX - side * 0.005, Math.cos(a) * midR, Math.sin(a) * midR);
      spoke.rotation.x = a;
      spinGroup.add(spoke);
    }
  }

  // Center hub cap + 5 chrome lug nuts
  const hubGeom = trackGeo(new THREE.CylinderGeometry(0.058, 0.064, 0.024, 18));
  hubGeom.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeom, mats.alloyMachined);
  hub.position.x = faceX - side * 0.001;
  spinGroup.add(hub);

  const capGeom = trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.028, 16));
  capGeom.rotateZ(Math.PI / 2);
  const cap = new THREE.Mesh(capGeom, mats.alloyDark);
  cap.position.x = faceX + side * 0.004;
  spinGroup.add(cap);

  const lugGeom = trackGeo(new THREE.CylinderGeometry(0.007, 0.007, 0.026, 8));
  lugGeom.rotateZ(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const lug = new THREE.Mesh(lugGeom, mats.chrome);
    lug.position.set(faceX + side * 0.003, Math.cos(a) * 0.042, Math.sin(a) * 0.042);
    spinGroup.add(lug);
  }

  // Ventilated brake disc rotor & stationary caliper
  const rotorGeom = trackGeo(new THREE.CylinderGeometry(0.165, 0.165, 0.018, 20));
  rotorGeom.rotateZ(Math.PI / 2);
  const rotor = new THREE.Mesh(rotorGeom, mats.rotor);
  rotor.position.x = side * (halfW - 0.095);
  spinGroup.add(rotor);

  const caliperGeom = trackGeo(new THREE.BoxGeometry(0.044, 0.108, 0.066));
  const caliper = new THREE.Mesh(caliperGeom, mats.caliper);
  caliper.position.set(side * (halfW - 0.092), 0.02, -0.115);
  wheelRoot.add(caliper);

  return wheelRoot;
}

/**
 * Creates a sculpted automotive bucket/captain seat with cushion, bolsters, backrest & headrest.
 */
function createSculptedSeat(
  leatherMat: THREE.Material,
  trimMat: THREE.Material,
  chromeMat: THREE.Material,
  width: number,
  includeInnerArmrestSide: -1 | 0 | 1,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): THREE.Group {
  const g = new THREE.Group();

  const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width, 0.11, 0.48)), leatherMat);
  base.position.set(0, 0.08, 0.02);
  g.add(base);

  const bolsterGeom = trackGeo(new THREE.BoxGeometry(0.08, 0.135, 0.46));
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(bolsterGeom, leatherMat);
    b.position.set(sx * (width * 0.45), 0.10, 0.02);
    b.rotation.z = sx * -0.14;
    g.add(b);
  }

  const ped = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width * 0.72, 0.12, 0.34)), trimMat);
  g.add(ped);

  const backGroup = new THREE.Group();
  backGroup.position.set(0, 0.14, -0.18);
  backGroup.rotation.x = -0.19;
  g.add(backGroup);

  const backMain = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width * 0.94, 0.56, 0.11)), leatherMat);
  backMain.position.set(0, 0.28, 0);
  backGroup.add(backMain);

  const backBolsterGeom = trackGeo(new THREE.BoxGeometry(0.075, 0.52, 0.135));
  for (const sx of [-1, 1]) {
    const bb = new THREE.Mesh(backBolsterGeom, leatherMat);
    bb.position.set(sx * (width * 0.44), 0.27, 0.02);
    bb.rotation.y = sx * 0.24;
    backGroup.add(bb);
  }

  const postGeom = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.10, 8));
  for (const sx of [-0.07, 0.07]) {
    const post = new THREE.Mesh(postGeom, chromeMat);
    post.position.set(sx, 0.60, 0);
    backGroup.add(post);
  }

  const headrest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.17, 0.10)), leatherMat);
  headrest.position.set(0, 0.71, 0.015);
  headrest.rotation.x = 0.08;
  backGroup.add(headrest);

  if (includeInnerArmrestSide !== 0) {
    const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.065, 0.34)), leatherMat);
    arm.position.set(includeInnerArmrestSide * (width * 0.54), 0.27, 0.12);
    g.add(arm);
  }

  return g;
}

/**
 * Builds the complete composite Toyota Innova AN140 (Revo Facelift) 3D vehicle.
 */
export function createInnovaModel(
  textures: InnovaTextureSet,
  isSoftwareGl: boolean,
): InnovaModelController {
  const root = new THREE.Group();
  root.name = 'ToyotaInnovaAN140';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // --- Physically-Based Automotive Material Library ---
  const initialPaint = PAINT_FINISHES[0];
  const bodyPaintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: initialPaint.bodyHex,
      metalness: initialPaint.metalness,
      roughness: initialPaint.roughness,
      clearcoat: initialPaint.clearcoat,
      clearcoatRoughness: initialPaint.clearcoatRoughness,
      bumpMap: textures.paintMicroBump,
      bumpScale: 0.001,
      envMapIntensity: 1.15,
      // FrontSide cuts fragment cost in half while keeping verified outward normals crisp
      side: THREE.FrontSide,
    }),
  );

  // Double-sided paint ONLY for the openable hinged doors & tailgate so back edges never look hollow
  const bodyPaintDoubleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: initialPaint.bodyHex,
      metalness: initialPaint.metalness,
      roughness: initialPaint.roughness,
      clearcoat: initialPaint.clearcoat,
      clearcoatRoughness: initialPaint.clearcoatRoughness,
      bumpMap: textures.paintMicroBump,
      bumpScale: 0.001,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide,
    }),
  );

  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f7fa,
      metalness: 0.96,
      roughness: 0.08,
      envMapIntensity: 1.35,
    }),
  );

  const glossBlackTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x11151b,
      metalness: 0.22,
      roughness: 0.16,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.1,
    }),
  );

  const matteBlackPlasticMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1d2128,
      metalness: 0.08,
      roughness: 0.78,
      side: THREE.DoubleSide,
    }),
  );

  const grilleSlatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262c34,
      metalness: 0.56,
      roughness: 0.32,
    }),
  );

  const silverSkidMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbcc4cc,
      metalness: 0.68,
      roughness: 0.30,
    }),
  );

  const exhaustMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa2aab4,
      metalness: 0.88,
      roughness: 0.26,
    }),
  );

  const underbodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22262e,
      metalness: 0.24,
      roughness: 0.84,
    }),
  );

  // Automotive glass: realistic studio reflections with crisp view of detailed 3-row cabin
  const frontGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e2c38,
      metalness: 0.08,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      envMapIntensity: 1.45,
      side: THREE.DoubleSide,
    }),
  );

  const rearPrivacyGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x121922,
      metalness: 0.08,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    }),
  );

  const headlampLensMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6eff8,
      metalness: 0.08,
      roughness: 0.05,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    }),
  );

  const projectorBulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fbff,
      emissive: new THREE.Color(0xfff6e5),
      emissiveIntensity: 0.4,
      roughness: 0.14,
      metalness: 0.2,
    }),
  );

  const drlMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2f8ff,
      emissive: new THREE.Color(0xdbeeff),
      emissiveIntensity: 0.85,
      roughness: 0.18,
    }),
  );

  const amberSignalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.14,
    }),
  );

  const tailRedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      emissive: new THREE.Color(0xef233c),
      emissiveIntensity: 0.38,
      roughness: 0.16,
      metalness: 0.12,
    }),
  );

  const tailReverseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.08,
      roughness: 0.2,
    }),
  );

  // Wheels & Brakes
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c1f24,
      roughness: 0.86,
      metalness: 0.04,
      bumpMap: textures.tireBump,
      bumpScale: 0.014,
      roughnessMap: textures.tireRoughness,
    }),
  );

  const alloyMachinedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0e6ec,
      metalness: 0.88,
      roughness: 0.18,
      envMapIntensity: 1.25,
    }),
  );

  const alloyDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262b33,
      metalness: 0.65,
      roughness: 0.36,
    }),
  );

  const rotorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.brakeRotor,
      metalness: 0.78,
      roughness: 0.34,
    }),
  );

  const caliperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      metalness: 0.55,
      roughness: 0.42,
    }),
  );

  // Interior Materials
  const dashMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x20242c,
      roughness: 0.78,
      metalness: 0.06,
    }),
  );

  const dashSilverTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9ca5b0,
      metalness: 0.75,
      roughness: 0.28,
    }),
  );

  const woodAccentMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x4b2e1e,
      roughness: 0.24,
      metalness: 0.08,
      clearcoat: 0.7,
    }),
  );

  const carpetMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x171a20,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );

  const headlinerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd5d8de,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );

  const leatherSeatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.leatherAlbedo,
      bumpMap: textures.leatherBump,
      bumpScale: 0.008,
      roughness: 0.66,
      metalness: 0.04,
    }),
  );

  const gaugeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.gaugeCluster,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: textures.gaugeCluster,
      emissiveIntensity: 0.78,
      roughness: 0.2,
    }),
  );

  const infoMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.infotainment,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: textures.infotainment,
      emissiveIntensity: 0.7,
      roughness: 0.16,
    }),
  );

  const domeLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8e7,
      emissive: new THREE.Color(0xffefcc),
      emissiveIntensity: 0.45,
      roughness: 0.3,
    }),
  );

  const makeDecalMat = (tex: THREE.Texture) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.68,
        metalness: 0.0,
        envMapIntensity: 0.32,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );

  const sealDecalMat = makeDecalMat(textures.liveryDark.seal);
  const scriptDecalMat = makeDecalMat(textures.liveryDark.script);
  const wordmarkDecalMat = makeDecalMat(textures.liveryDark.wordmark);
  const innovaBadgeMat = makeDecalMat(textures.innovaBadge);

  const liveryMeshes: THREE.Object3D[] = [];

  // =========================================================================
  // 1. SCULPTED BODY SHELL (Fenders, Rear Doors/Quarters, Hood, Roof, Pillars)
  // =========================================================================
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'ExteriorBody';
  root.add(bodyGroup);

  // Shared top-half curved wheel-well liner (axis along X, open arch faces DOWNWARD -Y!)
  // Verified: rotateZ(PI/2) maps +Y->-X, +X->+Y, +Z->+Z so theta in [0, PI] arches cleanly over TOP of tire!
  const sharedWheelWellArchGeom = trackGeo(
    new THREE.CylinderGeometry(
      INNOVA_DIMS.archRadius - 0.012,
      INNOVA_DIMS.archRadius - 0.012,
      0.30,
      20,
      1,
      true,
      0,
      Math.PI,
    ).rotateZ(Math.PI / 2),
  );
  const sharedWheelWellBulkheadGeom = trackGeo(
    new THREE.CircleGeometry(INNOVA_DIMS.archRadius - 0.016, 18, 0, Math.PI),
  );

  for (const side of [-1, 1] as const) {
    // Front fender & nose cheek (z = +0.93 .. +2.25) with circular front wheel arch cutout
    const frontFender = new THREE.Mesh(
      trackGeo(buildSidePanelGeometry(INNOVA_DIMS.frontDoorFrontZ, INNOVA_DIMS.hoodTipZ, side, true, 12, 8)),
      bodyPaintMat,
    );
    frontFender.castShadow = true;
    frontFender.receiveShadow = true;
    bodyGroup.add(frontFender);

    // Rear door & rear quarter panel (z = -2.31 .. -0.05) with circular rear wheel arch cutout
    const rearSide = new THREE.Mesh(
      trackGeo(buildSidePanelGeometry(-2.31, INNOVA_DIMS.frontDoorRearZ, side, true, 18, 8)),
      bodyPaintMat,
    );
    rearSide.castShadow = true;
    rearSide.receiveShadow = true;
    bodyGroup.add(rearSide);

    // Sculpted wheel arch flare lips
    bodyGroup.add(
      new THREE.Mesh(trackGeo(buildWheelArchFlareGeometry(INNOVA_DIMS.frontAxleZ, side)), bodyPaintMat),
    );
    bodyGroup.add(
      new THREE.Mesh(trackGeo(buildWheelArchFlareGeometry(INNOVA_DIMS.rearAxleZ, side)), bodyPaintMat),
    );

    // Properly oriented top-arch inner wheel-well liners tucked strictly INSIDE the fenders!
    for (const axZ of [INNOVA_DIMS.frontAxleZ, INNOVA_DIMS.rearAxleZ]) {
      const liner = new THREE.Mesh(sharedWheelWellArchGeom, matteBlackPlasticMat);
      liner.position.set(side * (INNOVA_DIMS.trackHalfX - 0.035), INNOVA_DIMS.wheelRadius, axZ);
      bodyGroup.add(liner);

      const bulkhead = new THREE.Mesh(sharedWheelWellBulkheadGeom, matteBlackPlasticMat);
      bulkhead.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      bulkhead.position.set(side * (INNOVA_DIMS.trackHalfX - 0.18), INNOVA_DIMS.wheelRadius, axZ);
      bodyGroup.add(bulkhead);
    }

    // Subtle lower rocker under-sill trim tucked cleanly beneath the doors
    const rockerTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.036, 1.88)), matteBlackPlasticMat);
    rockerTrim.position.set(side * 0.815, 0.215, 0.02);
    bodyGroup.add(rockerTrim);

    // Crisp rear door vertical shut-line seam
    const rearSeamPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const v = k / 8;
      const zSeam = -0.96 + (v < 0.35 ? (0.35 - v) * 0.16 : 0);
      const y = 0.24 + v * (beltlineYAtZ(zSeam) - 0.24);
      const x = bodysideXAtZV(zSeam, v) + 0.003;
      rearSeamPts.push(new THREE.Vector3(side * x, y, zSeam));
    }
    bodyGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rearSeamPts), 10, 0.0032, 6, false)),
        matteBlackPlasticMat,
      ),
    );

    // Chrome rear door handle
    const handleGroup = new THREE.Group();
    handleGroup.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.032, 0.175)), chromeMat));
    const hCup = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.052, 0.135)), matteBlackPlasticMat);
    hCup.position.x = -side * 0.009;
    handleGroup.add(hCup);
    handleGroup.position.set(side * (bodysideXAtZV(-0.76, 0.85) + 0.008), 0.99, -0.76);
    bodyGroup.add(handleGroup);

    // PANELCO III Horizontal Brush-Script Tagline spanning rear door & quarter panel: "Your delight . . . our success"
    const rearScriptDecal = new THREE.Mesh(
      trackGeo(buildHorizontalSideDecalGeometry(-1.76, -0.09, 0.778, 0.955, side, 0.008)),
      scriptDecalMat,
    );
    bodyGroup.add(rearScriptDecal);
    liveryMeshes.push(rearScriptDecal);

    // Fuel filler flap seam on left rear quarter (+X), positioned cleanly above the tagline
    if (side === 1) {
      const fuelFlap = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(0.062, 0.068, 18)),
        matteBlackPlasticMat,
      );
      fuelFlap.rotation.y = Math.PI / 2;
      fuelFlap.position.set(bodysideXAtZV(-1.62, 0.80) + 0.004, 1.045, -1.62);
      bodyGroup.add(fuelFlap);
    }

    // --- Greenhouse Pillars (Exact shared curve alignment!) ---
    const aBot = aPillarPointAtZ(INNOVA_DIMS.cowlZ);
    const aMid = aPillarPointAtZ((INNOVA_DIMS.cowlZ + INNOVA_DIMS.windshieldTopZ) * 0.5);
    const aTop = aPillarPointAtZ(INNOVA_DIMS.windshieldTopZ);
    const aPillar = new THREE.Mesh(
      trackGeo(
        buildPillarGeometry(
          new THREE.Vector3(side * aBot.x, aBot.y, INNOVA_DIMS.cowlZ),
          new THREE.Vector3(side * aMid.x, aMid.y, (INNOVA_DIMS.cowlZ + INNOVA_DIMS.windshieldTopZ) * 0.5),
          new THREE.Vector3(side * aTop.x, aTop.y, INNOVA_DIMS.windshieldTopZ),
          0.036,
        ),
      ),
      bodyPaintMat,
    );
    aPillar.castShadow = true;
    bodyGroup.add(aPillar);

    // Gloss-black B-pillar
    const bPillar = new THREE.Mesh(
      trackGeo(
        buildPillarGeometry(
          new THREE.Vector3(side * (bodysideXAtZV(-0.05, 1.0) - 0.008), beltlineYAtZ(-0.05), -0.05),
          new THREE.Vector3(side * 0.78, 1.44, -0.05),
          new THREE.Vector3(side * roofHalfWidthAtZ(-0.05), roofYAtZ(-0.05) - 0.015, -0.05),
          0.032,
        ),
      ),
      glossBlackTrimMat,
    );
    bodyGroup.add(bPillar);

    // Gloss-black C-pillar
    const cPillar = new THREE.Mesh(
      trackGeo(
        buildPillarGeometry(
          new THREE.Vector3(side * (bodysideXAtZV(-0.97, 1.0) - 0.008), beltlineYAtZ(-0.97), -0.97),
          new THREE.Vector3(side * 0.77, 1.45, -0.98),
          new THREE.Vector3(side * roofHalfWidthAtZ(-0.97), roofYAtZ(-0.97) - 0.015, -0.97),
          0.030,
        ),
      ),
      glossBlackTrimMat,
    );
    bodyGroup.add(cPillar);

    // Sculpted Body-Colored D-Pillar quarter panel
    const dPillarPanel = new THREE.Mesh(
      trackGeo(
        buildSideWindowGeometry(
          -2.22,
          -1.86,
          side,
          (z) => {
            const t = (z - -2.22) / (-1.86 - -2.22);
            return 1.24 + (roofYAtZ(-1.86) - 1.24) * Math.pow(t, 0.75);
          },
          0.002,
        ),
      ),
      bodyPaintMat,
    );
    dPillarPanel.castShadow = true;
    bodyGroup.add(dPillarPanel);

    const dStrut = new THREE.Mesh(
      trackGeo(
        buildPillarGeometry(
          new THREE.Vector3(side * (bodysideXAtZV(-2.24, 1.0) - 0.02), 1.15, -2.24),
          new THREE.Vector3(side * 0.73, 1.44, -2.07),
          new THREE.Vector3(side * (roofHalfWidthAtZ(-1.86) - 0.01), roofYAtZ(-1.86) - 0.01, -1.86),
          0.044,
        ),
      ),
      bodyPaintMat,
    );
    bodyGroup.add(dStrut);

    // Continuous body-colored upper roof rail
    const roofRailPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const z = -1.86 + (0.44 - -1.86) * (k / 12);
      roofRailPts.push(new THREE.Vector3(side * roofHalfWidthAtZ(z), roofYAtZ(z) - 0.01, z));
    }
    bodyGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(roofRailPts), 16, 0.032, 8, false)),
        bodyPaintMat,
      ),
    );

    // Chrome window beltline molding tracing the iconic Innova upsweep
    const beltPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) {
      const z = -1.92 + (1.16 - -1.92) * (k / 16);
      beltPts.push(new THREE.Vector3(side * (bodysideXAtZV(z, 1.0) + 0.004), beltlineYAtZ(z) + 0.005, z));
    }
    bodyGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beltPts), 20, 0.010, 6, false)),
        chromeMat,
      ),
    );

    // Fixed triangular front A-pillar quarter glass (exact match to aPillarPointAtZ!)
    const frontTriGlass = new THREE.Mesh(
      trackGeo(
        buildSideWindowGeometry(
          INNOVA_DIMS.frontDoorFrontZ,
          INNOVA_DIMS.cowlZ - 0.02,
          side,
          (z) => aPillarPointAtZ(z).y - 0.025,
          0.016,
        ),
      ),
      frontGlassMat,
    );
    frontTriGlass.renderOrder = 3;
    bodyGroup.add(frontTriGlass);

    // Rear Door Side Window Glass
    const rearDoorGlass = new THREE.Mesh(
      trackGeo(buildSideWindowGeometry(-0.96, -0.06, side, undefined, 0.015)),
      rearPrivacyGlassMat,
    );
    rearDoorGlass.renderOrder = 3;
    bodyGroup.add(rearDoorGlass);

    // Signature Innova Upswept Rear Quarter Glass
    const rearQuarterGlass = new THREE.Mesh(
      trackGeo(
        buildSideWindowGeometry(
          -1.92,
          -0.98,
          side,
          (z) => {
            const t = (z - -1.92) / (-0.98 - -1.92);
            return roofYAtZ(z) - 0.042 - (1 - t) * 0.045;
          },
          0.015,
        ),
      ),
      rearPrivacyGlassMat,
    );
    rearQuarterGlass.renderOrder = 3;
    bodyGroup.add(rearQuarterGlass);
  }

  // Sculpted Hood + PANELCO III Hood Wordmark Decal
  const hoodMesh = new THREE.Mesh(trackGeo(buildHoodGeometry()), bodyPaintMat);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  bodyGroup.add(hoodMesh);

  const hoodDecal = new THREE.Mesh(trackGeo(buildHoodDecalGeometryFixed()), wordmarkDecalMat);
  bodyGroup.add(hoodDecal);
  liveryMeshes.push(hoodDecal);

  // Sculpted Roof Panel + Interior Headliner Lining
  const roofMesh = new THREE.Mesh(trackGeo(buildRoofGeometry()), bodyPaintMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  bodyGroup.add(roofMesh);

  const headlinerMesh = new THREE.Mesh(trackGeo(buildRoofGeometry()), headlinerMat);
  headlinerMesh.position.y = -0.036;
  headlinerMesh.scale.set(0.96, 1, 0.97);
  bodyGroup.add(headlinerMesh);

  for (const sx of [-0.54, 0.54]) {
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.01, 2.15)), matteBlackPlasticMat);
    strip.position.set(sx, 1.745, -0.72);
    bodyGroup.add(strip);
  }

  // Aerodynamic Rear Roof Spoiler + Integrated High-Mount LED Brake Light
  const spoiler = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.22, 0.068, 0.28)), bodyPaintMat);
  spoiler.position.set(0, 1.695, -1.96);
  spoiler.rotation.x = 0.16;
  spoiler.castShadow = true;
  bodyGroup.add(spoiler);

  const highStopLamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.022, 0.03)), tailRedMat);
  highStopLamp.position.set(0, 1.685, -2.095);
  bodyGroup.add(highStopLamp);

  // Sculpted Shark-Fin Antenna
  const sharkFin = new THREE.Mesh(trackGeo(buildSharkFinGeometry()), bodyPaintMat);
  sharkFin.position.set(0, 1.745, -1.56);
  sharkFin.castShadow = true;
  bodyGroup.add(sharkFin);

  // Curved Front Windshield + Cowl Grill + Flat Horizontal Wipers
  const windshield = new THREE.Mesh(trackGeo(buildWindshieldGeometry()), frontGlassMat);
  windshield.renderOrder = 3;
  bodyGroup.add(windshield);

  const cowlDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.035, 0.14)), matteBlackPlasticMat);
  cowlDeck.position.set(0, 1.11, 1.21);
  cowlDeck.rotation.x = 0.12;
  bodyGroup.add(cowlDeck);

  for (const wx of [-0.28, 0.24]) {
    const wiper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.014, 0.02)), matteBlackPlasticMat);
    wiper.position.set(wx, 1.135, 1.225);
    wiper.rotation.z = 0.04;
    bodyGroup.add(wiper);
  }

  // =========================================================================
  // 2. ROUNDED & POINTY FRONT FASCIA: CURVED GRILLE, SWEPT HEADLAMPS & FOGS
  // =========================================================================
  const frontFasciaGroup = new THREE.Group();
  frontFasciaGroup.name = 'FrontFascia';
  root.add(frontFasciaGroup);

  const frontBumperSkin = new THREE.Mesh(trackGeo(buildFrontFasciaSkinGeometry()), bodyPaintMat);
  frontBumperSkin.castShadow = true;
  frontBumperSkin.receiveShadow = true;
  frontFasciaGroup.add(frontBumperSkin);

  // Helper sample on exact un-recessed rounded-pointy nose surface
  const pt = new THREE.Vector3();
  const sampleNose = (s: number, v: number, pushOut = 0): THREE.Vector3 => {
    const out = new THREE.Vector3();
    frontFasciaPointAtSV(s, v, out, false);
    if (pushOut !== 0) {
      const yaw = frontFasciaYawAtSV(s, v);
      out.x += Math.sin(yaw) * pushOut;
      out.z += Math.cos(yaw) * pushOut;
    }
    return out;
  };

  // Curved Dark Recessed Trapezoidal Grille Backing (hugs rounded-pointy nose cleanly inside pocket!)
  const grilleBacking = new THREE.Mesh(
    trackGeo(buildGrilleBackingGeometry()),
    matteBlackPlasticMat,
  );
  frontFasciaGroup.add(grilleBacking);

  // 5 Horizontal Dark-Gunmetal Grille Slats curving cleanly along the pointed nose contour
  for (let i = 0; i < 5; i++) {
    const t = i / 4; // 0 = top slat, 1 = bottom slat
    const fv = 0.88 - t * 0.46; // v in [0.42 .. 0.88]
    const halfS = 0.302 - t * 0.044;
    const slatPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const sVal = -halfS + (k / 8) * (halfS * 2);
      slatPts.push(sampleNose(sVal, fv, -0.004));
    }
    const slatMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(slatPts), 14, 0.0115, 6, false)),
      grilleSlatMat,
    );
    frontFasciaGroup.add(slatMesh);
  }

  // Polished Chrome Upper Eyebrow Wing flowing smoothly from pointed grille center over both headlamps
  const topChromePts: THREE.Vector3[] = [];
  for (let k = 0; k <= 16; k++) {
    const sVal = -0.74 + (k / 16) * 1.48;
    const absS = Math.abs(sVal);
    const fv = absS > 0.31 ? 0.942 + (absS - 0.31) * 0.03 : 0.952;
    topChromePts.push(sampleNose(sVal, fv, 0.013));
  }
  frontFasciaGroup.add(
    new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topChromePts), 28, 0.016, 8, false)),
      chromeMat,
    ),
  );

  // Polished Chrome Trapezoidal Grille Surround (left cheek -> pointed lower chin -> right cheek)
  const surroundPts: THREE.Vector3[] = [
    sampleNose(-0.312, 0.952, 0.012),
    sampleNose(-0.292, 0.64, 0.012),
    sampleNose(-0.258, 0.335, 0.012),
    sampleNose(-0.13, 0.328, 0.012),
    sampleNose(0, 0.325, 0.012),
    sampleNose(0.13, 0.328, 0.012),
    sampleNose(0.258, 0.335, 0.012),
    sampleNose(0.292, 0.64, 0.012),
    sampleNose(0.312, 0.952, 0.012),
  ];
  frontFasciaGroup.add(
    new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(surroundPts), 28, 0.013, 8, false)),
      chromeMat,
    ),
  );

  // 3D Chrome Toyota Emblem mounted proudly on the pointed center prow of the upper grille
  const frontEmblem = createToyotaEmblem(chromeMat, 0.98, trackGeo);
  const emblemPos = sampleNose(0, 0.78, 0.016);
  frontEmblem.position.copy(emblemPos);
  frontFasciaGroup.add(frontEmblem);

  // --- Flush Swept-Back Narrow Dual-Projector Headlamps + Flush Triangular Fog Bezels ---
  for (const side of [-1, 1] as const) {
    // Smoked dark contoured headlamp inner housing sweeping smoothly around the rounded fender
    const hlHousing = new THREE.Mesh(
      trackGeo(buildHeadlampShellGeometry(side, 0.008, 0.72, 0.945)),
      glossBlackTrimMat,
    );
    frontFasciaGroup.add(hlHousing);

    // Clear glossy polycarbonate outer lens hugging the sleek swept-back blade
    const hlCover = new THREE.Mesh(
      trackGeo(buildHeadlampShellGeometry(side, 0.020, 0.715, 0.95)),
      headlampLensMat,
    );
    hlCover.renderOrder = 4;
    frontFasciaGroup.add(hlCover);

    // Dual circular projector lenses aligned strictly along local curved nose normal
    const projGeom = trackGeo(new THREE.CylinderGeometry(0.028, 0.025, 0.024, 16).rotateX(Math.PI / 2));
    const ringGeom = trackGeo(new THREE.TorusGeometry(0.031, 0.0045, 8, 18));
    for (const [sPos, vPos] of [
      [0.41, 0.835],
      [0.54, 0.855],
    ] as const) {
      const sVal = side * sPos;
      const yaw = frontFasciaYawAtSV(sVal, vPos);
      const pProj = sampleNose(sVal, vPos, 0.011);
      const proj = new THREE.Mesh(projGeom, projectorBulbMat);
      proj.position.copy(pProj);
      proj.rotation.y = yaw;
      frontFasciaGroup.add(proj);

      const pRing = sampleNose(sVal, vPos, 0.017);
      const ring = new THREE.Mesh(ringGeom, chromeMat);
      ring.position.copy(pRing);
      ring.rotation.y = yaw;
      frontFasciaGroup.add(ring);
    }

    // Sleek contoured white LED DRL light-guide bar along bottom edge of swept headlamp
    const drlPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const sVal = side * (0.33 + t * 0.44);
      const vVal = 0.735 + t * 0.092;
      drlPts.push(sampleNose(sVal, vVal, 0.015));
    }
    frontFasciaGroup.add(
      new THREE.Mesh(trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(drlPts), 12, 0.0075, 6, false)), drlMat),
    );

    // Swept outer amber corner turn-signal tucked neatly into tapered fender blade tip
    const sAmb = side * 0.71;
    const vAmb = 0.885;
    const ambYaw = frontFasciaYawAtSV(sAmb, vAmb);
    const amberCorner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.034, 0.018)), amberSignalMat);
    amberCorner.position.copy(sampleNose(sAmb, vAmb, 0.012));
    amberCorner.rotation.y = ambYaw;
    frontFasciaGroup.add(amberCorner);

    // --- Signature Gloss-Black Triangular Corner Fog/Turn Bezel (Flush on Rounded Cheek!) ---
    const sFog = side * 0.53;
    const vFog = 0.36;
    const fogYaw = frontFasciaYawAtSV(sFog, vFog);
    const fogGroup = new THREE.Group();
    fogGroup.position.copy(sampleNose(sFog, vFog, 0.009));
    fogGroup.rotation.y = fogYaw;
    frontFasciaGroup.add(fogGroup);

    const triShape = new THREE.Shape();
    triShape.moveTo(-0.095, 0.102);
    triShape.lineTo(0.095, 0.102);
    triShape.lineTo(side * 0.022, -0.118);
    triShape.closePath();

    const triBezel = new THREE.Mesh(
      trackGeo(
        new THREE.ExtrudeGeometry(triShape, {
          depth: 0.022,
          bevelEnabled: true,
          bevelThickness: 0.006,
          bevelSize: 0.006,
          bevelSegments: 2,
        }),
      ),
      glossBlackTrimMat,
    );
    triBezel.position.z = -0.012;
    fogGroup.add(triBezel);

    // Vertical signal lens recessed inside black triangular housing
    const vertSignal = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.044, 0.108, 0.014)), amberSignalMat);
    vertSignal.position.set(0, 0.012, 0.013);
    fogGroup.add(vertSignal);

    // Lower round fog lamp near chin edge
    const fogBulb = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.016, 14).rotateX(Math.PI / 2)),
      projectorBulbMat,
    );
    fogBulb.position.set(-side * 0.045, -0.125, 0.013);
    fogGroup.add(fogBulb);
  }

  // Curved Lower Bumper Air Intake & Silver Chin Skid Lip hugging the pointed lower prow
  const lowerIntakePts: THREE.Vector3[] = [];
  const skidPts: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) {
    const sVal = -0.36 + (k / 10) * 0.72;
    lowerIntakePts.push(sampleNose(sVal, 0.15, 0.004));
    skidPts.push(sampleNose(sVal * 1.08, 0.045, 0.010));
  }
  const lowerIntake = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lowerIntakePts), 16, 0.046, 6, false)),
    matteBlackPlasticMat,
  );
  lowerIntake.scale.set(1, 1.0, 0.98);
  frontFasciaGroup.add(lowerIntake);

  const frontSkid = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(skidPts), 16, 0.022, 6, false)),
    silverSkidMat,
  );
  frontFasciaGroup.add(frontSkid);

  const frontPlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.plateFront,
      roughness: 0.35,
      metalness: 0.25,
    }),
  );
  const frontPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.108, 0.014)), frontPlateMat);
  frontPlate.position.copy(sampleNose(0, 0.23, 0.016));
  frontFasciaGroup.add(frontPlate);
  void pt;

  // =========================================================================
  // 3. HINGED FRONT DOORS (LEFT & RIGHT — CLEAN INNER CARDS & AERODYNAMIC MIRRORS)
  // =========================================================================
  const frontDoorPivots: { side: -1 | 1; pivot: THREE.Group }[] = [];

  for (const side of [-1, 1] as const) {
    const hingeZ = INNOVA_DIMS.frontDoorFrontZ;
    const hingeX = side * (bodysideXAtZV(hingeZ, 0.5) - 0.015);
    const pivot = new THREE.Group();
    pivot.name = side === 1 ? 'FrontLeftDoorPivot' : 'FrontRightDoorPivot';
    pivot.position.set(hingeX, 0, hingeZ);
    root.add(pivot);
    frontDoorPivots.push({ side, pivot });

    // Outer sculpted door metal panel (double-sided for solid open-door inspection)
    const doorSkinGeom = trackGeo(
      buildSidePanelGeometry(INNOVA_DIMS.frontDoorRearZ, INNOVA_DIMS.frontDoorFrontZ, side, false, 10, 8),
    );
    doorSkinGeom.translate(-hingeX, 0, -hingeZ);
    const doorSkin = new THREE.Mesh(doorSkinGeom, bodyPaintDoubleMat);
    doorSkin.castShadow = true;
    doorSkin.receiveShadow = true;
    pivot.add(doorSkin);

    // Properly tucked interior door trim card (sits safely INSIDE outer skin — ZERO poke-through!)
    const innerCard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.036, 0.62, 0.88)), dashMat);
    innerCard.position.set(-side * 0.072, 0.72, -0.49);
    pivot.add(innerCard);

    const innerArmrest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.075, 0.06, 0.52)), leatherSeatMat);
    innerArmrest.position.set(-side * 0.102, 0.82, -0.52);
    pivot.add(innerArmrest);

    // Contoured Front Door Window Glass (exact alignment with A-pillar!)
    const doorGlassGeom = trackGeo(
      buildSideWindowGeometry(
        INNOVA_DIMS.frontDoorRearZ + 0.01,
        INNOVA_DIMS.frontDoorFrontZ - 0.01,
        side,
        (z) => (z > INNOVA_DIMS.windshieldTopZ ? aPillarPointAtZ(z).y - 0.025 : roofYAtZ(z) - 0.032),
        0.016,
      ),
    );
    doorGlassGeom.translate(-hingeX, 0, -hingeZ);
    const doorGlass = new THREE.Mesh(doorGlassGeom, frontGlassMat);
    doorGlass.renderOrder = 3;
    pivot.add(doorGlass);

    // Sleek black door window frame surround
    const topFramePts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const z = INNOVA_DIMS.frontDoorRearZ + (INNOVA_DIMS.frontDoorFrontZ - INNOVA_DIMS.frontDoorRearZ) * (k / 8);
      const yTop = z > INNOVA_DIMS.windshieldTopZ ? aPillarPointAtZ(z).y - 0.022 : roofYAtZ(z) - 0.025;
      const xMag = z > INNOVA_DIMS.windshieldTopZ ? aPillarPointAtZ(z).x - 0.008 : roofHalfWidthAtZ(z) - 0.004;
      topFramePts.push(new THREE.Vector3(side * xMag - hingeX, yTop, z - hingeZ));
    }
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topFramePts), 12, 0.015, 6, false)),
        glossBlackTrimMat,
      ),
    );

    // Chrome Front Door Handle
    const fHandleGroup = new THREE.Group();
    fHandleGroup.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.032, 0.175)), chromeMat));
    const fhCup = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.052, 0.135)), matteBlackPlasticMat);
    fhCup.position.x = -side * 0.009;
    fHandleGroup.add(fhCup);
    fHandleGroup.position.set(
      side * (bodysideXAtZV(0.14, 0.85) + 0.008) - hingeX,
      0.975,
      0.14 - hingeZ,
    );
    pivot.add(fHandleGroup);

    // Aerodynamic Sculpted Wing Mirror with LED turn-signal strip
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(
      side * (bodysideXAtZV(0.84, 0.96) + 0.006) - hingeX,
      1.115,
      0.84 - hingeZ,
    );
    pivot.add(mirrorGroup);

    const stalk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.075, 0.042, 0.068)), glossBlackTrimMat);
    stalk.position.set(side * 0.038, 0.012, 0);
    stalk.rotation.z = side * 0.28;
    mirrorGroup.add(stalk);

    // Rounded aerodynamic mirror shell
    const capGeom = trackGeo(new THREE.SphereGeometry(0.088, 16, 12));
    const cap = new THREE.Mesh(capGeom, bodyPaintMat);
    cap.scale.set(1.12, 0.66, 0.72);
    cap.position.set(side * 0.125, 0.05, -0.02);
    cap.rotation.y = -side * 0.16;
    cap.castShadow = true;
    mirrorGroup.add(cap);

    const mirrorLed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.105, 0.013, 0.014)), drlMat);
    mirrorLed.position.set(side * 0.13, 0.046, 0.036);
    mirrorLed.rotation.y = -side * 0.16;
    mirrorGroup.add(mirrorLed);

    const mirrorGlass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.13, 0.078)), chromeMat);
    mirrorGlass.rotation.y = Math.PI - side * 0.16;
    mirrorGlass.position.set(side * 0.125, 0.05, -0.082);
    mirrorGroup.add(mirrorGlass);

    // Official PANELCO 3 Circular Logo Decal centered on the Front Door (1:1 circular aspect)
    const sealDecal = new THREE.Mesh(
      trackGeo(buildSideDecalGeometry(0.23, 0.67, 0.33, 0.82, side, 0.009, hingeZ, hingeX)),
      sealDecalMat,
    );
    pivot.add(sealDecal);
    liveryMeshes.push(sealDecal);
  }

  // =========================================================================
  // 4. REAR FASCIA, HINGED TAILGATE, BOOMERANG TAIL LAMPS & UNDERBODY AXLE
  // =========================================================================
  const rearBumper = new THREE.Mesh(trackGeo(buildRearBumperGeometry()), bodyPaintMat);
  rearBumper.castShadow = true;
  rearBumper.receiveShadow = true;
  bodyGroup.add(rearBumper);

  const rearDiffuser = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.42, 0.075, 0.055)), matteBlackPlasticMat);
  rearDiffuser.position.set(0, 0.33, -2.355);
  bodyGroup.add(rearDiffuser);

  for (const side of [-1, 1] as const) {
    const reflector = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.034, 0.022)), tailRedMat);
    reflector.position.set(side * 0.64, 0.42, -2.332);
    reflector.rotation.y = side * 0.24;
    bodyGroup.add(reflector);

    // Outer quarter-panel boomerang tail lamp cluster
    const outerLampGroup = new THREE.Group();
    outerLampGroup.position.set(side * 0.72, 1.04, -2.265);
    outerLampGroup.rotation.y = side * 0.28;
    bodyGroup.add(outerLampGroup);

    outerLampGroup.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.23, 0.125, 0.07)), tailRedMat));

    const lowerDrop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.175, 0.065)), tailRedMat);
    lowerDrop.position.set(side * 0.068, -0.135, 0.01);
    lowerDrop.rotation.z = -side * 0.14;
    outerLampGroup.add(lowerDrop);

    const outerSignal = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.048, 0.074)), amberSignalMat);
    outerSignal.position.set(-side * 0.04, -0.032, 0.004);
    outerLampGroup.add(outerSignal);
  }

  // Hinged Rear Tailgate pivoting cleanly from top roof hinge
  const tailgateHingeY = 1.70;
  const tailgateHingeZ = -1.90;
  const tailgatePivot = new THREE.Group();
  tailgatePivot.name = 'RearTailgatePivot';
  tailgatePivot.position.set(0, tailgateHingeY, tailgateHingeZ);
  root.add(tailgatePivot);

  const tailgateLower = new THREE.Mesh(
    trackGeo(buildTailgateLowerPanelGeometry(tailgateHingeY, tailgateHingeZ)),
    bodyPaintDoubleMat,
  );
  tailgateLower.castShadow = true;
  tailgateLower.receiveShadow = true;
  tailgatePivot.add(tailgateLower);

  const tailgateInner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.36, 0.42, 0.036)), dashMat);
  tailgateInner.position.set(0, 0.90 - tailgateHingeY, -2.23 - tailgateHingeZ);
  tailgatePivot.add(tailgateInner);

  const tailgateGlass = new THREE.Mesh(
    trackGeo(buildTailgateGlassGeometry(tailgateHingeY, tailgateHingeZ)),
    rearPrivacyGlassMat,
  );
  tailgateGlass.renderOrder = 3;
  tailgatePivot.add(tailgateGlass);

  const rearWiperArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.02, 0.022)), matteBlackPlasticMat);
  rearWiperArm.position.set(-0.08, 1.18 - tailgateHingeY, -2.29 - tailgateHingeZ);
  rearWiperArm.rotation.z = -0.05;
  tailgatePivot.add(rearWiperArm);

  for (const side of [-1, 1] as const) {
    const innerRed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.066, 0.038)), tailRedMat);
    innerRed.position.set(side * 0.45, 1.075 - tailgateHingeY, -2.31 - tailgateHingeZ);
    innerRed.rotation.z = side * 0.07;
    tailgatePivot.add(innerRed);

    const innerReverse = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.21, 0.044, 0.036)), tailReverseMat);
    innerReverse.position.set(side * 0.43, 1.018 - tailgateHingeY, -2.312 - tailgateHingeZ);
    innerReverse.rotation.z = side * 0.07;
    tailgatePivot.add(innerReverse);
  }

  const rearChromeBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.026, 0.022)), chromeMat);
  rearChromeBar.position.set(0, 1.045 - tailgateHingeY, -2.338 - tailgateHingeZ);
  tailgatePivot.add(rearChromeBar);

  const rearEmblem = createToyotaEmblem(chromeMat, 0.92, trackGeo);
  rearEmblem.rotation.y = Math.PI;
  rearEmblem.position.set(0, 1.095 - tailgateHingeY, -2.338 - tailgateHingeZ);
  tailgatePivot.add(rearEmblem);

  const rearPlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.plateRear,
      roughness: 0.35,
      metalness: 0.25,
    }),
  );
  const rearPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.41, 0.112, 0.015)), rearPlateMat);
  rearPlate.rotation.y = Math.PI;
  rearPlate.position.set(0, 0.775 - tailgateHingeY, -2.345 - tailgateHingeZ);
  tailgatePivot.add(rearPlate);

  // Metallic "INNOVA" chrome badge on rear-left (+X) tailgate
  tailgatePivot.add(
    new THREE.Mesh(
      trackGeo(buildTailgateDecalGeometry(0.145, 0.94, 1.005, tailgateHingeY, tailgateHingeZ, 0.50)),
      innovaBadgeMat,
    ),
  );

  // PANELCO III Bold Tailgate Wordmark Decal
  const tailgateDecal = new THREE.Mesh(
    trackGeo(buildTailgateDecalGeometry(0.46, 0.855, 0.975, tailgateHingeY, tailgateHingeZ, 0)),
    wordmarkDecalMat,
  );
  tailgatePivot.add(tailgateDecal);
  liveryMeshes.push(tailgateDecal);

  // --- Underbody Chassis, Rear Live Axle, Differential, Spare Tire & Exhaust ---
  const underbodyGroup = new THREE.Group();
  underbodyGroup.name = 'UnderbodyChassis';
  root.add(underbodyGroup);

  const chassisPan = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.44, 0.10, 4.14)), underbodyMat);
  chassisPan.position.set(0, 0.28, -0.02);
  underbodyGroup.add(chassisPan);

  for (const fx of [-0.46, 0.46]) {
    const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.085, 0.085, 4.20)), underbodyMat);
    rail.position.set(fx, 0.26, -0.02);
    underbodyGroup.add(rail);
  }

  const rearAxleTube = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.48, 12).rotateZ(Math.PI / 2)),
    underbodyMat,
  );
  rearAxleTube.position.set(0, 0.34, INNOVA_DIMS.rearAxleZ);
  underbodyGroup.add(rearAxleTube);

  const diffPumpkin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.112, 14, 12)), underbodyMat);
  diffPumpkin.position.set(0.03, 0.33, INNOVA_DIMS.rearAxleZ);
  underbodyGroup.add(diffPumpkin);

  const spareWheel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.31, 0.31, 0.17, 18)), tireMat);
  spareWheel.position.set(0, 0.275, -1.86);
  underbodyGroup.add(spareWheel);

  const muffler = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.068, 0.068, 0.40, 12).rotateX(Math.PI / 2)),
    exhaustMat,
  );
  muffler.position.set(-0.50, 0.27, -1.78);
  underbodyGroup.add(muffler);

  const tailpipe = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.027, 0.027, 0.42, 10).rotateX(Math.PI / 2)),
    exhaustMat,
  );
  tailpipe.position.set(-0.56, 0.26, -2.14);
  tailpipe.rotation.y = 0.16;
  tailpipe.rotation.x = 0.06;
  underbodyGroup.add(tailpipe);

  // =========================================================================
  // 5. FOUR HIGH-DETAIL TWO-TONE MACHINED ALLOY WHEELS
  // =========================================================================
  const sharedTireGeom = trackGeo(buildTireGeometry());
  const wheelSpinGroups: THREE.Group[] = [];

  for (const wc of [
    { side: 1 as const, z: INNOVA_DIMS.frontAxleZ },
    { side: -1 as const, z: INNOVA_DIMS.frontAxleZ },
    { side: 1 as const, z: INNOVA_DIMS.rearAxleZ },
    { side: -1 as const, z: INNOVA_DIMS.rearAxleZ },
  ]) {
    const wheel = createWheelAssembly(
      wc.side,
      sharedTireGeom,
      {
        tire: tireMat,
        alloyMachined: alloyMachinedMat,
        alloyDark: alloyDarkMat,
        chrome: chromeMat,
        rotor: rotorMat,
        caliper: caliperMat,
      },
      trackGeo,
    );
    wheel.position.set(wc.side * INNOVA_DIMS.trackHalfX, INNOVA_DIMS.wheelRadius, wc.z);
    root.add(wheel);
    const spin = wheel.getObjectByName('wheelSpin') as THREE.Group;
    if (spin) wheelSpinGroups.push(spin);
  }

  // =========================================================================
  // 6. HIGH-DETAIL 3-ROW MPV INTERIOR CABIN
  // =========================================================================
  const cabinGroup = new THREE.Group();
  cabinGroup.name = 'InteriorCabin';
  root.add(cabinGroup);

  const cabinFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.06, 3.04)), carpetMat);
  cabinFloor.position.set(0, 0.37, -0.42);
  cabinGroup.add(cabinFloor);

  const firewall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.50, 0.70, 0.08)), dashMat);
  firewall.position.set(0, 0.74, 1.14);
  cabinGroup.add(firewall);

  for (const side of [-1, 1] as const) {
    const rearInnerTub = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.40, 0.74)), dashMat);
    rearInnerTub.position.set(side * 0.67, 0.56, -1.42);
    cabinGroup.add(rearInnerTub);

    const rearInnerCard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.64, 0.88)), dashMat);
    rearInnerCard.position.set(side * 0.78, 0.74, -0.52);
    cabinGroup.add(rearInnerCard);
  }

  // Dual-Tier Sculpted Innova Dashboard
  const dashUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.50, 0.24, 0.50)), dashMat);
  dashUpper.position.set(0, 1.00, 0.90);
  cabinGroup.add(dashUpper);

  const dashLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.46, 0.22, 0.34)), dashMat);
  dashLower.position.set(0, 0.79, 0.96);
  cabinGroup.add(dashLower);

  const dashTrimWood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.46, 0.055, 0.055)), woodAccentMat);
  dashTrimWood.position.set(0, 0.955, 0.655);
  cabinGroup.add(dashTrimWood);

  const dashTrimSilver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.47, 0.018, 0.06)), dashSilverTrimMat);
  dashTrimSilver.position.set(0, 0.92, 0.653);
  cabinGroup.add(dashTrimSilver);

  // LHD Driver Optitron Instrument Cluster (+X driver side)
  const binnacle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.16, 0.18)), dashMat);
  binnacle.position.set(0.38, 1.09, 0.75);
  cabinGroup.add(binnacle);

  const gaugeScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.36, 0.145)), gaugeMat);
  gaugeScreen.rotation.y = Math.PI;
  gaugeScreen.rotation.x = 0.14;
  gaugeScreen.position.set(0.38, 1.075, 0.642);
  cabinGroup.add(gaugeScreen);

  // 3-Spoke Multi-Function Steering Wheel (LHD +X)
  const steeringGroup = new THREE.Group();
  steeringGroup.position.set(0.38, 1.01, 0.50);
  steeringGroup.rotation.x = -0.36;
  cabinGroup.add(steeringGroup);

  steeringGroup.add(new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.165, 0.020, 10, 28)), dashMat));
  steeringGroup.add(
    new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.060, 0.066, 0.052, 16).rotateX(Math.PI / 2)),
      dashMat,
    ),
  );

  const spokeL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.025, 0.02)), dashSilverTrimMat);
  spokeL.position.set(-0.095, -0.01, -0.005);
  steeringGroup.add(spokeL);
  const spokeR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.025, 0.02)), dashSilverTrimMat);
  spokeR.position.set(0.095, -0.01, -0.005);
  steeringGroup.add(spokeR);
  const spokeB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.032, 0.125, 0.02)), dashSilverTrimMat);
  spokeB.position.set(0, -0.095, -0.005);
  steeringGroup.add(spokeB);

  const steeringEmblem = createToyotaEmblem(chromeMat, 0.36, trackGeo);
  steeringEmblem.rotation.y = Math.PI;
  steeringEmblem.position.set(0, 0, -0.032);
  steeringGroup.add(steeringEmblem);

  const steeringCol = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.042, 0.05, 0.28, 10).rotateX(Math.PI / 2)),
    dashMat,
  );
  steeringCol.position.set(0, 0, 0.14);
  steeringGroup.add(steeringCol);

  for (const px of [0.30, 0.41]) {
    const pedal = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 0.09, 0.02)), dashSilverTrimMat);
    pedal.position.set(px, 0.50, 0.94);
    pedal.rotation.x = 0.35;
    cabinGroup.add(pedal);
  }

  // Center Infotainment Stack + 8-inch Screen + Climate Dials
  const centerStack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.38, 0.16)), glossBlackTrimMat);
  centerStack.position.set(0, 0.91, 0.68);
  centerStack.rotation.x = 0.24;
  cabinGroup.add(centerStack);

  const infoScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.24, 0.15)), infoMat);
  infoScreen.rotation.y = Math.PI;
  infoScreen.rotation.x = 0.24;
  infoScreen.position.set(0, 0.985, 0.588);
  cabinGroup.add(infoScreen);

  for (const dx of [-0.075, 0, 0.075]) {
    const dial = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.024, 12).rotateX(Math.PI / 2)),
      chromeMat,
    );
    dial.position.set(dx, 0.835, 0.618);
    cabinGroup.add(dial);
  }

  // Center Console, Automatic Shifter & Padded Armrest
  const centerConsole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.26, 0.96)), dashMat);
  centerConsole.position.set(0, 0.52, 0.22);
  cabinGroup.add(centerConsole);

  const shiftPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.02, 0.26)), dashSilverTrimMat);
  shiftPlate.position.set(0, 0.655, 0.44);
  cabinGroup.add(shiftPlate);

  const shiftStalk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.011, 0.014, 0.16, 8)), chromeMat);
  shiftStalk.position.set(0, 0.72, 0.46);
  shiftStalk.rotation.x = -0.14;
  cabinGroup.add(shiftStalk);

  const shiftKnob = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.068, 0.055)), leatherSeatMat);
  shiftKnob.position.set(0, 0.80, 0.448);
  cabinGroup.add(shiftKnob);

  const consoleLid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.075, 0.38)), leatherSeatMat);
  consoleLid.position.set(0, 0.685, -0.06);
  cabinGroup.add(consoleLid);

  // Rear-View Mirror, Sun Visors & Overhead Cabin Dome Light
  const rvMirror = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.062, 0.032)), glossBlackTrimMat);
  rvMirror.position.set(0, 1.56, 0.62);
  cabinGroup.add(rvMirror);

  const rvStalk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 8)), matteBlackPlasticMat);
  rvStalk.position.set(0, 1.62, 0.60);
  rvStalk.rotation.x = -0.35;
  cabinGroup.add(rvStalk);

  for (const sx of [-0.36, 0.36]) {
    const visor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.018, 0.14)), headlinerMat);
    visor.position.set(sx, 1.66, 0.56);
    visor.rotation.x = 0.28;
    cabinGroup.add(visor);
  }

  const domeLamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.022, 0.14)), domeLightMat);
  domeLamp.position.set(0, 1.71, -0.22);
  cabinGroup.add(domeLamp);

  const cabinLight = new THREE.PointLight(0xfff4dc, 1.25, 3.8, 1.6);
  cabinLight.position.set(0, 1.56, -0.18);
  cabinGroup.add(cabinLight);

  // 3 Full Rows of Sculpted MPV Seats
  const driverSeat = createSculptedSeat(leatherSeatMat, dashMat, chromeMat, 0.48, 0, trackGeo);
  driverSeat.position.set(0.41, 0.45, 0.06);
  cabinGroup.add(driverSeat);

  const passengerSeat = createSculptedSeat(leatherSeatMat, dashMat, chromeMat, 0.48, 0, trackGeo);
  passengerSeat.position.set(-0.41, 0.45, 0.06);
  cabinGroup.add(passengerSeat);

  const row2Left = createSculptedSeat(leatherSeatMat, dashMat, chromeMat, 0.47, -1, trackGeo);
  row2Left.position.set(0.40, 0.46, -0.80);
  cabinGroup.add(row2Left);

  const row2Right = createSculptedSeat(leatherSeatMat, dashMat, chromeMat, 0.47, 1, trackGeo);
  row2Right.position.set(-0.40, 0.46, -0.80);
  cabinGroup.add(row2Right);

  const row3Group = new THREE.Group();
  row3Group.position.set(0, 0.47, -1.58);
  cabinGroup.add(row3Group);

  const r3Base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.11, 0.44)), leatherSeatMat);
  r3Base.position.set(0, 0.08, 0.02);
  row3Group.add(r3Base);
  row3Group.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.06, 0.12, 0.34)), dashMat));

  const r3Back = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.50, 0.11)), leatherSeatMat);
  r3Back.position.set(0, 0.39, -0.20);
  r3Back.rotation.x = -0.17;
  row3Group.add(r3Back);

  for (const hx of [-0.38, 0, 0.38]) {
    const h = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.15, 0.095)), leatherSeatMat);
    h.position.set(hx, 0.72, -0.26);
    row3Group.add(h);
  }

  void isSoftwareGl;

  // =========================================================================
  // RUNTIME CONTROLLER API
  // =========================================================================
  const setPaint = (paintId: PaintId) => {
    const found = PAINT_FINISHES.find((p) => p.id === paintId) ?? PAINT_FINISHES[0];
    for (const mat of [bodyPaintMat, bodyPaintDoubleMat]) {
      mat.color.setHex(found.bodyHex);
      mat.metalness = found.metalness;
      mat.roughness = found.roughness;
      mat.clearcoat = found.clearcoat;
      mat.clearcoatRoughness = found.clearcoatRoughness;
    }

    const decalSet = found.decalInk === 'dark' ? textures.liveryDark : textures.liveryLight;
    sealDecalMat.map = decalSet.seal;
    scriptDecalMat.map = decalSet.script;
    wordmarkDecalMat.map = decalSet.wordmark;
    sealDecalMat.needsUpdate = true;
    scriptDecalMat.needsUpdate = true;
    wordmarkDecalMat.needsUpdate = true;
  };

  const setLiveryVisible = (visible: boolean) => {
    for (const m of liveryMeshes) m.visible = visible;
  };

  const setLightsOn = (on: boolean) => {
    projectorBulbMat.emissiveIntensity = on ? 3.2 : 0.35;
    drlMat.emissiveIntensity = on ? 2.4 : 0.6;
    tailRedMat.emissiveIntensity = on ? 2.2 : 0.35;
    amberSignalMat.emissiveIntensity = on ? 1.1 : 0.16;
    domeLightMat.emissiveIntensity = on ? 1.8 : 0.45;
    cabinLight.intensity = on ? 2.2 : 1.2;
  };

  const setDoorOpenAmount = (amount: number) => {
    const t = Math.max(0, Math.min(1, amount));
    const doorAngle = t * 1.02;
    for (const { side, pivot } of frontDoorPivots) {
      pivot.rotation.y = side === 1 ? -doorAngle : doorAngle;
    }
    tailgatePivot.rotation.x = t * 1.05;
  };

  const setInteriorVisibilityBoost = (boost: number) => {
    const b = Math.max(0, Math.min(1, boost));
    frontGlassMat.opacity = 0.38 - b * 0.22;
    rearPrivacyGlassMat.opacity = 0.56 - b * 0.36;
  };

  const spinWheels = (deltaAngle: number) => {
    for (const w of wheelSpinGroups) {
      w.rotation.x += deltaAngle;
    }
  };

  const dispose = () => {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };

  setPaint(initialPaint.id);
  setLightsOn(true);

  return {
    root,
    setPaint,
    setLiveryVisible,
    setLightsOn,
    setDoorOpenAmount,
    setInteriorVisibilityBoost,
    spinWheels,
    dispose,
  };
}
