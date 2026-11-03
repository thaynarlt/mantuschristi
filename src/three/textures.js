import * as THREE from "three";

// Texturas geradas em canvas: nada para baixar, tudo nítido em qualquer tela.

const canvas = (w, h = w) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function heightToNormal(height, w, h, strength) {
  const c = canvas(w, h), g = c.getContext("2d"), img = g.createImageData(w, h);
  const at = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

// malha de meia (jersey): colunas de pontos em "V"
export function knitNormalTexture(renderer) {
  // colunas estreitas de "V" (como no jersey de verdade); de longe viram um fio vertical bem fino
  const S = 512, wales = 26, courses = 19;
  const cw = S / wales, ch = S / courses;
  const hgt = new Float32Array(S * S);
  const jitter = Array.from({ length: wales * courses }, () => [rnd() * 0.12 - 0.06, 0.85 + rnd() * 0.3]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ci = Math.floor(x / cw), ri = Math.floor(y / ch);
      const lx = (x % cw) / cw, ly = (y % ch) / ch;
      const [jx, jh] = jitter[(ri % courses) * wales + (ci % wales)];
      const dl = segDist(lx, ly, 0.08 + jx, -0.15, 0.5, 1.05);
      const dr = segDist(lx, ly, 0.92 + jx, -0.15, 0.5, 1.05);
      const leg = (d) => Math.max(0, 1 - d / 0.24) ** 0.75;
      hgt[y * S + x] = Math.max(leg(dl), leg(dr)) * jh + (rnd() - 0.5) * 0.06;
    }
  }
  const tex = new THREE.CanvasTexture(heightToNormal(hgt, S, S, 2.6));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// ribana (gola, barras)
export function ribNormalTexture(renderer) {
  const S = 256, ribs = 10;
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = Math.cos((x / S) * ribs * Math.PI * 2);
      hgt[y * S + x] = Math.sign(v) * Math.abs(v) ** 0.6 * 0.5 + 0.5 + (rnd() - 0.5) * 0.04;
    }
  }
  const tex = new THREE.CanvasTexture(heightToNormal(hgt, S, S, 3.2));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// variação de cor do algodão (mescla bem sutil)
export function grainTexture(renderer) {
  const S = 512, c = canvas(S), g = c.getContext("2d"), img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = (0.955 + (rnd() - 0.5) * 0.05) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // manchas alongadas na horizontal (o fio corre ao longo da carreira), repetidas nas bordas para o tile fechar
  for (let k = 0; k < 140; k++) {
    const bx = rnd() * S, by = rnd() * S, r = 5 + rnd() * 18, a = rnd() * 0.016;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      g.save();
      g.translate(bx + ox, by + oy);
      g.scale(3, 1);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, `rgba(0,0,0,${a})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.25, 0.25);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// folhas douradas (as mesmas da arte): amêndoa e bordo
export function leafTextures() {
  const make = (draw) => {
    const S = 256, c = canvas(S), g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    g.scale(S / 2.2, -S / 2.2);
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const almond = make((g) => {
    g.beginPath();
    g.moveTo(0, 1);
    g.bezierCurveTo(0.62, 0.55, 0.58, -0.45, 0.02, -0.98);
    g.bezierCurveTo(-0.5, -0.5, -0.6, 0.5, 0, 1);
    g.fillStyle = "#fff"; g.fill();
    g.beginPath(); g.moveTo(0, 0.95); g.quadraticCurveTo(0.06, 0, 0.0, -0.9);
    g.lineWidth = 0.045; g.strokeStyle = "rgba(150,110,60,0.9)"; g.stroke();
  });
  const maple = make((g) => {
    const pts = [[0, 1], [0.12, 0.62], [0.36, 0.78], [0.3, 0.45], [0.62, 0.52], [0.5, 0.28], [0.92, 0.25], [0.6, 0.02], [0.72, -0.18], [0.36, -0.12], [0.3, -0.42], [0.06, -0.28], [0.035, -0.8]];
    const all = [...pts, ...pts.slice(1).reverse().map(([x, y]) => [-x, y])];
    g.beginPath();
    all.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath(); g.fillStyle = "#fff"; g.fill();
    g.strokeStyle = "rgba(150,110,60,0.85)"; g.lineWidth = 0.035;
    for (const [x, y] of [[0, 0.9], [0.7, 0.32], [-0.7, 0.32], [0.5, -0.1], [-0.5, -0.1]]) { g.beginPath(); g.moveTo(0, -0.2); g.lineTo(x * 0.85, y * 0.85); g.stroke(); }
  });
  return [almond, maple];
}

export function dustSprite() {
  const S = 64, c = canvas(S), g = c.getContext("2d");
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
