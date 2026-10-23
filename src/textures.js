import * as THREE from 'three';

// --- Noise helpers -------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise: lattice wraps at `period`, so repeated textures have no seams.
function makeValueNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rnd();

  const h = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  const mod = (a, n) => ((a % n) + n) % n;

  return function noise(x, y, px, py) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const x0 = mod(ix, px), x1 = mod(ix + 1, px);
    const y0 = mod(iy, py), y1 = mod(iy + 1, py);
    const a = h(x0, y0), b = h(x1, y0), c = h(x0, y1), d = h(x1, y1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function fbm(noise, x, y, px, py, octaves) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f, px * f, py * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

// --- Wall: cool limewash plaster ----------------------------------------

export function makePlaster() {
  const S = 1024;
  const col = canvas(S, S);
  const bmp = canvas(S, S);
  const cctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const cimg = cctx.createImageData(S, S);
  const bimg = bctx.createImageData(S, S);
  const n1 = makeValueNoise(11);
  const n2 = makeValueNoise(29);
  const rnd = mulberry32(7);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const mottle = fbm(n1, u * 4, v * 4, 4, 4, 4);
      const trowel = fbm(n2, u * 14, v * 9, 14, 9, 3);
      const grain = rnd();
      const tone = (mottle - 0.5) * 14 + (trowel - 0.5) * 5 + (grain - 0.5) * 6;
      const i = (y * S + x) * 4;
      cimg.data[i] = 222 + tone;
      cimg.data[i + 1] = 226 + tone;
      cimg.data[i + 2] = 233 + tone * 0.9;
      cimg.data[i + 3] = 255;
      const b = 128 + (trowel - 0.5) * 70 + (mottle - 0.5) * 40 + (grain - 0.5) * 34;
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = b;
      bimg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return { map: tex(col), bump: tex(bmp, { srgb: false }) };
}

// --- Floor: wide old pine boards, greyed and worn ------------------------

export function makeFloorboards() {
  const S = 1024;
  const PLANKS = 8;
  const PW = S / PLANKS;
  const col = canvas(S, S);
  const bmp = canvas(S, S);
  const rgh = canvas(S, S);
  const cimg = col.getContext('2d').createImageData(S, S);
  const bimg = bmp.getContext('2d').createImageData(S, S);
  const rimg = rgh.getContext('2d').createImageData(S, S);
  const grainN = makeValueNoise(3);
  const wearN = makeValueNoise(5);
  const rnd = mulberry32(42);

  // Per-plank segments separated by butt joints.
  const planks = [];
  for (let p = 0; p < PLANKS; p++) {
    const joints = [Math.floor(rnd() * S)];
    if (rnd() > 0.5) joints.push((joints[0] + 300 + Math.floor(rnd() * 400)) % S);
    joints.sort((a, b) => a - b);
    const segs = joints.map(() => ({
      tint: (rnd() - 0.5) * 26,
      grey: rnd() * 0.35,
      seed: rnd() * 10,
      knot: rnd() < 0.35 ? { x: 20 + rnd() * (PW - 40), y: rnd() * S, r: 6 + rnd() * 9 } : null,
    }));
    planks.push({ joints, segs });
  }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const p = Math.floor(x / PW);
      const lx = x - p * PW;
      const pk = planks[p];
      let si = 0;
      for (let j = 0; j < pk.joints.length; j++) if (y >= pk.joints[j]) si = j + 1;
      const seg = pk.segs[si % pk.segs.length];

      const u = x / S, v = y / S;
      let gx = u * 24 + seg.seed;
      let gy = v * 2;
      if (seg.knot) {
        const dx = lx - seg.knot.x;
        const dy = y - seg.knot.y;
        const d = Math.sqrt(dx * dx + dy * dy * 0.25);
        gx += Math.max(0, 1 - d / 60) * 0.6;
      }
      const g = fbm(grainN, gx, gy, 24, 2, 3);
      const streak = fbm(grainN, u * 192 + seg.seed * 7, v, 192, 1, 2);
      const rings = Math.pow(0.5 + 0.5 * Math.sin((g * 9 + seg.seed) * Math.PI), 4) * 0.55 + streak * 0.45;
      const wear = fbm(wearN, u * 6, v * 6, 6, 6, 3);

      let r = 176 + seg.tint - rings * 22 + (wear - 0.5) * 22;
      let gg = 161 + seg.tint * 0.9 - rings * 22 + (wear - 0.5) * 20;
      let b = 144 + seg.tint * 0.7 - rings * 18 + (wear - 0.5) * 16;
      // Grey weathering pulls toward a cool grey.
      const grey = (r + gg + b) / 3;
      r += (grey - r) * seg.grey;
      gg += (grey - gg) * seg.grey;
      b += (grey + 6 - b) * seg.grey;

      let bump = 150 + (0.5 - rings) * 40 + (wear - 0.5) * 30;
      let rough = 165 + (wear - 0.5) * 60 + rings * 30;

      if (seg.knot) {
        const dx = lx - seg.knot.x;
        const dy = (y - seg.knot.y) * 0.55;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < seg.knot.r) {
          const k = 1 - d / seg.knot.r;
          r -= 70 * k; gg -= 66 * k; b -= 58 * k;
          bump -= 30 * k;
        }
      }

      // Gaps between boards and at butt joints.
      const edge = Math.min(lx, PW - 1 - lx);
      let jointDist = 999;
      for (const j of pk.joints) jointDist = Math.min(jointDist, Math.abs(y - j));
      const gap = Math.min(edge, jointDist);
      if (gap < 2.2) {
        const k = gap < 1.2 ? 1 : 0.55;
        r = r * (1 - k) + 46 * k;
        gg = gg * (1 - k) + 42 * k;
        b = b * (1 - k) + 40 * k;
        bump = 20;
        rough = 250;
      } else if (gap < 5) {
        bump -= (5 - gap) * 14;
      }

      const i = (y * S + x) * 4;
      cimg.data[i] = r; cimg.data[i + 1] = gg; cimg.data[i + 2] = b; cimg.data[i + 3] = 255;
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = bump; bimg.data[i + 3] = 255;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough; rimg.data[i + 3] = 255;
    }
  }
  col.getContext('2d').putImageData(cimg, 0, 0);
  bmp.getContext('2d').putImageData(bimg, 0, 0);
  rgh.getContext('2d').putImageData(rimg, 0, 0);
  return {
    map: tex(col),
    bump: tex(bmp, { srgb: false }),
    rough: tex(rgh, { srgb: false }),
  };
}

// --- Basket: twined seagrass --------------------------------------------

export function makeWeave() {
  const W = 1024, H = 512;
  const col = canvas(W, H);
  const ctx = col.getContext('2d');
  const rnd = mulberry32(99);
  ctx.fillStyle = '#4c4637';
  ctx.fillRect(0, 0, W, H);
  const rowH = 28;
  for (let row = 0; row * rowH < H + rowH; row++) {
    const y = row * rowH + rowH / 2;
    const lean = row % 2 === 0 ? 0.55 : -0.55;
    for (let x = -20; x < W + 20; x += 15) {
      const shade = 0.82 + rnd() * 0.3;
      const r = 176 * shade, g = 166 * shade, b = 134 * shade;
      ctx.save();
      ctx.translate(x + (row % 2) * 7, y);
      ctx.rotate(lean);
      const grad = ctx.createLinearGradient(0, -9, 0, 9);
      grad.addColorStop(0, `rgb(${r * 0.62},${g * 0.62},${b * 0.62})`);
      grad.addColorStop(0.45, `rgb(${r},${g},${b})`);
      grad.addColorStop(1, `rgb(${r * 0.5},${g * 0.5},${b * 0.5})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // fibre striations
      ctx.strokeStyle = 'rgba(60,52,36,0.25)';
      ctx.lineWidth = 0.7;
      for (let s = -2; s <= 2; s++) {
        ctx.beginPath();
        ctx.moveTo(-11, s * 2.6);
        ctx.lineTo(11, s * 2.6 + (rnd() - 0.5));
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  const map = tex(col, { repeat: [3, 1] });

  const bmp = canvas(W, H);
  const bctx = bmp.getContext('2d');
  bctx.filter = 'grayscale(1) contrast(1.4)';
  bctx.drawImage(col, 0, 0);
  const bump = tex(bmp, { srgb: false, repeat: [3, 1] });
  return { map, bump };
}

// --- Paper grain (shared bump for posters) -------------------------------

export function makePaperGrain() {
  const S = 512;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const n = makeValueNoise(77);
  const rnd = mulberry32(5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = fbm(n, x / S * 48, y / S * 48, 48, 48, 3);
      const g = 128 + (v - 0.5) * 90 + (rnd() - 0.5) * 50;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // fibres
  for (let i = 0; i < 900; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 4 + rnd() * 14;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return c;
}

// --- Retro print treatment for a poster image ----------------------------

let grainCanvas = null;
function noiseCanvas() {
  if (grainCanvas) return grainCanvas;
  const S = 256;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rnd = mulberry32(1234);
  for (let i = 0; i < S * S; i++) {
    const v = 128 + (rnd() - 0.5) * 120;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

function halftonePattern(cell) {
  const c = canvas(cell, cell);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, cell, cell);
  const g = ctx.createRadialGradient(cell / 2, cell / 2, 0, cell / 2, cell / 2, cell * 0.5);
  g.addColorStop(0, '#303030');
  g.addColorStop(0.55, '#5a5a5a');
  g.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cell, cell);
  return c;
}

export function makeRetroPrint(img, seed, W, H) {
  const rnd = mulberry32(seed);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');

  // Paper stock
  ctx.fillStyle = '#ece6d7';
  ctx.fillRect(0, 0, W, H);

  // Ink: multiply so paper colour shows through the lights
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(img, 0, 0, W, H);
  // Slight plate misregistration ghost
  ctx.globalAlpha = 0.14;
  ctx.drawImage(img, 3 + rnd() * 2, 2 + rnd() * 2, W, H);
  ctx.globalAlpha = 1;

  // Faded blacks, cool cast
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(58,66,84,0.16)';
  ctx.fillRect(0, 0, W, H);

  // Halftone screen at a classic angle
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.22;
  ctx.save();
  ctx.rotate((15 * Math.PI) / 180);
  ctx.fillStyle = ctx.createPattern(halftonePattern(5), 'repeat');
  ctx.fillRect(-W, -H, W * 3, H * 3);
  ctx.restore();

  // Print grain
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = ctx.createPattern(noiseCanvas(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Ink drop-outs and dust
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 420; i++) {
    const r = rnd() < 0.9 ? 0.6 + rnd() * 1.2 : 2 + rnd() * 2.5;
    ctx.fillStyle = `rgba(240,236,226,${0.25 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Light scuffs
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
    ctx.lineWidth = 0.8 + rnd();
    ctx.beginPath();
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (60 + rnd() * 200), y + Math.sin(a) * (60 + rnd() * 200));
    ctx.stroke();
  }

  // Roll memory: faint horizontal-ish banding across the width
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5 + (rnd() - 0.5) * 0.4) * (W / 6);
    const g = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(222,218,210,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, 0, 60, H);
  }

  // Edge wear and yellowed margins
  const edge = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  edge.addColorStop(0, 'rgba(255,255,255,0)');
  edge.addColorStop(1, 'rgba(214,200,172,0.55)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(rnd() * 4);
    const t = rnd();
    const x = side === 0 ? 0 : side === 1 ? W : t * W;
    const y = side === 2 ? 0 : side === 3 ? H : t * H;
    ctx.beginPath();
    ctx.arc(x, y, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

export function makePaperBack(img, seed, W, H) {
  const rnd = mulberry32(seed + 1000);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e7e1d3';
  ctx.fillRect(0, 0, W, H);
  // Show-through of the print, mirrored
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.filter = 'blur(3px) grayscale(0.6)';
  ctx.drawImage(img, 0, 0, W, H);
  ctx.restore();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = ctx.createPattern(noiseCanvas(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Printer's mark on the back
  ctx.fillStyle = 'rgba(70,74,86,0.35)';
  ctx.font = `${Math.round(W * 0.022)}px ui-monospace, monospace`;
  ctx.fillText(`CORE / PRINT RUN 2026 — No. ${String(Math.floor(rnd() * 900) + 100)}`, W * 0.06, H * 0.96);
  return c;
}

// --- Masking tape --------------------------------------------------------

export function makeTape(seed) {
  const W = 256, H = 72;
  const rnd = mulberry32(seed);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(6, 0);
  for (let y = 0; y <= H; y += 4) ctx.lineTo(4 + rnd() * 7, y);
  ctx.lineTo(W - 6, H);
  for (let y = H; y >= 0; y -= 4) ctx.lineTo(W - 4 - rnd() * 7, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(232,222,196,0.86)';
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let x = 0; x < W; x += 3) {
    ctx.fillStyle = `rgba(160,146,110,${0.04 + rnd() * 0.06})`;
    ctx.fillRect(x, 0, 1, H);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, W, 4);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Record label + grooves ---------------------------------------------

export function makeVinylTop() {
  const S = 1024;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d0d0f';
  ctx.fillRect(0, 0, S, S);
  const cx = S / 2;
  const rnd = mulberry32(8);
  for (let r = S * 0.17; r < S * 0.495; r += 1.2) {
    const v = 14 + rnd() * 10;
    ctx.strokeStyle = `rgb(${v},${v},${v + 2})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // track separators
  for (const f of [0.24, 0.31, 0.38, 0.44]) {
    ctx.strokeStyle = '#050506';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cx, S * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  // label
  ctx.fillStyle = '#d4552a';
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.165, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efe6d6';
  ctx.font = `600 ${S * 0.045}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('C O R E', cx, cx - S * 0.06);
  ctx.font = `${S * 0.018}px ui-monospace, monospace`;
  ctx.fillText('SIDE A · 33⅓', cx, cx + S * 0.08);
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.008, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// --- Window light cookie for the spot light ------------------------------

export function makeWindowCookie() {
  const S = 512;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = '#fff';
  const pad = 70, mull = 16;
  const cols = 2, rows = 3;
  const cw = (S - pad * 2 - mull * (cols - 1)) / cols;
  const ch = (S - pad * 2 - mull * (rows - 1)) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.fillRect(pad + i * (cw + mull), pad + j * (ch + mull), cw, ch);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Soft contact shadow blob -------------------------------------------

export function makeContactShadow() {
  const S = 256;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export function makeLinearShadow() {
  const c = canvas(4, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}
