import * as THREE from 'three';
import { createGouacheMaterial } from '../shaders/gouacheShaders';
import { CITY_THEMES } from '../themes/cityThemes';
import type { CityId } from '../types/card';
import {
  createBackWallPaperTexture,
  createDeckPaperTexture,
  createFrontCoverTexture,
} from './paperArtwork';
import {
  createPaperCutLayer,
  drawBrusselsAtomiumCutout,
  drawBrusselsBeerAndFritesCutout,
  drawBrusselsFrontBeerAndFriesProp,
  drawBrusselsFrontWaffleProp,
  drawBrusselsGrandPlaceBackdrop,
  drawBrusselsGuildhallCutout,
  drawBrusselsSpottedCatCutout,
  drawBrusselsWaffleStandCutout,
  drawGastownSteamClockCutout,
  drawGwanghwamunChristmasCutout,
  drawLionsGateBridgeCutout,
  drawNSeoulTowerCutout,
  drawSeoulBokjumeoniCutout,
  drawSeoulBridgeCutout,
  drawSeoulHaechiCutout,
  drawSeoulHanbokAndTreesCutout,
  drawSeoulLanternCutout,
  drawSeoulMagpieOnly,
  drawSeoulMountainsAndLotte,
  drawSteamPuffCutout,
  drawTorontoCocoaStandCutout,
  drawTorontoDistilleryCutout,
  drawTorontoFlatironCutout,
  drawTorontoLampPostCutout,
  drawTorontoRaccoonCutout,
  drawTorontoSkylineAndCN,
  drawTorontoStreetcarCutout,
  drawVancouverBouldersCutout,
  drawVancouverCedarsCutout,
  drawVancouverMountainsAndSails,
  drawVancouverPierLanternCutout,
  drawVancouverSeaplaneOnly,
} from './paperCutCityArt';

export const CARD_WIDTH = 6.2;
export const CARD_DECK_DEPTH = 4.2;
export const CARD_WALL_HEIGHT = 4.05;
export const PAPER_THICK = 0.055;

interface PopupLayerMeta {
  group: THREE.Group;
  stageBias: number; // 0..0.28 stagger for realistic pop-up unfolding
}

export interface SteamPuffParticle {
  group: THREE.Group;
  active: boolean;
  age: number;
  duration: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  maxScale: number;
}

export interface AnimatedCityElements {
  streetcar?: THREE.Group;
  seaplane?: THREE.Group;
  magpie?: THREE.Group;
  brusselsCat?: THREE.Group;
  swayGroup?: THREE.Group;
  steamPuffs?: SteamPuffParticle[];
}

interface BrusselsCatRoam {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  speed: number;
  pauseTimer: number;
  stepPhase: number;
  facingRight: boolean;
}

interface CoverBowRuntime {
  group: THREE.Group;
  baseScale: number;
  baseZ: number;
  bouncePos: number;
  bounceVel: number;
  tiltPos: number;
  tiltVel: number;
}

export class CardDiorama {
  public readonly root = new THREE.Group();
  public readonly deckGroup = new THREE.Group();
  public readonly coverHinge = new THREE.Group();
  public readonly popStage = new THREE.Group();
  public readonly treeMount = new THREE.Group();

  private readonly popCutouts: PopupLayerMeta[] = [];
  private readonly coverBows: CoverBowRuntime[] = [];
  private readonly animated: AnimatedCityElements = {};

  private deckTopMesh: THREE.Mesh | null = null;
  private readonly textures: THREE.Texture[] = [];
  private readonly materials: THREE.Material[] = [];

  private cityId: CityId = 'toronto';
  private openMix = 0;
  private lastAnimTime = 0;
  private nextSteamBurstAt = 0.2;
  private catRoam: BrusselsCatRoam | null = null;

  constructor() {
    this.root.add(this.deckGroup);
    this.coverHinge.position.set(0, 0, 0);
    this.root.add(this.coverHinge);
    this.popStage.position.set(0, 0, 0);
    this.root.add(this.popStage);

    this.treeMount.position.set(0, 0.02, 1.56);
    this.popStage.add(this.treeMount);
  }

  public rebuild(cityId: CityId, recipientName: string): void {
    this.cityId = cityId;
    this.clearDynamicScene();

    const theme = CITY_THEMES[cityId];
    const deckW = CARD_WIDTH;
    const deckD = CARD_DECK_DEPTH;
    const wallH = CARD_WALL_HEIGHT;

    const basePaperMat = this.trackMat(
      createGouacheMaterial({
        color: theme.cardPaper,
        shadowColor: theme.cardPaperShadow,
        emissive: 0.14,
      })
    );
    const deckBase = new THREE.Mesh(new THREE.BoxGeometry(deckW, PAPER_THICK, deckD), basePaperMat);
    deckBase.position.set(0, -PAPER_THICK * 0.5, deckD * 0.5);
    this.deckGroup.add(deckBase);

    const deckTex = this.trackTex(createDeckPaperTexture(cityId, recipientName));
    const deckTopMat = this.trackMat(
      createGouacheMaterial({
        color: '#ffffff',
        shadowColor: '#e5ddd4',
        emissive: 0.18,
        map: deckTex,
      })
    );
    this.deckTopMesh = new THREE.Mesh(new THREE.PlaneGeometry(deckW, deckD), deckTopMat);
    this.deckTopMesh.rotation.x = -Math.PI * 0.5;
    this.deckTopMesh.position.set(0, 0.005, deckD * 0.5);
    this.deckGroup.add(this.deckTopMesh);

    const snowMat = this.trackMat(
      createGouacheMaterial({
        color: '#ffffff',
        shadowColor: '#d9e3ed',
        emissive: 0.16,
      })
    );
    const creaseDrift = new THREE.Mesh(new THREE.BoxGeometry(deckW - 0.55, 0.04, 0.48), snowMat);
    creaseDrift.position.set(0, 0.02, 0.35);
    this.deckGroup.add(creaseDrift);

    // Hinged Upright Back Wall (also carries Front Cover when closed)
    const wallSlab = new THREE.Mesh(new THREE.BoxGeometry(deckW, wallH, PAPER_THICK), basePaperMat);
    wallSlab.position.set(0, wallH * 0.5, -PAPER_THICK * 0.5);
    this.coverHinge.add(wallSlab);

    const wallTex = this.trackTex(createBackWallPaperTexture(cityId));
    const wallInnerMat = this.trackMat(
      createGouacheMaterial({
        color: '#ffffff',
        shadowColor: '#dcd5cc',
        emissive: 0.22,
        map: wallTex,
      })
    );
    const wallInnerFace = new THREE.Mesh(new THREE.PlaneGeometry(deckW, wallH), wallInnerMat);
    wallInnerFace.position.set(0, wallH * 0.5, 0.004);
    this.coverHinge.add(wallInnerFace);

    const coverTex = this.trackTex(createFrontCoverTexture(cityId));
    const coverOuterMat = this.trackMat(
      createGouacheMaterial({
        color: '#ffffff',
        shadowColor: '#e5ddd2',
        emissive: 0.2,
        map: coverTex,
      })
    );
    const wallOuterFace = new THREE.Mesh(new THREE.PlaneGeometry(deckW, wallH), coverOuterMat);
    wallOuterFace.rotation.x = Math.PI;
    wallOuterFace.position.set(0, wallH * 0.5, -PAPER_THICK - 0.004);
    this.coverHinge.add(wallOuterFace);

    // Sculpted 3D crimson satin ribbon garlands weaving around pine boughs + 6 actual tied ribbon bows
    const ribbonZ = -PAPER_THICK - 0.012;
    const toCoverX = (cxPx: number) => (cxPx / 1024 - 0.5) * deckW;
    const toCoverY = (cyPx: number) => (cyPx / 768) * wallH;

    const velvetMat = this.trackMat(
      createGouacheMaterial({
        color: '#b82924',
        shadowColor: '#7a1210',
        rimColor: '#e65b52',
        emissive: 0.18,
        rimStrength: 0.28,
      })
    );
    const velvetDarkMat = this.trackMat(
      createGouacheMaterial({
        color: '#911815',
        shadowColor: '#5c0907',
        emissive: 0.14,
      })
    );

    // Build shared bow loop & ribbon tail geometry once cleanly
    const ribbonLoopShape = new THREE.Shape();
    ribbonLoopShape.moveTo(0, 0);
    ribbonLoopShape.bezierCurveTo(0.11, 0.14, 0.34, 0.15, 0.35, 0.025);
    ribbonLoopShape.bezierCurveTo(0.35, -0.015, 0.14, 0.005, 0, 0);

    const ribbonLoopGeo = new THREE.ExtrudeGeometry(ribbonLoopShape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    });
    ribbonLoopGeo.rotateX(-Math.PI * 0.5);
    ribbonLoopGeo.translate(0, -0.0375, 0);

    const tailShape = new THREE.Shape();
    tailShape.moveTo(-0.036, 0);
    tailShape.lineTo(0.036, 0);
    tailShape.lineTo(0.048, 0.38);
    tailShape.lineTo(0, 0.31);
    tailShape.lineTo(-0.048, 0.38);
    tailShape.closePath();
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.014,
      bevelEnabled: false,
    });

    const addCoverBow = (cxPx: number, cyPx: number, rotZ = 0, scale = 1.0) => {
      const bowIndex = this.coverBows.length;
      const bowZ = ribbonZ - 0.012;
      const bow = new THREE.Group();
      bow.position.set(toCoverX(cxPx), toCoverY(cyPx), bowZ);
      bow.rotation.z = rotZ;
      bow.scale.setScalar(scale);

      [-1, 1].forEach((side) => {
        const loopMesh = new THREE.Mesh(ribbonLoopGeo, velvetMat);
        loopMesh.scale.x = side;
        loopMesh.rotation.z = -side * 0.22;
        loopMesh.rotation.y = side * 0.12;
        bow.add(loopMesh);

        const tailMesh = new THREE.Mesh(tailGeo, side > 0 ? velvetMat : velvetDarkMat);
        tailMesh.position.set(side * 0.025, 0.01, -0.016);
        tailMesh.rotation.z = -side * 0.52;
        tailMesh.rotation.x = 0.06;
        bow.add(tailMesh);
      });

      const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.092, 12), velvetDarkMat);
      knot.position.set(0, 0, -0.018);
      knot.scale.set(1.05, 1, 0.72);
      bow.add(knot);

      // Generous invisible hit collider + tag all bow sub-meshes with coverBowIndex
      const bowHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      bowHit.position.set(0, 0.02, -0.04);
      bow.add(bowHit);
      bow.traverse((obj) => {
        obj.userData.coverBowIndex = bowIndex;
      });

      this.coverHinge.add(bow);
      this.coverBows.push({
        group: bow,
        baseScale: scale,
        baseZ: bowZ,
        bouncePos: 0,
        bounceVel: 0,
        tiltPos: 0,
        tiltVel: 0,
      });
    };

    const addRibbonStrand = (ptsPx: Array<[number, number, number]>) => {
      const curve = new THREE.CatmullRomCurve3(
        ptsPx.map(([px, py, zOff]) => new THREE.Vector3(toCoverX(px), toCoverY(py), ribbonZ - zOff))
      );
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.032, 6, false), velvetMat);
      // Squash tube into flat silky satin ribbon band while hugging the cover face
      tube.scale.z = 0.22;
      tube.position.z = ribbonZ * (1 - 0.22);
      this.coverHinge.add(tube);
    };

    // Weaving 3D ribbon strands along top, corner pine boughs, and bottom wreath frame
    addRibbonStrand([
      [130, 114, 0.014],
      [250, 146, 0.008],
      [385, 118, 0.016],
      [512, 108, 0.012],
      [645, 134, 0.016],
      [775, 102, 0.008],
      [894, 114, 0.014],
    ]);
    addRibbonStrand([
      [130, 114, 0.012],
      [142, 168, 0.015],
      [126, 224, 0.008],
    ]);
    addRibbonStrand([
      [894, 114, 0.012],
      [882, 168, 0.015],
      [898, 224, 0.008],
    ]);
    addRibbonStrand([
      [130, 654, 0.014],
      [250, 622, 0.008],
      [385, 650, 0.016],
      [512, 660, 0.012],
      [645, 634, 0.016],
      [775, 666, 0.008],
      [894, 654, 0.014],
    ]);
    addRibbonStrand([
      [130, 654, 0.012],
      [142, 600, 0.015],
      [126, 544, 0.008],
    ]);
    addRibbonStrand([
      [894, 654, 0.012],
      [882, 600, 0.015],
      [898, 544, 0.008],
    ]);

    // Mount all 6 tied 3D bows around the greenery border
    addCoverBow(130, 112, -0.42, 0.94);
    addCoverBow(512, 106, 0.0, 1.08);
    addCoverBow(894, 112, 0.42, 0.94);
    addCoverBow(130, 656, Math.PI + 0.42, 0.94);
    addCoverBow(512, 662, Math.PI, 1.08);
    addCoverBow(894, 656, Math.PI - 0.42, 0.94);

    if (cityId === 'seoul') {
      this.buildSeoulPaperCuts(theme);
    } else if (cityId === 'toronto') {
      this.buildTorontoPaperCuts(theme);
    } else if (cityId === 'brussels') {
      this.buildBrusselsPaperCuts(theme);
    } else {
      this.buildVancouverPaperCuts(theme);
    }

    this.applyOpenMix(this.openMix);
  }

  public updateRecipientName(recipientName: string): void {
    if (!this.deckTopMesh) return;
    const nextTex = this.trackTex(createDeckPaperTexture(this.cityId, recipientName));
    const mat = this.deckTopMesh.material as THREE.ShaderMaterial;
    if (mat.uniforms?.uMap) {
      mat.uniforms.uMap.value = nextTex;
      mat.uniforms.uHasMap.value = 1.0;
    }
  }

  public setOpenMix(mix: number): void {
    this.openMix = Math.max(0, Math.min(1, mix));
    this.applyOpenMix(this.openMix);
  }

  public getInteractiveCoverBows(): THREE.Object3D[] {
    return this.coverBows.map((b) => b.group);
  }

  public triggerCoverBowBounce(index: number): void {
    const bow = this.coverBows[index];
    if (!bow) return;
    bow.bounceVel = 4.8;
    bow.tiltVel = (Math.random() > 0.5 ? 1 : -1) * 4.2;
  }

  public update(simTime: number, isReducedMotion: boolean): void {
    const dt = Math.min(0.08, Math.max(0, simTime - this.lastAnimTime));
    this.lastAnimTime = simTime;

    // Tactile spring bounce on clicked 3D crimson ribbon bows (works even when closed)
    this.coverBows.forEach((b) => {
      if (isReducedMotion) {
        b.bouncePos = 0;
        b.bounceVel = 0;
        b.tiltPos = 0;
        b.tiltVel = 0;
        b.group.scale.setScalar(b.baseScale);
        b.group.position.z = b.baseZ;
        b.group.rotation.x = 0;
        return;
      }
      const accScale = -115 * b.bouncePos - 10.5 * b.bounceVel;
      b.bounceVel += accScale * dt;
      b.bouncePos += b.bounceVel * dt;

      const accTilt = -85 * b.tiltPos - 8.5 * b.tiltVel;
      b.tiltVel += accTilt * dt;
      b.tiltPos += b.tiltVel * dt;

      const s = b.baseScale * Math.max(0.84, 1 + b.bouncePos * 0.65);
      b.group.scale.set(s, s, s * (1 + Math.abs(b.bouncePos) * 0.4));
      b.group.position.z = b.baseZ - Math.max(-0.02, b.bouncePos * 0.11);
      b.group.rotation.x = THREE.MathUtils.clamp(b.tiltPos * 0.5, -0.45, 0.45);
    });

    if (this.animated.steamPuffs) {
      if (this.openMix < 0.88) {
        this.animated.steamPuffs.forEach((p) => {
          p.group.visible = false;
        });
      } else if (isReducedMotion) {
        this.animated.steamPuffs.forEach((p, idx) => {
          if (idx < 2) {
            p.group.visible = true;
            p.group.position.set(idx === 0 ? -0.05 : 0.08, idx === 0 ? 0.14 : 0.34, 0.03);
            p.group.scale.setScalar(idx === 0 ? 0.72 : 0.94);
            p.group.rotation.z = idx === 0 ? -0.1 : 0.12;
          } else {
            p.group.visible = false;
          }
        });
      } else {
        if (simTime >= this.nextSteamBurstAt) {
          const burstCount = 2 + Math.floor(Math.random() * 3);
          let spawned = 0;
          for (const p of this.animated.steamPuffs) {
            if (!p.active && spawned < burstCount) {
              p.active = true;
              p.age = -spawned * 0.16;
              p.duration = 1.65 + Math.random() * 0.75;
              p.vx = (Math.random() - 0.38) * 0.28;
              p.vy = 0.56 + Math.random() * 0.28;
              p.vz = (Math.random() - 0.5) * 0.14;
              p.spin = (Math.random() - 0.5) * 0.65;
              p.maxScale = 0.68 + Math.random() * 0.42;
              p.group.position.set((Math.random() - 0.5) * 0.06, 0.02, 0.03);
              p.group.scale.setScalar(0.01);
              p.group.visible = false;
              spawned++;
            }
          }
          this.nextSteamBurstAt = simTime + 1.5 + Math.random() * 2.9;
        }

        for (const p of this.animated.steamPuffs) {
          if (!p.active) {
            p.group.visible = false;
            continue;
          }
          p.age += dt;
          if (p.age < 0) {
            p.group.visible = false;
            continue;
          }
          const u = p.age / p.duration;
          if (u >= 1) {
            p.active = false;
            p.group.visible = false;
            continue;
          }
          p.group.visible = true;
          const easeRise = 1 - Math.pow(1 - u, 1.5);
          p.group.position.set(
            p.vx * easeRise * 1.45 + Math.sin(u * 5.0 + p.spin) * 0.04,
            0.04 + p.vy * easeRise * 1.35,
            0.03 + p.vz * easeRise
          );
          const popScale =
            u < 0.22
              ? THREE.MathUtils.smoothstep(u, 0, 0.22)
              : u > 0.68
                ? Math.max(0.01, 1 - THREE.MathUtils.smoothstep(u, 0.68, 1))
                : 1;
          p.group.scale.setScalar(Math.max(0.01, popScale * p.maxScale));
          p.group.rotation.z = p.spin * easeRise;
        }
      }
    }

    if (isReducedMotion || this.openMix < 0.88) return;

    // Toronto: TTC Streetcar orbits smoothly around the Christmas tree on the elliptical deck rail!
    if (this.animated.streetcar) {
      const a = simTime * 0.52;
      const cx = 0;
      const cz = 1.62;
      const rx = 1.58;
      const rz = 1.28;
      const x = cx + Math.cos(a) * rx;
      const z = cz + Math.sin(a) * rz;
      const dx = -Math.sin(a) * rx;
      const dz = Math.cos(a) * rz;
      this.animated.streetcar.position.set(x, 0.01, z);
      // Tangent orientation so the paper-cut streetcar tracks cleanly around the tree
      this.animated.streetcar.rotation.y = Math.atan2(-dz, dx);
    }

    // Vancouver: Seaplane flies in a scenic loop behind the tree peak & above Lions Gate Bridge
    if (this.animated.seaplane) {
      const a = simTime * 0.62;
      const rx = 2.05;
      const x = Math.sin(a) * rx;
      const z = 0.68 + Math.sin(a * 2.0) * 0.18;
      const y = 2.68 + Math.cos(a * 2.0) * 0.14;
      const dx = Math.cos(a) * rx;
      this.animated.seaplane.position.set(x, y, z);
      // Keep paper plane angled cleanly toward viewer while flipping direction at loop turns
      this.animated.seaplane.rotation.y = dx >= 0 ? Math.PI - 0.32 : 0.32;
      this.animated.seaplane.rotation.z = Math.sin(a) * 0.14;
    }

    // Seoul: Lucky Korean Magpie (kkachi) swoops & glides across the winter palace sky clear of tree
    if (this.animated.magpie) {
      const a = simTime * 0.72 + 0.9;
      const rx = 2.05;
      const x = Math.sin(a) * rx;
      const z = 0.68 + Math.sin(a * 2.0) * 0.18;
      const y = 2.72 + Math.sin(simTime * 3.8) * 0.1 + Math.cos(a * 2.0) * 0.14;
      const dx = Math.cos(a) * rx;
      this.animated.magpie.position.set(x, y, z);
      // Keep crisp 14-degree 3/4 yaw so front & mirrored back outlines stay unbroken in both flight directions
      this.animated.magpie.rotation.y = dx >= 0 ? 0.24 : Math.PI - 0.24;
      this.animated.magpie.rotation.z = Math.sin(simTime * 3.8) * 0.1;
    }

    // Brussels: Black & white spotted cat ambles slowly and randomly across the Grand Place courtyard
    if (this.animated.brusselsCat && this.catRoam) {
      const cat = this.catRoam;
      if (cat.pauseTimer > 0) {
        cat.pauseTimer = Math.max(0, cat.pauseTimer - dt);
        this.animated.brusselsCat.position.set(cat.x, 0.01, cat.z);
        this.animated.brusselsCat.rotation.z = Math.sin(simTime * 1.4) * 0.018;
      } else {
        const toX = cat.targetX - cat.x;
        const toZ = cat.targetZ - cat.z;
        const dist = Math.hypot(toX, toZ);
        if (dist < 0.04) {
          cat.pauseTimer = 0.85 + Math.random() * 2.15;
          this.pickNextCatTarget(cat);
          this.animated.brusselsCat.position.set(cat.x, 0.01, cat.z);
          this.animated.brusselsCat.rotation.z = 0;
        } else {
          const step = Math.min(dist, cat.speed * dt);
          const stepX = (toX / dist) * step;
          const stepZ = (toZ / dist) * step;
          cat.x += stepX;
          cat.z += stepZ;

          // Steer cleanly around curved lower tree branches (center 0, 1.56, r = 1.14)
          const tzOff = cat.z - 1.56;
          const treeDist = Math.hypot(cat.x, tzOff);
          if (treeDist < 1.3) {
            const safeDist = Math.max(0.001, treeDist);
            cat.x = (cat.x / safeDist) * 1.3;
            cat.z = 1.56 + (tzOff / safeDist) * 1.3;
          }
          cat.x = THREE.MathUtils.clamp(cat.x, -1.38, 1.38);
          cat.z = THREE.MathUtils.clamp(cat.z, 2.46, 3.04);

          if (Math.abs(stepX) > 0.0004) {
            cat.facingRight = stepX > 0;
          }
          cat.stepPhase += dt * (cat.speed * 13.0);
          const hop = Math.abs(Math.sin(cat.stepPhase)) * 0.022;
          this.animated.brusselsCat.position.set(cat.x, 0.01 + hop, cat.z);
          this.animated.brusselsCat.rotation.y = cat.facingRight ? 0.2 : Math.PI - 0.2;
          this.animated.brusselsCat.rotation.z = Math.sin(cat.stepPhase) * 0.032;
        }
      }
    }

    if (this.animated.swayGroup) {
      this.animated.swayGroup.rotation.z = Math.sin(simTime * 1.5) * 0.022;
    }
  }

  private pickNextCatTarget(cat: BrusselsCatRoam): void {
    for (let attempt = 0; attempt < 16; attempt++) {
      let tx = (Math.random() * 2 - 1) * 1.36;
      let tz = 2.48 + Math.random() * 0.56;
      const dz = tz - 1.56;
      const d = Math.hypot(tx, dz);
      if (d < 1.32) {
        const s = 1.34 / Math.max(0.001, d);
        tx = THREE.MathUtils.clamp(tx * s, -1.36, 1.36);
        tz = THREE.MathUtils.clamp(1.56 + dz * s, 2.48, 3.04);
      }
      if (Math.hypot(tx - cat.x, tz - cat.z) >= 0.52 || attempt === 15) {
        cat.targetX = tx;
        cat.targetZ = tz;
        cat.speed = 0.16 + Math.random() * 0.16;
        return;
      }
    }
  }

  private applyOpenMix(mix: number): void {
    // 1. Cover unfolds smoothly from folded shut (+PI/2) to upright open (-0.09 rad)
    const coverClosedRot = Math.PI * 0.5 - 0.012;
    const coverOpenRot = -0.09;
    const coverEase = 1 - Math.pow(1 - mix, 2.8);
    this.coverHinge.rotation.x = THREE.MathUtils.lerp(coverClosedRot, coverOpenRot, coverEase);

    // 2. Pop-up cutouts & stepped tree remain hidden flush under the cover until cover lifts past ~0.08
    const visible = mix > 0.07;
    this.popStage.visible = visible;

    // Rigid paper hinge folding around bottom crease (y = 0) instead of rubbery y-squashing!
    this.popCutouts.forEach(({ group, stageBias }) => {
      const localT = THREE.MathUtils.clamp((mix - 0.1 - stageBias) / (0.86 - stageBias), 0, 1);
      const ease = 1 - Math.pow(1 - localT, 2.4);
      // Pivot flat from folded forward/back (-88°) upright to 0°!
      group.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.49, 0, ease);
      // Only tiny initial flatness clearance right under 0.12 so edges stay tucked cleanly inside closed card
      const hideFlatten = THREE.MathUtils.smoothstep(mix, 0.07, 0.22);
      group.scale.y = Math.max(0.02, hideFlatten);
    });

    // Stepped paper tree rises cleanly from flat crease accordion-style as the card opens
    const treeT = THREE.MathUtils.clamp((mix - 0.18) / 0.82, 0, 1);
    const treeEase = 1 - Math.pow(1 - treeT, 2.5);
    this.treeMount.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.44, 0, treeEase);
    this.treeMount.scale.set(0.65 + 0.35 * treeEase, Math.max(0.02, treeEase), 0.65 + 0.35 * treeEase);

    if (this.animated.seaplane && mix < 0.99) {
      this.animated.seaplane.position.y = THREE.MathUtils.lerp(0.18, 2.62, treeEase);
    }
    if (this.animated.magpie && mix < 0.99) {
      this.animated.magpie.position.y = THREE.MathUtils.lerp(0.18, 2.68, treeEase);
    }
  }

  private addCutout(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    stageBias = 0.0
  ): THREE.Group {
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    this.popStage.add(group);
    this.popCutouts.push({ group, stageBias });
    return group;
  }

  private buildSeoulPaperCuts(theme: (typeof CITY_THEMES)['seoul']): void {
    const t = this.trackTex.bind(this);
    const m = this.trackMat.bind(this);

    const backdrop = createPaperCutLayer(
      { width: 5.5, height: 3.15, pxWidth: 960, pxHeight: 540, borderPx: 7, paperColor: theme.cardPaper },
      (ctx, w, h) => drawSeoulMountainsAndLotte(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(backdrop, 0.05, 0, 0.34, 0, 0.0);

    const nTower = createPaperCutLayer(
      { width: 1.32, height: 2.85, pxWidth: 320, pxHeight: 620, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawNSeoulTowerCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(nTower, -2.18, 0, 0.56, 0.14, 0.04);

    // Richly detailed Christmas Gwanghwamun Palace Gate framed clearly left of the tree (zero overlap)
    const palace = createPaperCutLayer(
      { width: 2.08, height: 1.86, pxWidth: 640, pxHeight: 540, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawGwanghwamunChristmasCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(palace, -1.94, 0, 1.08, 0.34, 0.08);

    // Cheonggyecheon Stone Arch Bridge set cleanly to the right side of the tree
    const bridge = createPaperCutLayer(
      { width: 1.82, height: 0.94, pxWidth: 520, pxHeight: 240, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawSeoulBridgeCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(bridge, 2.04, 0, 1.78, -0.58, 0.14);

    // Joyful paper-cut 해치 (Haechi) in right foreground
    const haechi = createPaperCutLayer(
      { width: 1.28, height: 1.18, pxWidth: 360, pxHeight: 330, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawSeoulHaechiCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(haechi, 2.15, 0, 2.82, -0.22, 0.18);

    const hanbokCluster = createPaperCutLayer(
      { width: 1.55, height: 1.3, pxWidth: 500, pxHeight: 380, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawSeoulHanbokAndTreesCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(hanbokCluster, -2.08, 0, 2.38, 0.28, 0.16);
    this.animated.swayGroup = hanbokCluster;

    // Flying Korean Magpie (kkachi) gliding high over Seoul clear of tree
    const magpie = createPaperCutLayer(
      { width: 0.94, height: 0.64, pxWidth: 480, pxHeight: 330, borderPx: 8, paperColor: theme.cardPaper, depth: 0.022 },
      (ctx, w, h) => drawSeoulMagpieOnly(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(magpie, 1.45, 2.68, 1.05, 0.24, 0.18);
    this.animated.magpie = magpie;

    this.mountForegroundProps(
      theme.cardPaper,
      (ctx, w, h) => drawSeoulLanternCutout(ctx, w, h, theme),
      (ctx, w, h) => drawSeoulBokjumeoniCutout(ctx, w, h, theme)
    );
  }

  private buildTorontoPaperCuts(theme: (typeof CITY_THEMES)['toronto']): void {
    const t = this.trackTex.bind(this);
    const m = this.trackMat.bind(this);

    // Wide extra-tall Financial District skyline (CN Tower + Rogers Centre + First Canadian Place + TD Centre + Scotia Plaza + Royal Bank Plaza)
    const cnSkyline = createPaperCutLayer(
      { width: 5.45, height: 3.65, pxWidth: 960, pxHeight: 680, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawTorontoSkylineAndCN(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(cnSkyline, 0, 0, 0.36, 0, 0.0);

    const distillery = createPaperCutLayer(
      { width: 2.05, height: 1.98, pxWidth: 520, pxHeight: 480, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawTorontoDistilleryCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(distillery, 1.92, 0, 0.72, -0.18, 0.06);

    const flatiron = createPaperCutLayer(
      { width: 1.55, height: 2.05, pxWidth: 420, pxHeight: 540, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawTorontoFlatironCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(flatiron, -2.02, 0, 0.96, 0.18, 0.08);

    // Classic Red TTC Streetcar orbiting cleanly outside tree on elliptical rail
    const streetcar = createPaperCutLayer(
      { width: 1.18, height: 0.74, pxWidth: 480, pxHeight: 290, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawTorontoStreetcarCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(streetcar, 1.58, 0.01, 1.62, 0, 0.16);
    this.animated.streetcar = streetcar;

    // Cute storybook Toronto Raccoon with curved striped tail, bandit mask, toque & hot cocoa
    const raccoonCluster = createPaperCutLayer(
      { width: 1.82, height: 1.42, pxWidth: 500, pxHeight: 380, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawTorontoRaccoonCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(raccoonCluster, -2.02, 0, 2.42, 0.24, 0.16);
    this.animated.swayGroup = raccoonCluster;

    this.mountForegroundProps(
      theme.cardPaper,
      (ctx, w, h) => drawTorontoLampPostCutout(ctx, w, h, theme),
      (ctx, w, h) => drawTorontoCocoaStandCutout(ctx, w, h, theme)
    );
  }

  private buildVancouverPaperCuts(theme: (typeof CITY_THEMES)['vancouver']): void {
    const t = this.trackTex.bind(this);
    const m = this.trackMat.bind(this);

    const mtns = createPaperCutLayer(
      { width: 5.5, height: 3.1, pxWidth: 960, pxHeight: 540, borderPx: 7, paperColor: theme.cardPaper },
      (ctx, w, h) => drawVancouverMountainsAndSails(ctx, w, h),
      t,
      m
    );
    this.addCutout(mtns, 0, 0, 0.18, 0, 0.0);

    // Architectural Lions Gate Suspension Bridge set cleanly behind the tree tiers (zero Z-clipping)
    const bridge = createPaperCutLayer(
      { width: 5.1, height: 2.38, pxWidth: 920, pxHeight: 430, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawLionsGateBridgeCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(bridge, 0, 0, 0.37, 0, 0.08);

    const clock = createPaperCutLayer(
      { width: 1.25, height: 2.05, pxWidth: 340, pxHeight: 560, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawGastownSteamClockCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(clock, -1.96, 0, 2.15, 0.16, 0.14);

    // Random puffing steam emitter anchored at the top whistle nozzles of Gastown Steam Clock
    const steamAnchor = new THREE.Group();
    steamAnchor.position.set(0, 1.66, 0.03);
    clock.add(steamAnchor);
    const puffs: SteamPuffParticle[] = [];
    for (let i = 0; i < 7; i++) {
      const puffGroup = createPaperCutLayer(
        { width: 0.44, height: 0.34, pxWidth: 180, pxHeight: 140, borderPx: 4, paperColor: '#ffffff', depth: 0.018 },
        (ctx, w, h) => drawSteamPuffCutout(ctx, w, h),
        t,
        m
      );
      puffGroup.visible = false;
      steamAnchor.add(puffGroup);
      puffs.push({
        group: puffGroup,
        active: false,
        age: 0,
        duration: 1.8,
        vx: 0,
        vy: 0.65,
        vz: 0,
        spin: 0,
        maxScale: 0.9,
      });
    }
    this.animated.steamPuffs = puffs;
    this.nextSteamBurstAt = this.lastAnimTime + 0.15;

    // Standing coastal cedars on right
    const cedars = createPaperCutLayer(
      { width: 1.38, height: 1.32, pxWidth: 360, pxHeight: 350, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawVancouverCedarsCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(cedars, 1.98, 0, 2.12, -0.18, 0.16);

    // Flying Harbour Seaplane orbiting high around mountains & tree!
    const seaplane = createPaperCutLayer(
      { width: 1.05, height: 0.65, pxWidth: 320, pxHeight: 200, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawVancouverSeaplaneOnly(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(seaplane, 1.9, 2.62, 1.08, 0, 0.18);
    this.animated.seaplane = seaplane;

    this.mountForegroundProps(
      theme.cardPaper,
      (ctx, w, h) => drawVancouverPierLanternCutout(ctx, w, h, theme),
      (ctx, w, h) => drawVancouverBouldersCutout(ctx, w, h, theme)
    );
  }

  private buildBrusselsPaperCuts(theme: (typeof CITY_THEMES)['brussels']): void {
    const t = this.trackTex.bind(this);
    const m = this.trackMat.bind(this);

    const grandPlace = createPaperCutLayer(
      { width: 5.5, height: 3.35, pxWidth: 960, pxHeight: 620, borderPx: 7, paperColor: theme.cardPaper },
      (ctx, w, h) => drawBrusselsGrandPlaceBackdrop(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(grandPlace, 0, 0, 0.28, 0, 0.0);

    const atomium = createPaperCutLayer(
      { width: 1.74, height: 2.66, pxWidth: 460, pxHeight: 700, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawBrusselsAtomiumCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(atomium, -2.18, 0, 0.72, 0.16, 0.06);

    const guildhall = createPaperCutLayer(
      { width: 1.86, height: 2.15, pxWidth: 520, pxHeight: 580, borderPx: 6, paperColor: theme.cardPaper },
      (ctx, w, h) => drawBrusselsGuildhallCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(guildhall, 2.08, 0, 0.94, -0.22, 0.08);

    const beerFritesStand = createPaperCutLayer(
      { width: 1.44, height: 1.18, pxWidth: 420, pxHeight: 350, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawBrusselsBeerAndFritesCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(beerFritesStand, -2.06, 0, 2.22, 0.24, 0.14);

    const waffleStand = createPaperCutLayer(
      { width: 1.44, height: 1.15, pxWidth: 420, pxHeight: 340, borderPx: 5, paperColor: theme.cardPaper },
      (ctx, w, h) => drawBrusselsWaffleStandCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(waffleStand, 2.06, 0, 2.22, -0.24, 0.16);

    const cat = createPaperCutLayer(
      { width: 0.78, height: 0.92, pxWidth: 320, pxHeight: 380, borderPx: 5, paperColor: theme.cardPaper, depth: 0.028 },
      (ctx, w, h) => drawBrusselsSpottedCatCutout(ctx, w, h, theme),
      t,
      m
    );
    this.addCutout(cat, 0, 0.01, 2.94, 0.2, 0.18);
    this.animated.brusselsCat = cat;
    this.catRoam = {
      x: 0,
      z: 2.94,
      targetX: 0,
      targetZ: 2.94,
      speed: 0.22,
      pauseTimer: 0.35,
      stepPhase: 0,
      facingRight: true,
    };
    this.pickNextCatTarget(this.catRoam);

    this.mountForegroundProps(
      theme.cardPaper,
      (ctx, w, h) => drawBrusselsFrontBeerAndFriesProp(ctx, w, h, theme),
      (ctx, w, h) => drawBrusselsFrontWaffleProp(ctx, w, h, theme)
    );
  }

  private mountForegroundProps(
    paperColor: string,
    leftDraw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    rightDraw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): void {
    const t = this.trackTex.bind(this);
    const m = this.trackMat.bind(this);
    const leftProp = createPaperCutLayer(
      { width: 0.78, height: 0.72, pxWidth: 260, pxHeight: 240, borderPx: 5, paperColor, depth: 0.032 },
      leftDraw,
      t,
      m
    );
    this.addCutout(leftProp, -2.38, 0, 3.34, 0.26, 0.2);

    const rightProp = createPaperCutLayer(
      { width: 0.86, height: 0.62, pxWidth: 280, pxHeight: 200, borderPx: 5, paperColor, depth: 0.032 },
      rightDraw,
      t,
      m
    );
    this.addCutout(rightProp, 2.38, 0, 3.34, -0.26, 0.2);
  }

  private clearDynamicScene(): void {
    [this.deckGroup, this.coverHinge].forEach((grp) => {
      while (grp.children.length > 0) {
        grp.remove(grp.children[0]);
      }
    });

    for (let i = this.popStage.children.length - 1; i >= 0; i--) {
      const child = this.popStage.children[i];
      if (child !== this.treeMount) {
        this.popStage.remove(child);
      }
    }

    this.popCutouts.length = 0;
    this.coverBows.length = 0;
    this.animated.streetcar = undefined;
    this.animated.seaplane = undefined;
    this.animated.magpie = undefined;
    this.animated.brusselsCat = undefined;
    this.catRoam = null;
    this.animated.swayGroup = undefined;
    this.animated.steamPuffs = undefined;

    this.textures.forEach((t) => t.dispose());
    this.textures.length = 0;
    this.materials.forEach((m) => m.dispose());
    this.materials.length = 0;
  }

  private trackTex<T extends THREE.Texture>(t: T): T {
    t.anisotropy = 8;
    this.textures.push(t);
    return t;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  public dispose(): void {
    this.clearDynamicScene();
  }
}

(import.meta as unknown as { hot?: { accept: (cb: () => void) => void } }).hot?.accept(() => {
  window.location.reload();
});
