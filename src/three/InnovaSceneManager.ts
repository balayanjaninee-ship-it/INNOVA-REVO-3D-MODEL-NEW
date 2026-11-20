import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {
  CameraPresetId,
  InteriorSpotId,
  PaintId,
  QuadPaneId,
  QuadViewportRect,
  ViewMode,
} from '../types/viewer';
import {
  MAX_EXTERIOR_DISTANCE,
  MIN_EXTERIOR_DISTANCE,
  MIN_INTERIOR_DISTANCE,
  QUAD_PANES,
  clamp,
  computeQuadViewports,
  dampValue,
  distanceToZoomPercent,
  getCameraPresetPose,
  hitTestQuadPane,
  zoomPercentToDistance,
} from '../utils/cameraMath';
import { createInnovaModel, type InnovaModelController } from './innovaModel';
import { createInnovaTextures, type InnovaTextureSet } from './textures';

interface QuadCameraRig {
  id: QuadPaneId;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  desiredTarget: THREE.Vector3;
  spherical: THREE.Spherical;
  desiredSpherical: THREE.Spherical;
  baseRadius: number;
  minRadius: number;
  maxRadius: number;
}

export interface SceneManagerCallbacks {
  onZoomChange: (zoomPercent: number) => void;
  onActiveQuadPaneChange: (pane: QuadPaneId) => void;
  onQuadRectsChange: (rects: QuadViewportRect[]) => void;
  onContextLost: (lost: boolean) => void;
}

// Reusable scratch vectors (zero per-frame GC allocation)
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpSph = new THREE.Spherical();
const _tmpSize = new THREE.Vector2();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class InnovaSceneManager {
  private container: HTMLElement;
  private callbacks: SceneManagerCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private textures: InnovaTextureSet;
  private model: InnovaModelController;

  // Single-view camera & OrbitControls
  private singleCamera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private singleBaseDistance = 6.2;

  // Single-view damped transition state (canceled on manual user drag)
  private transitionActive = false;
  private transitionTargetPos = new THREE.Vector3();
  private transitionTargetLook = new THREE.Vector3();
  private transitionTargetFov = 34;

  // 4-View quad cameras
  private quadRigs: Record<QuadPaneId, QuadCameraRig>;
  private quadRects: QuadViewportRect[] = [];
  private activeQuadPane: QuadPaneId = 'right';

  // Animated vehicle states
  private viewMode: ViewMode = 'quad';
  private activePreset: CameraPresetId = 'hero';
  private doorsOpenTarget = 0;
  private doorsOpenCurrent = 0;
  private interiorBoostCurrent = 0;
  private turntableEnabled = false;
  private topInset = 52;

  // Quad pointer / touch interaction state
  private activePointers = new Map<number, { x: number; y: number }>();
  private draggingPane: QuadPaneId | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPinchDist = 0;

  // Coalesced render scheduling (on-demand + afterDraw fence on software GL)
  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private lastTimeMs = 0;
  private lastHudSyncMs = 0;
  private lastReportedZoom = 100;
  private disposed = false;

  // Resize observer & bound event listeners
  private resizeObserver: ResizeObserver;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;

  // Ground geometry cleanup list
  private sceneDisposables: { dispose: () => void }[] = [];

  constructor(
    container: HTMLElement,
    initialMode: ViewMode,
    callbacks: SceneManagerCallbacks,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.viewMode = initialMode;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.topInset = width < 640 ? 48 : 52;

    // 1. Modern PBR Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.setSize(width, height, false);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('data-testid', 'innova-webgl-canvas');
    container.appendChild(this.renderer.domElement);

    // 2. Studio Scene, Horizon Fog & Mandatory RoomEnvironment Reflections
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9edf2);
    this.scene.fog = new THREE.Fog(0xe9edf2, 22, 56);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    pmrem.dispose();

    // 3. Procedural PBR Textures & Studio Cyclorama Ground
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createInnovaTextures(maxAniso, () => {
      if (!this.disposed) {
        this.requestRender();
      }
    });
    this.buildStudioStage();
    this.buildLightingRig();

    // 4. Sculpted Toyota Innova AN140 Model
    this.model = createInnovaModel(this.textures, this.isSoftwareGl);
    this.scene.add(this.model.root);

    // 5. Single-View Camera + OrbitControls
    this.singleCamera = new THREE.PerspectiveCamera(34, width / height, 0.08, 90);
    this.controls = new OrbitControls(this.singleCamera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.78;
    this.controls.zoomSpeed = 0.92;
    this.controls.panSpeed = 0.65;
    this.controls.minDistance = MIN_EXTERIOR_DISTANCE;
    this.controls.maxDistance = MAX_EXTERIOR_DISTANCE;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.492;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.6;
    this.controls.enabled = this.viewMode !== 'quad';

    // Cancel scripted preset glides immediately when user grabs controls
    this.controls.addEventListener('start', () => {
      this.transitionActive = false;
    });
    this.controls.addEventListener('change', () => {
      this.syncZoomFromCamera();
      this.requestRender();
    });

    // 6. Initialize 4-View Quad Cameras
    this.quadRects = computeQuadViewports(width, height, this.topInset, 0);
    this.quadRigs = {
      right: this.createQuadRig('right', this.quadRects[0].aspect),
      left: this.createQuadRig('left', this.quadRects[1].aspect),
      front: this.createQuadRig('front', this.quadRects[2].aspect),
      rear: this.createQuadRig('rear', this.quadRects[3].aspect),
    };

    // Position single camera on Hero 3/4 immediately
    this.applySinglePresetImmediate('hero');

    // Pre-warm shaders on GPU for instant 60fps interaction
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.singleCamera);
    }

    // 7. Wire Interactive Listeners
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost(true);
    };
    this.boundContextRestored = () => {
      this.callbacks.onContextLost(false);
      this.requestRender();
    };

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.boundPointerDown);
    dom.addEventListener('pointermove', this.boundPointerMove);
    dom.addEventListener('pointerup', this.boundPointerUp);
    dom.addEventListener('pointercancel', this.boundPointerUp);
    dom.addEventListener('wheel', this.boundWheel, { passive: false });
    dom.addEventListener('webglcontextlost', this.boundContextLost);
    dom.addEventListener('webglcontextrestored', this.boundContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Emit initial quad rects and draw first frame
    this.callbacks.onQuadRectsChange(this.quadRects);
    this.requestRender();
  }

  private buildStudioStage(): void {
    // Seamless automotive studio floor disc
    const floorGeom = new THREE.CircleGeometry(24, 48);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.floorGradient,
      roughness: 0.72,
      metalness: 0.04,
      envMapIntensity: 0.35,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.sceneDisposables.push(floorGeom, floorMat);

    // Soft radial contact shadow plane directly beneath the 4 wheels (prevents floating!)
    const shadowGeom = new THREE.PlaneGeometry(3.2, 5.5);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadow,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadow = new THREE.Mesh(shadowGeom, shadowMat);
    contactShadow.position.y = 0.008;
    contactShadow.renderOrder = 1;
    this.scene.add(contactShadow);
    this.sceneDisposables.push(shadowGeom, shadowMat);
  }

  private buildLightingRig(): void {
    // Cool sky / neutral studio floor hemisphere fill
    const hemi = new THREE.HemisphereLight(0xe4efff, 0xc3c9d1, 0.98);
    hemi.position.set(0, 14, 0);
    this.scene.add(hemi);

    // Warm directional key light (single shadow caster, tight automotive frustum)
    const keyLight = new THREE.DirectionalLight(0xfff7ec, 1.95);
    keyLight.position.set(5.4, 8.2, 6.2);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 24;
      const d = 4.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cool rear-right rim / accent light for crisp shoulder & roofline definition
    const rimLight = new THREE.DirectionalLight(0xdcebff, 0.92);
    rimLight.position.set(-5.8, 4.6, -6.4);
    this.scene.add(rimLight);

    // Subtle front-low bounce fill so the dark grille slats & wheel spokes stay crisp in Front View
    const frontBounce = new THREE.DirectionalLight(0xf3f6fa, 0.48);
    frontBounce.position.set(-2.5, 1.8, 6.5);
    this.scene.add(frontBounce);

    // Studio overhead & side RectAreaLight softboxes on GPU (elongated automotive clearcoat highlights)
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const overheadStrip = new THREE.RectAreaLight(0xffffff, 2.2, 5.2, 1.8);
      overheadStrip.position.set(0, 4.4, 0.2);
      overheadStrip.lookAt(0, 0.9, 0.2);
      this.scene.add(overheadStrip);

      const sideSoftbox = new THREE.RectAreaLight(0xf4f8ff, 1.4, 4.6, 1.4);
      sideSoftbox.position.set(4.5, 2.2, 1.4);
      sideSoftbox.lookAt(0, 0.9, 0);
      this.scene.add(sideSoftbox);
    }
  }

  private createQuadRig(id: QuadPaneId, aspect: number): QuadCameraRig {
    const pose = getCameraPresetPose(id, aspect, true);
    const camera = new THREE.PerspectiveCamera(pose.fov, aspect, 0.08, 80);
    const target = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z);
    const pos = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);

    const offset = pos.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    camera.position.copy(pos);
    camera.lookAt(target);

    return {
      id,
      camera,
      target,
      desiredTarget: target.clone(),
      spherical,
      desiredSpherical: spherical.clone(),
      baseRadius: spherical.radius,
      minRadius: MIN_EXTERIOR_DISTANCE,
      maxRadius: Math.max(MAX_EXTERIOR_DISTANCE, spherical.radius * 1.6),
    };
  }

  private applySinglePresetImmediate(preset: CameraPresetId): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const pose = getCameraPresetPose(preset, width / height, false);
    this.activePreset = preset;

    this.singleCamera.fov = pose.fov;
    this.singleCamera.updateProjectionMatrix();
    this.singleCamera.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.controls.target.set(pose.target.x, pose.target.y, pose.target.z);
    this.controls.minDistance = pose.minDistance;
    this.controls.maxDistance = pose.maxDistance;
    this.controls.maxPolarAngle =
      this.isInteriorPreset(preset) ? Math.PI * 0.74 : Math.PI * 0.492;
    this.controls.update();

    this.singleBaseDistance = this.singleCamera.position.distanceTo(this.controls.target);
    this.transitionActive = false;
    this.syncZoomFromCamera(true);
  }

  private isInteriorPreset(preset: CameraPresetId): boolean {
    return (
      preset === 'cockpit' ||
      preset === 'dashboard' ||
      preset === 'secondRow' ||
      preset === 'fullCabin'
    );
  }

  // =========================================================================
  // PUBLIC CONTROL API (CALLED FROM REACT HUD)
  // =========================================================================

  public setViewMode(mode: ViewMode, focusPreset?: CameraPresetId): void {
    this.viewMode = mode;
    this.controls.enabled = mode !== 'quad';

    if (mode === 'quad') {
      this.transitionActive = false;
      this.syncZoomFromCamera(true);
    } else if (mode === 'interior') {
      const spot: InteriorSpotId =
        focusPreset && this.isInteriorPreset(focusPreset)
          ? (focusPreset as InteriorSpotId)
          : 'cockpit';
      this.animateToPreset(spot);
    } else {
      const nextPreset = focusPreset ?? (this.isInteriorPreset(this.activePreset) ? 'hero' : this.activePreset);
      this.animateToPreset(nextPreset);
    }
    this.requestRender();
  }

  public animateToPreset(preset: CameraPresetId): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const pose = getCameraPresetPose(preset, width / height, false);
    this.activePreset = preset;

    this.controls.minDistance = pose.minDistance;
    this.controls.maxDistance = pose.maxDistance;
    this.controls.maxPolarAngle =
      this.isInteriorPreset(preset) ? Math.PI * 0.74 : Math.PI * 0.492;

    this.transitionTargetPos.set(pose.position.x, pose.position.y, pose.position.z);
    this.transitionTargetLook.set(pose.target.x, pose.target.y, pose.target.z);
    this.transitionTargetFov = pose.fov;
    this.singleBaseDistance = this.transitionTargetPos.distanceTo(this.transitionTargetLook);

    if (this.isSoftwareGl) {
      // On software GL, settle cleanly in one frame for instant deterministic response
      this.singleCamera.position.copy(this.transitionTargetPos);
      this.controls.target.copy(this.transitionTargetLook);
      this.singleCamera.fov = this.transitionTargetFov;
      this.singleCamera.updateProjectionMatrix();
      this.controls.update();
      this.transitionActive = false;
      this.syncZoomFromCamera(true);
    } else {
      this.transitionActive = true;
    }

    this.requestRender();
  }

  public resetCurrentView(): void {
    if (this.viewMode === 'quad') {
      for (const rect of this.quadRects) {
        const pose = getCameraPresetPose(rect.id, rect.aspect, true);
        const rig = this.quadRigs[rect.id];
        rig.desiredTarget.set(pose.target.x, pose.target.y, pose.target.z);
        _tmpVecA.set(pose.position.x, pose.position.y, pose.position.z).sub(rig.desiredTarget);
        rig.desiredSpherical.setFromVector3(_tmpVecA);
        rig.baseRadius = rig.desiredSpherical.radius;
        if (this.isSoftwareGl) {
          rig.target.copy(rig.desiredTarget);
          rig.spherical.copy(rig.desiredSpherical);
        }
      }
      this.syncZoomFromCamera(true);
    } else if (this.viewMode === 'interior') {
      this.animateToPreset('cockpit');
    } else {
      this.animateToPreset('hero');
    }
    this.requestRender();
  }

  public setZoomPercent(zoomPercent: number): void {
    const clamped = clamp(zoomPercent, 35, 450);

    if (this.viewMode === 'quad') {
      const rig = this.quadRigs[this.activeQuadPane];
      const nextRadius = zoomPercentToDistance(
        clamped,
        rig.baseRadius,
        MIN_INTERIOR_DISTANCE,
        rig.maxRadius,
      );
      rig.desiredSpherical.radius = nextRadius;
      if (this.isSoftwareGl) {
        rig.spherical.radius = nextRadius;
      }
      this.lastReportedZoom = Math.round(clamped);
      this.callbacks.onZoomChange(this.lastReportedZoom);
    } else {
      this.transitionActive = false;
      const minDist = this.viewMode === 'interior' ? MIN_INTERIOR_DISTANCE : 0.72;
      const nextDist = zoomPercentToDistance(
        clamped,
        this.singleBaseDistance,
        minDist,
        MAX_EXTERIOR_DISTANCE,
      );
      this.controls.minDistance = minDist;
      _tmpVecA.copy(this.singleCamera.position).sub(this.controls.target);
      if (_tmpVecA.lengthSq() < 1e-6) {
        _tmpVecA.set(0, 0.2, 1);
      }
      _tmpVecA.normalize().multiplyScalar(nextDist);
      this.singleCamera.position.copy(this.controls.target).add(_tmpVecA);
      this.controls.update();
      this.lastReportedZoom = Math.round(clamped);
      this.callbacks.onZoomChange(this.lastReportedZoom);
    }
    this.requestRender();
  }

  public setPaint(paintId: PaintId): void {
    this.model.setPaint(paintId);
    this.requestRender();
  }

  public setLiveryVisible(visible: boolean): void {
    this.model.setLiveryVisible(visible);
    this.requestRender();
  }

  public setLightsOn(on: boolean): void {
    this.model.setLightsOn(on);
    this.requestRender();
  }

  public setDoorsOpen(open: boolean): void {
    this.doorsOpenTarget = open ? 1 : 0;
    if (this.isSoftwareGl) {
      this.doorsOpenCurrent = this.doorsOpenTarget;
      this.model.setDoorOpenAmount(this.doorsOpenCurrent);
    }
    this.requestRender();
  }

  public setTurntable(enabled: boolean): void {
    this.turntableEnabled = enabled && !this.isSoftwareGl;
    this.controls.autoRotate = this.turntableEnabled && this.viewMode === 'single';
    this.requestRender();
  }

  // =========================================================================
  // POINTER & TOUCH INTERACTION FOR INDEPENDENT 4-VIEW QUAD ROTATION & ZOOM
  // =========================================================================

  private getCanvasLocalCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.viewMode !== 'quad') return;
    const { x, y } = this.getCanvasLocalCoords(e.clientX, e.clientY);
    const pane = hitTestQuadPane(x, y, this.quadRects);
    if (!pane) return;

    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, { x, y });
    this.draggingPane = pane;
    this.setActiveQuadPane(pane);

    if (this.activePointers.size === 1) {
      this.lastPointerX = x;
      this.lastPointerY = y;
    } else if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.viewMode !== 'quad' || !this.draggingPane || !this.activePointers.has(e.pointerId)) {
      return;
    }
    const { x, y } = this.getCanvasLocalCoords(e.clientX, e.clientY);
    this.activePointers.set(e.pointerId, { x, y });
    const rig = this.quadRigs[this.draggingPane];

    if (this.activePointers.size === 1) {
      const dx = x - this.lastPointerX;
      const dy = y - this.lastPointerY;
      this.lastPointerX = x;
      this.lastPointerY = y;

      const rotSpeed = 0.0075;
      rig.desiredSpherical.theta -= dx * rotSpeed;
      rig.desiredSpherical.phi = clamp(
        rig.desiredSpherical.phi - dy * rotSpeed,
        0.12,
        Math.PI * 0.492,
      );
      if (this.isSoftwareGl) {
        rig.spherical.theta = rig.desiredSpherical.theta;
        rig.spherical.phi = rig.desiredSpherical.phi;
      }
      this.requestRender();
    } else if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDist > 1) {
        const scale = this.lastPinchDist / Math.max(1, dist);
        rig.desiredSpherical.radius = clamp(
          rig.desiredSpherical.radius * scale,
          MIN_INTERIOR_DISTANCE,
          rig.maxRadius,
        );
        if (this.isSoftwareGl) {
          rig.spherical.radius = rig.desiredSpherical.radius;
        }
        this.syncZoomFromCamera();
        this.requestRender();
      }
      this.lastPinchDist = dist;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.delete(e.pointerId);
      try {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    }
    if (this.activePointers.size === 0) {
      this.draggingPane = null;
      this.lastPinchDist = 0;
    } else if (this.activePointers.size === 1) {
      const remaining = Array.from(this.activePointers.values())[0];
      this.lastPointerX = remaining.x;
      this.lastPointerY = remaining.y;
    }
  }

  private onWheel(e: WheelEvent): void {
    if (this.viewMode !== 'quad') return;
    const { x, y } = this.getCanvasLocalCoords(e.clientX, e.clientY);
    const pane = hitTestQuadPane(x, y, this.quadRects);
    if (!pane) return;

    e.preventDefault();
    this.setActiveQuadPane(pane);
    const rig = this.quadRigs[pane];
    const zoomStep = Math.exp(e.deltaY * 0.0012);
    rig.desiredSpherical.radius = clamp(
      rig.desiredSpherical.radius * zoomStep,
      MIN_INTERIOR_DISTANCE,
      rig.maxRadius,
    );
    if (this.isSoftwareGl) {
      rig.spherical.radius = rig.desiredSpherical.radius;
    }
    this.syncZoomFromCamera();
    this.requestRender();
  }

  private setActiveQuadPane(pane: QuadPaneId): void {
    if (this.activeQuadPane !== pane) {
      this.activeQuadPane = pane;
      this.callbacks.onActiveQuadPaneChange(pane);
      this.syncZoomFromCamera(true);
    }
  }

  private syncZoomFromCamera(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudSyncMs < 110) return;

    let pct = 100;
    if (this.viewMode === 'quad') {
      const rig = this.quadRigs[this.activeQuadPane];
      pct = distanceToZoomPercent(rig.desiredSpherical.radius, rig.baseRadius);
    } else {
      const dist = this.singleCamera.position.distanceTo(this.controls.target);
      pct = distanceToZoomPercent(dist, this.singleBaseDistance);
    }

    if (force || Math.abs(pct - this.lastReportedZoom) >= 2) {
      this.lastHudSyncMs = now;
      this.lastReportedZoom = pct;
      this.callbacks.onZoomChange(pct);
    }
  }

  // =========================================================================
  // RESIZE & ON-DEMAND / DAMPED RENDER PIPELINE
  // =========================================================================

  private pendingResize: { width: number; height: number } | null = null;

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.topInset = width < 640 ? 48 : 52;
    this.pendingResize = { width, height };

    this.singleCamera.aspect = width / height;
    this.singleCamera.updateProjectionMatrix();

    this.quadRects = computeQuadViewports(width, height, this.topInset, 0);
    for (const rect of this.quadRects) {
      const rig = this.quadRigs[rect.id];
      const pose = getCameraPresetPose(rect.id, rect.aspect, true);
      rig.camera.aspect = rect.aspect;
      rig.camera.fov = pose.fov;
      rig.camera.updateProjectionMatrix();

      const prevRatio = rig.desiredSpherical.radius / Math.max(0.5, rig.baseRadius);
      _tmpVecA.set(pose.position.x, pose.position.y, pose.position.z).sub(rig.desiredTarget);
      const nextBase = _tmpVecA.length();
      rig.baseRadius = nextBase;
      rig.maxRadius = Math.max(MAX_EXTERIOR_DISTANCE, nextBase * 1.6);
      rig.desiredSpherical.radius = clamp(nextBase * prevRatio, MIN_INTERIOR_DISTANCE, rig.maxRadius);
      rig.spherical.radius = rig.desiredSpherical.radius;
    }

    this.callbacks.onQuadRectsChange(this.quadRects);
    this.requestRender();
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public requestRender(): void {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame((nowMs) => {
      if (this.disposed) return;
      this.renderDirty = false;
      const dt = this.lastTimeMs > 0 ? Math.min(0.05, (nowMs - this.lastTimeMs) / 1000) : 1 / 60;
      this.lastTimeMs = nowMs;

      const needsMoreFrames = this.stepSimulation(dt);
      this.renderFrame();

      const done = () => {
        this.renderBusy = false;
        if (this.disposed) return;
        if (this.renderDirty || needsMoreFrames) {
          this.requestRender();
        }
      };

      if (this.isSoftwareGl) {
        this.afterDraw(done);
      } else {
        done();
      }
    });
  }

  private stepSimulation(dt: number): boolean {
    let activeMotion = false;

    // 1. Smoothly animate hinged Front Doors & Rear Tailgate
    if (Math.abs(this.doorsOpenCurrent - this.doorsOpenTarget) > 0.002) {
      this.doorsOpenCurrent = dampValue(this.doorsOpenCurrent, this.doorsOpenTarget, 8.5, dt);
      if (Math.abs(this.doorsOpenCurrent - this.doorsOpenTarget) <= 0.002) {
        this.doorsOpenCurrent = this.doorsOpenTarget;
      } else {
        activeMotion = true;
      }
      this.model.setDoorOpenAmount(this.doorsOpenCurrent);
    }

    // 2. Compute interior visibility clarity boost (auto-clears glass when close to cabin!)
    let targetBoost = this.viewMode === 'interior' ? 1.0 : 0.0;
    if (this.viewMode === 'single') {
      const dist = this.singleCamera.position.distanceTo(this.controls.target);
      targetBoost = clamp((2.9 - dist) / 1.5, 0, 1);
    } else if (this.viewMode === 'quad') {
      const minR = Math.min(
        this.quadRigs.right.spherical.radius,
        this.quadRigs.left.spherical.radius,
        this.quadRigs.front.spherical.radius,
        this.quadRigs.rear.spherical.radius,
      );
      targetBoost = clamp((2.6 - minR) / 1.4, 0, 1);
    }

    if (Math.abs(this.interiorBoostCurrent - targetBoost) > 0.004) {
      if (this.isSoftwareGl) {
        this.interiorBoostCurrent = targetBoost;
      } else {
        this.interiorBoostCurrent = dampValue(this.interiorBoostCurrent, targetBoost, 7, dt);
        activeMotion = true;
      }
      this.model.setInteriorVisibilityBoost(this.interiorBoostCurrent);
    }

    // 3. Camera updates per mode
    if (this.viewMode === 'quad') {
      for (const pane of QUAD_PANES) {
        const rig = this.quadRigs[pane.id];
        if (this.turntableEnabled) {
          rig.desiredSpherical.theta += dt * 0.35;
          activeMotion = true;
        }
        const dTheta = Math.abs(rig.desiredSpherical.theta - rig.spherical.theta);
        const dPhi = Math.abs(rig.desiredSpherical.phi - rig.spherical.phi);
        const dRad = Math.abs(rig.desiredSpherical.radius - rig.spherical.radius);
        const dTarget = rig.target.distanceTo(rig.desiredTarget);

        if (dTheta > 0.0008 || dPhi > 0.0008 || dRad > 0.002 || dTarget > 0.002) {
          rig.spherical.theta = dampValue(rig.spherical.theta, rig.desiredSpherical.theta, 11, dt);
          rig.spherical.phi = dampValue(rig.spherical.phi, rig.desiredSpherical.phi, 11, dt);
          rig.spherical.radius = dampValue(rig.spherical.radius, rig.desiredSpherical.radius, 11, dt);
          rig.target.x = dampValue(rig.target.x, rig.desiredTarget.x, 11, dt);
          rig.target.y = dampValue(rig.target.y, rig.desiredTarget.y, 11, dt);
          rig.target.z = dampValue(rig.target.z, rig.desiredTarget.z, 11, dt);
          activeMotion = true;
        }

        _tmpVecA.setFromSpherical(rig.spherical).add(rig.target);
        rig.camera.position.copy(_tmpVecA);
        rig.camera.lookAt(rig.target);
      }
    } else {
      if (this.transitionActive) {
        this.singleCamera.position.x = dampValue(this.singleCamera.position.x, this.transitionTargetPos.x, 7.5, dt);
        this.singleCamera.position.y = dampValue(this.singleCamera.position.y, this.transitionTargetPos.y, 7.5, dt);
        this.singleCamera.position.z = dampValue(this.singleCamera.position.z, this.transitionTargetPos.z, 7.5, dt);

        this.controls.target.x = dampValue(this.controls.target.x, this.transitionTargetLook.x, 7.5, dt);
        this.controls.target.y = dampValue(this.controls.target.y, this.transitionTargetLook.y, 7.5, dt);
        this.controls.target.z = dampValue(this.controls.target.z, this.transitionTargetLook.z, 7.5, dt);

        const nextFov = dampValue(this.singleCamera.fov, this.transitionTargetFov, 7.5, dt);
        if (Math.abs(nextFov - this.singleCamera.fov) > 0.02) {
          this.singleCamera.fov = nextFov;
          this.singleCamera.updateProjectionMatrix();
        }

        const posErr = this.singleCamera.position.distanceTo(this.transitionTargetPos);
        const lookErr = this.controls.target.distanceTo(this.transitionTargetLook);
        if (posErr < 0.008 && lookErr < 0.008) {
          this.singleCamera.position.copy(this.transitionTargetPos);
          this.controls.target.copy(this.transitionTargetLook);
          this.singleCamera.fov = this.transitionTargetFov;
          this.singleCamera.updateProjectionMatrix();
          this.transitionActive = false;
        } else {
          activeMotion = true;
        }
      }

      // Check if OrbitControls damping or autoRotate still moves the camera
      _tmpVecB.copy(this.singleCamera.position);
      this.controls.update();
      if (_tmpVecB.distanceToSquared(this.singleCamera.position) > 1e-7 || this.controls.autoRotate) {
        activeMotion = true;
      }
      void _tmpSph;
    }

    if (this.turntableEnabled) {
      this.model.spinWheels(dt * 0.55);
    }

    return activeMotion;
  }

  private renderFrame(): void {
    if (this.pendingResize) {
      const { width: rw, height: rh } = this.pendingResize;
      this.pendingResize = null;
      this.renderer.setSize(rw, rh, false);
    }

    this.renderer.getSize(_tmpSize);
    const width = Math.max(1, _tmpSize.x);
    const height = Math.max(1, _tmpSize.y);

    if (this.viewMode === 'quad') {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.setClearColor(0xe9edf2, 1);
      this.renderer.clear();

      this.renderer.setScissorTest(true);
      for (const rect of this.quadRects) {
        const rig = this.quadRigs[rect.id];
        this.renderer.setViewport(rect.glX, rect.glY, rect.width, rect.height);
        this.renderer.setScissor(rect.glX, rect.glY, rect.width, rect.height);
        this.renderer.render(this.scene, rig.camera);
      }
      this.renderer.setScissorTest(false);
    } else {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.render(this.scene, this.singleCamera);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.boundPointerDown);
    dom.removeEventListener('pointermove', this.boundPointerMove);
    dom.removeEventListener('pointerup', this.boundPointerUp);
    dom.removeEventListener('pointercancel', this.boundPointerUp);
    dom.removeEventListener('wheel', this.boundWheel);
    dom.removeEventListener('webglcontextlost', this.boundContextLost);
    dom.removeEventListener('webglcontextrestored', this.boundContextRestored);

    this.controls.dispose();
    this.model.dispose();
    this.textures.dispose();
    this.envRenderTarget.dispose();
    for (const d of this.sceneDisposables) d.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
