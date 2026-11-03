import * as THREE from "three";

// Camiseta modelada por código (estilo "manequim invisível").
// Unidade = largura visível do peito (~39 cm). y = 0 na altura da axila; o ombro mais alto (HPS) fica em ~0,43.
//
// Realismo em camadas:
//  1. forma de repouso (tronco, ombros, mangas) — onde as estampas ficam "presas";
//  2. caimento: dobras deslocam a malha (barra em leque, franzido na cintura, tração das axilas, mangas);
//  3. oclusão: vincos e junções (manga/tronco, gola) escurecem, assado nos vértices;
//  4. no shader: relevo da tinta, pespontos da barra e da manga, costura do ombro, malha do tecido.

// --------------------------------------------------------------------------
// utilitários
// --------------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

const perm = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  let s = 20260428;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const g = (h, a, b, c) => { const q = G3[h % 12]; return q[0] * a + q[1] * b + q[2] * c; };
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(
    lerp(lerp(g(perm[AA], x, y, z), g(perm[BA], x - 1, y, z), u), lerp(g(perm[AB], x, y - 1, z), g(perm[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(g(perm[AA + 1], x, y, z - 1), g(perm[BA + 1], x - 1, y, z - 1), u), lerp(g(perm[AB + 1], x, y - 1, z - 1), g(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
    w
  );
}

// curva suave (Catmull-Rom) por pontos de controle [y, valor]
function profile(points) {
  return (y) => {
    if (y <= points[0][0]) return points[0][1];
    if (y >= points[points.length - 1][0]) return points[points.length - 1][1];
    let i = 0;
    while (y > points[i + 1][0]) i++;
    const [y0, v0] = points[i], [y1, v1] = points[i + 1];
    const t = (y - y0) / (y1 - y0), t2 = t * t, t3 = t2 * t;
    const vm = points[i - 1]?.[1] ?? v0, vp = points[i + 2]?.[1] ?? v1;
    return 0.5 * (2 * v0 + (-vm + v1) * t + (2 * vm - 5 * v0 + 4 * v1 - vp) * t2 + (-vm + 3 * v0 - 3 * v1 + vp) * t3);
  };
}

// --------------------------------------------------------------------------
// medidas
// --------------------------------------------------------------------------
// Corpo "vestido" num manequim invisível: peito cheio na frente, costas mais retas, leve cintura.
export const DIM = {
  hemY: -1.2,
  hpsY: 0.44,
  halfW: profile([[-1.2, 0.462], [-0.95, 0.448], [-0.7, 0.442], [-0.45, 0.458], [-0.2, 0.49], [0, 0.505], [0.15, 0.505], [0.3, 0.488]]),
  depthFront: profile([[-1.2, 0.25], [-0.95, 0.243], [-0.7, 0.246], [-0.45, 0.264], [-0.2, 0.296], [0, 0.306], [0.15, 0.282], [0.3, 0.208]]),
  depthBack: profile([[-1.2, 0.26], [-0.95, 0.258], [-0.7, 0.252], [-0.45, 0.255], [-0.2, 0.264], [0, 0.272], [0.15, 0.268], [0.3, 0.222]]),
  exp: 2.25,
  neck: { a: 0.172, b: 0.136, z: -0.028, frontDrop: 0.12, backDrop: 0.028 },
  // estampas (coordenadas do objeto): x esquerdo/direito, y do topo, largura
  back: { cx: 0, top: 0.215, width: 0.7 },
  front: { cx: 0.24, top: 0.06, width: 0.2 },
};
// profundidade da seção: frente (peito) e costas são diferentes
DIM.halfD = (y, s = 1) => (s >= 0 ? DIM.depthFront(y) : DIM.depthBack(y));

const superXZ = (theta, a, y, n = DIM.exp) => {
  const c = Math.cos(theta), s = Math.sin(theta), e = 2 / n;
  return [a * Math.sign(c) * Math.abs(c) ** e, DIM.halfD(y, s) * Math.sign(s) * Math.abs(s) ** e];
};
const capStartY = (theta) => {
  const s = Math.sin(theta);
  return 0.3 - 0.17 * Math.max(0, s) ** 1.2 - 0.08 * Math.max(0, -s) ** 1.2;
};
const neckPoint = (theta) => {
  const { a, b, z, frontDrop, backDrop } = DIM.neck;
  const s = Math.sin(theta);
  const y = DIM.hpsY - frontDrop * Math.max(0, s) ** 1.5 - backDrop * Math.max(0, -s) ** 1.5;
  return [a * Math.cos(theta), y, z + b * s];
};

// Manga em pose de "A": sai quase na linha do ombro e desce para fora (~45°), um pouco para a frente.
function sleeveCurve(side) {
  const s = side;
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0.3 * s, 0.2, -0.02),
    new THREE.Vector3(0.5 * s, 0.15, -0.012),
    new THREE.Vector3(0.78 * s, -0.16, 0.05)
  );
}
const sleeveRadius = (v) => lerp(0.185, 0.153, smoothstep(0.1, 1, v)) * (1 + 0.03 * Math.exp(-(((v - 0.93) / 0.05) ** 2)));

// --------------------------------------------------------------------------
// caimento (deslocamento ao longo da normal, em unidades; 0,02 ≈ 8 mm)
// Camiseta vestida: superfície lisa, só vincos suaves onde o tecido sobra.
// --------------------------------------------------------------------------
// perfil de prega: crista arredondada, vale vincado
const pleat = (s) => 2 * Math.sqrt(Math.cos(s / 2) ** 2 + 0.02) - 1.1;
// [x0, y0, x1, y1, largura, amplitude] — vincos longos e suaves (cristas + e vales −)
const FOLDS_FRONT = [
  [0.4, -0.25, 0.12, -0.98, 0.09, 0.008],
  [-0.38, -0.4, -0.16, -1.05, 0.09, 0.007],
  [-0.3, -0.62, -0.42, -1.1, 0.06, -0.005],
];
const FOLDS_BACK = [
  [-0.42, -0.35, -0.2, -1.06, 0.09, 0.008],
  [0.42, -0.5, 0.26, -1.1, 0.08, 0.007],
];

function torsoDrape(x, y, z, theta) {
  const side = Math.abs(Math.cos(theta)); // 1 nas laterais, 0 no meio da frente/costas
  // a tinta deixa o tecido mais firme: áreas estampadas enrugam menos
  const backInk = z < 0 ? smoothstep(0.42, 0.3, Math.abs(x)) * smoothstep(-1.02, -0.86, y) * smoothstep(0.3, 0.16, y) : 0;
  const frontInk = z > 0 ? Math.exp(-(((x - 0.24) / 0.14) ** 2) - ((y + 0.02) / 0.12) ** 2) : 0;
  const stiff = 1 - 0.6 * Math.max(backInk, frontInk);

  // 1. ondulação larga e suave (o tecido nunca é perfeitamente esticado)
  let d = (noise3(x * 1.3 + 11, y * 1.1, z * 1.3) * 0.0048 + noise3(x * 3.4, y * 3.2 + 3, z * 3.4) * 0.0014) * stiff;

  // 2. barra: só uma leve ondulação (a barra fica limpa)
  const hang = smoothstep(-0.7, -1.2, y);
  d += Math.sin(theta * 7 + noise3(Math.cos(theta) * 1.2, 4.2, Math.sin(theta) * 1.2) * 2) * 0.0055 * hang * (0.5 + 0.5 * side);

  // 3. vincos na cintura, nas laterais (onde o tecido sobra)
  const waist = Math.exp(-(((y + 0.68) / 0.26) ** 2));
  d += Math.sin(y * 26 + noise3(x * 2, y * 1.4, z * 2) * 2.6) * 0.0055 * waist * side ** 3 * stiff;

  // 4. tração saindo das axilas (frente e costas) — os vincos diagonais da referência
  for (const sx of [-1, 1]) {
    const ax = x - sx * 0.47, ay = y + 0.06;
    const along = ax * -sx * 0.55 + ay * -0.835;
    const across = ax * 0.835 + ay * -sx * 0.55;
    const env = smoothstep(-0.02, 0.08, along) * Math.exp(-along / 0.34) * Math.exp(-((across / 0.15) ** 2));
    d += Math.sin(across * 34 + along * 5) * 0.0135 * env * (1 - 0.6 * backInk);
  }

  // 5. vincos longos e diagonais (diferentes na frente e nas costas)
  for (const [x0, y0, x1, y1, w, amp] of z >= 0 ? FOLDS_FRONT : FOLDS_BACK) {
    const vx = x1 - x0, vy = y1 - y0;
    const t = clamp01(((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy));
    const dist = Math.hypot(x - (x0 + vx * t), y - (y0 + vy * t));
    d += amp * Math.exp(-((dist / w) ** 2)) * Math.sin(Math.PI * t) ** 0.8 * stiff;
  }
  return d;
}

function sleeveDrape(x, y, z, v, phi, side) {
  const under = smoothstep(0.35, -0.7, Math.cos(phi)); // lado de baixo, voltado para o corpo
  const visible = smoothstep(0.3, 0.5, v); // a raiz da manga fica dentro do tronco
  let d = noise3(x * 2.6 + side * 5, y * 2.6, z * 2.6) * 0.0035;
  // vincos embaixo do braço, perto da axila
  d += Math.sin(v * 30 + noise3(x * 4, y * 4, z * 4) * 2) * 0.007 * under * Math.exp(-(((v - 0.55) / 0.16) ** 2));
  // a manga "assenta" um pouco mais embaixo do que em cima
  d += (0.5 - 0.5 * Math.cos(phi)) * 0.004 * visible;
  // boca da manga levemente ondulada
  d += Math.sin(phi * 2 + side * 0.9) * 0.0035 * smoothstep(0.8, 1, v);
  return d;
}

// --------------------------------------------------------------------------
// malhas em grade (u dá a volta, v percorre a peça)
// --------------------------------------------------------------------------
const TILE = 0.055; // tamanho de um "quadro" da textura de malha
const NO_DETAIL = [1, 0, 1];

function gridGeometry(cols, rows, fn, { flip = false } = {}) {
  // fn(u, v) -> { p, uv, det?, ao?, drape? }. A coluna final repete a primeira (u = 1)
  // para a textura não "esticar" na emenda; as normais da emenda são unificadas depois.
  const nu = cols + 1, count = nu * (rows + 1);
  const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), det = new Float32Array(count * 3);
  const ao = new Float32Array(count), drape = new Float32Array(count);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * nu + i, r = fn(i / cols, j / rows);
      pos.set(r.p, k * 3);
      uv.set(r.uv, k * 2);
      det.set(r.det ?? NO_DETAIL, k * 3);
      ao[k] = r.ao ?? 1;
      drape[k] = r.drape ?? 0;
    }
  }
  const idx = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * nu + i, b = j * nu + i + 1, c = (j + 1) * nu + i + 1, d = (j + 1) * nu + i;
      if (flip) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("aDetail", new THREE.BufferAttribute(det, 3));
  g.setIndex(idx);
  g.userData.grid = { nu, rows };
  g.userData.ao = ao;
  g.userData.drape = drape;
  return g;
}

function computeNormals(geo) {
  geo.computeVertexNormals();
  const { nu, rows } = geo.userData.grid;
  const n = geo.attributes.normal, v = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const a = j * nu, b = j * nu + nu - 1;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}

// guarda a forma de repouso (onde a estampa fica presa) e aplica o caimento
function drapeGeometry(geo) {
  geo.setAttribute("restPos", geo.attributes.position.clone());
  computeNormals(geo);
  const p = geo.attributes.position, n = geo.attributes.normal, d = geo.userData.drape;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * d[i], p.getY(i) + n.getY(i) * d[i], p.getZ(i) + n.getZ(i) * d[i]);
  }
  computeNormals(geo);
  return geo;
}

// oclusão ambiente por vértice: vincos (curvatura) + proximidade entre peças + o que o gerador já sabe
function bakeAO(geo, { cavityStep = 3, strength = 95, occlusion = null } = {}) {
  const { nu, rows } = geo.userData.grid, cols = nu - 1;
  const P = geo.attributes.position, N = geo.attributes.normal, base = geo.userData.ao;
  const out = new Float32Array(P.count);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3(), avg = new THREE.Vector3();
  const at = (i, j) => q.fromBufferAttribute(P, j * nu + (((i % cols) + cols) % cols));
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * nu + i;
      p.fromBufferAttribute(P, k);
      n.fromBufferAttribute(N, k);
      let a = base[k];
      if (cavityStep) {
        avg.set(0, 0, 0);
        let c = 0;
        avg.add(at(i + cavityStep, j)).add(at(i - cavityStep, j)); c += 2;
        if (j - cavityStep >= 0 && j + cavityStep <= rows) { avg.add(at(i, j + cavityStep)).add(at(i, j - cavityStep)); c += 2; }
        const cav = avg.divideScalar(c).sub(p).dot(n); // > 0: côncavo (fundo de dobra)
        a *= 1 - Math.min(0.42, Math.max(0, cav * strength));
      }
      if (occlusion) a *= occlusion(p, n);
      out[k] = a;
    }
  }
  geo.setAttribute("aAO", new THREE.BufferAttribute(out, 1));
  return geo;
}

// ---------------------------------------------------------------- tronco
function torsoGeometry(cols = 220, tubeRows = 150, capRows = 46, bake = true) {
  const rows = tubeRows + capRows;
  const tubeV = tubeRows / rows;
  const geo = gridGeometry(cols, rows, (u, v) => {
    const theta = u * TAU;
    const ys = capStartY(theta);
    let x, y, z, cap = 0;
    if (v <= tubeV) {
      const t = v / tubeV;
      // mais resolução perto do ombro
      y = lerp(DIM.hemY, ys, 1 - (1 - t) ** 1.25);
      [x, z] = superXZ(theta, DIM.halfW(y), y);
    } else {
      const t = (v - tubeV) / (1 - tubeV);
      cap = t;
      const [xs, zs] = superXZ(theta, DIM.halfW(ys), ys);
      const [xn, yn, zn] = neckPoint(theta);
      const k = Math.abs(Math.sin(theta)) ** 1.3;
      // nas laterais: ombro arredondado (deltoide) que vira rampa até a gola; na frente/costas: rampa suave
      const hSide = lerp(1 - Math.cos((t * Math.PI) / 2), t, 0.45), vSide = lerp(Math.sin((t * Math.PI) / 2), t, 0.45);
      const h = lerp(hSide, t ** 1.3, k);
      const vv = lerp(vSide, t ** 0.9, k);
      x = lerp(xs, xn, h); z = lerp(zs, zn, h); y = lerp(ys, yn, vv);
      y += Math.sin(t * Math.PI) * 0.008 * (1 - k);
    }
    // detalhes para o shader: distância até a barra, coordenada dos pontos de costura,
    // distância até a costura (lateral no corpo, de ombro no topo)
    const seamAngle = Math.min(Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta))), Math.abs(Math.atan2(Math.sin(theta - Math.PI), Math.cos(theta - Math.PI))));
    const seam = cap > 0.985 || y < DIM.hemY + 0.03 ? 1 : seamAngle * (cap > 0 ? 0.2 : DIM.halfD(y, Math.sin(theta)));
    return {
      p: [x, y, z],
      uv: [(u * 2.45) / TILE, y / TILE],
      det: [y - DIM.hemY, (u * 2.45 * TAU) / 0.0085, seam],
      ao: 1 - 0.24 * smoothstep(0.78, 1, cap), // sombra da gola sobre o tecido
      drape: torsoDrape(x, y, z, theta),
    };
  });
  drapeGeometry(geo);
  if (bake) bakeAO(geo, { occlusion: torsoOcclusion });
  return geo;
}

// ---------------------------------------------------------------- mangas
function sleeveGeometry(side, cols = 96, rows = 70, bake = true) {
  const curve = sleeveCurve(side);
  const len = curve.getLength();
  const Z = new THREE.Vector3(0, 0, 1);
  const geo = gridGeometry(cols, rows, (u, v) => {
    const P = curve.getPoint(v), T = curve.getTangent(v).normalize();
    const N = new THREE.Vector3().crossVectors(T, Z).multiplyScalar(-side).normalize(); // lado de fora da manga
    const B = new THREE.Vector3().crossVectors(N, T).normalize();
    if (B.z < 0) B.negate();
    const phi = u * TAU + Math.PI; // emenda no lado de dentro da manga
    const r = sleeveRadius(v);
    const p = P.clone().addScaledVector(N, Math.cos(phi) * r).addScaledVector(B, Math.sin(phi) * r * 0.8);
    return {
      p: p.toArray(),
      uv: [(u * 0.92) / TILE, (v * 0.42) / TILE],
      det: [(1 - v) * len, (u * 0.88 * TAU) / 0.0085, 1],
      drape: sleeveDrape(p.x, p.y, p.z, v, phi, side),
    };
  }, { flip: side > 0 });
  drapeGeometry(geo);
  if (bake) bakeAO(geo, { occlusion: sleeveOcclusion });
  return geo;
}

// ---------------------------------------------------------------- oclusão entre peças
const SLEEVE_SAMPLES = [-1, 1].map((side) => {
  const c = sleeveCurve(side);
  return Array.from({ length: 48 }, (_, s) => ({ p: c.getPoint(s / 47), r: sleeveRadius(s / 47) }));
});
const _dir = new THREE.Vector3();

// o tronco escurece embaixo das mangas e perto da cava
function torsoOcclusion(p, n) {
  let a = 1;
  for (const samples of SLEEVE_SAMPLES) {
    let best = Infinity, bp = null, br = 0;
    for (const s of samples) {
      const d = s.p.distanceToSquared(p);
      if (d < best) { best = d; bp = s.p; br = s.r; }
    }
    const gap = Math.sqrt(best) - br;
    if (gap < 0.17) {
      const facing = clamp01(n.dot(_dir.subVectors(bp, p).normalize()) * 1.3 + 0.15);
      const k = (1 - clamp01(gap / 0.17)) ** 2;
      a *= 1 - 0.58 * k * facing;
    }
  }
  return a;
}

// a parte de dentro da manga (voltada para o corpo) escurece
function sleeveOcclusion(p, n) {
  if (p.y < DIM.hemY || p.y > 0.26) return 1;
  const a = DIM.halfW(p.y), b = DIM.halfD(p.y, p.z), e = DIM.exp;
  const r = ((Math.abs(p.x) / a) ** e + (Math.abs(p.z) / b) ** e) ** (1 / e);
  const gap = (r - 1) * a;
  if (gap < 0) return 0.45; // trecho escondido dentro do tronco
  if (gap > 0.17) return 1;
  const facing = clamp01(n.dot(_dir.set(-p.x, 0, -p.z).normalize()) * 1.3 + 0.1);
  return 1 - 0.5 * (1 - gap / 0.17) ** 2 * facing;
}

// ---------------------------------------------------------------- gola, barra e punhos
// Faixa de ribana que acompanha uma linha da malha já com caimento (assim nunca "descola" do tecido).
function bandFromRow(src, row, { frame = null, upHint, out, lift, rA, rB }) {
  const { nu } = src.userData.grid, cols = nu - 1;
  const P = src.attributes.position, N = src.attributes.normal;
  const pts = [], nrm = [];
  for (let i = 0; i < nu; i++) {
    pts.push(new THREE.Vector3().fromBufferAttribute(P, row * nu + i));
    nrm.push(new THREE.Vector3().fromBufferAttribute(N, row * nu + i));
  }
  const arc = [0];
  for (let i = 1; i < nu; i++) arc.push(arc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const frames = pts.map((p, i) => {
    const T = pts[(i + 1) % cols].clone().sub(pts[(i - 1 + cols) % cols]).normalize();
    const A = frame ? frame(p, nrm[i]) : nrm[i].clone();
    const B = new THREE.Vector3().crossVectors(T, A).normalize();
    return { A, B };
  });
  const flip = frames[0].B.dot(upHint) < 0;
  const geo = gridGeometry(cols, 16, (u, v) => {
    const i = Math.round(u * cols);
    const { A } = frames[i];
    const B = flip ? frames[i].B.clone().negate() : frames[i].B;
    const phi = v * TAU;
    const p = pts[i].clone()
      .addScaledVector(A, out + Math.cos(phi) * rA)
      .addScaledVector(B, lift + Math.sin(phi) * rB);
    return {
      p: p.toArray(),
      uv: [arc[i] / (TILE * 0.55), (v * 0.08) / TILE],
      ao: 0.6 + 0.4 * smoothstep(-0.9, 0.55, Math.cos(phi)),
    };
  }, { flip });
  geo.setAttribute("restPos", geo.attributes.position.clone());
  computeNormals(geo);
  bakeAO(geo, { cavityStep: 0 });
  return geo;
}

// Borda dobrada (barra e boca da manga): um friso arredondado com o centro um pouco para dentro,
// de modo que a face de fora fica rente ao tecido e só a dobra da borda aparece.
const HEM_EDGE = (upHint) => ({ upHint, out: -0.0033, lift: 0.0008, rA: 0.0043, rB: 0.0046 });

// Gola: a faixa de ribana continua a rampa do ombro/peito e se curva para cima, abraçando
// a base do pescoço (rente ao corpo na frente, mais em pé nas costas) — nunca um "aro" em pé.
function collarFromTorso(src, { rA = 0.0045, rB = 0.0195, curl = 0.85 } = {}) {
  const { nu, rows } = src.userData.grid, cols = nu - 1;
  const P = src.attributes.position, N = src.attributes.normal;
  const up = new THREE.Vector3(0, 1, 0);
  const pts = [], frames = [];
  for (let i = 0; i < nu; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(P, rows * nu + i);
    const q = new THREE.Vector3().fromBufferAttribute(P, (rows - 3) * nu + i);
    const n = new THREE.Vector3().fromBufferAttribute(N, rows * nu + i);
    const B = p.clone().sub(q).normalize().addScaledVector(up, curl).normalize(); // sentido da faixa
    pts.push(p);
    frames.push({ B, n });
  }
  const arc = [0];
  for (let i = 1; i < nu; i++) arc.push(arc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  frames.forEach((f, i) => {
    const T = pts[(i + 1) % cols].clone().sub(pts[(i - 1 + cols) % cols]).normalize();
    f.A = new THREE.Vector3().crossVectors(f.B, T).normalize(); // espessura, para fora
  });
  const flip = frames[0].A.dot(frames[0].n) < 0;
  const geo = gridGeometry(cols, 18, (u, v) => {
    const i = Math.round(u * cols);
    const { B } = frames[i];
    const A = flip ? frames[i].A.clone().negate() : frames[i].A;
    const phi = v * TAU;
    const p = pts[i].clone()
      .addScaledVector(A, -0.0018 + Math.cos(phi) * rA)
      .addScaledVector(B, rB * 0.78 + Math.sin(phi) * rB);
    return {
      p: p.toArray(),
      uv: [arc[i] / (TILE * 0.55), (v * 0.08) / TILE],
      // lado de dentro (voltado para o pescoço) e a emenda com o corpo ficam mais escuros
      ao: (0.62 + 0.38 * smoothstep(-0.9, 0.55, Math.cos(phi))) * (0.78 + 0.22 * smoothstep(-1, -0.25, Math.sin(phi))),
    };
  }, { flip });
  geo.setAttribute("restPos", geo.attributes.position.clone());
  computeNormals(geo);
  bakeAO(geo, { cavityStep: 0 });
  return geo;
}

// --------------------------------------------------------------------------
// material de tecido com estampas presas à forma de repouso
// --------------------------------------------------------------------------
const VERT_HEAD = /* glsl */ `
attribute vec3 restPos;
attribute float aAO;
attribute vec3 aDetail;
varying vec3 vRest;
varying float vAO;
varying vec3 vDetail;
`;

const FRAG_HEAD = /* glsl */ `
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform vec4 uFrontRect;   // x esquerda, y topo, largura, altura
uniform vec4 uBackRect;    // x (esquerda vista de trás), y topo, largura, altura
uniform float uPrints;
uniform vec4 uMedals[10];  // retângulos dos medalhões em uv da arte (u0, v0, u1, v1), v para baixo
uniform float uHover;
uniform float uHoverAmt;
uniform float uFocus;
uniform float uFocusAmt;
uniform vec3 uInner;
uniform float uTime;
varying vec3 vRest;
varying float vAO;
varying vec3 vDetail;
float printA = 0.0;
float goldA = 0.0;
float groove = 0.0;
vec3 glowCol = vec3(0.0);
float medal(vec2 uv, vec4 m) {
  vec2 c = (m.xy + m.zw) * 0.5;
  vec2 r = (m.zw - m.xy) * vec2(0.56, 0.54);
  return 1.0 - smoothstep(0.82, 1.06, length((uv - c) / r));
}
// relevo por derivadas de tela (mesma ideia do bump map do three.js)
vec3 bumpNormal(vec3 surfPos, vec3 surfNorm, float h, float faceDir) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * surfNorm - grad);
}
float sq(float x) { return x * x; }
// pespontos (barra e manga) e costura do ombro; somem quando ficam menores que um pixel
float stitchHeight(vec3 d) {
  float fx = fwidth(d.x), fz = fwidth(d.z);
  float near1 = 1.0 - smoothstep(0.0012, 0.0035, fx);
  float near2 = 1.0 - smoothstep(0.0015, 0.004, fz);
  float dash = mix(smoothstep(-0.2, 0.6, sin(d.y)), 0.65, smoothstep(0.6, 2.0, fwidth(d.y)));
  // um pesponto só, a ~1,2 cm da borda, e a costura (lateral/ombro)
  float g1 = exp(-sq((d.x - 0.031) / 0.0015));
  float g2 = exp(-sq(d.z / 0.0026));
  groove = clamp(g1 * dash * near1 * 0.7 + g2 * near2, 0.0, 1.0);
  return -0.00024 * g1 * dash * near1 - 0.0005 * g2 * near2;
}
`;

// As texturas são lidas sempre (fora de "if") para o mipmap não errar nas bordas da estampa.
const FRAG_PRINT = /* glsl */ `
{
  float face = gl_FrontFacing ? 1.0 : 0.0;
  vec2 uvF = vec2((vRest.x - uFrontRect.x) / uFrontRect.z, (uFrontRect.y - vRest.y) / uFrontRect.w);
  vec2 uvB = vec2((uBackRect.x - vRest.x) / uBackRect.z, (uBackRect.y - vRest.y) / uBackRect.w);
  vec4 pf = texture2D(uFront, vec2(uvF.x, 1.0 - uvF.y));
  vec4 pb = texture2D(uBack, vec2(uvB.x, 1.0 - uvB.y));
  float inF = step(0.0, uvF.x) * step(uvF.x, 1.0) * step(0.0, uvF.y) * step(uvF.y, 1.0) * step(0.0, vRest.z);
  float inB = step(0.0, uvB.x) * step(uvB.x, 1.0) * step(0.0, uvB.y) * step(uvB.y, 1.0) * step(vRest.z, 0.0);
  float inFocus = 0.0;
  float inHover = 0.0;
  for (int i = 0; i < 10; i++) {
    float m = medal(uvB, uMedals[i]);
    float fi = float(i);
    inFocus += m * (1.0 - step(0.5, abs(fi - uFocus)));
    inHover += m * (1.0 - step(0.5, abs(fi - uHover)));
  }
  pb.rgb *= mix(1.0, mix(0.2, 1.0, inFocus), uFocusAmt);
  pf.a *= inF * face * uPrints;
  pb.a *= inB * face * uPrints;
  vec4 pc = vec4(pf.rgb * pf.a + pb.rgb * pb.a, pf.a + pb.a);
  pc.rgb /= max(pc.a, 1e-4);
  glowCol = pb.rgb * pb.a * inHover * uHoverAmt * 0.32;
  #ifdef USE_MAP
    pc.rgb *= mix(1.0, sampledDiffuseColor.r * 1.08, 0.4);
  #endif
  printA = pc.a;
  goldA = pc.a * smoothstep(0.2, 0.42, pc.r - pc.b);
  diffuseColor.rgb = mix(diffuseColor.rgb, pc.rgb, pc.a);
  // avesso: o mesmo tecido visto por dentro, um pouco mais escuro quanto mais "fundo" na peça
  vec3 inner = uInner * mix(0.7, 1.0, smoothstep(-0.6, 0.4, vRest.y));
  diffuseColor.rgb = mix(inner, diffuseColor.rgb, face);
  diffuseColor.rgb *= vAO;
}
`;

const FRAG_BUMP = /* glsl */ `
{
  float h = printA * 0.00009 + stitchHeight(vDetail);
  normal = bumpNormal(-vViewPosition, normal, h, faceDirection);
  diffuseColor.rgb *= 1.0 - 0.22 * groove;
}
`;

export function createFabricMaterial({ color, grainMap, normalMap, prints = null, shared = {} }) {
  const uniforms = {
    uFront: { value: prints?.front ?? null },
    uBack: { value: prints?.back ?? null },
    uFrontRect: { value: new THREE.Vector4() },
    uBackRect: { value: new THREE.Vector4() },
    uPrints: { value: prints ? 1 : 0 },
    uMedals: { value: Array.from({ length: 10 }, () => new THREE.Vector4(-1, -1, -1, -1)) },
    uHover: shared.uHover ?? { value: -1 },
    uHoverAmt: shared.uHoverAmt ?? { value: 0 },
    uFocus: shared.uFocus ?? { value: -1 },
    uFocusAmt: shared.uFocusAmt ?? { value: 0 },
    uInner: { value: new THREE.Color("#3a131d") },
    uTime: shared.uTime ?? { value: 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    map: grainMap,
    normalMap,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 0.95,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color("#7a4a58"),
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = restPos;\nvAO = aAO;\nvDetail = aDetail;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_PRINT}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, printA);\nroughnessFactor = mix(roughnessFactor, 0.42, goldA);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.45, goldA);")
      .replace("mapN.xy *= normalScale;", "mapN.xy *= normalScale * (1.0 - printA * 0.86);")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_BUMP}`)
      .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor *= (1.0 - printA * 0.85) * vAO;\n#endif")
      // avesso: luz rebatida (não vira um buraco preto) e menos luz direta (sem reflexo dourado lá dentro)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += glowCol + (gl_FrontFacing ? vec3(0.0) : uInner * 0.55 * vAO);")
      .replace("#include <opaque_fragment>", "if (!gl_FrontFacing) outgoingLight *= 0.62;\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey = () => (prints ? "mc-fabric2-print" : "mc-fabric2");
  mat.userData.uniforms = uniforms;
  return mat;
}

// --------------------------------------------------------------------------
// a camisa
// --------------------------------------------------------------------------
export class Shirt {
  constructor({ textures, medallions, color, light = false }) {
    this.group = new THREE.Group();   // posição/rotação controladas pela cena
    this.pivot = new THREE.Group();   // centraliza a camisa no próprio eixo
    this.group.add(this.pivot);
    this.pivot.position.y = 0.4;

    const shared = {
      uHover: { value: -1 }, uHoverAmt: { value: 0 },
      uFocus: { value: -1 }, uFocusAmt: { value: 0 },
      uTime: { value: 0 },
    };
    this.shared = shared;

    const back = DIM.back, front = DIM.front;
    const backAspect = textures.back.image.width / textures.back.image.height;
    const frontAspect = textures.front.image.width / textures.front.image.height;
    this.backRect = new THREE.Vector4(back.cx + back.width / 2, back.top, back.width, back.width / backAspect);
    this.frontRect = new THREE.Vector4(front.cx - front.width / 2, front.top, front.width, front.width / frontAspect);

    this.printMat = createFabricMaterial({ color, grainMap: textures.grain, normalMap: textures.knit, prints: { front: textures.front, back: textures.back }, shared });
    this.printMat.userData.uniforms.uBackRect.value.copy(this.backRect);
    this.printMat.userData.uniforms.uFrontRect.value.copy(this.frontRect);
    medallions.forEach((m, i) => this.printMat.userData.uniforms.uMedals.value[i].set(m.x0, m.y0, m.x1, m.y1));
    this.plainMat = createFabricMaterial({ color, grainMap: textures.grain, normalMap: textures.knit, shared });
    this.ribMat = createFabricMaterial({ color, grainMap: textures.grain, normalMap: textures.rib, shared });
    this.ribMat.normalScale.set(0.75, 0.75);

    // no celular, malha mais leve (metade dos triângulos) com o mesmo caimento
    const torsoGeo = light ? torsoGeometry(150, 104, 32) : torsoGeometry();
    this.torso = new THREE.Mesh(torsoGeo, this.printMat);
    this.pivot.add(this.torso);
    const up = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1]) {
      const sleeveGeo = light ? sleeveGeometry(side, 64, 48) : sleeveGeometry(side);
      this.pivot.add(new THREE.Mesh(sleeveGeo, this.plainMat));
      const toRoot = sleeveCurve(side).getTangent(1).negate();
      // boca da manga: borda dobrada arredondada, rente ao tecido (sem anel saltado)
      this.pivot.add(new THREE.Mesh(bandFromRow(sleeveGeo, sleeveGeo.userData.grid.rows, HEM_EDGE(toRoot)), this.plainMat));
    }
    // gola: faixa de ribana abraçando a base do pescoço
    this.pivot.add(new THREE.Mesh(collarFromTorso(torsoGeo), this.ribMat));
    // barra: mesma borda dobrada
    this.pivot.add(new THREE.Mesh(bandFromRow(torsoGeo, 0, HEM_EDGE(up)), this.plainMat));
    this.pivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // versão simplificada e invisível, só para detectar o cursor (raycast barato a cada quadro)
    this.proxy = new THREE.Group();
    const hidden = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.proxyTorso = new THREE.Mesh(torsoGeometry(56, 34, 12, false), hidden);
    this.proxy.add(this.proxyTorso, new THREE.Mesh(sleeveGeometry(-1, 20, 12, false), hidden), new THREE.Mesh(sleeveGeometry(1, 20, 12, false), hidden));
    this.proxy.traverse((o) => { o.visible = o === this.proxy; });
    this.pivot.add(this.proxy);

    // pontos de ancoragem dos medalhões na superfície das costas (espaço do objeto "pivot")
    this.medallions = medallions;
    this.anchors = medallions.map((m) => this.backPoint((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2 - 0.012));
    this.titleAnchor = this.backPoint(0.5, 0.075);
    this.frontAnchor = this.frontPoint(0.5, 0.5);
  }

  uvToBackXY(u, v) {
    return [this.backRect.x - u * this.backRect.z, this.backRect.y - v * this.backRect.w];
  }

  backPoint(u, v) {
    const [x, y] = this.uvToBackXY(u, v);
    return this.surfacePoint(x, y, -1);
  }

  frontPoint(u, v) {
    const r = this.frontRect;
    return this.surfacePoint(r.x + u * r.z, r.y - v * r.w, 1);
  }

  surfacePoint(x, y, dir) {
    // raio disparado de fora, no espaço local do torso, convertido para o mundo
    this.torso.updateWorldMatrix(true, false);
    const m = this.torso.matrixWorld;
    const origin = new THREE.Vector3(x, y, dir * 3).applyMatrix4(m);
    const direction = new THREE.Vector3(0, 0, -dir).transformDirection(m);
    const hit = new THREE.Raycaster(origin, direction).intersectObject(this.torso, false)[0];
    if (!hit) return { point: new THREE.Vector3(x, y, dir * 0.25), normal: new THREE.Vector3(0, 0, dir) };
    const point = this.torso.worldToLocal(hit.point.clone());
    const normal = hit.face.normal.clone();
    if (normal.z * dir < 0) normal.negate();
    return { point, normal };
  }

  // uv da arte das costas a partir de um ponto local do torso
  backUV(local) {
    return [(this.backRect.x - local.x) / this.backRect.z, (this.backRect.y - local.y) / this.backRect.w];
  }

  medallionAt(local) {
    if (local.z > 0) return -1;
    const [u, v] = this.backUV(local);
    return this.medallions.findIndex((m) => u > m.x0 && u < m.x1 && v > m.y0 && v < m.y1);
  }
}
