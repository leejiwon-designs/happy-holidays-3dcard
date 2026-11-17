import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { FestiveAudioEngine } from '../audio/festiveAudio';
import { createBackdropMaterial, createGouacheMaterial } from '../shaders/gouacheShaders';
import { PainterlyPostShader } from '../shaders/painterlyPostShader';
import { CITY_THEMES } from '../themes/cityThemes';
import type { CityId, OrnamentId, PlacedOrnamentInfo } from '../types/card';
import { CardDiorama } from './cityDiorama';
import { ORNAMENT_CATALOG } from './ornamentCatalog';
import { createOrnamentMesh } from './ornaments3d';
import { buildHolidayTree, type TreeBuildResult } from './treeBuilder';
import { exportHighResShowcaseVideo } from './videoExporter';

interface HungOrnamentRuntime {
  instanceId: string;
  ornamentId: OrnamentId;
  slotIndex: number;
  pivot: THREE.Group;
  swingAngleX: number;
  swingAngleZ: number;
  swingVelX: number;
  swingVelZ: number;
  popScale: number;
}

interface SnowParticle {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  y: number;
  speed: number;
  driftFreq: number;
  phase: number;
}

export interface CardEngineCallbacks {
  onPlacedChange?: (placed: PlacedOrnamentInfo[]) => void;
  onStatusAnnounce?: (text: string) => void;
  onHoverHint?: (hint: string | null) => void;
  onFirstFrameRendered?: () => void;
}

const OPEN_AZIMUTH = 0.34;
const OPEN_POLAR = 0.96;
const OPEN_DIST = 12.6;

const CLOSED_AZIMUTH = 0.36;
const CLOSED_POLAR = 0.56;
const CLOSED_DIST = 10.6;

export class CardEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly audio: FestiveAudioEngine;
  private readonly callbacks: CardEngineCallbacks;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly postPass: ShaderPass;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly backdropMat: THREE.ShaderMaterial;

  private readonly diorama = new CardDiorama();
  private readonly tree: TreeBuildResult;
  private readonly hungOrnaments = new Map<string, HungOrnamentRuntime>();
  private readonly snowParticles: SnowParticle[] = [];

  private cityId: CityId = 'toronto';
  private recipientName = 'Friend';
  private isOpen = false;
  private openMix = 0;
  private targetOpenMix = 0;

  // Orbit camera state
  private azimuth = CLOSED_AZIMUTH;
  private polar = CLOSED_POLAR;
  private camDist = CLOSED_DIST;
  private targetAzimuth = CLOSED_AZIMUTH;
  private targetPolar = CLOSED_POLAR;
  private targetCamDist = CLOSED_DIST;
  private lookTarget = new THREE.Vector3(0.0, -0.62, 2.25);
  private targetLook = new THREE.Vector3(0.0, -0.62, 2.25);

  // Pointer & Drag-and-Drop state
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNDC = new THREE.Vector2(99, 99);
  private isOrbitDragging = false;
  private dragStart = new THREE.Vector2();
  private dragLast = new THREE.Vector2();
  private dragMoved = 0;

  private activeTraySelection: OrnamentId | null = null;
  private externalDragOrnamentId: OrnamentId | null = null;
  private ghostGroup: THREE.Group | null = null;
  private hoveredSlotIndex: number | null = null;
  private hoveredPlacedInstanceId: string | null = null;

  private draggingPlaced: HungOrnamentRuntime | null = null;
  private draggingPlacedOriginSlot: number | null = null;
  private instanceSeq = 0;

  private isPaused = false;
  private prefersReducedMotion = false;
  private hasRenderedFirstFrame = false;
  private isExportingVideo = false;
  private exportCancelled = false;
  private simTime = 0;
  private lastFrameMs = 0;
  private rafId: number | null = null;

  private readonly onResizeBound = () => this.handleResize();
  private readonly onVisibilityBound = () => {
    this.lastFrameMs = performance.now();
  };
  private readonly onPointerDownBound = (e: PointerEvent) => this.handlePointerDown(e);
  private readonly onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onPointerUpBound = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly onPointerLeaveBound = () => this.handlePointerLeave();
  private readonly onWheelBound = (e: WheelEvent) => this.handleWheel(e);

  constructor(
    canvas: HTMLCanvasElement,
    audio: FestiveAudioEngine,
    callbacks: CardEngineCallbacks = {}
  ) {
    this.canvas = canvas;
    this.audio = audio;
    this.callbacks = callbacks;

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.NoToneMapping;

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(34, w / Math.max(1, h), 0.1, 140);

    // Clip-space gouache winter sky backdrop inside main scene (single RenderPass pattern)
    this.backdropMat = createBackdropMaterial();
    const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.backdropMat);
    bgQuad.frustumCulled = false;
    bgQuad.renderOrder = -1000;
    this.scene.add(bgQuad);

    this.scene.add(this.diorama.root);

    // Mount empty 3D pine tree in the pop-up card center
    this.tree = buildHolidayTree();
    this.diorama.treeMount.add(this.tree.group);

    this.buildSnowfall();
    this.diorama.rebuild(this.cityId, this.recipientName);
    this.applyThemeBackdrop(this.cityId);
    this.diorama.setOpenMix(0);

    // Painterly gouache & stipple paper-tooth grain post-process pass (with MSAA render target)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const maxSamples = Math.min(4, this.renderer.capabilities.maxSamples || 0);
    const composerTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.round(w * pixelRatio)),
      Math.max(1, Math.round(h * pixelRatio)),
      { type: THREE.HalfFloatType, samples: maxSamples }
    );
    this.composer = new EffectComposer(this.renderer, composerTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.postPass = new ShaderPass(PainterlyPostShader);
    this.composer.addPass(this.postPass);

    this.handleResize();
    this.snapCameraImmediate();

    window.addEventListener('resize', this.onResizeBound);
    document.addEventListener('visibilitychange', this.onVisibilityBound);
    canvas.addEventListener('pointerdown', this.onPointerDownBound);
    canvas.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    canvas.addEventListener('pointerleave', this.onPointerLeaveBound);
    canvas.addEventListener('wheel', this.onWheelBound, { passive: false });

    // Re-bake cover Fleur de Leah + deck/wall Glass Antiqua text cleanly once both Google Fonts load
    void Promise.all([
      document.fonts.load('400 108px "Fleur De Leah"').catch(() => []),
      document.fonts.load('400 32px "Glass Antiqua"').catch(() => []),
      document.fonts.ready,
    ]).then(() => {
      this.diorama.rebuild(this.cityId, this.recipientName);
      this.diorama.setOpenMix(this.openMix);
    });

    this.lastFrameMs = performance.now();
    this.animate(this.lastFrameMs);
  }

  public openCard(name: string, city: CityId): void {
    const clean = name.trim() || 'Friend';
    this.recipientName = clean;
    this.cityId = city;
    this.isOpen = true;
    this.targetOpenMix = 1;
    if (this.prefersReducedMotion) {
      this.openMix = 1;
      this.diorama.setOpenMix(1);
    }

    this.diorama.rebuild(this.cityId, this.recipientName);
    this.applyThemeBackdrop(this.cityId);

    this.targetAzimuth = OPEN_AZIMUTH;
    this.targetPolar = OPEN_POLAR;
    this.targetCamDist = this.getResponsiveDist(OPEN_DIST);
    this.targetLook.copy(this.getResponsiveOpenTarget());
  }

  public closeCardToEdit(): void {
    this.isOpen = false;
    this.targetOpenMix = 0;
    if (this.prefersReducedMotion) {
      this.openMix = 0;
      this.diorama.setOpenMix(0);
    }
    this.targetAzimuth = CLOSED_AZIMUTH;
    this.targetPolar = CLOSED_POLAR;
    this.targetCamDist = this.getResponsiveDist(CLOSED_DIST);
    this.targetLook.set(0.0, -0.62, 2.25);
  }

  public setCity(city: CityId): void {
    if (this.cityId === city) return;
    this.cityId = city;
    this.diorama.rebuild(this.cityId, this.recipientName);
    this.applyThemeBackdrop(this.cityId);
  }

  public setRecipientName(name: string): void {
    this.recipientName = name.trim() || 'Friend';
    this.diorama.updateRecipientName(this.recipientName);
  }

  public setSelectedTrayOrnament(ornamentId: OrnamentId | null): void {
    this.activeTraySelection = ornamentId;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public async exportShowcaseVideo(onProgress?: (pct: number) => void): Promise<boolean> {
    if (this.isExportingVideo || !this.isOpen) return false;

    const clientW = this.canvas.clientWidth || window.innerWidth;
    const clientH = this.canvas.clientHeight || window.innerHeight;
    const origOpenMix = this.openMix;
    const origTargetOpenMix = this.targetOpenMix;
    const origAzimuth = this.targetAzimuth;
    const origPolar = this.targetPolar;
    const origCamDist = this.targetCamDist;
    const origLook = this.targetLook.clone();
    const origHoveredSlot = this.hoveredSlotIndex;
    const origHoveredPlaced = this.hoveredPlacedInstanceId;

    const slug = (this.recipientName || 'friend')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const filenameBase = `holiday-card-${slug || 'friend'}-${this.cityId}`;

    this.isExportingVideo = true;
    this.exportCancelled = false;

    try {
      return await exportHighResShowcaseVideo({
        canvas: this.canvas,
        viewportWidth: clientW,
        viewportHeight: clientH,
        durationSec: 4.5,
        fps: 30,
        filenameBase,
        beginExportViewport: (exportW, exportH) => {
          this.openMix = 1;
          this.targetOpenMix = 1;
          this.diorama.setOpenMix(1);
          this.hoveredSlotIndex = null;
          this.hoveredPlacedInstanceId = null;
          this.applyRenderDimensions(exportW, exportH, 1);
        },
        renderDeterministicFrame: (u, dt) => {
          this.simTime += dt;
          this.stepSceneFrame(dt, origAzimuth, u);
          this.composer.render();
        },
        restoreViewport: () => {
          this.openMix = origOpenMix;
          this.targetOpenMix = origTargetOpenMix;
          this.diorama.setOpenMix(this.openMix);
          this.hoveredSlotIndex = origHoveredSlot;
          this.hoveredPlacedInstanceId = origHoveredPlaced;
          this.azimuth = origAzimuth;
          this.targetAzimuth = origAzimuth;
          this.polar = origPolar;
          this.targetPolar = origPolar;
          this.camDist = origCamDist;
          this.targetCamDist = origCamDist;
          this.lookTarget.copy(origLook);
          this.targetLook.copy(origLook);
          this.handleResize();
          this.updateCameraTransform();
          this.lastFrameMs = performance.now();
          this.isExportingVideo = false;
        },
        renderOfflineAudio: (durationSec, sampleRate) => this.audio.renderOfflineMusicTrack(durationSec, sampleRate),
        getLiveAudioTrack: () => this.audio.getRecordableAudioTrack(),
        onProgress,
        onStatus: (msg) => this.callbacks.onStatusAnnounce?.(msg),
        isCancelled: () => this.exportCancelled,
      });
    } catch {
      this.isExportingVideo = false;
      this.handleResize();
      this.callbacks.onStatusAnnounce?.('Could not export video.');
      return false;
    }
  }

  public resetCamera(): void {
    if (this.isOpen) {
      this.targetAzimuth = OPEN_AZIMUTH;
      this.targetPolar = OPEN_POLAR;
      this.targetCamDist = this.getResponsiveDist(OPEN_DIST);
      this.targetLook.copy(this.getResponsiveOpenTarget());
    } else {
      this.targetAzimuth = CLOSED_AZIMUTH;
      this.targetPolar = CLOSED_POLAR;
      this.targetCamDist = this.getResponsiveDist(CLOSED_DIST);
      this.targetLook.set(0.0, -0.62, 2.25);
    }
  }

  public rotateCameraStep(deltaAzimuth: number): void {
    this.targetAzimuth += deltaAzimuth;
  }

  // External Drag-and-Drop from OrnamentTray
  public startExternalDrag(ornamentId: OrnamentId, clientX: number, clientY: number): void {
    if (!this.isOpen) return;
    this.externalDragOrnamentId = ornamentId;
    this.isOrbitDragging = false;

    this.clearGhost();
    this.ghostGroup = createOrnamentMesh(ornamentId);
    this.ghostGroup.scale.setScalar(1.06);
    this.scene.add(this.ghostGroup);

    this.updateExternalDragPosition(clientX, clientY);
  }

  public moveExternalDrag(clientX: number, clientY: number): boolean {
    if (!this.externalDragOrnamentId || !this.ghostGroup) return false;
    return this.updateExternalDragPosition(clientX, clientY);
  }

  public dropExternalDrag(clientX: number, clientY: number): boolean {
    if (!this.externalDragOrnamentId) return false;
    const ornamentId = this.externalDragOrnamentId;
    this.updateExternalDragPosition(clientX, clientY);

    let placed = false;
    if (this.hoveredSlotIndex !== null) {
      this.attachOrnamentToSlot(ornamentId, this.hoveredSlotIndex);
      this.audio.playOrnamentAttach(ornamentId);
      placed = true;
    }

    this.clearGhost();
    this.externalDragOrnamentId = null;
    this.hoveredSlotIndex = null;
    return placed;
  }

  public cancelExternalDrag(): void {
    this.clearGhost();
    this.externalDragOrnamentId = null;
    this.hoveredSlotIndex = null;
  }

  public placeOrnamentNext(ornamentId: OrnamentId): boolean {
    if (!this.isOpen) return false;
    const emptySlot = this.findNextEmptySlot();
    const slotIdx = emptySlot !== null ? emptySlot : Math.floor(Math.random() * this.tree.slots.length);
    this.attachOrnamentToSlot(ornamentId, slotIdx);
    this.audio.playOrnamentAttach(ornamentId);
    return true;
  }

  public autoDecorateAll(): void {
    if (!this.isOpen) return;
    this.clearTree(true);
    // Shuffle all 24 unique ornaments and spread them across front, sides & back (leaving extra empty slots too!)
    const pool = [...ORNAMENT_CATALOG];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const balancedSpreadOrder = [
      // Front face (13 slots)
      4, 3, 5, 12, 13, 20, 19, 21, 26, 27, 31, 32, 34,
      // Left & right sides (6 slots)
      2, 6, 11, 14, 25, 28,
      // Back face (5 slots)
      0, 8, 17, 29, 35,
    ];
    pool.forEach((meta, idx) => {
      const slotIdx = balancedSpreadOrder[idx] ?? idx;
      if (slotIdx < this.tree.slots.length) {
        this.attachOrnamentToSlot(meta.id, slotIdx);
      }
    });
    this.audio.playCardOpen();
    this.callbacks.onStatusAnnounce?.('Tree decorated across front, sides, and back with all 24 quirky ornaments.');
  }

  public clearTree(silent = false): void {
    this.hungOrnaments.forEach((item) => {
      this.tree.group.remove(item.pivot);
    });
    this.hungOrnaments.clear();
    this.hoveredPlacedInstanceId = null;
    if (!silent) {
      this.audio.playOrnamentRemove();
      this.callbacks.onStatusAnnounce?.('Cleared all ornaments from the tree.');
    }
    this.emitPlacedList();
  }

  private updateExternalDragPosition(clientX: number, clientY: number): boolean {
    if (!this.ghostGroup) return false;
    const slotIdx = this.pickBestTreeSlot(clientX, clientY, 96);
    this.hoveredSlotIndex = slotIdx;

    if (slotIdx !== null) {
      const slot = this.tree.slots[slotIdx];
      const worldPos = new THREE.Vector3(...slot.position);
      this.tree.group.localToWorld(worldPos);
      this.ghostGroup.position.copy(worldPos);
      this.ghostGroup.rotation.y = slot.outwardAngle;
      this.ghostGroup.visible = true;
      return true;
    }

    // Floating at tree plane depth following cursor when near canvas
    const worldPt = this.screenToTreeDepthWorld(clientX, clientY);
    if (worldPt) {
      this.ghostGroup.position.copy(worldPt);
      this.ghostGroup.rotation.y = this.azimuth;
      this.ghostGroup.visible = true;
    } else {
      this.ghostGroup.visible = false;
    }
    return false;
  }

  private screenToTreeDepthWorld(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const treeWorldCenter = new THREE.Vector3(0, 1.45, 0);
    this.tree.group.localToWorld(treeWorldCenter);

    const camForward = new THREE.Vector3();
    this.camera.getWorldDirection(camForward);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camForward.negate(), treeWorldCenter);
    const target = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, target);
  }

  private isSlotCameraFacing(slotIndex: number, minDot = 0.08): boolean {
    const slot = this.tree.slots[slotIndex];
    if (!slot) return false;
    const slotWorld = new THREE.Vector3(...slot.position);
    const axisWorld = new THREE.Vector3(0, slot.position[1], 0);
    this.tree.group.localToWorld(slotWorld);
    this.tree.group.localToWorld(axisWorld);
    const outward = slotWorld.clone().sub(axisWorld).normalize();
    const toCam = this.camera.position.clone().sub(slotWorld).normalize();
    return outward.dot(toCam) > minDot;
  }

  private pickBestTreeSlot(clientX: number, clientY: number, maxPixelDist: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    // First check exact raycast hit on tree hull
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hullHits = this.raycaster.intersectObjects(this.tree.treeHullMeshes, false);
    const hitPoint = hullHits[0]?.point ?? null;
    const onTreeHull = hitPoint !== null;

    let bestEmptyIdx: number | null = null;
    let bestEmptyDist = maxPixelDist;
    let bestEmptyScore = Infinity;
    let bestAnyIdx: number | null = null;
    let bestAnyDist = maxPixelDist;
    let bestAnyScore = Infinity;

    const slotWorld = new THREE.Vector3();
    const projected = new THREE.Vector3();
    for (const slot of this.tree.slots) {
      if (!this.isSlotCameraFacing(slot.index, 0.06)) continue;

      slotWorld.set(...slot.position);
      this.tree.group.localToWorld(slotWorld);
      projected.copy(slotWorld).project(this.camera);

      const sx = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;
      const dist = Math.hypot(sx - clientX, sy - clientY);
      const score = hitPoint ? dist + slotWorld.distanceTo(hitPoint) * 28 : dist;

      if (dist < maxPixelDist && score < bestAnyScore) {
        bestAnyScore = score;
        bestAnyDist = dist;
        bestAnyIdx = slot.index;
      }
      if (!this.isSlotOccupied(slot.index) && dist < maxPixelDist && score < bestEmptyScore) {
        bestEmptyScore = score;
        bestEmptyDist = dist;
        bestEmptyIdx = slot.index;
      }
    }

    // Prefer visible camera-facing empty slot nearby; if direct hit or full, snap to closest visible slot
    if (bestEmptyIdx !== null && (bestEmptyDist < 72 || onTreeHull)) {
      return bestEmptyIdx;
    }
    if (bestAnyIdx !== null && (bestAnyDist < 48 || onTreeHull)) {
      return bestAnyIdx;
    }
    if (onTreeHull) {
      return this.findNextEmptySlot(true) ?? 4;
    }
    return null;
  }

  private isSlotOccupied(slotIndex: number): boolean {
    for (const item of this.hungOrnaments.values()) {
      if (item.slotIndex === slotIndex) return true;
    }
    return false;
  }

  private findNextEmptySlot(preferCameraFacing = false): number | null {
    // Prefer visible front spots first, then wrap cleanly through all side & back slots
    const frontFirstOrder = [
      4, 3, 5, 12, 13, 20, 19, 21, 26, 27, 31, 32, 34, 2, 6, 11, 14, 25, 28,
    ];
    if (preferCameraFacing) {
      for (let idx = 0; idx < this.tree.slots.length; idx++) {
        if (this.isSlotCameraFacing(idx, 0.08) && !this.isSlotOccupied(idx)) return idx;
      }
    }
    for (const idx of frontFirstOrder) {
      if (idx < this.tree.slots.length && !this.isSlotOccupied(idx)) return idx;
    }
    for (let idx = 0; idx < this.tree.slots.length; idx++) {
      if (!this.isSlotOccupied(idx)) return idx;
    }
    return null;
  }

  private attachOrnamentToSlot(
    ornamentId: OrnamentId,
    slotIndex: number,
    existingInstance?: HungOrnamentRuntime
  ): void {
    // Remove whatever was already in target slot (unless it's the same moving ornament)
    for (const [id, item] of this.hungOrnaments.entries()) {
      if (item.slotIndex === slotIndex && item !== existingInstance) {
        this.tree.group.remove(item.pivot);
        this.hungOrnaments.delete(id);
      }
    }

    const slot = this.tree.slots[slotIndex];
    if (!slot) return;

    if (existingInstance) {
      existingInstance.slotIndex = slotIndex;
      existingInstance.pivot.position.set(...slot.position);
      existingInstance.pivot.rotation.y = slot.outwardAngle;
      existingInstance.swingVelX = (Math.random() - 0.5) * 3.8;
      existingInstance.swingVelZ = 3.2;
      existingInstance.popScale = 0.65;
      this.emitPlacedList();
      return;
    }

    const instanceId = `orn-${++this.instanceSeq}`;
    const pivot = new THREE.Group();
    pivot.position.set(...slot.position);
    pivot.rotation.y = slot.outwardAngle;

    const mesh = createOrnamentMesh(ornamentId);
    mesh.userData.instanceId = instanceId;
    mesh.traverse((obj) => {
      obj.userData.instanceId = instanceId;
      obj.userData.ornamentId = ornamentId;
    });
    pivot.add(mesh);
    this.tree.group.add(pivot);

    const runtime: HungOrnamentRuntime = {
      instanceId,
      ornamentId,
      slotIndex,
      pivot,
      swingAngleX: 0.28,
      swingAngleZ: (Math.random() - 0.5) * 0.25,
      swingVelX: -1.8,
      swingVelZ: (Math.random() - 0.5) * 3.0,
      popScale: 0.2,
    };
    this.hungOrnaments.set(instanceId, runtime);
    this.emitPlacedList();
  }

  private removePlacedOrnament(instanceId: string): void {
    const item = this.hungOrnaments.get(instanceId);
    if (!item) return;
    this.tree.group.remove(item.pivot);
    this.hungOrnaments.delete(instanceId);
    this.audio.playOrnamentRemove();
    this.emitPlacedList();
  }

  private emitPlacedList(): void {
    const list: PlacedOrnamentInfo[] = [];
    this.hungOrnaments.forEach((item) => {
      list.push({
        instanceId: item.instanceId,
        ornamentId: item.ornamentId,
        slotIndex: item.slotIndex,
      });
    });
    this.callbacks.onPlacedChange?.(list);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.isExportingVideo) return;
    this.audio.unlock(this.isOpen);
    this.updatePointerNDC(e);
    this.dragStart.set(e.clientX, e.clientY);
    this.dragLast.set(e.clientX, e.clientY);
    this.dragMoved = 0;

    // Allow clicking any 3D crimson ribbon bow on the cover to make it spring-bounce!
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const bowHits = this.raycaster.intersectObjects(this.diorama.getInteractiveCoverBows(), true);
    if (bowHits.length > 0) {
      const bowIdx = bowHits[0].object.userData.coverBowIndex as number | undefined;
      if (bowIdx !== undefined) {
        this.diorama.triggerCoverBowBounce(bowIdx);
        this.audio.playRibbonBounce();
        return;
      }
    }

    if (this.isOpen && !this.activeTraySelection) {
      // Check if clicking an already-placed ornament on the tree
      const placedTargets: THREE.Object3D[] = [];
      this.hungOrnaments.forEach((item) => placedTargets.push(item.pivot));

      const hits = this.raycaster.intersectObjects(placedTargets, true);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.instanceId as string | undefined;
        if (hitId && this.hungOrnaments.has(hitId)) {
          const runtime = this.hungOrnaments.get(hitId)!;
          this.draggingPlaced = runtime;
          this.draggingPlacedOriginSlot = runtime.slotIndex;
          this.hoveredPlacedInstanceId = null;
          this.canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    this.hoveredPlacedInstanceId = null;

    this.isOrbitDragging = true;
    this.canvas.setPointerCapture(e.pointerId);
  }

  private handlePointerMove(e: PointerEvent): void {
    this.updatePointerNDC(e);
    const dx = e.clientX - this.dragLast.x;
    const dy = e.clientY - this.dragLast.y;
    this.dragLast.set(e.clientX, e.clientY);

    if (this.draggingPlaced) {
      this.dragMoved += Math.hypot(dx, dy);
      if (this.dragMoved > 6) {
        const slotIdx = this.pickBestTreeSlot(e.clientX, e.clientY, 85);
        this.hoveredSlotIndex = slotIdx;
        if (slotIdx !== null) {
          const slot = this.tree.slots[slotIdx];
          this.draggingPlaced.pivot.position.set(...slot.position);
          this.draggingPlaced.pivot.rotation.y = slot.outwardAngle;
        } else {
          // Move freely near cursor to visually show dragging off tree to remove
          const worldPt = this.screenToTreeDepthWorld(e.clientX, e.clientY);
          if (worldPt) {
            this.tree.group.worldToLocal(worldPt);
            this.draggingPlaced.pivot.position.copy(worldPt);
          }
        }
      }
      return;
    }

    if (this.isOrbitDragging) {
      this.dragMoved += Math.hypot(dx, dy);
      this.targetAzimuth -= dx * 0.0075;
      this.targetPolar = THREE.MathUtils.clamp(this.targetPolar - dy * 0.006, 0.34, 1.38);
      return;
    }

    // Hover feedback over cover ribbon bows (even when card is closed) & tree hooks / ornaments
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const bowHoverHits = this.raycaster.intersectObjects(this.diorama.getInteractiveCoverBows(), true);
    if (bowHoverHits.length > 0) {
      this.hoveredPlacedInstanceId = null;
      this.hoveredSlotIndex = null;
      this.canvas.style.cursor = 'pointer';
      return;
    }

    if (this.isOpen) {
      const placedTargets: THREE.Object3D[] = [];
      this.hungOrnaments.forEach((item) => placedTargets.push(item.pivot));
      const placedHits = this.raycaster.intersectObjects(placedTargets, true);
      if (placedHits.length > 0) {
        const oid = placedHits[0].object.userData.ornamentId as OrnamentId | undefined;
        const instanceId = placedHits[0].object.userData.instanceId as string | undefined;
        const meta = ORNAMENT_CATALOG.find((m) => m.id === oid);
        this.hoveredPlacedInstanceId = instanceId ?? null;
        this.canvas.style.cursor = 'pointer';
        this.callbacks.onHoverHint?.(meta ? `${meta.label} · Click for sound, drag to move/remove` : null);
        this.hoveredSlotIndex = null;
        return;
      }
      this.hoveredPlacedInstanceId = null;

      if (this.activeTraySelection) {
        const slotIdx = this.pickBestTreeSlot(e.clientX, e.clientY, 64);
        this.hoveredSlotIndex = slotIdx;
        this.canvas.style.cursor = slotIdx !== null ? 'copy' : 'grab';
      } else {
        this.hoveredSlotIndex = null;
        this.canvas.style.cursor = 'grab';
      }
      this.callbacks.onHoverHint?.(null);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }

    if (this.draggingPlaced) {
      const runtime = this.draggingPlaced;
      const originSlot = this.draggingPlacedOriginSlot;
      this.draggingPlaced = null;
      this.draggingPlacedOriginSlot = null;

      if (this.dragMoved <= 6) {
        // Click reaction: festive pendulum wobble + signature ornament sound!
        runtime.swingVelX = (Math.random() > 0.5 ? 1 : -1) * 5.2;
        runtime.swingVelZ = (Math.random() - 0.5) * 4.4;
        this.audio.playOrnamentVoice(runtime.ornamentId);
      } else {
        const dropSlot = this.pickBestTreeSlot(e.clientX, e.clientY, 85);
        if (dropSlot !== null) {
          this.attachOrnamentToSlot(runtime.ornamentId, dropSlot, runtime);
          if (dropSlot !== originSlot) {
            this.audio.playOrnamentAttach(runtime.ornamentId);
          }
        } else {
          // Dragged completely outside tree -> remove!
          this.removePlacedOrnament(runtime.instanceId);
        }
      }
      this.hoveredSlotIndex = null;
      return;
    }

    if (this.isOrbitDragging) {
      this.isOrbitDragging = false;
      if (this.dragMoved <= 6 && this.isOpen && this.activeTraySelection) {
        const slotIdx = this.pickBestTreeSlot(e.clientX, e.clientY, 68);
        if (slotIdx !== null) {
          this.attachOrnamentToSlot(this.activeTraySelection, slotIdx);
          this.audio.playOrnamentAttach(this.activeTraySelection);
        }
      }
    }
  }

  private handlePointerLeave(): void {
    this.hoveredSlotIndex = null;
    this.hoveredPlacedInstanceId = null;
    this.callbacks.onHoverHint?.(null);
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const baseMin = this.isOpen ? 5.6 : 5.2;
    const baseMax = this.isOpen ? 15.8 : 13.5;
    this.targetCamDist = THREE.MathUtils.clamp(
      this.targetCamDist + e.deltaY * 0.006,
      baseMin,
      baseMax
    );
  }

  private updatePointerNDC(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  private applyThemeBackdrop(city: CityId): void {
    const theme = CITY_THEMES[city];
    this.backdropMat.uniforms.uTopColor.value.set(theme.skyTop);
    this.backdropMat.uniforms.uMidColor.value.set(theme.skyMid);
    this.backdropMat.uniforms.uBottomColor.value.set(theme.skyBottom);
  }

  private buildSnowfall(): void {
    const snowMat = createGouacheMaterial({
      color: '#ffffff',
      shadowColor: '#e1ecf8',
      emissive: 0.35,
      opacity: 0.85,
      transparent: true,
    });
    const goldSparkleMat = createGouacheMaterial({
      color: '#ffe694',
      shadowColor: '#d9a43b',
      emissive: 0.45,
      opacity: 0.9,
      transparent: true,
    });

    for (let i = 0; i < 42; i++) {
      const isSparkle = i % 6 === 0;
      const geo = isSparkle
        ? new THREE.OctahedronGeometry(0.042, 0)
        : new THREE.SphereGeometry(0.032 + (i % 3) * 0.012, 6, 6);
      const mesh = new THREE.Mesh(geo, isSparkle ? goldSparkleMat : snowMat);
      const baseX = (Math.random() - 0.5) * 9.5;
      const baseZ = (Math.random() - 0.5) * 6.8 + 1.4;
      const y = Math.random() * 5.8 + 0.3;
      const startX = Math.abs(baseX) < 3.6 ? (baseX >= 0 ? 3.7 + baseX * 0.45 : -3.7 + baseX * 0.45) : baseX;
      mesh.position.set(startX, y, baseZ);
      this.scene.add(mesh);

      this.snowParticles.push({
        mesh,
        baseX,
        baseZ,
        y,
        speed: 0.25 + Math.random() * 0.32,
        driftFreq: 0.8 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private clearGhost(): void {
    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }
  }

  private getResponsiveDist(desktopDist: number): number {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    if (aspect < 0.95) {
      // Pull camera cleanly back on portrait mobile (e.g. 390x844) so card wings never clip
      return desktopDist / Math.max(0.56, aspect * 1.04);
    }
    return desktopDist;
  }

  private getResponsiveOpenTarget(): THREE.Vector3 {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    // On desktop, nudge look target right so the card clears the 244px right paper OrnamentTray cleanly
    return aspect < 0.95 ? new THREE.Vector3(0.0, 1.08, 1.65) : new THREE.Vector3(0.38, 1.02, 1.68);
  }

  private snapCameraImmediate(): void {
    this.targetCamDist = this.getResponsiveDist(this.isOpen ? OPEN_DIST : CLOSED_DIST);
    this.camDist = this.targetCamDist;
    this.lookTarget.copy(this.targetLook);
    this.updateCameraTransform();
  }

  private updateCameraTransform(): void {
    const sinP = Math.sin(this.polar);
    const x = this.lookTarget.x + this.camDist * sinP * Math.sin(this.azimuth);
    const y = this.lookTarget.y + this.camDist * Math.cos(this.polar);
    const z = this.lookTarget.z + this.camDist * sinP * Math.cos(this.azimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.lookTarget);
  }

  private applyRenderDimensions(w: number, h: number, pixelRatio: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);

    const bufSize = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(bufSize);
    this.postPass.uniforms.uResolution.value.set(Math.max(1, bufSize.x), Math.max(1, bufSize.y));
  }

  private handleResize(): void {
    if (this.isExportingVideo) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.applyRenderDimensions(w, h, pixelRatio);

    if (!this.isOrbitDragging) {
      this.targetCamDist = this.getResponsiveDist(this.isOpen ? OPEN_DIST : CLOSED_DIST);
      if (this.isOpen) {
        this.targetLook.copy(this.getResponsiveOpenTarget());
      }
    }
  }

  private stepSceneFrame(dt: number, exportOrigAzimuth?: number, exportU?: number): void {
    // Smooth physical pop-up unfold over ~1.45s so users watch the hinges lift cleanly
    if (this.openMix !== this.targetOpenMix) {
      const step = dt / 1.45;
      if (this.targetOpenMix > this.openMix) {
        this.openMix = Math.min(1, this.openMix + step);
      } else {
        this.openMix = Math.max(0, this.openMix - step * 1.4);
      }
      this.diorama.setOpenMix(this.openMix);
    }

    // Gentle floating drift when closed
    if (!this.isOpen && !this.prefersReducedMotion && !this.isPaused) {
      this.diorama.root.position.y = Math.sin(this.simTime * 1.4) * 0.08;
      this.diorama.root.rotation.y = Math.sin(this.simTime * 0.7) * 0.05;
    } else {
      this.diorama.root.position.y = THREE.MathUtils.lerp(this.diorama.root.position.y, 0, 1 - Math.exp(-7 * dt));
      this.diorama.root.rotation.y = THREE.MathUtils.lerp(this.diorama.root.rotation.y, 0, 1 - Math.exp(-7 * dt));
    }

    // Smooth damped orbit camera OR automated 360 turntable video showcase
    if (exportU !== undefined && exportOrigAzimuth !== undefined) {
      const ease = exportU < 0.5 ? 2 * exportU * exportU : 1 - Math.pow(-2 * exportU + 2, 2) / 2;
      this.azimuth = exportOrigAzimuth + ease * Math.PI * 2;
      this.targetAzimuth = this.azimuth;
      this.polar = OPEN_POLAR - Math.sin(exportU * Math.PI) * 0.14;
      this.targetPolar = this.polar;
      this.camDist = this.getResponsiveDist(OPEN_DIST * 1.08);
      this.lookTarget.set(0.0, 1.38, 1.55);
      this.targetLook.copy(this.lookTarget);
      this.updateCameraTransform();
    } else {
      const camEase = 1 - Math.exp(-8.0 * dt);
      this.azimuth = THREE.MathUtils.lerp(this.azimuth, this.targetAzimuth, camEase);
      this.polar = THREE.MathUtils.lerp(this.polar, this.targetPolar, camEase);
      this.camDist = THREE.MathUtils.lerp(this.camDist, this.targetCamDist, camEase);
      this.lookTarget.lerp(this.targetLook, camEase);
      this.updateCameraTransform();
    }

    // Update backdrop & city landmark animations
    this.backdropMat.uniforms.uTime.value = this.simTime;
    this.postPass.uniforms.uTime.value = this.simTime;
    this.diorama.update(this.simTime, this.prefersReducedMotion || this.isPaused);

    // Tree topper star & fairy lights subtle festive pulse
    if (!this.prefersReducedMotion && !this.isPaused) {
      this.tree.topperStar.rotation.y = Math.sin(this.simTime * 1.1) * 0.25;
      this.tree.fairyBulbs.forEach((bulb) => {
        const ph = (bulb.userData.phase as number) ?? 0;
        const s = 0.88 + Math.sin(this.simTime * 3.1 + ph) * 0.22;
        bulb.scale.setScalar(s);
      });
    }

    // Branch hook ring visibility & highlight feedback during drag/select (suppressed during export)
    const showHooks =
      !this.isExportingVideo &&
      this.isOpen &&
      (this.externalDragOrnamentId !== null || this.activeTraySelection !== null || this.draggingPlaced !== null);
    this.tree.slotMarkers.forEach((marker, idx) => {
      const mat = marker.material as THREE.ShaderMaterial;
      const facing = showHooks && this.isSlotCameraFacing(idx, 0.04);
      const isHovered = this.hoveredSlotIndex === idx;
      const occupied = this.isSlotOccupied(idx);
      const targetOpacity = isHovered ? 0.96 : facing ? (occupied ? 0.22 : 0.72) : 0.0;
      mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        mat.uniforms.uOpacity.value,
        targetOpacity,
        1 - Math.exp(-12 * dt)
      );
      const targetScale = isHovered
        ? 1.48 + Math.sin(this.simTime * 8) * 0.12
        : showHooks
          ? 1.05
          : 0.7;
      marker.scale.setScalar(THREE.MathUtils.lerp(marker.scale.x, targetScale, 1 - Math.exp(-12 * dt)));
    });

    // Perched ornament upright spring-wobble + pop-in & hover bounce
    this.hungOrnaments.forEach((item) => {
      const isHovered = !this.isExportingVideo && this.hoveredPlacedInstanceId === item.instanceId && this.draggingPlaced !== item;
      const targetScale = isHovered ? 1.19 : 1.0;
      item.popScale = THREE.MathUtils.lerp(item.popScale, targetScale, 1 - Math.exp(-12 * dt));
      item.pivot.scale.setScalar(item.popScale);

      const slot = this.tree.slots[item.slotIndex];
      if (slot && this.draggingPlaced !== item) {
        const hoverLift = Math.max(0, item.popScale - 1.0) * 0.24;
        item.pivot.position.y = slot.position[1] + hoverLift;
      }

      if (this.draggingPlaced !== item && !this.prefersReducedMotion && !this.isPaused) {
        const k = 32.0;
        const damp = 4.8;
        const accX = -k * item.swingAngleX - damp * item.swingVelX;
        const accZ = -k * item.swingAngleZ - damp * item.swingVelZ;
        item.swingVelX += accX * dt;
        item.swingVelZ += accZ * dt;
        item.swingAngleX += item.swingVelX * dt;
        item.swingAngleZ += item.swingVelZ * dt;

        const hoverRockZ = isHovered ? Math.sin(this.simTime * 6.5) * 0.11 : 0;
        const hoverRockX = isHovered ? Math.cos(this.simTime * 5.2) * 0.07 : 0;
        item.pivot.rotation.x = THREE.MathUtils.clamp(item.swingAngleX * 0.42, -0.26, 0.26) + hoverRockX;
        item.pivot.rotation.z = THREE.MathUtils.clamp(item.swingAngleZ * 0.42, -0.26, 0.26) + hoverRockZ;
      }
    });

    // Gentle snowfall & sparkles (detour softly around closed cover perimeter so greeting text stays crystal clear!)
    const closedHaloMix = 1 - THREE.MathUtils.smoothstep(this.openMix, 0.0, 0.38);
    if (!this.prefersReducedMotion && !this.isPaused) {
      this.snowParticles.forEach((p) => {
        p.y -= p.speed * dt;
        if (p.y < -0.1) p.y = 5.8;
        let px = p.baseX + Math.sin(this.simTime * p.driftFreq + p.phase) * 0.28;
        if (closedHaloMix > 0.01 && Math.abs(px) < 3.6) {
          const haloX = px >= 0 ? 3.7 + px * 0.45 : -3.7 + px * 0.45;
          px = THREE.MathUtils.lerp(px, haloX, closedHaloMix);
        }
        p.mesh.position.y = p.y;
        p.mesh.position.x = px;
        p.mesh.position.z = p.baseZ + Math.cos(this.simTime * p.driftFreq * 0.7 + p.phase) * 0.22;
        p.mesh.rotation.y += dt * 0.9;
      });
    }
  }

  private animate = (nowMs: number): void => {
    this.rafId = requestAnimationFrame(this.animate);
    if (document.hidden || this.isExportingVideo) {
      this.lastFrameMs = nowMs;
      return;
    }

    const rawDt = (nowMs - this.lastFrameMs) * 0.001;
    this.lastFrameMs = nowMs;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (!this.isPaused) {
      this.simTime += dt;
    }

    this.stepSceneFrame(dt);
    this.composer.render();
    if (!this.hasRenderedFirstFrame) {
      this.hasRenderedFirstFrame = true;
      this.callbacks.onFirstFrameRendered?.();
    }
  };

  public dispose(): void {
    this.exportCancelled = true;
    this.isExportingVideo = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResizeBound);
    document.removeEventListener('visibilitychange', this.onVisibilityBound);
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeaveBound);
    this.canvas.removeEventListener('wheel', this.onWheelBound);
    this.diorama.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

(import.meta as unknown as { hot?: { decline: () => void } }).hot?.decline();
