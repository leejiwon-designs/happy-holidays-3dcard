import * as THREE from 'three';
import { CITY_THEMES } from '../themes/cityThemes';
import type { CityId } from '../types/card';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHollyCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  green: string,
  red: string,
  gold: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  [-0.48, 0.48].forEach((ang) => {
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -14, 34, -4);
    ctx.quadraticCurveTo(22, 8, 36, 16);
    ctx.quadraticCurveTo(14, 18, 0, 0);
    ctx.fill();
    ctx.restore();
  });

  const berries = [
    [-5, 2],
    [5, 3],
    [0, -5],
  ];
  ctx.fillStyle = red;
  berries.forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 4.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, -1, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.28;
    const a = (i * Math.PI) / 4;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha = 0.85
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1.2, r * 0.22);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEvergreenSwagEdge(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  loops: number,
  sag: number,
  green: string,
  greenDark: string,
  red: string,
  gold: string
) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  // Inward perpendicular rotated +90deg around trace direction
  const nx = -uy;
  const ny = ux;

  ctx.save();
  for (let s = 0; s < loops; s++) {
    const t0 = s / loops;
    const t1 = (s + 1) / loops;
    const sx = x0 + dx * t0;
    const sy = y0 + dy * t0;
    const ex = x0 + dx * t1;
    const ey = y0 + dy * t1;
    const cx = (sx + ex) * 0.5 + nx * sag;
    const cy = (sy + ey) * 0.5 + ny * sag;

    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const omt = 1 - u;
      const bx = omt * omt * sx + 2 * omt * u * cx + u * u * ex;
      const by = omt * omt * sy + 2 * omt * u * cy + u * u * ey;

      const angle = Math.atan2(uy, ux);
      ctx.strokeStyle = i % 2 === 0 ? green : greenDark;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      [-0.62, 0.62].forEach((off) => {
        const na = angle + off + (hash01(i * 17 + s * 31) - 0.5) * 0.25;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(na) * 14, by + Math.sin(na) * 14);
        ctx.stroke();
      });
    }

    // Crimson berry cluster & subtle gold glint at each swag gather knot
    ctx.fillStyle = red;
    [[-4, 2], [4, 2], [0, -4]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(ex + ox * 0.7, ey + oy * 0.7, 3.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createDeckPaperTexture(cityId: CityId, recipientName: string): THREE.CanvasTexture {
  const theme = CITY_THEMES[cityId];
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.cardPaper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const wash = ctx.createRadialGradient(512, 460, 80, 512, 420, 540);
  wash.addColorStop(0, '#ffffff');
  wash.addColorStop(1, theme.cardDeckTint);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clip all interior floor artwork, watercolor snowbanks & swag strictly inside the gold/red border
  ctx.save();
  ctx.beginPath();
  ctx.rect(34, 34, canvas.width - 68, canvas.height - 68);
  ctx.clip();

  // Soft layered painted watercolor snowbanks framing all corners & sides of the card floor
  const bankWash = cityId === 'seoul' ? '#ede1d6' : cityId === 'vancouver' ? '#d9ebe6' : '#dfe9f5';
  const bankMid = cityId === 'seoul' ? '#f6eee6' : cityId === 'vancouver' ? '#edf6f4' : '#eef5fc';
  ctx.save();
  const drawSnowMound = (mx: number, my: number, rx: number, ry: number, rot: number, fill: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(mx, my, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  };
  drawSnowMound(120, 120, 185, 86, 0.25, bankWash, 0.72);
  drawSnowMound(900, 125, 185, 88, -0.25, bankWash, 0.72);
  drawSnowMound(135, 648, 210, 96, -0.2, bankWash, 0.76);
  drawSnowMound(890, 648, 210, 96, 0.2, bankWash, 0.76);
  drawSnowMound(115, 385, 115, 175, 0.08, bankMid, 0.68);
  drawSnowMound(908, 385, 115, 175, -0.08, bankMid, 0.68);
  drawSnowMound(512, 85, 290, 64, 0, bankMid, 0.6);
  ctx.restore();

  // City ground artwork printed crisply on the front deck
  ctx.save();
  ctx.globalAlpha = 0.88;
  if (cityId === 'toronto') {
    // Full elliptical TTC streetcar rail loop circling smoothly around the tree (matches CardDiorama orbit)
    const cx = 512;
    const cy = (1.62 / 4.2) * 768;
    const rx = (1.58 / 6.2) * 1024;
    const ry = (1.28 / 4.2) * 768;
    ctx.strokeStyle = '#92abc4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 7, ry - 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 7, ry + 7, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Cute snowy raccoon paw prints strolling from raccoon toward foreground streetlamp
    ctx.fillStyle = '#8fa4ba';
    for (let i = 0; i < 6; i++) {
      const px = 148 + (i % 2 === 0 ? -7 : 7) - i * 4;
      const py = 468 + i * 24;
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.arc(px - 4, py - 4, 1.5, 0, Math.PI * 2);
      ctx.arc(px, py - 5, 1.5, 0, Math.PI * 2);
      ctx.arc(px + 4, py - 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cityId === 'seoul') {
    // Painted icy winter Cheonggyecheon stream ribbon flowing beneath the arched stone bridge
    ctx.fillStyle = '#99c4ea';
    ctx.beginPath();
    ctx.moveTo(540, 115);
    ctx.bezierCurveTo(610, 225, 740, 265, 960, 345);
    ctx.lineTo(960, 425);
    ctx.bezierCurveTo(690, 365, 560, 285, 470, 115);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#eef7ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(525, 140);
    ctx.quadraticCurveTo(705, 310, 920, 385);
    ctx.stroke();

    // Frosted riverfront stepping stones & tiny bird prints near Haechi courtyard
    ctx.fillStyle = '#d3dee8';
    [[790, 455], [835, 495], [875, 540]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.ellipse(sx, sy, 16, 9, -0.3, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    ctx.fillStyle = '#c4e3e0';
    ctx.beginPath();
    ctx.moveTo(60, 310);
    ctx.quadraticCurveTo(512, 240, 964, 320);
    ctx.lineTo(964, 360);
    ctx.quadraticCurveTo(512, 282, 60, 350);
    ctx.closePath();
    ctx.fill();

    // Smooth coastal river stones & snow flecks along inlet bank
    ctx.fillStyle = '#92b3b0';
    [[145, 368], [185, 380], [820, 365], [860, 378]].forEach(([rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(rx, ry, 10, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  for (let i = 0; i < 18; i++) {
    const sx = 72 + hash01(i * 11 + 3) * 880;
    const sy = 68 + hash01(i * 23 + 7) * 490;
    if (i % 3 === 0) {
      drawFourPointStar(ctx, sx, sy, 7 + (i % 3) * 2.5, theme.goldAccent);
    } else {
      drawSnowflake(ctx, sx, sy, 5 + (i % 2) * 2.5, '#b8d0e6', 0.65);
    }
  }
  ctx.restore();

  // Hand-painted evergreen swag garlands weaving smoothly around the perimeter edges
  drawEvergreenSwagEdge(ctx, 42, 46, 42, 722, 4, 24, theme.greenAccent, theme.greenShadow, theme.redAccent, theme.goldAccent);
  drawEvergreenSwagEdge(ctx, 982, 722, 982, 46, 4, 24, theme.greenAccent, theme.greenShadow, theme.redAccent, theme.goldAccent);
  drawEvergreenSwagEdge(ctx, 982, 46, 42, 46, 5, 22, theme.greenAccent, theme.greenShadow, theme.redAccent, theme.goldAccent);
  drawEvergreenSwagEdge(ctx, 42, 722, 982, 722, 5, 20, theme.greenAccent, theme.greenShadow, theme.redAccent, theme.goldAccent);

  drawHollyCluster(ctx, 74, 76, 1.05, theme.greenAccent, theme.redAccent, theme.goldAccent);
  drawHollyCluster(ctx, 950, 76, 1.05, theme.greenAccent, theme.redAccent, theme.goldAccent);
  drawHollyCluster(ctx, 74, 692, 1.05, theme.greenAccent, theme.redAccent, theme.goldAccent);
  drawHollyCluster(ctx, 950, 692, 1.05, theme.greenAccent, theme.redAccent, theme.goldAccent);
  ctx.restore();

  // Crisp red outer frame & inner gold border drawn cleanly above clipped floor snow
  ctx.strokeStyle = theme.redAccent;
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, canvas.width - 22, canvas.height - 22);

  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  // Scalloped cream/white paper name plate positioned cleanly in front of tree & streetcar loop
  const px = 222;
  const py = 540;
  const pw = 580;
  const ph = 166;

  ctx.save();
  ctx.shadowColor = 'rgba(70, 50, 40, 0.14)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fffdf8';
  roundRectPath(ctx, px, py, pw, ph, 32);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 5;
  roundRectPath(ctx, px + 8, py + 8, pw - 16, ph - 16, 26);
  ctx.stroke();

  ctx.setLineDash([8, 7]);
  ctx.strokeStyle = theme.greenAccent;
  ctx.lineWidth = 2.5;
  roundRectPath(ctx, px + 19, py + 19, pw - 38, ph - 38, 18);
  ctx.stroke();
  ctx.setLineDash([]);

  drawFourPointStar(ctx, px + 42, py + 42, 10, theme.redAccent);
  drawFourPointStar(ctx, px + pw - 42, py + 42, 10, theme.redAccent);
  drawFourPointStar(ctx, px + 42, py + ph - 42, 10, theme.goldAccent);
  drawFourPointStar(ctx, px + pw - 42, py + ph - 42, 10, theme.goldAccent);

  const cleanName = recipientName.trim() || 'Friend';
  const fontFamily = '"Glass Antiqua", Georgia, serif';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Deck name plate ("Season's Greetings" + "For [Name]")
  ctx.fillStyle = theme.greenAccent;
  ctx.font = `400 30px ${fontFamily}`;
  ctx.fillText("Season's Greetings", px + pw / 2, py + 48);

  ctx.fillStyle = theme.redAccent;
  const maxNameWidth = pw - 104;
  let nameFontSize = 56;
  ctx.font = `400 ${nameFontSize}px ${fontFamily}`;
  const labelText = `For ${cleanName}`;
  while (ctx.measureText(labelText).width > maxNameWidth && nameFontSize > 12) {
    nameFontSize -= 1;
    ctx.font = `400 ${nameFontSize}px ${fontFamily}`;
  }
  ctx.fillText(labelText, px + pw / 2, py + 102, maxNameWidth);

  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px + pw / 2 - 90, py + 136);
  ctx.lineTo(px + pw / 2 + 90, py + 136);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createBackWallPaperTexture(cityId: CityId): THREE.CanvasTexture {
  const theme = CITY_THEMES[cityId];
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.cardPaper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 30, 0, canvas.height - 30);
  grad.addColorStop(0, theme.wallSkyTop);
  grad.addColorStop(1, theme.wallSkyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(28, 28, canvas.width - 56, canvas.height - 56);

  ctx.strokeStyle = theme.goldAccent;
  ctx.lineWidth = 5;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  // Natural organically scattered falling snowfall + gentle winter stars (zero diagonal pattern!)
  for (let i = 0; i < 95; i++) {
    const x = 54 + hash01(i * 13.7 + 19.3) * (canvas.width - 108);
    const y = 54 + hash01(i * 29.1 + 7.1) * (canvas.height - 165);
    const r = 1.6 + hash01(i * 41.3 + 5.7) * 3.8;
    const alpha = 0.34 + hash01(i * 53.9 + 2.3) * 0.56;

    if (i % 9 === 0) {
      drawSnowflake(ctx, x, y, r + 3.6, '#ffffff', alpha * 0.9);
    } else if (i % 4 === 0) {
      // Soft feathered bokeh snowflake
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      glow.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
      glow.addColorStop(0.5, `rgba(255, 255, 255, ${(alpha * 0.45).toFixed(2)})`);
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sparse golden stars nestled high in the evening sky
  for (let s = 0; s < 9; s++) {
    const sx = 64 + hash01(s * 71.3 + 91.1) * (canvas.width - 128);
    const sy = 56 + hash01(s * 83.7 + 17.9) * 210;
    drawFourPointStar(ctx, sx, sy, 8 + (s % 3) * 2.5, theme.goldAccent);
  }

  const darkSkyLights = cityId === 'vancouver' || cityId === 'seoul';
  ctx.strokeStyle = darkSkyLights ? theme.goldAccent : theme.greenAccent;
  ctx.lineWidth = darkSkyLights ? 4.5 : 4;
  ctx.beginPath();
  ctx.moveTo(32, 92);
  ctx.quadraticCurveTo(260, 152, 512, 104);
  ctx.quadraticCurveTo(764, 152, 992, 92);
  ctx.stroke();

  const bulbColors = darkSkyLights
    ? ['#ff4f58', '#f5ce5b', '#fffdf2', '#e03c45']
    : [theme.redAccent, theme.goldAccent, '#ffffff', theme.greenAccent];
  for (let i = 1; i <= 15; i++) {
    const t = i / 16;
    const x = 32 + t * 960;
    const y =
      t < 0.5
        ? 92 * (1 - t * 2) * (1 - t * 2) + 152 * 2 * (1 - t * 2) * (t * 2) + 104 * (t * 2) * (t * 2)
        : 104 * (1 - (t - 0.5) * 2) * (1 - (t - 0.5) * 2) +
          152 * 2 * (1 - (t - 0.5) * 2) * ((t - 0.5) * 2) +
          92 * ((t - 0.5) * 2) * ((t - 0.5) * 2);
    const bulbColor = bulbColors[i % bulbColors.length];
    if (darkSkyLights) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = bulbColor;
      ctx.beginPath();
      ctx.arc(x, y + 10, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = bulbColor;
    ctx.beginPath();
    ctx.arc(x, y + 10, darkSkyLights ? 10 : 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fffcf5';
  ctx.font = '400 54px "Glass Antiqua", Georgia, serif';
  ctx.fillText('let it snow', 512, 202);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createFrontCoverTexture(cityId: CityId): THREE.CanvasTexture {
  const theme = CITY_THEMES[cityId];
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  // 1. Brick-crimson outer stamp border + crisp ivory paper-white cardstock center
  const stampRed = '#b33627';
  const paperWhite = '#faf7f3';
  ctx.fillStyle = stampRed;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const margin = 34;
  ctx.fillStyle = paperWhite;
  ctx.fillRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

  // Punched postage-stamp semicircular scallops biting inward cleanly around all 4 edges
  ctx.fillStyle = stampRed;
  const pitch = 36;
  const rScallop = 12;
  for (let x = margin + 18; x <= canvas.width - margin - 16; x += pitch) {
    ctx.beginPath();
    ctx.arc(x, margin, rScallop, 0, Math.PI * 2);
    ctx.arc(x, canvas.height - margin, rScallop, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let y = margin + 18; y <= canvas.height - margin - 16; y += pitch) {
    ctx.beginPath();
    ctx.arc(margin, y, rScallop, 0, Math.PI * 2);
    ctx.arc(canvas.width - margin, y, rScallop, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle distressed rose-blush block-print dry-brush speckles & soft paper grain inside the white sheet
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin + 14, margin + 14, canvas.width - (margin + 14) * 2, canvas.height - (margin + 14) * 2);
  ctx.clip();
  for (let i = 0; i < 420; i++) {
    const px = margin + 20 + ((i * 211 + (i % 7) * 37) % (canvas.width - margin * 2 - 40));
    const py = margin + 20 + ((i * 307 + (i % 13) * 29) % (canvas.height - margin * 2 - 40));
    ctx.fillStyle = i % 3 === 0 ? 'rgba(179, 54, 39, 0.055)' : 'rgba(195, 185, 172, 0.14)';
    ctx.fillRect(px, py, 3 + (i % 5), 1.5);
  }
  ctx.strokeStyle = 'rgba(179, 54, 39, 0.14)';
  ctx.lineWidth = 3;
  ctx.strokeRect(margin + 36, margin + 36, canvas.width - (margin + 36) * 2, canvas.height - (margin + 36) * 2);
  ctx.restore();

  // 2. Lush, fuller feathery evergreen pine sprigs framing top, bottom, and side corners
  const drawPineSprig = (
    sx: number,
    sy: number,
    ang: number,
    len: number,
    scale = 1.0
  ) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2d6340';
    ctx.lineWidth = 5.4 * scale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -7 * scale, len, 0);
    ctx.stroke();

    const needles = Math.max(10, Math.floor(len / 7.5));
    for (let n = 1; n <= needles; n++) {
      const t = n / (needles + 1);
      const bx = len * t;
      const by = -Math.sin(t * Math.PI) * 3.5 * scale;
      const nLen = (19 + (n % 3) * 5) * scale * (1 - t * 0.2);
      ctx.strokeStyle = n % 2 === 0 ? '#295f3c' : '#437e55';
      ctx.lineWidth = 4.1 * scale;
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + nLen * 0.44, by + side * nLen * 0.88);
        ctx.stroke();
      });
    }
    ctx.restore();
  };

  // Top edge & top corners pine branches
  drawPineSprig(145, 112, -0.04, 155, 1.0);
  drawPineSprig(485, 116, 3.06, 175, 1.05);
  drawPineSprig(535, 116, 0.08, 175, 1.05);
  drawPineSprig(875, 112, 3.18, 155, 1.0);
  drawPineSprig(124, 134, 1.48, 135, 0.95);
  drawPineSprig(150, 126, 0.96, 95, 0.85);
  drawPineSprig(896, 134, 1.66, 135, 0.95);
  drawPineSprig(868, 126, 2.18, 95, 0.85);

  // Bottom edge & bottom corners pine branches
  drawPineSprig(145, 656, 0.04, 155, 1.0);
  drawPineSprig(485, 652, -3.06, 175, 1.05);
  drawPineSprig(535, 652, -0.08, 175, 1.05);
  drawPineSprig(875, 656, -3.18, 155, 1.0);
  drawPineSprig(124, 634, -1.48, 135, 0.95);
  drawPineSprig(150, 642, -0.96, 95, 0.85);
  drawPineSprig(896, 634, -1.66, 135, 0.95);
  drawPineSprig(868, 642, -2.18, 95, 0.85);

  // 3. Centered "Merry Christmas" in Fleur De Leah + "from Anna" subtext beneath
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = stampRed;
  ctx.font = '400 104px "Fleur De Leah", Georgia, cursive';
  ctx.fillText('Merry Christmas', canvas.width * 0.5, 344);

  ctx.font = '400 44px "Glass Antiqua", Georgia, serif';
  ctx.fillText('from Anna', canvas.width * 0.5, 422);

  void theme;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
