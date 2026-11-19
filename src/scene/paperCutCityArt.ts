import * as THREE from 'three';
import { createGouacheMaterial } from '../shaders/gouacheShaders';
import type { CityTheme } from '../types/card';

export interface PaperCutOptions {
  width: number;
  height: number;
  pxWidth?: number;
  pxHeight?: number;
  borderPx?: number;
  paperColor?: string;
  depth?: number;
}

function finalizeDieCutTexture(
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  pxW: number,
  pxH: number,
  borderPx: number,
  paperColor: string
): { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement } {
  const artCanvas = document.createElement('canvas');
  artCanvas.width = pxW;
  artCanvas.height = pxH;
  const artCtx = artCanvas.getContext('2d')!;
  drawFn(artCtx, pxW, pxH);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = pxW;
  maskCanvas.height = pxH;
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCtx.drawImage(artCanvas, 0, 0);
  maskCtx.globalCompositeOperation = 'source-in';
  maskCtx.fillStyle = paperColor;
  maskCtx.fillRect(0, 0, pxW, pxH);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = pxW;
  outCanvas.height = pxH;
  const outCtx = outCanvas.getContext('2d')!;

  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    outCtx.drawImage(maskCanvas, Math.cos(a) * borderPx, Math.sin(a) * borderPx);
  }
  outCtx.drawImage(artCanvas, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { texture: tex, canvas: outCanvas };
}

function buildPaperThicknessGeometry(
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  halfDepth: number
): THREE.BufferGeometry {
  const maxGrid = 176;
  const aspect = sourceCanvas.width / Math.max(1, sourceCanvas.height);
  const gw = aspect >= 1 ? maxGrid : Math.max(24, Math.round(maxGrid * aspect));
  const gh = aspect >= 1 ? Math.max(24, Math.round(maxGrid / aspect)) : maxGrid;
  const W = gw + 2;
  const H = gh + 2;

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = W;
  sampleCanvas.height = H;
  const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  // Pad with 1 transparent pixel ring so shapes touching canvas edges always close cleanly
  sCtx.drawImage(sourceCanvas, 1, 1, gw, gh);
  const rgba = sCtx.getImageData(0, 0, W, H).data;

  // Light 3x3 Gaussian-like alpha smoothing removes single-pixel stairs before sub-cell tracing
  const rawAlpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) rawAlpha[i] = rgba[i * 4 + 3];
  const alpha = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      alpha[idx] =
        (rawAlpha[idx] * 4 +
          (rawAlpha[idx - 1] + rawAlpha[idx + 1] + rawAlpha[idx - W] + rawAlpha[idx + W]) * 2 +
          (rawAlpha[idx - W - 1] + rawAlpha[idx - W + 1] + rawAlpha[idx + W - 1] + rawAlpha[idx + W + 1])) /
        16;
    }
  }

  const threshold = 160;
  const interp = (v0: number, v1: number) => {
    const denom = v1 - v0;
    if (Math.abs(denom) < 1e-4) return 0.5;
    return Math.max(0.02, Math.min(0.98, (threshold - v0) / denom));
  };

  const gridToLocal = (gx: number, gy: number): [number, number] => {
    const u = Math.max(0.001, Math.min(0.999, (gx - 0.5) / gw));
    const v = Math.max(0.001, Math.min(0.999, (gy - 0.5) / gh));
    return [(u - 0.5) * width, (1 - v) * height];
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const d = halfDepth * 0.992;

  const pushSideQuad = (
    gx0: number,
    gy0: number,
    gx1: number,
    gy1: number,
    outX: number,
    outY: number
  ) => {
    let [x0, y0] = gridToLocal(gx0, gy0);
    let [x1, y1] = gridToLocal(gx1, gy1);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-5) return;

    // Choose edge perpendicular aligned with negative alpha gradient (outward from solid)
    let nx = dy / len;
    let ny = -dx / len;
    if (nx * outX + ny * outY < 0) {
      nx = -nx;
      ny = -ny;
    }

    // Ensure quad triangles wind CCW when viewed from +normal
    if (-dy * nx + dx * ny < 0) {
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }

    positions.push(
      x0, y0, d,
      x1, y1, d,
      x1, y1, -d,
      x0, y0, d,
      x1, y1, -d,
      x0, y0, -d
    );
    for (let k = 0; k < 6; k++) normals.push(nx, ny, 0);
  };

  // Marching Squares lookup table of edge index pairs (0=top, 1=right, 2=bottom, 3=left)
  const MS_TABLE: number[][] = [
    [],             // 0
    [3, 2],         // 1
    [2, 1],         // 2
    [3, 1],         // 3
    [1, 0],         // 4
    [],             // 5 (saddle)
    [2, 0],         // 6
    [3, 0],         // 7
    [0, 3],         // 8
    [0, 2],         // 9
    [],             // 10 (saddle)
    [0, 1],         // 11
    [1, 3],         // 12
    [1, 2],         // 13
    [2, 3],         // 14
    [],             // 15
  ];

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const aTL = alpha[y * W + x];
      const aTR = alpha[y * W + (x + 1)];
      const aBR = alpha[(y + 1) * W + (x + 1)];
      const aBL = alpha[(y + 1) * W + x];

      const mask =
        (aTL >= threshold ? 8 : 0) |
        (aTR >= threshold ? 4 : 0) |
        (aBR >= threshold ? 2 : 0) |
        (aBL >= threshold ? 1 : 0);

      if (mask === 0 || mask === 15) continue;

      const edgePt = (e: number): [number, number] => {
        if (e === 0) return [x + interp(aTL, aTR), y];
        if (e === 1) return [x + 1, y + interp(aTR, aBR)];
        if (e === 2) return [x + interp(aBL, aBR), y + 1];
        return [x, y + interp(aTL, aBL)];
      };

      // Outward gradient (-dAlpha/dx, -dAlpha/dy in Y-up 3D coords)
      const outX = aTL + aBL - (aTR + aBR);
      const outY = aBL + aBR - (aTL + aTR);

      let edges: number[];
      if (mask === 5) {
        const center = (aTL + aTR + aBR + aBL) * 0.25;
        edges = center >= threshold ? [3, 0, 1, 2] : [0, 1, 2, 3];
      } else if (mask === 10) {
        const center = (aTL + aTR + aBR + aBL) * 0.25;
        edges = center >= threshold ? [0, 1, 2, 3] : [0, 3, 1, 2];
      } else {
        edges = MS_TABLE[mask];
      }

      for (let i = 0; i < edges.length; i += 2) {
        const [gx0, gy0] = edgePt(edges[i]);
        const [gx1, gy1] = edgePt(edges[i + 1]);
        pushSideQuad(gx0, gy0, gx1, gy1, outX, outY);
      }
    }
  }

  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  edgeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return edgeGeo;
}

export function createPaperCutLayer(
  opts: PaperCutOptions,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  trackTex: (t: THREE.Texture) => THREE.Texture,
  trackMat: (m: THREE.Material) => THREE.Material
): THREE.Group {
  const {
    width,
    height,
    pxWidth = 512,
    pxHeight = 512,
    borderPx = 6,
    paperColor = '#fcfaf4',
    depth = 0.044,
  } = opts;

  const { texture: tex, canvas: cutCanvas } = finalizeDieCutTexture(
    drawFn,
    pxWidth,
    pxHeight,
    borderPx,
    paperColor
  );
  trackTex(tex);
  const group = new THREE.Group();
  const halfDepth = depth * 0.5;

  const frontMat = trackMat(
    createGouacheMaterial({
      color: '#ffffff',
      shadowColor: '#dfd7cc',
      emissive: 0.24,
      rimStrength: 0.22,
      alphaTest: 0.42,
      map: tex,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
    })
  );

  const backMat = trackMat(
    createGouacheMaterial({
      color: '#ffffff',
      shadowColor: '#e2dbd0',
      emissive: 0.24,
      rimStrength: 0.22,
      alphaTest: 0.42,
      map: tex,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
    })
  );

  const sideMat = trackMat(
    createGouacheMaterial({
      color: paperColor,
      shadowColor: '#d5cec2',
      rimColor: '#ffffff',
      emissive: 0.2,
      rimStrength: 0.16,
      side: THREE.FrontSide,
    })
  );

  const frontGeo = new THREE.PlaneGeometry(width, height);
  frontGeo.translate(0, height * 0.5, 0);

  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.z = halfDepth;
  group.add(front);

  // Flip UVs horizontally on the back plane so back artwork aligns 1:1 with the 3D side walls & points in local +X when yawed 180 deg!
  const backGeo = frontGeo.clone();
  const backUv = backGeo.attributes.uv;
  for (let i = 0; i < backUv.count; i++) {
    backUv.setX(i, 1 - backUv.getX(i));
  }
  backUv.needsUpdate = true;

  const back = new THREE.Mesh(backGeo, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -halfDepth;
  group.add(back);

  const sideWallGeo = buildPaperThicknessGeometry(cutCanvas, width, height, halfDepth);
  if (sideWallGeo.getAttribute('position').count > 0) {
    group.add(new THREE.Mesh(sideWallGeo, sideMat));
  }

  return group;
}

function drawWreath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  green: string,
  red: string,
  gold: string
) {
  ctx.save();
  ctx.strokeStyle = green;
  ctx.lineWidth = r * 0.48;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = red;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx - r * 0.45, cy - r * 1.45);
  ctx.lineTo(cx - r * 0.3, cy - r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.45, cy - r * 1.45);
  ctx.lineTo(cx + r * 0.3, cy - r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLayeredPine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  color: string,
  snowColor = '#ffffff'
) {
  ctx.save();
  ctx.fillStyle = '#6c4938';
  ctx.fillRect(cx - w * 0.08, baseY - h * 0.18, w * 0.16, h * 0.18);

  for (let t = 0; t < 3; t++) {
    const ty = baseY - h * (0.14 + t * 0.24);
    const tw = w * (1 - t * 0.22);
    const th = h * 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, ty - th);
    ctx.lineTo(cx + tw * 0.5, ty);
    ctx.lineTo(cx - tw * 0.5, ty);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = snowColor;
    ctx.beginPath();
    ctx.moveTo(cx, ty - th);
    ctx.lineTo(cx + tw * 0.24, ty - th * 0.48);
    ctx.lineTo(cx, ty - th * 0.58);
    ctx.lineTo(cx - tw * 0.24, ty - th * 0.48);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ==================== SEOUL PAPER-CUT ARTWORK ==================== */

interface AlpinePeak {
  x0: number;
  y0: number;
  px: number;
  py: number;
  x1: number;
  y1: number;
  snowDrop: number;
}

function drawFacetedSnowyRange(
  ctx: CanvasRenderingContext2D,
  peaks: AlpinePeak[],
  bottomY: number,
  litColor: string,
  shadowColor: string,
  snowLitColor = '#ffffff',
  snowShadowColor = '#dce8f5'
) {
  if (peaks.length === 0) return;

  // Build unified outer mountain silhouette path cleanly
  const rangePath = new Path2D();
  rangePath.moveTo(peaks[0].x0, bottomY);
  rangePath.lineTo(peaks[0].x0, peaks[0].y0);
  peaks.forEach((p, idx) => {
    rangePath.lineTo(p.px, p.py);
    if (idx < peaks.length - 1) {
      rangePath.lineTo(p.x1, p.y1);
    }
  });
  const last = peaks[peaks.length - 1];
  rangePath.lineTo(last.x1, last.y1);
  rangePath.lineTo(last.x1, bottomY);
  rangePath.closePath();

  ctx.fillStyle = litColor;
  ctx.fill(rangePath);

  ctx.save();
  ctx.clip(rangePath);

  // Draw shaded right slope per peak along natural ridge spine + valley-clipped 2-tone glacier caps
  peaks.forEach((p) => {
    const spineBottomX = p.px + (p.x1 - p.px) * 0.24;
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x1 + 28, p.y1);
    ctx.lineTo(p.x1 + 28, bottomY + 10);
    ctx.lineTo(spineBottomX, bottomY + 10);
    ctx.closePath();
    ctx.fill();

    // Confine glacier cap between neighboring valleys with sculpted jagged snowline
    const capBottom = p.py + p.snowDrop;
    const capW = Math.max(p.x1 - p.px, p.px - p.x0) + 12;

    const snowPoly = new Path2D();
    snowPoly.moveTo(p.px - capW, p.py - 18);
    snowPoly.lineTo(p.px + capW, p.py - 18);
    snowPoly.lineTo(p.px + capW, capBottom);
    snowPoly.lineTo(p.px + capW * 0.36, capBottom - p.snowDrop * 0.24);
    snowPoly.lineTo(spineBottomX * 0.25 + p.px * 0.75, capBottom + p.snowDrop * 0.08);
    snowPoly.lineTo(p.px - capW * 0.32, capBottom - p.snowDrop * 0.22);
    snowPoly.lineTo(p.px - capW, capBottom);
    snowPoly.closePath();

    ctx.fillStyle = snowLitColor;
    ctx.fill(snowPoly);

    // Subtle cool glacier shadow on right half of the snowcap matching mountain ridge spine
    ctx.save();
    ctx.clip(snowPoly);
    ctx.fillStyle = snowShadowColor;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py - 18);
    ctx.lineTo(p.px + capW + 10, p.py - 18);
    ctx.lineTo(p.px + capW + 10, capBottom + 30);
    ctx.lineTo(spineBottomX * 0.35 + p.px * 0.65, capBottom + 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();
}

export function drawSeoulMountainsAndLotte(
  ctx: CanvasRenderingContext2D,
  _w: number,
  h: number,
  theme: CityTheme
) {
  // Scenic three-peak snowy Bukhansan granite range behind Gwanghwamun & N Seoul
  drawFacetedSnowyRange(
    ctx,
    [
      { x0: 26, y0: h - 18, px: 142, py: 175, x1: 230, y1: 292, snowDrop: 88 },
      { x0: 230, y0: 292, px: 318, py: 205, x1: 412, y1: 315, snowDrop: 74 },
      { x0: 412, y0: 315, px: 482, py: 252, x1: 545, y1: h - 18, snowDrop: 58 },
    ],
    h - 18,
    '#7490b3',
    '#4c6687',
    '#ffffff',
    '#dbe7f4'
  );

  // Right urban skyline silhouettes
  const bldgs = [
    [520, 320, 48, 174],
    [574, 285, 56, 209],
    [635, 340, 44, 154],
    [790, 310, 54, 184],
    [848, 345, 48, 149],
  ];
  bldgs.forEach(([bx, by, bw, bh], i) => {
    ctx.fillStyle = i % 2 === 0 ? '#8ba2bd' : '#6c85a3';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff0b3';
    for (let ry = by + 16; ry < h - 32; ry += 22) {
      ctx.fillRect(bx + 10, ry, bw - 20, 7);
    }
  });

  // Lotte World Tower
  const lx = 735;
  ctx.fillStyle = '#b9cfe6';
  ctx.beginPath();
  ctx.moveTo(lx - 42, h - 18);
  ctx.lineTo(lx - 10, 48);
  ctx.lineTo(lx, 24);
  ctx.lineTo(lx + 10, 48);
  ctx.lineTo(lx + 42, h - 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#89a8c9';
  ctx.beginPath();
  ctx.moveTo(lx, 24);
  ctx.lineTo(lx + 10, 48);
  ctx.lineTo(lx + 42, h - 18);
  ctx.lineTo(lx, h - 18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lx, 30);
  ctx.lineTo(lx, h - 20);
  ctx.stroke();

  ctx.fillStyle = theme.goldAccent;
  ctx.beginPath();
  ctx.arc(lx, 30, 8, 0, Math.PI * 2);
  ctx.fill();
}

export function drawNSeoulTowerCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  ctx.fillStyle = theme.greenAccent;
  ctx.beginPath();
  ctx.moveTo(28, h - 14);
  ctx.quadraticCurveTo(cx, h - 130, w - 28, h - 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 56, h - 62);
  ctx.quadraticCurveTo(cx, h - 134, cx + 56, h - 62);
  ctx.quadraticCurveTo(cx, h - 84, cx - 56, h - 62);
  ctx.fill();

  ctx.fillStyle = '#f2f5f9';
  ctx.fillRect(cx - 14, 155, 28, h - 220);
  ctx.fillStyle = '#c5d3e2';
  ctx.fillRect(cx, 155, 14, h - 220);

  ctx.fillStyle = '#4e637d';
  ctx.beginPath();
  ctx.moveTo(cx - 48, 128);
  ctx.lineTo(cx + 48, 128);
  ctx.lineTo(cx + 32, 165);
  ctx.lineTo(cx - 32, 165);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 42, 136, 84, 13);

  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? theme.redAccent : '#ffffff';
    ctx.fillRect(cx - 5, 34 + i * 16, 10, 16);
  }
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.arc(cx, 28, 8, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGwanghwamunChristmasCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;

  // Stepped stone fortress rampart base + left/right battlement merlons (yeojang)
  ctx.fillStyle = '#ede5da';
  ctx.fillRect(38, 252, w - 76, h - 266);

  // Crenellated fortress wall battlements left & right
  for (let x = 42; x <= w - 66; x += 28) {
    if (x > 96 && x < w - 120) continue;
    ctx.fillStyle = '#dfd5c6';
    ctx.fillRect(x, 236, 18, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, 232, 20, 5);
  }

  // Granite ashlar masonry blocks
  ctx.strokeStyle = '#cfc4b4';
  ctx.lineWidth = 2;
  for (let y = 276; y < h - 24; y += 22) {
    ctx.beginPath();
    ctx.moveTo(38, y);
    ctx.lineTo(w - 38, y);
    ctx.stroke();
    const off = (y / 22) % 2 === 0 ? 0 : 20;
    for (let x = 58 + off; x < w - 46; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(h - 14, y + 22));
      ctx.stroke();
    }
  }

  // Snowy stone balustrade along top terrace
  ctx.fillStyle = '#d9cfbf';
  ctx.fillRect(72, 240, w - 144, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(72, 235, w - 144, 6);

  // Three detailed stone arches with brass-studded crimson wooden palace doors + wreaths
  [-116, 0, 116].forEach((ox, idx) => {
    const gx = cx + ox;
    const gw = idx === 1 ? 64 : 50;
    const gh = idx === 1 ? 94 : 80;

    // Stone arch keystone frame
    ctx.fillStyle = '#c9bdb0';
    ctx.beginPath();
    ctx.arc(gx, h - 14 - gh + gw * 0.5, gw * 0.58, Math.PI, 0);
    ctx.lineTo(gx + gw * 0.58, h - 14);
    ctx.lineTo(gx - gw * 0.58, h - 14);
    ctx.closePath();
    ctx.fill();

    // Recessed wooden doors
    ctx.fillStyle = '#7c2929';
    ctx.beginPath();
    ctx.arc(gx, h - 14 - gh + gw * 0.5, gw * 0.48, Math.PI, 0);
    ctx.lineTo(gx + gw * 0.48, h - 14);
    ctx.lineTo(gx - gw * 0.48, h - 14);
    ctx.closePath();
    ctx.fill();

    // Door center seam & golden brass studs
    ctx.strokeStyle = '#471515';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, h - 14 - gh + gw * 0.45);
    ctx.lineTo(gx, h - 14);
    ctx.stroke();

    ctx.fillStyle = theme.goldAccent;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(gx + s * 7, h - 46, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Hanging Christmas wreath above each arch
    drawWreath(ctx, gx, 286, 16, theme.greenAccent, theme.redAccent, theme.goldAccent);
  });

  // Two-story Crimson Pavilion Hall + Lattice Changhoji Doors + Dancheong Brackets
  // Lower pavilion story
  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(112, 166, w - 224, 72);
  // Upper pavilion story
  ctx.fillStyle = '#be2b35';
  ctx.fillRect(148, 102, w - 296, 66);

  // Glowing golden palace lattice windows
  [-110, -55, 0, 55, 110].forEach((wx) => {
    ctx.fillStyle = '#ffecad';
    ctx.fillRect(cx + wx - 14, 184, 28, 36);
    ctx.strokeStyle = '#6b2a29';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(cx + wx - 14, 184, 28, 36);
    ctx.beginPath();
    ctx.moveTo(cx + wx, 184);
    ctx.lineTo(cx + wx, 220);
    ctx.moveTo(cx + wx - 14, 202);
    ctx.lineTo(cx + wx + 14, 202);
    ctx.stroke();
  });

  // Crimson structural pillars across both tiers
  ctx.fillStyle = '#991f2a';
  [-165, -82, 0, 82, 165].forEach((px) => {
    ctx.fillRect(cx + px - 5, 166, 10, 72);
  });
  [-120, -40, 40, 120].forEach((px) => {
    ctx.fillRect(cx + px - 4, 102, 8, 66);
  });

  // Multi-stripe Dancheong bracket cornices under both roofs (jade-green, crimson, cobalt, gold)
  [168, 104].forEach((by, ti) => {
    const bw = ti === 0 ? w - 188 : w - 248;
    ctx.fillStyle = '#277d54';
    ctx.fillRect(cx - bw * 0.5, by, bw, 10);
    ctx.fillStyle = '#4776b8';
    ctx.fillRect(cx - bw * 0.5 + 8, by + 10, bw - 16, 6);
    ctx.fillStyle = theme.goldAccent;
    for (let dx = cx - bw * 0.5 + 14; dx < cx + bw * 0.5 - 12; dx += 18) {
      ctx.fillRect(dx, by + 3, 9, 5);
    }
  });

  // Festive holly garland draped across pavilion railing
  ctx.strokeStyle = theme.greenAccent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(114, 232);
  ctx.quadraticCurveTo(cx - 95, 250, cx, 232);
  ctx.quadraticCurveTo(cx + 95, 250, w - 114, 232);
  ctx.stroke();

  // Ornate Giwa Tiled Roofs with vertical rib lines, ridge finials & thick snow!
  const drawDetailedGiwaRoof = (ry: number, rw: number, rh: number) => {
    ctx.fillStyle = '#334359';
    ctx.beginPath();
    ctx.moveTo(cx - rw, ry + 14);
    ctx.quadraticCurveTo(cx - rw * 0.5, ry + 8, cx, ry - rh);
    ctx.quadraticCurveTo(cx + rw * 0.5, ry + 8, cx + rw, ry + 14);
    ctx.quadraticCurveTo(cx + rw * 0.55, ry + 34, cx, ry + 26);
    ctx.quadraticCurveTo(cx - rw * 0.55, ry + 34, cx - rw, ry + 14);
    ctx.closePath();
    ctx.fill();

    // Tiled roof vertical rib lines
    ctx.strokeStyle = '#506480';
    ctx.lineWidth = 2;
    for (let rx = -rw * 0.78; rx <= rw * 0.78; rx += 20) {
      ctx.beginPath();
      ctx.moveTo(cx + rx, ry + 22);
      ctx.lineTo(cx + rx * 0.65, ry - rh * 0.4);
      ctx.stroke();
    }

    // Golden Yongmaru end finials (chimi)
    ctx.fillStyle = theme.goldAccent;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(cx + s * (rw * 0.94), ry + 9, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Snow cap along roof top
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - rw * 0.92, ry + 8);
    ctx.quadraticCurveTo(cx - rw * 0.44, ry + 2, cx, ry - rh - 3);
    ctx.quadraticCurveTo(cx + rw * 0.44, ry + 2, cx + rw * 0.92, ry + 8);
    ctx.quadraticCurveTo(cx + rw * 0.42, ry - 5, cx, ry - rh + 13);
    ctx.quadraticCurveTo(cx - rw * 0.42, ry - 5, cx - rw * 0.92, ry + 8);
    ctx.closePath();
    ctx.fill();
  };

  drawDetailedGiwaRoof(164, 212, 42);
  drawDetailedGiwaRoof(96, 162, 46);

  // Gold & Ink Royal Gwanghwamun Signboard Plaque centered beneath upper roof
  ctx.fillStyle = '#2d221d';
  ctx.fillRect(cx - 32, 114, 64, 24);
  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 32, 114, 64, 24);
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 18, 124, 36, 4);
}

export function drawSeoulBridgeCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  ctx.fillStyle = '#9aaabe';
  ctx.beginPath();
  ctx.moveTo(28, h - 18);
  ctx.lineTo(28, 118);
  ctx.quadraticCurveTo(w * 0.5, 68, w - 28, 126);
  ctx.lineTo(w - 28, h - 18);
  ctx.lineTo(w - 75, h - 18);
  ctx.arc(w - 115, h - 18, 40, 0, Math.PI, true);
  ctx.lineTo(w * 0.5 + 48, h - 18);
  ctx.arc(w * 0.5, h - 18, 48, 0, Math.PI, true);
  ctx.lineTo(155, h - 18);
  ctx.arc(115, h - 18, 40, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#536880';
  ctx.lineWidth = 6;
  [115, w - 115].forEach((ax) => {
    ctx.beginPath();
    ctx.arc(ax, h - 18, 40, Math.PI, 0);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.arc(w * 0.5, h - 18, 48, Math.PI, 0);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(30, 114);
  ctx.quadraticCurveTo(w * 0.5, 64, w - 30, 122);
  ctx.stroke();

  [90, 175, 260, 345, 425].forEach((px, i) => {
    const t = px / w;
    const py = 114 * (1 - t) * (1 - t) + 64 * 2 * (1 - t) * t + 122 * t * t;
    ctx.fillStyle = '#4e637a';
    ctx.fillRect(px - 4, py - 24, 8, 24);
    ctx.fillStyle = i % 2 === 0 ? theme.redAccent : theme.goldAccent;
    ctx.beginPath();
    ctx.arc(px, py - 28, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawSeoulHanbokAndTreesCutout(
  ctx: CanvasRenderingContext2D,
  _w: number,
  h: number,
  theme: CityTheme
) {
  drawLayeredPine(ctx, 118, h - 22, 140, 285, theme.greenAccent);
  drawLayeredPine(ctx, 196, h - 18, 110, 225, '#2b8a5c');

  ctx.fillStyle = theme.redAccent;
  [
    [82, h - 180],
    [140, h - 210],
    [190, h - 155],
    [115, h - 135],
  ].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  const hx = 328;
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.moveTo(hx - 16, h - 115);
  ctx.lineTo(hx + 16, h - 115);
  ctx.lineTo(hx + 38, h - 20);
  ctx.lineTo(hx - 38, h - 20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(hx - 34, h - 30, 68, 5);

  ctx.fillStyle = theme.greenAccent;
  ctx.beginPath();
  ctx.moveTo(hx - 24, h - 146);
  ctx.lineTo(hx + 24, h - 146);
  ctx.lineTo(hx + 18, h - 114);
  ctx.lineTo(hx - 18, h - 114);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fae0cc';
  ctx.beginPath();
  ctx.arc(hx, h - 168, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#262936';
  ctx.beginPath();
  ctx.arc(hx, h - 174, 18, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.arc(hx, h - 189, 6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSeoulMagpieOnly(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  // Graceful flying Korean magpie (kkachi) with generous margins so white paper halo never clips when flipped
  ctx.save();
  ctx.translate(w * 0.52, h * 0.56);
  const sc = Math.min(w / 320, h / 220) * 0.94;
  ctx.scale(sc, sc);

  // Back wing swept upward
  ctx.fillStyle = '#1f2636';
  ctx.beginPath();
  ctx.moveTo(-10, -8);
  ctx.bezierCurveTo(-42, -78, -96, -72, -108, -28);
  ctx.bezierCurveTo(-72, -16, -34, -6, -8, 4);
  ctx.closePath();
  ctx.fill();

  // Iconic bold white wing-bar patch on back wing
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-56, -36, 26, 11, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Long fanned iridescent blue-black tail feathers sweeping left
  ctx.fillStyle = '#1b273b';
  ctx.beginPath();
  ctx.moveTo(-18, 4);
  ctx.lineTo(-118, 16);
  ctx.lineTo(-114, 32);
  ctx.lineTo(-16, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2b4768';
  ctx.beginPath();
  ctx.moveTo(-20, 8);
  ctx.lineTo(-108, 28);
  ctx.lineTo(-100, 38);
  ctx.lineTo(-16, 16);
  ctx.closePath();
  ctx.fill();

  // Sleek body + snowy white breast belly
  ctx.fillStyle = '#202636';
  ctx.beginPath();
  ctx.ellipse(6, 4, 34, 18, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(8, 10, 23, 12, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Front wing arched high with white primary flash
  ctx.fillStyle = '#26324a';
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.bezierCurveTo(-14, -68, 38, -82, 60, -40);
  ctx.bezierCurveTo(38, -16, 18, -4, 2, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(22, -38, 18, 9, -0.45, 0, Math.PI * 2);
  ctx.fill();

  // Head & expressive eye
  ctx.fillStyle = '#1c2230';
  ctx.beginPath();
  ctx.arc(40, -8, 15, 0, Math.PI * 2);
  ctx.fill();

  // Beak holding festive holly berry sprig
  ctx.fillStyle = '#3c4252';
  ctx.beginPath();
  ctx.moveTo(52, -12);
  ctx.lineTo(76, -6);
  ctx.lineTo(52, -2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(44, -11, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#11141c';
  ctx.beginPath();
  ctx.arc(45, -11, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Tiny holly leaves & winter berries in beak
  ctx.fillStyle = theme.greenAccent;
  ctx.beginPath();
  ctx.ellipse(78, -2, 10, 5, 0.5, 0, Math.PI * 2);
  ctx.ellipse(82, -10, 9, 4.5, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.arc(76, -5, 4.5, 0, Math.PI * 2);
  ctx.arc(84, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSeoulHaechiCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5 - 12;
  // Snowy Korean pine beside Haechi
  drawLayeredPine(ctx, cx + 88, h - 18, 92, 165, theme.greenAccent);

  // Seoul's iconic joyful Haechi guardian lion (warm apricot-gold coat, jade mane swirls, horn & red Christmas bell collar!)
  // Curly cloud tail
  ctx.fillStyle = '#6fb8a8';
  ctx.beginPath();
  ctx.arc(cx - 56, h - 62, 22, 0, Math.PI * 2);
  ctx.arc(cx - 66, h - 84, 15, 0, Math.PI * 2);
  ctx.fill();

  // Plump seated Haechi body
  ctx.fillStyle = '#f2be7a';
  ctx.beginPath();
  ctx.ellipse(cx - 8, h - 68, 46, 52, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cream belly + jade wing scales on hip
  ctx.fillStyle = '#fff5dc';
  ctx.beginPath();
  ctx.ellipse(cx - 4, h - 62, 24, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6fb8a8';
  ctx.beginPath();
  ctx.ellipse(cx - 32, h - 72, 14, 22, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Sturdy front paws
  [-22, 10].forEach((px) => {
    ctx.fillStyle = '#f2be7a';
    ctx.beginPath();
    ctx.ellipse(cx + px, h - 25, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Curly jade-teal lion mane halo behind head
  ctx.fillStyle = '#5da898';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 34, h - 134 + Math.sin(a) * 30, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheerful Haechi rounded head
  ctx.fillStyle = '#f5c787';
  ctx.beginPath();
  ctx.ellipse(cx, h - 134, 34, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iconic small central Haechi horn
  ctx.fillStyle = theme.goldAccent;
  ctx.beginPath();
  ctx.moveTo(cx - 7, h - 160);
  ctx.lineTo(cx, h - 184);
  ctx.lineTo(cx + 7, h - 160);
  ctx.closePath();
  ctx.fill();

  // Expressive eyes, round nose, and big happy toothy smile!
  ctx.fillStyle = '#252836';
  ctx.beginPath();
  ctx.arc(cx - 13, h - 139, 4.5, 0, Math.PI * 2);
  ctx.arc(cx + 13, h - 139, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b54d40';
  ctx.beginPath();
  ctx.ellipse(cx, h - 129, 8, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big cheerful grin + tiny cute fangs
  ctx.fillStyle = '#752424';
  ctx.beginPath();
  ctx.arc(cx, h - 120, 14, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 10, h - 120);
  ctx.lineTo(cx - 6, h - 113);
  ctx.lineTo(cx - 2, h - 120);
  ctx.moveTo(cx + 2, h - 120);
  ctx.lineTo(cx + 6, h - 113);
  ctx.lineTo(cx + 10, h - 120);
  ctx.fill();

  // Festive holly-red collar & gold bell
  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(cx - 26, h - 104, 52, 11);
  ctx.fillStyle = theme.goldAccent;
  ctx.beginPath();
  ctx.arc(cx, h - 92, 8, 0, Math.PI * 2);
  ctx.fill();
}

/* ==================== TORONTO PAPER-CUT ARTWORK ==================== */

export function drawTorontoSkylineAndCN(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const baseY = h - 18;
  const sx = w / 960;
  const sy = h / 680;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;

  const drawWindowGrid = (
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    cols: number,
    rowStep: number,
    litColor = '#ffe89c',
    dimColor = 'rgba(255, 255, 255, 0.14)'
  ) => {
    const padX = Math.max(4, rw * 0.12);
    const gapX = 4 * sx;
    const cellW = Math.max(3, (rw - padX * 2 - gapX * (cols - 1)) / cols);
    for (let wy = ry + 14 * sy; wy < ry + rh - 18 * sy; wy += rowStep * sy) {
      for (let c = 0; c < cols; c++) {
        const seed = Math.abs(Math.sin(wy * 0.37 + c * 3.17 + rx * 0.11));
        ctx.fillStyle = seed > 0.36 ? litColor : dimColor;
        ctx.fillRect(rx + padX + c * (cellW + gapX), wy, cellW, Math.max(4, 6 * sy));
      }
    }
  };

  // 1. Background misty Harbourfront & Financial mid-rises
  const bgTowers: Array<[number, number, number, string]> = [
    [26, 56, 260, '#6e8bb0'],
    [194, 62, 310, '#627fa6'],
    [400, 54, 340, '#5a769c'],
    [594, 52, 350, '#5c78a0'],
    [862, 68, 290, '#6e8bb0'],
  ];
  bgTowers.forEach(([bx, bw, bh, col]) => {
    ctx.fillStyle = col;
    ctx.fillRect(X(bx), baseY - Y(bh), X(bw), Y(bh));
    drawWindowGrid(X(bx), baseY - Y(bh), X(bw), Y(bh), 3, 20, '#f7df94', 'rgba(255,255,255,0.1)');
  });

  // 2. First Canadian Place (ultra-tall iconic white marble striped BMO tower + spire)
  const fcpX = X(336);
  const fcpW = X(78);
  const fcpH = Y(540);
  const fcpY = baseY - fcpH;
  ctx.fillStyle = '#e7eff8';
  ctx.fillRect(fcpX, fcpY, fcpW, fcpH);
  // Subtle chamfered corner & vertical ribs
  ctx.fillStyle = '#cbd9eb';
  ctx.fillRect(fcpX + fcpW - X(16), fcpY, X(16), fcpH);
  ctx.fillStyle = '#9bb2cf';
  for (let i = 1; i <= 5; i++) {
    ctx.fillRect(fcpX + (fcpW * i) / 6, fcpY + Y(10), 1.5, fcpH - Y(14));
  }
  // Classic red/white FCP broadcast needle + frosted snow cap
  ctx.fillStyle = '#dce6f2';
  ctx.fillRect(fcpX + fcpW * 0.44, fcpY - Y(54), X(6), Y(54));
  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(fcpX + fcpW * 0.44, fcpY - Y(54), X(6), Y(16));
  drawWindowGrid(fcpX + X(4), fcpY + Y(16), fcpW - X(18), fcpH - Y(20), 4, 18, '#ffd977', '#7f99ba');

  // 3. TD Centre (Toronto-Dominion Bank Towers — unmistakable matte charcoal-black Mies van der Rohe slabs + emerald TD crown!)
  const tdTowers: Array<[number, number, number]> = [
    [438, 86, 512], // Flagship 56-storey TD Tower
    [532, 74, 442], // Royal Trust / TD North Tower
  ];
  tdTowers.forEach(([tx, tw, th], idx) => {
    const px = X(tx);
    const pw = X(tw);
    const ph = Y(th);
    const py = baseY - ph;
    ctx.fillStyle = idx === 0 ? '#242934' : '#2d3340';
    ctx.fillRect(px, py, pw, ph);
    // Steel bronze I-beam vertical ribs
    ctx.fillStyle = '#3b4252';
    for (let c = 1; c < 6; c++) {
      ctx.fillRect(px + (pw * c) / 6, py, 2, ph);
    }
    // Signature glowing Emerald-Green TD crown sign band!
    ctx.fillStyle = '#18b35a';
    ctx.fillRect(px + X(8), py + Y(12), pw - X(16), Y(14));
    ctx.fillStyle = '#d6ffe6';
    ctx.font = `700 ${Math.round(12 * sy)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('TD', px + pw * 0.5, py + Y(23));

    drawWindowGrid(px, py + Y(28), pw, ph - Y(32), idx === 0 ? 5 : 4, 17, '#ffe794', '#394150');
  });

  // 4. Scotia Plaza (tall crimson-rose granite tower with diagonal setback crown)
  const spX = X(626);
  const spW = X(74);
  const spH = Y(492);
  const spY = baseY - spH;
  ctx.fillStyle = '#8b434d';
  ctx.beginPath();
  ctx.moveTo(spX, baseY);
  ctx.lineTo(spX, spY + Y(44));
  ctx.lineTo(spX + spW * 0.45, spY);
  ctx.lineTo(spX + spW, spY);
  ctx.lineTo(spX + spW, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6f323b';
  ctx.fillRect(spX + spW - X(16), spY, X(16), spH);
  // Crisp snow cap ledge on Scotia setback
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(spX - 1, spY + Y(44));
  ctx.lineTo(spX + spW * 0.45, spY - 1);
  ctx.lineTo(spX + spW + 1, spY - 1);
  ctx.lineTo(spX + spW + 1, spY + Y(8));
  ctx.lineTo(spX + spW * 0.47, spY + Y(8));
  ctx.lineTo(spX + X(4), spY + Y(50));
  ctx.closePath();
  ctx.fill();
  drawWindowGrid(spX + X(4), spY + Y(46), spW - X(20), spH - Y(50), 4, 18, '#ffea9f', '#57282f');

  // 5. Royal Bank Plaza (iconic twin golden-glass faceted towers!)
  const rbcTowers: Array<[number, number, number]> = [
    [718, 66, 428],
    [792, 62, 344],
  ];
  rbcTowers.forEach(([rx, rw, rh]) => {
    const px = X(rx);
    const pw = X(rw);
    const ph = Y(rh);
    const py = baseY - ph;
    const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
    grad.addColorStop(0, '#f3ca6b');
    grad.addColorStop(0.55, '#c9933b');
    grad.addColorStop(1, '#8c5f21');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px, baseY);
    ctx.lineTo(px, py + Y(22));
    ctx.lineTo(px + pw * 0.5, py);
    ctx.lineTo(px + pw, py + Y(22));
    ctx.lineTo(px + pw, baseY);
    ctx.closePath();
    ctx.fill();
    drawWindowGrid(px, py + Y(26), pw, ph - Y(30), 3, 18, '#fff2b8', 'rgba(90, 58, 12, 0.35)');
  });

  // 6. CN Tower (tall left-of-center hero spire + Santa hat!)
  const cx = X(132);
  ctx.fillStyle = '#edf3fa';
  ctx.beginPath();
  ctx.moveTo(cx - X(40), baseY);
  ctx.lineTo(cx - X(13), Y(210));
  ctx.lineTo(cx + X(13), Y(210));
  ctx.lineTo(cx + X(40), baseY);
  ctx.closePath();
  ctx.fill();

  // Illuminated vertical elevator spine & red festive trim
  ctx.fillStyle = '#cfe0f0';
  ctx.fillRect(cx - X(5), Y(210), X(10), baseY - Y(210));

  // Rogers Centre (SkyDome) white ribbed roof tucking right beside CN Tower base
  ctx.fillStyle = '#e7eff8';
  ctx.beginPath();
  ctx.ellipse(cx + X(106), baseY - Y(4), X(74), Y(56), 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#9db5d1';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffe58f';
  for (let ax = -48; ax <= 48; ax += 24) {
    ctx.fillRect(cx + X(106 + ax - 6), baseY - Y(26), X(12), Y(16));
  }

  // CN Tower Main Observation Pod & 360 Restaurant
  ctx.fillStyle = '#dde7f2';
  ctx.beginPath();
  ctx.roundRect(cx - X(54), Y(172), X(108), Y(42), 16);
  ctx.fill();
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - X(50), Y(188), X(100), Y(12));

  // Upper Skypod & Antenna
  ctx.fillStyle = '#f5f8fc';
  ctx.fillRect(cx - X(9), Y(112), X(18), Y(62));
  ctx.fillStyle = '#d3e0ee';
  ctx.fillRect(cx - X(20), Y(114), X(40), Y(16));
  ctx.fillRect(cx - X(4), Y(46), X(8), Y(68));

  // Signature red Santa hat at top of CN Tower spire!
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.moveTo(cx - X(18), Y(52));
  ctx.lineTo(cx + X(22), Y(20));
  ctx.lineTo(cx + X(18), Y(52));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - X(20), Y(49), X(40), Y(10));
  ctx.beginPath();
  ctx.arc(cx + X(24), Y(21), X(8), 0, Math.PI * 2);
  ctx.fill();
}

export function drawTorontoFlatironCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(92, 148, w - 184, h - 165);
  ctx.fillStyle = '#a3232c';
  ctx.fillRect(cx + 18, 148, w * 0.5 - 110, h - 165);

  ctx.fillStyle = theme.greenAccent;
  ctx.beginPath();
  ctx.moveTo(cx - 64, 150);
  ctx.lineTo(cx, 54);
  ctx.lineTo(cx + 64, 150);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx, 54);
  ctx.lineTo(cx + 30, 100);
  ctx.lineTo(cx, 90);
  ctx.lineTo(cx - 30, 100);
  ctx.closePath();
  ctx.fill();

  for (let row = 0; row < 4; row++) {
    for (let col = -1; col <= 1; col++) {
      const wx = cx + col * 64;
      const wy = 182 + row * 66;
      ctx.fillStyle = '#fff0a8';
      ctx.beginPath();
      ctx.roundRect(wx - 16, wy, 32, 42, [14, 14, 2, 2]);
      ctx.fill();
    }
  }

  drawWreath(ctx, cx, h - 62, 22, theme.greenAccent, theme.redAccent, theme.goldAccent);
}

export function drawTorontoDistilleryCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  ctx.fillStyle = '#c9433d';
  ctx.beginPath();
  ctx.moveTo(64, h - 16);
  ctx.lineTo(64, 155);
  ctx.lineTo(cx, 92);
  ctx.lineTo(w - 64, 155);
  ctx.lineTo(w - 64, h - 16);
  ctx.lineTo(cx + 82, h - 16);
  ctx.arc(cx, h - 125, 82, 0, Math.PI, true);
  ctx.lineTo(cx - 82, h - 16);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(58, 158);
  ctx.lineTo(cx, 90);
  ctx.lineTo(w - 58, 158);
  ctx.stroke();

  drawWreath(ctx, cx, 150, 26, theme.greenAccent, theme.redAccent, theme.goldAccent);
  drawLayeredPine(ctx, w - 58, h - 18, 92, 180, theme.greenAccent);
}

export function drawTorontoStreetcarCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.roundRect(36, 98, w - 72, h - 134, 26);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(42, 128, w - 84, 62);
  ctx.fillRect(58, 86, w - 116, 16);

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#fff0a6';
    ctx.beginPath();
    ctx.roundRect(74 + i * 94, 138, 68, 42, 8);
    ctx.fill();
  }

  ctx.strokeStyle = '#47596e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 86);
  ctx.lineTo(w * 0.5 - 26, 56);
  ctx.lineTo(w * 0.5, 32);
  ctx.lineTo(w * 0.5 + 26, 56);
  ctx.closePath();
  ctx.stroke();

  [125, w - 125].forEach((wx) => {
    ctx.fillStyle = '#2c3745';
    ctx.beginPath();
    ctx.arc(wx, h - 32, 22, 0, Math.PI * 2);
    ctx.fill();
  });
  drawWreath(ctx, 74, h - 72, 18, theme.greenAccent, theme.redAccent, theme.goldAccent);
}

export function drawTorontoRaccoonCutout(
  ctx: CanvasRenderingContext2D,
  _w: number,
  h: number,
  theme: CityTheme
) {
  drawLayeredPine(ctx, 90, h - 18, 110, 232, theme.greenAccent);

  // Iconic round hunched wide-eyed Toronto raccoon standing on 4 skinny tapered black legs!
  const cx = 292;
  const by = h - 18;

  // 1. Short striped curve tail peeking up from left rear rump (clipped cleanly)
  ctx.save();
  const tailPath = new Path2D();
  tailPath.moveTo(cx - 56, by - 58);
  tailPath.bezierCurveTo(cx - 104, by - 66, cx - 106, by - 132, cx - 54, by - 144);
  tailPath.bezierCurveTo(cx - 32, by - 140, cx - 34, by - 96, cx - 44, by - 58);
  tailPath.closePath();
  ctx.fillStyle = '#7c7e83';
  ctx.fill(tailPath);
  ctx.clip(tailPath);
  ctx.fillStyle = '#2c2d31';
  [
    [cx - 82, by - 88],
    [cx - 80, by - 114],
    [cx - 66, by - 136],
  ].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 28, 8, -0.35, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 2. Four skinny grey-to-black tapered legs & tiny clawed feet underneath
  const drawLeg = (hipX: number, hipY: number, footX: number, footY: number, shade: string) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(hipX - 11, hipY);
    ctx.lineTo(hipX + 11, hipY);
    ctx.lineTo(footX + 3.5, footY - 22);
    ctx.lineTo(footX - 3.5, footY - 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#252629';
    ctx.beginPath();
    ctx.moveTo(footX - 3.5, footY - 22);
    ctx.lineTo(footX + 3.5, footY - 22);
    ctx.lineTo(footX + 8, footY);
    ctx.lineTo(footX - 2, footY);
    ctx.closePath();
    ctx.fill();
  };
  drawLeg(cx - 18, by - 44, cx - 22, by - 2, '#5c5e63');
  drawLeg(cx + 12, by - 46, cx + 10, by - 6, '#5c5e63');

  // 3. Giant arched hump-backed fuzzy spherical charcoal-grey body
  ctx.fillStyle = '#737479';
  ctx.beginPath();
  ctx.moveTo(cx - 66, by - 82);
  ctx.bezierCurveTo(cx - 72, by - 156, cx - 12, by - 178, cx + 38, by - 160);
  ctx.bezierCurveTo(cx + 76, by - 146, cx + 82, by - 72, cx + 48, by - 44);
  ctx.bezierCurveTo(cx + 12, by - 26, cx - 54, by - 34, cx - 66, by - 82);
  ctx.closePath();
  ctx.fill();

  // Subtle wispy fur strokes & soft lighter belly under-shading
  ctx.fillStyle = '#85868b';
  ctx.beginPath();
  ctx.ellipse(cx + 6, by - 78, 44, 34, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  for (let a = -2.4; a <= -0.35; a += 0.22) {
    const fx = cx - 4 + Math.cos(a) * 62;
    const fy = by - 96 + Math.sin(a) * 66;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(a) * 7, fy + Math.sin(a) * 7);
    ctx.stroke();
  }

  // Front legs overlapping tummy cleanly
  drawLeg(cx - 46, by - 44, cx - 52, by, '#737479');
  drawLeg(cx + 42, by - 48, cx + 52, by + 2, '#737479');

  // 4. Head perched slightly forward-right with rounded white-rimmed ears
  const hx = cx + 34;
  const hy = by - 102;

  [
    [-32, -26, -0.25],
    [28, -32, 0.25],
  ].forEach(([ex, ey, rot]) => {
    ctx.save();
    ctx.translate(hx + ex, hy + ey);
    ctx.rotate(rot);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-15, 8);
    ctx.quadraticCurveTo(-12, -22, 0, -24);
    ctx.quadraticCurveTo(14, -22, 15, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2d2e32';
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.quadraticCurveTo(-8, -14, 0, -16);
    ctx.quadraticCurveTo(8, -14, 10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Rounded raccoon head oval
  ctx.fillStyle = '#7d7f84';
  ctx.beginPath();
  ctx.ellipse(hx, hy, 48, 36, -0.06, 0, Math.PI * 2);
  ctx.fill();

  // Wide charcoal bandit mask sweeping to cheek points
  ctx.fillStyle = '#2d2e33';
  ctx.beginPath();
  ctx.moveTo(hx - 48, hy + 4);
  ctx.quadraticCurveTo(hx - 24, hy - 22, hx + 6, hy - 14);
  ctx.quadraticCurveTo(hx + 34, hy - 22, hx + 54, hy + 4);
  ctx.quadraticCurveTo(hx + 34, hy + 22, hx + 6, hy + 16);
  ctx.quadraticCurveTo(hx - 24, hy + 22, hx - 48, hy + 4);
  ctx.closePath();
  ctx.fill();

  // Crisp curved white eyebrow arcs above the mask
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hx - 14, hy + 3, 18, Math.PI * 1.15, Math.PI * 1.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx + 24, hy + 3, 17, Math.PI * 1.25, Math.PI * 1.85);
  ctx.stroke();

  // Signature sharp vertical charcoal forehead streak right between eyes
  ctx.fillStyle = '#232429';
  ctx.beginPath();
  ctx.moveTo(hx + 4, hy - 32);
  ctx.lineTo(hx + 12, hy - 2);
  ctx.lineTo(hx + 7, hy - 2);
  ctx.closePath();
  ctx.fill();

  // HUGE wide white-ringed round saucer eyes!
  [
    [hx - 11, hy + 2, 13.5, 10.2],
    [hx + 23, hy + 2, 13.5, 10.2],
  ].forEach(([ex, ey, rw, rb]) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, rw, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0c0d10';
    ctx.beginPath();
    ctx.arc(ex + 1.5, ey, rb, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 2.5, ey - 3.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Bright pointed white muzzle jutting slightly right + shiny black button nose
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(hx - 4, hy + 16);
  ctx.quadraticCurveTo(hx + 16, hy + 6, hx + 38, hy + 17);
  ctx.quadraticCurveTo(hx + 24, hy + 31, hx - 4, hy + 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#121316';
  ctx.beginPath();
  ctx.ellipse(hx + 30, hy + 17, 7.5, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.arc(hx + 27.5, hy + 15.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/* ==================== VANCOUVER PAPER-CUT ARTWORK ==================== */

export function drawVancouverMountainsAndSails(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  // Crisp layered North Shore peaks with sunlit/shaded alpine ridge geometry & aligned glacier caps
  drawFacetedSnowyRange(
    ctx,
    [
      { x0: 26, y0: h - 18, px: 162, py: 122, x1: 278, y1: 268, snowDrop: 108 },
      { x0: 278, y0: 268, px: 422, py: 72, x1: 562, y1: 252, snowDrop: 124 },
      { x0: 562, y0: 252, px: 688, py: 104, x1: 816, y1: 245, snowDrop: 106 },
      { x0: 816, y0: 245, px: 888, py: 174, x1: w - 26, y1: h - 18, snowDrop: 74 },
    ],
    h - 18,
    '#67949c',
    '#3e6a73',
    '#ffffff',
    '#d9eaf2'
  );

  // Canada Place harbour sails along bottom right
  for (let s = 0; s < 4; s++) {
    const sx = 635 + s * 62;
    ctx.fillStyle = s % 2 === 0 ? '#ffffff' : '#dceaf0';
    ctx.beginPath();
    ctx.moveTo(sx - 28, h - 18);
    ctx.lineTo(sx, h - 135);
    ctx.lineTo(sx + 28, h - 18);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawLionsGateBridgeCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const tx1 = 190;
  const tx2 = w - 190;
  const deckY = h - 122;
  const waterY = h - 38;

  // Coastal Burrard Inlet water base & pier foundations
  ctx.fillStyle = '#4e8ea3';
  ctx.fillRect(26, waterY, w - 52, 24);
  ctx.strokeStyle = '#cdeaf2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(46, waterY + 10);
  ctx.lineTo(w - 46, waterY + 10);
  ctx.stroke();

  // Concrete bridge tower piers resting in the inlet
  [tx1, tx2].forEach((tx) => {
    ctx.fillStyle = '#cfd7de';
    ctx.fillRect(tx - 38, deckY + 16, 76, waterY - deckY - 10);
  });

  // Main catenary gold-lit suspension cables dipping down to deck anchors
  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(32, deckY + 4);
  ctx.quadraticCurveTo(tx1 * 0.56, 175, tx1, 66);
  ctx.quadraticCurveTo(w * 0.5, 232, tx2, 66);
  ctx.quadraticCurveTo(w - tx1 * 0.56, 175, w - 32, deckY + 4);
  ctx.stroke();

  // Crisp vertical suspender hangers connecting STRICTLY between the catenary cable and the roadway deck!
  const evalCableY = (x: number): number => {
    if (x <= tx1) {
      const t = (x - 32) / (tx1 - 32);
      return (1 - t) * (1 - t) * (deckY + 4) + 2 * (1 - t) * t * 175 + t * t * 66;
    }
    if (x <= tx2) {
      const t = (x - tx1) / (tx2 - tx1);
      return (1 - t) * (1 - t) * 66 + 2 * (1 - t) * t * 232 + t * t * 66;
    }
    const t = (x - tx2) / (w - 32 - tx2);
    return (1 - t) * (1 - t) * 66 + 2 * (1 - t) * t * 175 + t * t * (deckY + 4);
  };

  ctx.strokeStyle = '#d7e3e0';
  ctx.lineWidth = 3;
  for (let x = 76; x <= w - 76; x += 28) {
    if (Math.abs(x - tx1) < 34 || Math.abs(x - tx2) < 34) continue;
    const cy = evalCableY(x);
    ctx.beginPath();
    ctx.moveTo(x, cy + 2);
    ctx.lineTo(x, deckY);
    ctx.stroke();
  }

  // Twin Art Deco Lions Gate emerald-green suspension towers with arched portals
  [tx1, tx2].forEach((tx) => {
    ctx.fillStyle = theme.greenAccent;
    ctx.fillRect(tx - 26, 64, 16, deckY + 18 - 64);
    ctx.fillRect(tx + 10, 64, 16, deckY + 18 - 64);
    // Stepped cross-portals
    ctx.fillRect(tx - 28, 72, 56, 16);
    ctx.fillRect(tx - 26, 134, 52, 16);
    ctx.fillRect(tx - 26, 200, 52, 14);
    // Crown beacons
    ctx.fillStyle = theme.goldAccent;
    ctx.beginPath();
    ctx.arc(tx - 18, 60, 6, 0, Math.PI * 2);
    ctx.arc(tx + 18, 60, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Solid bridge truss roadway deck + warm bridge streetlights + snow parapet
  ctx.fillStyle = '#365661';
  ctx.fillRect(24, deckY, w - 48, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(24, deckY - 5, w - 48, 6);

  ctx.fillStyle = theme.goldAccent;
  for (let lx = 58; lx <= w - 58; lx += 56) {
    ctx.beginPath();
    ctx.arc(lx, deckY - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGastownSteamClockCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Brass whistle nozzle crown on top of Gastown Steam Clock (dynamic steam puffs rise from here!)
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 12, 108, 24, 14);
  ctx.fillStyle = '#e8c45e';
  [-8, 0, 8].forEach((nx) => {
    ctx.beginPath();
    ctx.roundRect(cx + nx - 3, 94, 6, 16, 2);
    ctx.fill();
  });

  ctx.fillStyle = '#a3443c';
  ctx.fillRect(cx - 44, h - 98, 88, 82);
  ctx.fillStyle = theme.greenAccent;
  ctx.fillRect(cx - 34, 212, 68, h - 306);

  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 46, 152, 92, 66);
  ctx.beginPath();
  ctx.moveTo(cx - 42, 152);
  ctx.lineTo(cx, 118);
  ctx.lineTo(cx + 42, 152);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.arc(cx, 185, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2d3747';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, 185);
  ctx.lineTo(cx, 171);
  ctx.moveTo(cx, 185);
  ctx.lineTo(cx + 11, 185);
  ctx.stroke();

  drawWreath(ctx, cx, 260, 18, theme.greenAccent, theme.redAccent, theme.goldAccent);
}

export function drawVancouverCedarsCutout(
  ctx: CanvasRenderingContext2D,
  _w: number,
  h: number,
  theme: CityTheme
) {
  drawLayeredPine(ctx, 118, h - 18, 150, 290, theme.greenAccent);
  drawLayeredPine(ctx, 212, h - 18, 118, 230, '#2b825d');
}

export function drawVancouverSeaplaneOnly(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  const cy = h * 0.52;

  ctx.save();
  ctx.translate(cx, cy);
  // Crisp sky-teal & crimson coastal seaplane flying left
  ctx.fillStyle = '#4e96ad';
  ctx.beginPath();
  ctx.ellipse(0, 0, 88, 27, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-62, -5, 112, 9);

  // Cockpit glass & propeller blur
  ctx.fillStyle = '#243a52';
  ctx.beginPath();
  ctx.ellipse(-34, -10, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(-66, -42, 134, 17);
  ctx.beginPath();
  ctx.moveTo(56, -7);
  ctx.lineTo(90, -48);
  ctx.lineTo(90, 2);
  ctx.closePath();
  ctx.fill();

  // Pontoons & struts
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(-52, 34, 104, 13);
  ctx.strokeStyle = '#44596b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-25, 20);
  ctx.lineTo(-25, 34);
  ctx.moveTo(25, 20);
  ctx.lineTo(25, 34);
  ctx.stroke();
  ctx.restore();
}

export function drawSteamPuffCutout(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5;
  const cy = h * 0.52;

  // Soft icy-blue paper-cut shadow under the fluffy cloud puff
  ctx.fillStyle = '#dceaf2';
  ctx.beginPath();
  ctx.arc(cx - 22, cy + 12, 24, 0, Math.PI * 2);
  ctx.arc(cx + 22, cy + 14, 22, 0, Math.PI * 2);
  ctx.arc(cx, cy + 16, 28, 0, Math.PI * 2);
  ctx.fill();

  // Crisp fluffy white paper-cut cloud puff
  ctx.fillStyle = '#ffffff';
  [
    [cx - 26, cy + 4, 23],
    [cx + 24, cy + 6, 22],
    [cx - 10, cy - 12, 27],
    [cx + 14, cy - 10, 24],
    [cx, cy + 6, 26],
  ].forEach(([px, py, pr]) => {
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ==================== CITY-SPECIFIC FOREGROUND DECK PROPS ==================== */

export function drawTorontoLampPostCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Wrought-iron base & fluted winter streetlamp column
  ctx.fillStyle = '#253140';
  ctx.beginPath();
  ctx.moveTo(cx - 24, h - 16);
  ctx.lineTo(cx + 24, h - 16);
  ctx.lineTo(cx + 12, h - 68);
  ctx.lineTo(cx - 12, h - 68);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(cx - 6, 86, 12, h - 154);

  // Decorative cast-iron crossbar + hanging amber lantern head
  ctx.fillRect(cx - 22, 90, 44, 7);
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 18, 44, 36, 44);
  ctx.fillStyle = '#fff5bd';
  ctx.fillRect(cx - 13, 49, 26, 34);

  // Lantern spire roof topped with fresh snow puff
  ctx.fillStyle = '#253140';
  ctx.beginPath();
  ctx.moveTo(cx - 25, 44);
  ctx.lineTo(cx, 16);
  ctx.lineTo(cx + 25, 44);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 21, 41);
  ctx.lineTo(cx, 16);
  ctx.lineTo(cx + 18, 36);
  ctx.closePath();
  ctx.fill();

  drawWreath(ctx, cx, 124, 15, theme.greenAccent, theme.redAccent, theme.goldAccent);
}

export function drawTorontoCocoaStandCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Soft drifted snowbase mound
  ctx.fillStyle = '#eaf2fa';
  ctx.beginPath();
  ctx.ellipse(cx, h - 22, 74, 18, 0, Math.PI, 0);
  ctx.fill();

  // Wrapped crimson gift box with gold ribbon + bow on left
  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(cx - 58, h - 90, 62, 66);
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 33, h - 90, 12, 66);
  ctx.fillRect(cx - 58, h - 63, 62, 12);
  ctx.beginPath();
  ctx.arc(cx - 33, h - 95, 9, 0, Math.PI * 2);
  ctx.arc(cx - 21, h - 95, 9, 0, Math.PI * 2);
  ctx.fill();

  // Cozy striped hot-cocoa mug + cream marshmallow cap on right
  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(cx + 14, h - 66, 42, 42);
  ctx.fillStyle = theme.greenAccent;
  ctx.fillRect(cx + 14, h - 56, 42, 10);
  ctx.fillStyle = '#6c3e27';
  ctx.beginPath();
  ctx.ellipse(cx + 35, h - 66, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 29, h - 71, 6, 0, Math.PI * 2);
  ctx.arc(cx + 41, h - 71, 6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSeoulLanternCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Carved timber winter garden post with snow-capped top beam
  ctx.fillStyle = '#4e3529';
  ctx.fillRect(cx - 22, h - 24, 44, 14);
  ctx.fillRect(cx - 8, 42, 16, h - 66);
  ctx.fillRect(cx - 8, 38, 62, 13);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx + 22, 36, 30, 7, 0, Math.PI, 0);
  ctx.fill();

  // Traditional Korean cheongsachorong silk lantern hanging from beam
  const lx = cx + 34;
  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lx, 50);
  ctx.lineTo(lx, 74);
  ctx.stroke();

  ctx.fillStyle = '#d6333e';
  ctx.fillRect(lx - 20, 74, 40, 32);
  ctx.fillStyle = '#2d5fa6';
  ctx.fillRect(lx - 20, 106, 40, 32);

  // Warm inner candle glow window & gold tassels
  ctx.fillStyle = '#ffe999';
  ctx.fillRect(lx - 11, 86, 22, 40);
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(lx - 23, 70, 46, 7);
  ctx.fillRect(lx - 23, 136, 46, 7);
  ctx.fillRect(lx - 3, 143, 6, 22);
}

export function drawSeoulBokjumeoniCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Rounded coral-crimson Korean silk lucky pouch (bokjumeoni)
  ctx.fillStyle = '#d63344';
  ctx.beginPath();
  ctx.arc(cx - 12, h - 54, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f5a0b2';
  ctx.beginPath();
  ctx.moveTo(cx - 32, h - 92);
  ctx.lineTo(cx - 12, h - 108);
  ctx.lineTo(cx + 8, h - 92);
  ctx.lineTo(cx - 12, h - 84);
  ctx.closePath();
  ctx.fill();

  // Golden embroidered longevity seal & silk tie cords
  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx - 12, h - 54, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = theme.goldAccent;
  ctx.beginPath();
  ctx.arc(cx - 12, h - 54, 6, 0, Math.PI * 2);
  ctx.fill();

  // Fresh green winter pine sprig & pair of ripe golden persimmons on right
  ctx.fillStyle = theme.greenAccent;
  ctx.beginPath();
  ctx.moveTo(cx + 22, h - 22);
  ctx.lineTo(cx + 68, h - 58);
  ctx.lineTo(cx + 56, h - 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f28b30';
  ctx.beginPath();
  ctx.arc(cx + 42, h - 32, 16, 0, Math.PI * 2);
  ctx.fill();
}

export function drawVancouverPierLanternCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Dark coastal stone plinth + sturdy cedar pier piling
  ctx.fillStyle = '#3b4f59';
  ctx.fillRect(cx - 34, h - 32, 68, 16);
  ctx.fillStyle = '#5c3c28';
  ctx.fillRect(cx - 18, 82, 36, h - 110);

  // Warm nautical rope wraps around cedar post
  ctx.strokeStyle = '#c49b60';
  ctx.lineWidth = 7;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 21, h - 76 + i * 11);
    ctx.lineTo(cx + 21, h - 76 + i * 11);
    ctx.stroke();
  }

  // Crimson & ivory coastal lifebuoy resting cleanly against post base
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.arc(cx + 22, h - 46, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx + 16, h - 68, 12, 44);
  ctx.fillRect(cx, h - 52, 44, 12);
  ctx.fillStyle = '#3b4f59';
  ctx.beginPath();
  ctx.arc(cx + 22, h - 46, 10, 0, Math.PI * 2);
  ctx.fill();

  // Brass coastal storm lantern perched cleanly atop timber piling
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 20, 68, 40, 14);
  ctx.fillStyle = '#ffef9f';
  ctx.fillRect(cx - 13, 36, 26, 32);
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.moveTo(cx - 24, 36);
  ctx.lineTo(cx, 16);
  ctx.lineTo(cx + 24, 36);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - 6, 24, 14, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawVancouverBouldersCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Lush coastal cedar bough rising behind dark slate boulders & harbor buoy
  drawLayeredPine(ctx, cx - 32, h - 18, 74, 124, theme.greenAccent);

  // Bold dark mossy basalt boulders anchoring bottom silhouette cleanly
  ctx.fillStyle = '#3c4e59';
  ctx.beginPath();
  ctx.arc(cx - 28, h - 18, 42, Math.PI, 0);
  ctx.arc(cx + 18, h - 18, 34, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#536b78';
  ctx.beginPath();
  ctx.arc(cx - 28, h - 22, 30, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();

  // Miniature bright red & white harbor bell buoy with gold lantern top
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.moveTo(cx + 4, h - 18);
  ctx.lineTo(cx + 16, h - 108);
  ctx.lineTo(cx + 42, h - 108);
  ctx.lineTo(cx + 54, h - 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx + 13, h - 72, 32, 12);
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx + 20, h - 122, 18, 15);
}

/* ==================== BRUSSELS PAPER-CUT ARTWORK ==================== */

export function drawBrusselsGrandPlaceBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const baseY = h - 18;
  const sx = w / 960;
  const sy = h / 620;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;

  // Shared helper for glowing arched Gothic/Baroque Grand Place windows
  const drawArchedWindow = (wx: number, wy: number, ww: number, wh: number, lit = true) => {
    ctx.fillStyle = lit ? '#ffe694' : '#3a4668';
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx, wy + ww * 0.5);
    ctx.arc(wx + ww * 0.5, wy + ww * 0.5, ww * 0.5, Math.PI, 0);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.closePath();
    ctx.fill();

    if (lit) {
      ctx.strokeStyle = 'rgba(130, 88, 34, 0.45)';
      ctx.lineWidth = Math.max(1, 1.4 * sx);
      ctx.beginPath();
      ctx.moveTo(wx + ww * 0.5, wy + 2 * sy);
      ctx.lineTo(wx + ww * 0.5, wy + wh);
      ctx.moveTo(wx + 1 * sx, wy + wh * 0.55);
      ctx.lineTo(wx + ww - 1 * sx, wy + wh * 0.55);
      ctx.stroke();
    }
  };

  // 1. Center low Grand Place snow-covered winter rooflines (tucked low behind center tree)
  const centerRoofs: Array<[number, number, number, string, string]> = [
    [296, 84, 210, '#7c6b66', '#4a3d49'],
    [382, 82, 192, '#8d7b6c', '#534552'],
    [466, 86, 184, '#6e6678', '#423c52'],
    [554, 88, 206, '#846f68', '#4d3e48'],
  ];
  centerRoofs.forEach(([rx, rw, rh, wallCol, roofCol]) => {
    const px = X(rx);
    const pw = X(rw);
    const py = baseY - Y(rh);
    ctx.fillStyle = wallCol;
    ctx.fillRect(px, py + Y(44), pw, Y(rh - 44));
    ctx.fillStyle = roofCol;
    ctx.beginPath();
    ctx.moveTo(px - X(2), py + Y(44));
    ctx.lineTo(px + pw * 0.5, py);
    ctx.lineTo(px + pw + X(2), py + Y(44));
    ctx.closePath();
    ctx.fill();
    // Snow slope & golden trim
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px - X(2), py + Y(44));
    ctx.lineTo(px + pw * 0.5, py);
    ctx.lineTo(px + pw * 0.65, py + Y(15));
    ctx.lineTo(px + X(10), py + Y(44));
    ctx.closePath();
    ctx.fill();
    for (let c = 0; c < 3; c++) {
      drawArchedWindow(px + pw * (0.16 + c * 0.28), py + Y(64), pw * 0.16, Y(32), true);
    }
  });

  // 2. Left Grand Place Centerpiece: Hôtel de Ville (Brussels Town Hall Gothic Belfry Spire)
  const thX = X(54);
  const thW = X(242);
  const thBodyH = Y(190);
  const thY = baseY - thBodyH;

  // Limestone Gothic body + ground arcade
  ctx.fillStyle = '#e7dcc5';
  ctx.fillRect(thX, thY, thW, thBodyH);
  ctx.fillStyle = '#d3c4a6';
  ctx.fillRect(thX + thW - X(28), thY, X(28), thBodyH);

  // Steep slate Gothic roof with twin stone dormer pinnacles & snow cap
  ctx.fillStyle = '#3d4c6b';
  ctx.beginPath();
  ctx.moveTo(thX - X(4), thY);
  ctx.lineTo(thX + thW * 0.5, thY - Y(58));
  ctx.lineTo(thX + thW + X(4), thY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(thX - X(4), thY);
  ctx.lineTo(thX + thW * 0.5, thY - Y(58));
  ctx.lineTo(thX + thW * 0.44, thY - Y(38));
  ctx.lineTo(thX + X(14), thY);
  ctx.closePath();
  ctx.fill();

  // Corner turrets with pointed conical roofs & gold finials
  [thX + X(8), thX + thW - X(24)].forEach((tx) => {
    ctx.fillStyle = '#dfd0b3';
    ctx.fillRect(tx, thY - Y(38), X(16), Y(42));
    ctx.fillStyle = '#3d4c6b';
    ctx.beginPath();
    ctx.moveTo(tx - X(3), thY - Y(38));
    ctx.lineTo(tx + X(8), thY - Y(76));
    ctx.lineTo(tx + X(19), thY - Y(38));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.goldAccent;
    ctx.beginPath();
    ctx.arc(tx + X(8), thY - Y(80), X(4), 0, Math.PI * 2);
    ctx.fill();
  });

  // Iconic Flamboyant Gothic Belfry Spire rising cleanly inside canvas top margin
  const spCx = thX + thW * 0.49;
  const spBot = thY - Y(14);
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(spCx - X(24), spBot - Y(112), X(48), Y(112));
  ctx.fillStyle = '#d3c4a6';
  ctx.fillRect(spCx + X(10), spBot - Y(112), X(14), Y(112));
  drawArchedWindow(spCx - X(13), spBot - Y(96), X(11), Y(42), true);
  drawArchedWindow(spCx + X(2), spBot - Y(96), X(11), Y(42), true);

  ctx.fillStyle = '#e7dcc5';
  ctx.fillRect(spCx - X(17), spBot - Y(182), X(34), Y(70));
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(spCx - X(26), spBot - Y(115), X(52), Y(5));
  ctx.fillRect(spCx - X(19), spBot - Y(184), X(38), Y(5));

  ctx.fillStyle = '#f2e8d4';
  ctx.beginPath();
  ctx.moveTo(spCx - X(15), spBot - Y(182));
  ctx.lineTo(spCx, spBot - Y(296));
  ctx.lineTo(spCx + X(15), spBot - Y(182));
  ctx.closePath();
  ctx.fill();

  // Golden St. Michael weathervane pinnacle
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(spCx - X(1.8), spBot - Y(322), X(3.6), Y(26));
  ctx.beginPath();
  ctx.arc(spCx, spBot - Y(326), X(6.5), 0, Math.PI * 2);
  ctx.fill();

  // Town Hall arched arcade & lancet facade rows
  ctx.fillStyle = '#cbb792';
  ctx.fillRect(thX, thY, thW, Y(7));
  for (let c = 0; c < 6; c++) {
    const gx = thX + X(14) + c * X(36);
    drawArchedWindow(gx, thY + Y(18), X(22), Y(42), true);
    drawArchedWindow(gx, thY + Y(72), X(22), Y(42), true);
    ctx.fillStyle = '#534538';
    ctx.beginPath();
    ctx.moveTo(gx, baseY);
    ctx.lineTo(gx, baseY - Y(40));
    ctx.arc(gx + X(11), baseY - Y(40), X(11), Math.PI, 0);
    ctx.lineTo(gx + X(22), baseY);
    ctx.closePath();
    ctx.fill();
  }
  drawWreath(ctx, spCx, thY + Y(126), X(15), theme.greenAccent, theme.redAccent, theme.goldAccent);

  // 3. Right Grand Place Block: Maison du Roi (Broodhuis) & Gilded Gables
  const mrX = X(642);
  const mrW = X(264);
  const mrBodyH = Y(258);
  const mrY = baseY - mrBodyH;

  ctx.fillStyle = '#d8cbb3';
  ctx.fillRect(mrX, mrY, mrW, mrBodyH);
  ctx.fillStyle = '#beaf94';
  ctx.fillRect(mrX + mrW - X(24), mrY, X(24), mrBodyH);

  // Ornate gilded Baroque frieze bands & balconies
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(mrX, mrY, mrW, Y(6));
  ctx.fillRect(mrX, mrY + Y(96), mrW, Y(6));
  ctx.fillRect(mrX, mrY + Y(182), mrW, Y(5));

  // Steep dark slate Flemish roof with three gilded triangular gable peaks & central lantern turret
  ctx.fillStyle = '#374666';
  ctx.fillRect(mrX + X(6), mrY - Y(62), mrW - X(12), Y(62));

  [mrX + X(44), mrX + mrW * 0.5, mrX + mrW - X(44)].forEach((gx, idx) => {
    const gw = idx === 1 ? X(58) : X(42);
    const gh = idx === 1 ? Y(108) : Y(74);
    ctx.fillStyle = '#e8dcc4';
    ctx.beginPath();
    ctx.moveTo(gx - gw * 0.5, mrY);
    ctx.lineTo(gx, mrY - gh);
    ctx.lineTo(gx + gw * 0.5, mrY);
    ctx.closePath();
    ctx.fill();

    // Gold pediment border & finial
    ctx.strokeStyle = theme.goldAccent;
    ctx.lineWidth = Math.max(1.5, 2.8 * sx);
    ctx.stroke();
    ctx.fillStyle = theme.goldAccent;
    ctx.beginPath();
    ctx.arc(gx, mrY - gh - Y(5), X(5), 0, Math.PI * 2);
    ctx.fill();

    drawArchedWindow(gx - X(8), mrY - gh * 0.52, X(16), gh * 0.42, true);
  });

  // Maison du Roi central gilded copper belfry lantern & snow caps
  const mrSpX = mrX + mrW * 0.5;
  ctx.fillStyle = '#374666';
  ctx.fillRect(mrSpX - X(14), mrY - Y(176), X(28), Y(76));
  ctx.fillStyle = theme.goldAccent;
  ctx.beginPath();
  ctx.moveTo(mrSpX - X(17), mrY - Y(176));
  ctx.lineTo(mrSpX, mrY - Y(236));
  ctx.lineTo(mrSpX + X(17), mrY - Y(176));
  ctx.closePath();
  ctx.fill();

  for (let c = 0; c < 6; c++) {
    const wx = mrX + X(16) + c * X(40);
    drawArchedWindow(wx, mrY + Y(22), X(24), Y(62), true);
    drawArchedWindow(wx, mrY + Y(112), X(24), Y(58), true);
    drawArchedWindow(wx, mrY + Y(196), X(24), Y(52), c % 2 === 0);
  }
  drawWreath(ctx, mrSpX, mrY + Y(214), X(18), theme.greenAccent, theme.redAccent, theme.goldAccent);
}

export function drawBrusselsAtomiumCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  const baseY = h - 18;

  // Entrance Pavilion at base with glowing holiday arcade & snow skirt
  ctx.fillStyle = '#475776';
  ctx.fillRect(cx - 84, baseY - 56, 168, 56);
  ctx.fillStyle = '#8fa4c2';
  ctx.fillRect(cx - 92, baseY - 64, 184, 11);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 92, baseY - 68, 184, 6);
  ctx.fillStyle = '#ffe594';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(cx + i * 28 - 9, baseY - 44, 18, 34);
  }
  drawWreath(ctx, cx, baseY - 36, 15, theme.greenAccent, theme.redAccent, theme.goldAccent);

  // Atomium 9 spheres oriented along vertical body diagonal
  const coreY = h * 0.5;
  const topY = 104;
  const botY = baseY - 102;
  const dxOuter = w * 0.285;
  const dxMid = w * 0.18;
  const sphereR = Math.min(w, h) * 0.086;

  const nodes: Array<{ id: string; x: number; y: number; r: number }> = [
    { id: 'bot', x: cx, y: botY, r: sphereR },
    { id: 'top', x: cx, y: topY, r: sphereR * 1.04 },
    { id: 'core', x: cx, y: coreY, r: sphereR * 1.02 },
    { id: 'bl', x: cx - dxOuter, y: coreY + (botY - coreY) * 0.52, r: sphereR * 0.96 },
    { id: 'br', x: cx + dxOuter, y: coreY + (botY - coreY) * 0.52, r: sphereR * 0.96 },
    { id: 'bf', x: cx + dxMid * 0.25, y: coreY + (botY - coreY) * 0.72, r: sphereR * 0.9 },
    { id: 'tl', x: cx - dxOuter, y: coreY - (coreY - topY) * 0.52, r: sphereR * 0.96 },
    { id: 'tr', x: cx + dxOuter, y: coreY - (coreY - topY) * 0.52, r: sphereR * 0.96 },
    { id: 'tf', x: cx - dxMid * 0.25, y: coreY - (coreY - topY) * 0.72, r: sphereR * 0.9 },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Three ground steel tripod bipod stair pylons supporting the outer crystal spheres
  ctx.strokeStyle = '#536785';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  [
    [byId.bl, cx - 56, baseY - 58],
    [byId.br, cx + 56, baseY - 58],
    [byId.bot, cx - 22, baseY - 52],
    [byId.bot, cx + 22, baseY - 52],
  ].forEach(([node, fx, fy]) => {
    const n = node as { x: number; y: number };
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(fx as number, fy as number);
    ctx.stroke();
  });

  // 1. Metallic steel connecting tubes (edges + central vertical elevator shaft + radials)
  const edges: Array<[string, string, number]> = [
    ['bot', 'top', 18],
    ['bot', 'bl', 14],
    ['bot', 'br', 14],
    ['bot', 'bf', 12],
    ['top', 'tl', 14],
    ['top', 'tr', 14],
    ['top', 'tf', 12],
    ['bl', 'tl', 14],
    ['br', 'tr', 14],
    ['bf', 'tf', 12],
    ['bl', 'bf', 12],
    ['br', 'bf', 12],
    ['tl', 'tf', 12],
    ['tr', 'tf', 12],
    ['core', 'bl', 11],
    ['core', 'br', 11],
    ['core', 'tl', 11],
    ['core', 'tr', 11],
    ['core', 'bf', 11],
    ['core', 'tf', 11],
  ];

  edges.forEach(([a, b, lw]) => {
    const p0 = byId[a];
    const p1 = byId[b];
    ctx.strokeStyle = '#566987';
    ctx.lineWidth = lw + 4;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    ctx.strokeStyle = '#d3e1f2';
    ctx.lineWidth = lw * 0.55;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  });

  // Upper summit flagpole spire
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(byId.top.x - 2.5, byId.top.y - byId.top.r - 24, 5, 26);
  ctx.beginPath();
  ctx.arc(byId.top.x, byId.top.y - byId.top.r - 26, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // 2. Crisp brushed-chrome 3D Atomium spheres with warm golden porthole lights & snow caps
  const drawSphere = (n: { x: number; y: number; r: number }) => {
    const grad = ctx.createRadialGradient(
      n.x - n.r * 0.34,
      n.y - n.r * 0.34,
      n.r * 0.12,
      n.x,
      n.y,
      n.r
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.32, '#dde8f6');
    grad.addColorStop(0.75, '#8fa6c4');
    grad.addColorStop(1, '#4c6180');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();

    // Specular equatorial meridian arc & illuminated golden windows
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(n.x, n.y, n.r * 0.88, n.r * 0.28, -0.18, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#ffe594';
    [-0.5, 0, 0.5].forEach((off) => {
      ctx.beginPath();
      ctx.arc(n.x + off * n.r * 0.72, n.y + n.r * 0.08, n.r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    });

    // Soft top winter snow frost
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * 0.98, Math.PI * 1.18, Math.PI * 1.82);
    ctx.quadraticCurveTo(n.x, n.y - n.r * 0.58, n.x - n.r * 0.82, n.y - n.r * 0.52);
    ctx.closePath();
    ctx.fill();
  };

  ['bot', 'bl', 'br', 'tl', 'tr', 'core', 'bf', 'tf', 'top'].forEach((id) => {
    drawSphere(byId[id]);
  });
}

export function drawBrusselsGuildhallCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const baseY = h - 18;
  const sx = w / 520;
  const sy = h / 580;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;

  // Trio of ornate Grand Place Baroque Guildhalls (sandstone gold, deep olive slate, warm Flemish rose)
  const houses: Array<{
    x: number;
    w: number;
    h: number;
    wall: string;
    trim: string;
    gableStyle: 'bell' | 'step' | 'scroll';
  }> = [
    { x: 24, w: 148, h: 378, wall: '#d6c39c', trim: '#b49242', gableStyle: 'scroll' },
    { x: 180, w: 162, h: 446, wall: '#4d605d', trim: theme.goldAccent, gableStyle: 'bell' },
    { x: 350, w: 146, h: 392, wall: '#b85c54', trim: '#f2ca63', gableStyle: 'step' },
  ];

  houses.forEach((house) => {
    const hx = X(house.x);
    const hw = X(house.w);
    const hy = baseY - Y(house.h);

    ctx.fillStyle = house.wall;
    ctx.fillRect(hx, hy + Y(96), hw, Y(house.h - 96));

    // Ornate Flemish Baroque gable crown with gilded volutes & snow
    const gMid = hx + hw * 0.5;
    ctx.fillStyle = house.wall;
    ctx.beginPath();
    ctx.moveTo(hx, hy + Y(96));
    if (house.gableStyle === 'bell') {
      ctx.bezierCurveTo(hx, hy + Y(44), gMid - X(30), hy + Y(46), gMid - X(22), hy + Y(16));
      ctx.quadraticCurveTo(gMid, hy - Y(4), gMid + X(22), hy + Y(16));
      ctx.bezierCurveTo(gMid + X(30), hy + Y(46), hx + hw, hy + Y(44), hx + hw, hy + Y(96));
    } else if (house.gableStyle === 'step') {
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const sxOff = (s / steps) * (hw * 0.44);
        const syOff = hy + Y(96) - (s + 1) * Y(20);
        ctx.lineTo(hx + sxOff, syOff + Y(20));
        ctx.lineTo(hx + sxOff, syOff);
      }
      ctx.lineTo(gMid, hy);
      for (let s = steps - 1; s >= 0; s--) {
        const sxOff = (s / steps) * (hw * 0.44);
        const syOff = hy + Y(96) - (s + 1) * Y(20);
        ctx.lineTo(hx + hw - sxOff, syOff);
        ctx.lineTo(hx + hw - sxOff, syOff + Y(20));
      }
    } else {
      ctx.quadraticCurveTo(hx + hw * 0.2, hy + Y(32), gMid, hy + Y(4));
      ctx.quadraticCurveTo(hx + hw * 0.8, hy + Y(32), hx + hw, hy + Y(96));
    }
    ctx.closePath();
    ctx.fill();

    // Gold guildhall filigree border, spire globe, & pilasters
    ctx.strokeStyle = house.trim;
    ctx.lineWidth = Math.max(2, 3.8 * sx);
    ctx.stroke();

    ctx.fillStyle = house.trim;
    ctx.beginPath();
    ctx.arc(gMid, hy - Y(2), X(8), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx, hy + Y(94), hw, Y(6));
    ctx.fillRect(hx + X(4), hy + Y(98), X(5), Y(house.h - 102));
    ctx.fillRect(hx + hw - X(9), hy + Y(98), X(5), Y(house.h - 102));

    // Glowing grid of Baroque guildhall windows + snow-capped window sills
    for (let row = 0; row < 3; row++) {
      const wy = hy + Y(118 + row * 82);
      const cols = 3;
      const cellW = (hw - X(38)) / cols;
      for (let c = 0; c < cols; c++) {
        const wx = hx + X(16) + c * (cellW + X(3));
        ctx.fillStyle = '#ffe596';
        ctx.fillRect(wx, wy, cellW - X(6), Y(48));
        ctx.strokeStyle = house.trim;
        ctx.lineWidth = Math.max(1, 1.8 * sx);
        ctx.strokeRect(wx, wy, cellW - X(6), Y(48));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - X(2), wy + Y(47), cellW - X(2), Y(5));
      }
    }
  });

  drawWreath(ctx, X(261), baseY - Y(175), X(22), theme.greenAccent, theme.redAccent, theme.goldAccent);
}

export function drawBrusselsBeerAndFritesCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  const baseY = h - 18;

  // Festive Belgian timber chalet booth with scalloped crimson & cream striped awning
  ctx.fillStyle = '#5c3c28';
  ctx.fillRect(cx - 146, baseY - 122, 292, 122);
  ctx.fillStyle = '#3f281b';
  ctx.fillRect(cx - 134, baseY - 196, 18, 92);
  ctx.fillRect(cx + 116, baseY - 196, 18, 92);

  // Dark slate backdrop inside open booth window + glowing strings
  ctx.fillStyle = '#2d242a';
  ctx.fillRect(cx - 116, baseY - 190, 232, 80);

  // Scalloped red & cream Belgian market awning with snow roof cap
  for (let i = 0; i < 8; i++) {
    const ax = cx - 156 + i * 39;
    ctx.fillStyle = i % 2 === 0 ? theme.redAccent : '#fbf6eb';
    ctx.beginPath();
    ctx.moveTo(ax, baseY - 244);
    ctx.lineTo(ax + 39, baseY - 244);
    ctx.lineTo(ax + 39, baseY - 196);
    ctx.arc(ax + 19.5, baseY - 196, 19.5, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 246, 158, 12, 0, Math.PI, 0);
  ctx.fill();

  // Warm wooden counter top with snow dusting
  ctx.fillStyle = '#9e6b43';
  ctx.fillRect(cx - 152, baseY - 126, 304, 16);

  // LEFT COUNTER PROP: Twin Golden Belgian Abbey Chalice Beers with frothy foam caps!
  const drawBeerChalice = (bx: number, by: number, beerColor: string, scale = 1) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(scale, scale);
    // Gold chalice base & stem
    ctx.fillStyle = theme.goldAccent;
    ctx.fillRect(-18, -6, 36, 6);
    ctx.fillRect(-5, -24, 10, 20);
    // Curved tulip beer glass filled with glowing golden/amber ale
    ctx.fillStyle = beerColor;
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.quadraticCurveTo(-28, -54, -20, -76);
    ctx.lineTo(20, -76);
    ctx.quadraticCurveTo(28, -54, 16, -24);
    ctx.closePath();
    ctx.fill();
    // Gold rim accent & bubbly foam overflow
    ctx.strokeStyle = theme.goldAccent;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fffef9';
    ctx.beginPath();
    ctx.arc(-12, -77, 10, 0, Math.PI * 2);
    ctx.arc(0, -82, 13, 0, Math.PI * 2);
    ctx.arc(13, -76, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawBeerChalice(cx - 72, baseY - 126, '#e6a52c', 1.0);
  drawBeerChalice(cx - 22, baseY - 126, '#b85c24', 0.88);

  // RIGHT COUNTER PROP: Classic striped paper cone of golden Belgian Frites!
  const drawFritesCone = (fx: number, fy: number) => {
    ctx.save();
    ctx.translate(fx, fy);
    // Golden hand-cut frites sticking fan-shaped out of cone top
    ctx.fillStyle = '#f5c742';
    [
      [-18, -82, -0.24],
      [-10, -90, -0.12],
      [-2, -94, -0.02],
      [7, -92, 0.1],
      [15, -84, 0.22],
    ].forEach(([xOff, yTop, ang]) => {
      ctx.save();
      ctx.translate(xOff, -54);
      ctx.rotate(ang);
      ctx.fillRect(-4.5, yTop + 54, 9, 44);
      ctx.fillStyle = '#df9a26';
      ctx.fillRect(-4.5, yTop + 54, 2.5, 44);
      ctx.restore();
      ctx.fillStyle = '#f5c742';
    });
    // Creamy Belgian mayo swirl on top
    ctx.fillStyle = '#fff5cf';
    ctx.beginPath();
    ctx.arc(-4, -84, 8, 0, Math.PI * 2);
    ctx.arc(4, -82, 7, 0, Math.PI * 2);
    ctx.fill();
    // Striped paper cornet cone
    ctx.fillStyle = '#fbf6eb';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-26, -64);
    ctx.lineTo(26, -64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.redAccent;
    ctx.beginPath();
    ctx.moveTo(-6, -15);
    ctx.lineTo(-20, -48);
    ctx.lineTo(-8, -48);
    ctx.lineTo(0, -15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -15);
    ctx.lineTo(8, -48);
    ctx.lineTo(20, -48);
    ctx.lineTo(9, -15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawFritesCone(cx + 52, baseY - 126);
  drawFritesCone(cx + 100, baseY - 126);

  // Brass placard centered on booth apron
  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 88, baseY - 94, 176, 44);
  ctx.fillStyle = '#2d221c';
  ctx.fillRect(cx - 82, baseY - 88, 164, 32);
  ctx.fillStyle = '#fff6dc';
  ctx.font = '700 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('BIÈRE · FRITES', cx, baseY - 65);
}

export function drawBrusselsWaffleStandCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  const baseY = h - 18;

  // Evergreen timber winter waffle chalet with gold trim
  ctx.fillStyle = theme.greenAccent;
  ctx.fillRect(cx - 142, baseY - 122, 284, 122);
  ctx.fillStyle = '#184b2f';
  ctx.fillRect(cx - 130, baseY - 194, 18, 86);
  ctx.fillRect(cx + 112, baseY - 194, 18, 86);

  ctx.fillStyle = '#332520';
  ctx.fillRect(cx - 112, baseY - 188, 224, 78);

  // Candy green & cream striped scalloped awning topped by snow
  for (let i = 0; i < 8; i++) {
    const ax = cx - 152 + i * 38;
    ctx.fillStyle = i % 2 === 0 ? theme.greenAccent : '#fbf6eb';
    ctx.beginPath();
    ctx.moveTo(ax, baseY - 242);
    ctx.lineTo(ax + 38, baseY - 242);
    ctx.lineTo(ax + 38, baseY - 194);
    ctx.arc(ax + 19, baseY - 194, 19, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 244, 154, 12, 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#b47d4e';
  ctx.fillRect(cx - 148, baseY - 126, 296, 15);

  // Stacked rectangular golden Brussels Waffles on display platter with powdered sugar & berries!
  const drawBrusselsWaffle = (wx: number, wy: number, tilt: number, chocolate = false) => {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(tilt);
    ctx.fillStyle = '#e5a343';
    ctx.fillRect(-38, -28, 76, 54);
    ctx.strokeStyle = '#b97422';
    ctx.lineWidth = 3;
    ctx.strokeRect(-38, -28, 76, 54);

    // Classic 4x3 Brussels waffle pockets
    ctx.fillStyle = '#b97422';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillRect(-31 + c * 17, -21 + r * 15, 11, 10);
      }
    }
    if (chocolate) {
      // Glossy melted Belgian dark chocolate ribbon drizzle
      ctx.fillStyle = '#472518';
      ctx.fillRect(-34, -26, 68, 16);
      ctx.beginPath();
      ctx.arc(-18, -10, 6, 0, Math.PI);
      ctx.arc(4, -8, 8, 0, Math.PI);
      ctx.arc(22, -10, 6, 0, Math.PI);
      ctx.fill();
    }
    // Whipped cream rosette & festive red strawberries + sugar snow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8, -28, 9, 0, Math.PI * 2);
    ctx.arc(10, -28, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.redAccent;
    ctx.beginPath();
    ctx.arc(1, -34, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawBrusselsWaffle(cx - 56, baseY - 154, -0.08, false);
  drawBrusselsWaffle(cx + 46, baseY - 154, 0.08, true);

  ctx.fillStyle = theme.goldAccent;
  ctx.fillRect(cx - 78, baseY - 94, 156, 44);
  ctx.fillStyle = theme.redAccent;
  ctx.fillRect(cx - 72, baseY - 88, 144, 32);
  ctx.fillStyle = '#fff9eb';
  ctx.font = '700 21px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAUFRES', cx, baseY - 64);
}

export function drawBrusselsFrontBeerAndFriesProp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Warm walnut timber serving board anchoring the beer goblet & frites cone cleanly on pale snow
  ctx.fillStyle = '#5c3c28';
  ctx.beginPath();
  ctx.roundRect(cx - 86, h - 34, 172, 18, 8);
  ctx.fill();
  ctx.fillStyle = '#7c5238';
  ctx.beginPath();
  ctx.roundRect(cx - 82, h - 37, 164, 9, 5);
  ctx.fill();

  // Left: Frothy Belgian amber-gold Tripel chalice with crisp bronze outline & white foam dome
  const gx = cx - 36;
  const gy = h - 34;
  ctx.fillStyle = '#bd882c';
  ctx.fillRect(gx - 22, gy - 9, 44, 9);
  ctx.fillRect(gx - 6, gy - 36, 12, 29);

  ctx.fillStyle = '#d9841c';
  ctx.strokeStyle = '#6b3e12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx - 20, gy - 36);
  ctx.quadraticCurveTo(gx - 35, gy - 78, gx - 25, gy - 114);
  ctx.lineTo(gx + 25, gy - 114);
  ctx.quadraticCurveTo(gx + 35, gy - 78, gx + 20, gy - 36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bright amber highlight band inside glass
  ctx.fillStyle = '#f2b838';
  ctx.beginPath();
  ctx.moveTo(gx - 12, gy - 44);
  ctx.quadraticCurveTo(gx - 20, gy - 78, gx - 14, gy - 108);
  ctx.lineTo(gx - 3, gy - 108);
  ctx.lineTo(gx - 4, gy - 44);
  ctx.closePath();
  ctx.fill();

  // Crisp fluffy white beer foam head framed delicately against white cutout edge
  ctx.fillStyle = '#e8dfd0';
  ctx.beginPath();
  ctx.arc(gx - 14, gy - 116, 13, 0, Math.PI * 2);
  ctx.arc(gx, gy - 123, 16, 0, Math.PI * 2);
  ctx.arc(gx + 14, gy - 116, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(gx - 12, gy - 117, 10, 0, Math.PI * 2);
  ctx.arc(gx, gy - 124, 13, 0, Math.PI * 2);
  ctx.arc(gx + 12, gy - 117, 10, 0, Math.PI * 2);
  ctx.fill();

  // Right: Red-and-ivory striped Belgian frites cone brimming with crisp golden fries & dark shadows
  const fx = cx + 40;
  const fy = h - 34;
  [
    [-18, -108],
    [-8, -120],
    [2, -125],
    [12, -118],
    [21, -106],
  ].forEach(([ox, oy], idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#eab032' : '#cf881f';
    ctx.fillRect(fx + ox - 4.5, fy + oy, 9, 54);
    ctx.strokeStyle = '#7d4d12';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(fx + ox - 4.5, fy + oy, 9, 54);
  });

  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx - 30, fy - 78);
  ctx.lineTo(fx + 30, fy - 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbf6eb';
  ctx.beginPath();
  ctx.moveTo(fx - 4, fy - 14);
  ctx.lineTo(fx - 15, fy - 74);
  ctx.lineTo(fx - 4, fy - 74);
  ctx.lineTo(fx - 1, fy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(fx + 5, fy - 14);
  ctx.lineTo(fx + 6, fy - 74);
  ctx.lineTo(fx + 17, fy - 74);
  ctx.lineTo(fx + 7, fy - 14);
  ctx.closePath();
  ctx.fill();
}

export function drawBrusselsFrontWaffleProp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  const cx = w * 0.5;
  // Dark ceramic festive platter sitting cleanly on pale floor
  ctx.fillStyle = '#334257';
  ctx.beginPath();
  ctx.ellipse(cx, h - 24, 92, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e7dfd0';
  ctx.beginPath();
  ctx.ellipse(cx, h - 28, 76, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rich golden double-stacked Belgian grid waffles with chocolate glaze, berries & holly
  ctx.fillStyle = '#cf8527';
  ctx.fillRect(cx - 56, h - 56, 112, 26);
  ctx.strokeStyle = '#6b3e12';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(cx - 56, h - 56, 112, 26);

  ctx.fillStyle = '#e5a33b';
  ctx.fillRect(cx - 50, h - 98, 100, 50);
  ctx.strokeStyle = '#6b3e12';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 50, h - 98, 100, 50);

  ctx.fillStyle = '#995716';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillRect(cx - 41 + c * 22, h - 90 + r * 14, 15, 9);
    }
  }
  // Glossy dark Belgian chocolate sauce drip
  ctx.fillStyle = '#472518';
  ctx.fillRect(cx - 46, h - 96, 92, 18);
  ctx.beginPath();
  ctx.arc(cx - 24, h - 78, 7, 0, Math.PI);
  ctx.arc(cx, h - 76, 8, 0, Math.PI);
  ctx.arc(cx + 24, h - 78, 7, 0, Math.PI);
  ctx.fill();

  // Whipped cream cloud & bright strawberries + holly leaves
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 12, h - 101, 13, 0, Math.PI * 2);
  ctx.arc(cx + 12, h - 101, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.redAccent;
  ctx.beginPath();
  ctx.arc(cx, h - 113, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.greenAccent;
  ctx.beginPath();
  ctx.ellipse(cx + 58, h - 40, 16, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBrusselsSpottedCatCutout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: CityTheme
) {
  void theme;
  const sx = w / 320;
  const sy = h / 380;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;

  // 1. Tall skyward-curving slender S-tail rising high on left rear (matching reference pose!)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#181a20';
  ctx.lineWidth = X(24);
  ctx.beginPath();
  ctx.moveTo(X(104), Y(222));
  ctx.bezierCurveTo(X(102), Y(156), X(98), Y(108), X(68), Y(62));
  ctx.stroke();

  ctx.strokeStyle = '#faf7f2';
  ctx.lineWidth = X(17.5);
  ctx.beginPath();
  ctx.moveTo(X(104), Y(222));
  ctx.bezierCurveTo(X(102), Y(156), X(98), Y(108), X(68), Y(62));
  ctx.stroke();

  // Crisp ink-black spots & tip along tall upright tail
  ctx.fillStyle = '#15171c';
  ctx.beginPath();
  ctx.arc(X(68), Y(62), X(10.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(X(96), Y(138), X(9.5), Y(13), 0.15, 0, Math.PI * 2);
  ctx.fill();

  // 2. Fluffy hunched pear-shaped body with close-set front paws (from reference!)
  const bodyPath = new Path2D();
  bodyPath.moveTo(X(148), Y(354)); // left paw base
  bodyPath.bezierCurveTo(X(118), Y(348), X(86), Y(302), X(86), Y(252)); // plump left hip
  bodyPath.bezierCurveTo(X(86), Y(202), X(124), Y(178), X(166), Y(190)); // high hunched back arch
  bodyPath.quadraticCurveTo(X(176), Y(192), X(180), Y(178)); // nape into left ear base
  // Left pointed triangular ear
  bodyPath.lineTo(X(194), Y(136));
  bodyPath.lineTo(X(212), Y(172));
  // Small bridge between close-set upright ears
  bodyPath.lineTo(X(218), Y(172));
  // Right pointed triangular ear
  bodyPath.lineTo(X(238), Y(132));
  bodyPath.lineTo(X(248), Y(178));
  // Cheek & plush pear right belly tapering to right paw
  bodyPath.bezierCurveTo(X(260), Y(214), X(256), Y(278), X(230), Y(322));
  bodyPath.quadraticCurveTo(X(218), Y(344), X(206), Y(354)); // right paw base
  // Cute tucked V-cleft between close front legs
  bodyPath.quadraticCurveTo(X(186), Y(354), X(182), Y(314));
  bodyPath.quadraticCurveTo(X(176), Y(306), X(170), Y(314));
  bodyPath.quadraticCurveTo(X(166), Y(354), X(148), Y(354));
  bodyPath.closePath();

  // Soft ivory-white base fill clipped for crisp cow-cat ink-black spots
  ctx.fillStyle = '#faf7f2';
  ctx.fill(bodyPath);

  ctx.save();
  ctx.clip(bodyPath);
  ctx.fillStyle = '#15171c';
  // Left ear black patch draping slightly across brow
  ctx.beginPath();
  ctx.ellipse(X(194), Y(154), X(24), Y(24), -0.25, 0, Math.PI * 2);
  ctx.fill();
  // Iconic broad ink-black cow spot arching over hunched left back
  ctx.beginPath();
  ctx.ellipse(X(126), Y(228), X(40), Y(34), -0.35, 0, Math.PI * 2);
  ctx.fill();
  // Bold organic cow patch on lower right belly/flank
  ctx.beginPath();
  ctx.ellipse(X(226), Y(272), X(28), Y(34), 0.22, 0, Math.PI * 2);
  ctx.fill();
  // Playful lower left paw spot
  ctx.beginPath();
  ctx.ellipse(X(132), Y(316), X(19), Y(24), 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Clean charcoal outer fur contour + subtle sketchy ink bristle fuzz
  ctx.strokeStyle = '#181a20';
  ctx.lineWidth = X(3.6);
  ctx.stroke(bodyPath);

  // Soft pastel-pink inner ear triangles matching reference illustration
  ctx.fillStyle = '#f7c5d3';
  ctx.beginPath();
  ctx.moveTo(X(186), Y(168));
  ctx.lineTo(X(194), Y(144));
  ctx.lineTo(X(206), Y(168));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(X(224), Y(168));
  ctx.lineTo(X(237), Y(140));
  ctx.lineTo(X(244), Y(168));
  ctx.closePath();
  ctx.fill();

  // 3. Tall expressive vertical-oval luminous GREEN eyes (no nose, no mouth, just saucer charm!)
  const drawSaucerEye = (ex: number, ey: number, tilt: number) => {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(tilt);

    // Crisp ink rim
    ctx.fillStyle = '#15171c';
    ctx.beginPath();
    ctx.ellipse(0, 0, X(10.5), Y(14.5), 0, 0, Math.PI * 2);
    ctx.fill();

    // Luminous light pistachio-mint green iris gradient
    const irisGrad = ctx.createRadialGradient(0, Y(-2), X(1.5), 0, 0, Y(13));
    irisGrad.addColorStop(0, '#f2ffe6');
    irisGrad.addColorStop(0.55, '#c6f89f');
    irisGrad.addColorStop(1, '#98e072');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, X(8.6), Y(12.4), 0, 0, Math.PI * 2);
    ctx.fill();

    // Upright delicate feline pupil + bright highlight speck
    ctx.fillStyle = '#14171c';
    ctx.beginPath();
    ctx.ellipse(X(0.4), 0, X(2.4), Y(5.8), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(X(-2.4), Y(-4.2), X(2.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawSaucerEye(X(196), Y(198), -0.14);
  drawSaucerEye(X(226), Y(201), 0.08);

  // 4. Three short perky whiskers fanning neatly from left brow & right cheek
  ctx.strokeStyle = '#181a20';
  ctx.lineWidth = X(2.1);
  // Left cheek/temple whiskers
  [
    [176, 184, 158, 174],
    [175, 190, 154, 186],
    [175, 196, 156, 198],
  ].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(y0));
    ctx.lineTo(X(x1), Y(y1));
    ctx.stroke();
  });
  // Right outer cheek whiskers
  [
    [248, 200, 269, 192],
    [250, 208, 272, 207],
    [249, 215, 270, 221],
  ].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(y0));
    ctx.lineTo(X(x1), Y(y1));
    ctx.stroke();
  });
}
