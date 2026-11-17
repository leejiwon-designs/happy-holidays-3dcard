import * as THREE from 'three';
import { createGouacheMaterial } from '../shaders/gouacheShaders';
import type { TreeHookSlot } from '../types/card';

export interface TreeBuildResult {
  group: THREE.Group;
  slots: TreeHookSlot[];
  slotMarkers: THREE.Mesh[];
  fairyBulbs: THREE.Mesh[];
  topperStar: THREE.Group;
  treeHullMeshes: THREE.Object3D[];
}

function makeZigZagShelfShape(outerR: number, points = 12): THREE.Shape {
  const shape = new THREE.Shape();
  const totalVerts = points * 2;
  for (let i = 0; i < totalVerts; i++) {
    const a = (i / totalVerts) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : outerR * 0.855;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function buildHolidayTree(): TreeBuildResult {
  const group = new THREE.Group();
  const slots: TreeHookSlot[] = [];
  const slotMarkers: THREE.Mesh[] = [];
  const fairyBulbs: THREE.Mesh[] = [];
  const treeHullMeshes: THREE.Object3D[] = [];

  const shelfGreenMat = createGouacheMaterial({
    color: '#216e45',
    shadowColor: '#15472d',
    rimColor: '#ccebd7',
    emissive: 0.14,
    rimStrength: 0.3,
  });

  const cutPaperEdgeMat = createGouacheMaterial({
    color: '#d4eee0',
    shadowColor: '#97c7ae',
    rimColor: '#ffffff',
    emissive: 0.18,
  });

  const spineDarkMat = createGouacheMaterial({
    color: '#1b5a39',
    shadowColor: '#123e27',
    rimColor: '#bfe6ce',
    emissive: 0.13,
  });

  const snowSpeckMat = createGouacheMaterial({
    color: '#ffffff',
    shadowColor: '#d9ebdf',
    emissive: 0.25,
  });

  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#bd8826',
    rimColor: '#fffce6',
    emissive: 0.2,
  });

  const spineH = 2.48;
  [0, Math.PI * 0.5, Math.PI * 0.25, -Math.PI * 0.25].forEach((rotY, idx) => {
    const finShape = new THREE.Shape();
    const baseHalf = idx < 2 ? 0.92 : 0.78;
    finShape.moveTo(-baseHalf, 0);
    finShape.lineTo(baseHalf, 0);
    finShape.lineTo(0.05, spineH);
    finShape.lineTo(-0.05, spineH);
    finShape.closePath();

    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.032,
      bevelEnabled: false,
    });
    finGeo.translate(0, 0, -0.016);
    const fin = new THREE.Mesh(finGeo, spineDarkMat);
    fin.rotation.y = rotY;
    group.add(fin);
    treeHullMeshes.push(fin);
  });

  // 7 stepped horizontal die-cut evergreen cardstock shelves stacked upward
  const tiers = [
    { y: 0.08, radius: 1.14, points: 14, thickness: 0.044 },
    { y: 0.42, radius: 0.99, points: 14, thickness: 0.044 },
    { y: 0.76, radius: 0.85, points: 12, thickness: 0.044 },
    { y: 1.1, radius: 0.71, points: 12, thickness: 0.042 },
    { y: 1.44, radius: 0.57, points: 10, thickness: 0.042 },
    { y: 1.78, radius: 0.44, points: 10, thickness: 0.04 },
    { y: 2.12, radius: 0.3, points: 8, thickness: 0.038 },
  ];

  tiers.forEach((tier, tIdx) => {
    const shelfShape = makeZigZagShelfShape(tier.radius, tier.points);

    const shelfGeo = new THREE.ExtrudeGeometry(shelfShape, {
      depth: tier.thickness,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
    });
    shelfGeo.rotateX(-Math.PI * 0.5);
    const shelf = new THREE.Mesh(shelfGeo, shelfGreenMat);
    shelf.position.set(0, tier.y, 0);
    group.add(shelf);
    treeHullMeshes.push(shelf);

    const rimPoints: THREE.Vector3[] = [];
    const totalVerts = tier.points * 2;
    const topY = tier.y + tier.thickness + 0.006;
    for (let i = 0; i <= totalVerts; i++) {
      const idx = i % totalVerts;
      const a = (idx / totalVerts) * Math.PI * 2;
      const r = idx % 2 === 0 ? tier.radius : tier.radius * 0.855;
      rimPoints.push(new THREE.Vector3(Math.cos(a) * r, topY, Math.sin(a) * r));
    }
    const rimGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(rimPoints, true, 'catmullrom', 0.05),
      totalVerts * 2,
      0.011,
      5,
      true
    );
    group.add(new THREE.Mesh(rimGeo, cutPaperEdgeMat));

    const dotCount = Math.max(4, Math.floor(tier.radius * 7));
    for (let d = 0; d < dotCount; d++) {
      const a = (d / dotCount) * Math.PI * 2 + tIdx * 0.7;
      const dr = tier.radius * (0.66 + (d % 3) * 0.08);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 6), snowSpeckMat);
      dot.position.set(Math.cos(a) * dr, topY + 0.002, Math.sin(a) * dr);
      group.add(dot);
    }
  });

  const peakShape = new THREE.Shape();
  peakShape.moveTo(-0.22, 0);
  peakShape.lineTo(0.22, 0);
  peakShape.lineTo(0, 0.44);
  peakShape.closePath();

  [0, Math.PI * 0.5].forEach((rotY) => {
    const peakGeo = new THREE.ExtrudeGeometry(peakShape, {
      depth: 0.032,
      bevelEnabled: false,
    });
    peakGeo.translate(0, 0, -0.016);
    const peak = new THREE.Mesh(peakGeo, shelfGreenMat);
    peak.position.set(0, 2.16, 0);
    peak.rotation.y = rotY;
    group.add(peak);
  });

  const topperStar = new THREE.Group();
  topperStar.position.set(0, 2.66, 0);

  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.25 : 0.105;
    const a = (i * Math.PI) / 5 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.048,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  starGeo.center();
  topperStar.add(new THREE.Mesh(starGeo, goldMat));
  group.add(topperStar);

  // 36 well-spaced 360° perch spots across Tiers 0-5 (front, left side, right side, and back!)
  const slotDefs: Array<{ tierIdx: number; angleDeg: number; radialFrac: number }> = [
    // Tier 0 bottom wide ledge (9 spots all around)
    { tierIdx: 0, angleDeg: -160, radialFrac: 0.78 },
    { tierIdx: 0, angleDeg: -120, radialFrac: 0.78 },
    { tierIdx: 0, angleDeg: -80, radialFrac: 0.79 },
    { tierIdx: 0, angleDeg: -40, radialFrac: 0.8 },
    { tierIdx: 0, angleDeg: 0, radialFrac: 0.8 },
    { tierIdx: 0, angleDeg: 40, radialFrac: 0.8 },
    { tierIdx: 0, angleDeg: 80, radialFrac: 0.79 },
    { tierIdx: 0, angleDeg: 120, radialFrac: 0.78 },
    { tierIdx: 0, angleDeg: 160, radialFrac: 0.78 },
    // Tier 1 ledge (8 spots all around)
    { tierIdx: 1, angleDeg: -156, radialFrac: 0.78 },
    { tierIdx: 1, angleDeg: -112, radialFrac: 0.78 },
    { tierIdx: 1, angleDeg: -68, radialFrac: 0.79 },
    { tierIdx: 1, angleDeg: -24, radialFrac: 0.8 },
    { tierIdx: 1, angleDeg: 24, radialFrac: 0.8 },
    { tierIdx: 1, angleDeg: 68, radialFrac: 0.79 },
    { tierIdx: 1, angleDeg: 112, radialFrac: 0.78 },
    { tierIdx: 1, angleDeg: 156, radialFrac: 0.78 },
    // Tier 2 ledge (7 spots all around)
    { tierIdx: 2, angleDeg: -152, radialFrac: 0.77 },
    { tierIdx: 2, angleDeg: -102, radialFrac: 0.77 },
    { tierIdx: 2, angleDeg: -52, radialFrac: 0.78 },
    { tierIdx: 2, angleDeg: 0, radialFrac: 0.78 },
    { tierIdx: 2, angleDeg: 52, radialFrac: 0.78 },
    { tierIdx: 2, angleDeg: 102, radialFrac: 0.77 },
    { tierIdx: 2, angleDeg: 152, radialFrac: 0.77 },
    // Tier 3 ledge (6 spots all around)
    { tierIdx: 3, angleDeg: -150, radialFrac: 0.77 },
    { tierIdx: 3, angleDeg: -90, radialFrac: 0.77 },
    { tierIdx: 3, angleDeg: -30, radialFrac: 0.78 },
    { tierIdx: 3, angleDeg: 30, radialFrac: 0.78 },
    { tierIdx: 3, angleDeg: 90, radialFrac: 0.77 },
    { tierIdx: 3, angleDeg: 150, radialFrac: 0.77 },
    // Tier 4 ledge (4 spots all around)
    { tierIdx: 4, angleDeg: -135, radialFrac: 0.75 },
    { tierIdx: 4, angleDeg: -45, radialFrac: 0.76 },
    { tierIdx: 4, angleDeg: 45, radialFrac: 0.76 },
    { tierIdx: 4, angleDeg: 135, radialFrac: 0.75 },
    // Tier 5 upper ledge (2 spots: front & back)
    { tierIdx: 5, angleDeg: 8, radialFrac: 0.75 },
    { tierIdx: 5, angleDeg: 172, radialFrac: 0.74 },
  ];

  const perchRingMat = createGouacheMaterial({
    color: '#ffe066',
    shadowColor: '#cc8f26',
    emissive: 0.4,
    opacity: 0.45,
    transparent: true,
    depthWrite: false,
  });

  slotDefs.forEach((def, index) => {
    const tier = tiers[def.tierIdx];
    const topY = tier.y + tier.thickness + 0.008;
    const rad = (def.angleDeg * Math.PI) / 180;
    const r = tier.radius * def.radialFrac;
    const hx = Math.sin(rad) * r;
    const hz = Math.cos(rad) * r;

    slots.push({
      index,
      position: [hx, topY, hz],
      outwardAngle: rad,
      tier: def.tierIdx,
    });

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.042, 0.078, 18),
      perchRingMat.clone()
    );
    marker.rotation.x = -Math.PI * 0.5;
    marker.position.set(hx, topY + 0.004, hz);
    marker.userData.slotIndex = index;
    group.add(marker);
    slotMarkers.push(marker);
  });

  return {
    group,
    slots,
    slotMarkers,
    fairyBulbs,
    topperStar,
    treeHullMeshes,
  };
}
