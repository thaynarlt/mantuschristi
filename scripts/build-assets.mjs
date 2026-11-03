// Gera os assets do site a partir dos arquivos originais da edição.
// Uso: npm run assets
//
// Entradas (na raiz do projeto):
//   - CamisaAbrilMantusChristi-op1.pdf  (pág. 1 = frente, pág. 2 = costas; exportado do Illustrator
//     com "Preservar recursos de edição", o que permite recuperar o logo e o selo da área de trabalho)
//   - MOCKUP2.jpg                       (foto/mockup da camisa)
// Saídas:
//   - public/assets/*.webp|svg          (estampas, recortes dos medalhões, mockup, logo, selo)
//   - src/data/medallions.json          (posição de cada medalhão na arte das costas)

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, Path2D } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PDF = path.join(ROOT, "CamisaAbrilMantusChristi-op1.pdf");
const MOCKUP = path.join(ROOT, "MOCKUP2.jpg");
const OUT = path.join(ROOT, "public", "assets");
const SVG_OUT = path.join(ROOT, "src", "assets"); // SVGs entram inline na página (herdam cor do CSS)
const DATA = path.join(ROOT, "src", "data");
fs.mkdirSync(path.join(OUT, "popes"), { recursive: true });
fs.mkdirSync(SVG_OUT, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const log = (...a) => console.log("  ·", ...a);

// ---------------------------------------------------------------------------
// 1) Estampas a partir do PDF (vetor -> PNG em alta, sem o retângulo de fundo)
// ---------------------------------------------------------------------------
const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), verbosity: 0, isEvalSupported: false }).promise;

async function renderPage(num, scale) {
  const page = await pdf.getPage(num);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  // O primeiro preenchimento da página é o retângulo de fundo da prancheta: pulamos.
  const fill = ctx.fill.bind(ctx);
  let n = 0;
  ctx.fill = (...args) => (++n === 1 ? undefined : fill(...args));
  await page.render({ canvasContext: ctx, viewport: vp, background: "rgba(0,0,0,0)" }).promise;
  return canvas;
}

function alphaBounds(canvas, threshold = 8) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

function crop(canvas, x, y, w, h, outW, outH) {
  const c = createCanvas(outW ?? w, outH ?? h);
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}

async function save(canvas, file, quality = 90) {
  const ext = path.extname(file).slice(1);
  const buf = ext === "png" ? await canvas.encode("png") : await canvas.encode(ext === "jpg" ? "jpeg" : ext, quality);
  fs.writeFileSync(path.join(OUT, file), buf);
  log(file.padEnd(28), `${canvas.width}×${canvas.height}`, `${(buf.length / 1024).toFixed(0)} KB`);
}

console.log("Estampa das costas");
const backFull = await renderPage(2, 3.6);
const bb = alphaBounds(backFull);
const pad = 12;
const bx = Math.max(0, bb.x0 - pad), by = Math.max(0, bb.y0 - pad);
const bw = Math.min(backFull.width, bb.x1 + pad) - bx, bh = Math.min(backFull.height, bb.y1 + pad) - by;
const back4k = crop(backFull, bx, by, bw, bh, Math.round((bw * 4096) / bh), 4096);
await save(back4k, "print-back-4k.webp", 92);
const back2k = crop(back4k, 0, 0, back4k.width, back4k.height, Math.round((back4k.width * 2048) / back4k.height), 2048);
await save(back2k, "print-back-2k.webp", 90);

console.log("Estampa da frente");
const frontFull = await renderPage(1, 5);
const fb = alphaBounds(frontFull);
const fpad = 16;
const fx = fb.x0 - fpad, fy = fb.y0 - fpad, fw = fb.x1 - fb.x0 + fpad * 2, fh = fb.y1 - fb.y0 + fpad * 2;
const front = crop(frontFull, fx, fy, fw, fh, 1024, Math.round((fh * 1024) / fw));
await save(front, "print-front.webp", 92);

// ---------------------------------------------------------------------------
// 2) Medalhões: componentes conexos da cor creme na arte das costas
// ---------------------------------------------------------------------------
console.log("Medalhões");
{
  const S = 8; // fator de redução para a análise
  const small = crop(back4k, 0, 0, back4k.width, back4k.height, Math.floor(back4k.width / S), Math.floor(back4k.height / S));
  const { width: w, height: h } = small;
  const d = small.getContext("2d").getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
    // creme (#fff7ed) ou traço escuro dentro do medalhão: tudo que não é dourado nem transparente
    const gold = r > 170 && g > 120 && b < 140 && r - b > 70;
    mask[i] = a > 160 && !gold ? 1 : 0;
  }
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    const id = comps.length, stack = [i];
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    label[i] = id;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p / w) | 0;
      area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || label[q] >= 0 || !mask[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        label[q] = id; stack.push(q);
      }
    }
    comps.push({ x0, y0, x1, y1, area });
  }
  const big = comps.filter((c) => c.area > (w * h) / 120).sort((a, b) => a.y0 - b.y0);
  // agrupa por linhas e ordena da esquerda para a direita (ordem cronológica da arte)
  const rows = [];
  for (const c of big) {
    const row = rows.find((r) => Math.abs(r[0].y0 - c.y0) < h / 20);
    row ? row.push(c) : rows.push([c]);
  }
  const ordered = rows.flatMap((r) => r.sort((a, b) => a.x0 - b.x0));
  log(`${ordered.length} medalhões encontrados`);
  const W = back4k.width, H = back4k.height;
  const medallions = [];
  for (const [i, c] of ordered.entries()) {
    const x0 = c.x0 * S, y0 = c.y0 * S, x1 = (c.x1 + 1) * S, y1 = (c.y1 + 1) * S;
    const p = 24;
    const cx0 = Math.max(0, x0 - p), cy0 = Math.max(0, y0 - p);
    const cw = Math.min(W, x1 + p) - cx0, ch = Math.min(H, y1 + p) - cy0;
    const outH = 720;
    await save(crop(back4k, cx0, cy0, cw, ch, Math.round((cw * outH) / ch), outH), `popes/${String(i + 1).padStart(2, "0")}.webp`, 90);
    medallions.push({ x0: x0 / W, y0: y0 / H, x1: x1 / W, y1: y1 / H });
  }
  fs.writeFileSync(
    path.join(DATA, "medallions.json"),
    JSON.stringify({ aspect: W / H, medallions: medallions.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(4)]))) }, null, 2)
  );
}

// ---------------------------------------------------------------------------
// 3) Logo, selo e ramo a partir dos dados do Illustrator embutidos no PDF
// ---------------------------------------------------------------------------
console.log("Logo e selo (dados do Illustrator)");
function extractIllustratorData(buf) {
  const s = buf.toString("latin1");
  const priv = /\/Private\s+(\d+)\s+0\s+R/.exec(s)?.[1];
  const dict = new RegExp(`[\\r\\n]${priv} 0 obj\\s*<<([\\s\\S]*?)>>\\s*endobj`).exec(s)[1];
  const refs = [...dict.matchAll(/\/AIPDFPrivateData(\d+)\s+(\d+)\s+0\s+R/g)].map((m) => [+m[1], m[2]]).sort((a, b) => a[0] - b[0]);
  const parts = refs.map(([, id]) => {
    const at = s.search(new RegExp(`[\\r\\n]${id} 0 obj\\s*<<`));
    const dEnd = s.indexOf(">>", at);
    const d = s.slice(at, dEnd);
    const len = +/\/Length\s+(\d+)/.exec(d)[1];
    let start = s.indexOf("stream", dEnd) + 6;
    if (s[start] === "\r") start++;
    if (s[start] === "\n") start++;
    const chunk = buf.subarray(start, start + len);
    return /\/Filter/.test(d) ? zlib.inflateSync(chunk) : chunk;
  });
  const all = Buffer.concat(parts);
  const hdr = "%AI24_ZStandard_Data";
  const i = all.indexOf(hdr);
  if (i < 0) return all.toString("latin1");
  return zlib.zstdDecompressSync(all.subarray(i + hdr.length)).toString("latin1");
}

// Interpretador mínimo do formato de desenho do Illustrator (operadores de caminho e cor).
function interpretAI(text) {
  const cmyk = (c, m, y, k) => [255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k)].map(Math.round);
  const items = [];
  let fillC = [0, 0, 0], d = "", bbox = null, compound = null, evenOdd = false, lx = 0, ly = 0, inData = false;
  const pt = (x, y) => { bbox = bbox ? [Math.min(bbox[0], x), Math.min(bbox[1], y), Math.max(bbox[2], x), Math.max(bbox[3], y)] : [x, y, x, y]; };
  const P = (x, y) => `${x} ${-y}`;
  const paint = (fill, close) => {
    if (close) d += "Z";
    if (compound) { compound.d += d; compound.fill ||= fill; compound.bbox = merge(compound.bbox, bbox); }
    else if (d && fill) items.push({ d, fill: fillC, rule: evenOdd ? "evenodd" : "nonzero", bbox });
    d = ""; bbox = null;
  };
  const merge = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (inData) { if (line.startsWith("%%EndData") || line.startsWith("%AI5_EndRaster")) inData = false; continue; }
    if (line.startsWith("%%BeginData") || line.startsWith("%AI5_BeginRaster")) { inData = true; continue; }
    if (!line || line.startsWith("%")) continue;
    const t = line.split(/\s+/);
    const op = t[t.length - 1], n = t.slice(0, -1).map(Number);
    switch (op) {
      case "m": d += `M${P(n[0], n[1])}`; pt(n[0], n[1]); [lx, ly] = n; break;
      case "l": case "L": d += `L${P(n[0], n[1])}`; pt(n[0], n[1]); [lx, ly] = n; break;
      case "c": case "C": d += `C${P(n[0], n[1])} ${P(n[2], n[3])} ${P(n[4], n[5])}`; pt(n[4], n[5]); [lx, ly] = [n[4], n[5]]; break;
      case "v": case "V": d += `C${P(lx, ly)} ${P(n[0], n[1])} ${P(n[2], n[3])}`; pt(n[2], n[3]); [lx, ly] = [n[2], n[3]]; break;
      case "y": case "Y": d += `C${P(n[0], n[1])} ${P(n[2], n[3])} ${P(n[2], n[3])}`; pt(n[2], n[3]); [lx, ly] = [n[2], n[3]]; break;
      case "f": case "b": paint(true, true); break;
      case "F": case "B": paint(true, false); break;
      case "s": case "S": case "n": case "N": d = ""; bbox = null; break;
      case "k": if (n.length === 4) fillC = cmyk(...n); break;
      case "Xa": if (n.length === 3) fillC = n.map((v) => Math.round(v * 255)); break;
      case "XR": evenOdd = n[0] === 1; break;
      case "*u": compound = { d: "", fill: false, bbox: null }; break;
      case "*U":
        if (compound?.d && compound.fill) items.push({ d: compound.d, fill: fillC, rule: evenOdd ? "evenodd" : "nonzero", bbox: compound.bbox });
        compound = null; break;
    }
  }
  return items;
}

function toSVG(items, region, colorMap, file, extra = "") {
  const [rx0, ry0, rx1, ry1] = region; // em coordenadas do Illustrator (y para cima)
  const sel = items.filter((it) => it.bbox && it.bbox[0] >= rx0 && it.bbox[2] <= rx1 && it.bbox[1] >= ry1 && it.bbox[3] <= ry0);
  const u = sel.reduce((a, it) => [Math.min(a[0], it.bbox[0]), Math.min(a[1], it.bbox[1]), Math.max(a[2], it.bbox[2]), Math.max(a[3], it.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const vb = [u[0], -u[3], u[2] - u[0], u[3] - u[1]].map((v) => +v.toFixed(2));
  const round = (s) => s.replace(/-?\d+\.\d+/g, (m) => String(+(+m).toFixed(2)));
  let body = "";
  for (const it of sel) {
    const key = it.fill.join(",");
    const [fill, cls] = colorMap[key] ?? [`rgb(${key})`];
    const attrs = (cls ? ` class="${cls}"` : "") + (fill === "currentColor" ? "" : ` fill="${fill}"`) + (it.rule === "evenodd" ? ' fill-rule="evenodd"' : "");
    body += `<path${attrs} d="${round(it.d)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" fill="currentColor"${extra}>${body}</svg>\n`;
  fs.writeFileSync(path.join(SVG_OUT, file), svg);
  log(file.padEnd(28), `${sel.length} formas`, `${(svg.length / 1024).toFixed(0)} KB`, `proporção ${(vb[2] / vb[3]).toFixed(3)}`);
  return vb;
}

{
  const ai = extractIllustratorData(fs.readFileSync(PDF));
  const items = interpretAI(ai);
  const cream = "255,247,235", gold = "219,182,59";
  // Regiões (coordenadas do Illustrator) da área de trabalho fora das pranchetas
  toSVG(items, [620, -1340, 780, -1435], { [cream]: ["currentColor"] }, "logo-stacked.svg");
  toSVG(items, [380, -1360, 590, -1400], { [cream]: ["currentColor"] }, "logo-line.svg");
  toSVG(items, [-60, -1190, 320, -1590], { [cream]: ["#fff7ed", "seal-text"], [gold]: ["#e5b35a", "seal-gold"] }, "seal.svg");
  toSVG(items, [-1390, -570, -850, -1490], { [gold]: ["currentColor"] }, "branch.svg");
}

// ---------------------------------------------------------------------------
// 4) Mockup (foto) otimizado + imagem de compartilhamento
// ---------------------------------------------------------------------------
console.log("Mockup");
{
  const img = await loadImage(fs.readFileSync(MOCKUP));
  const c = createCanvas(img.width, img.height);
  c.getContext("2d").drawImage(img, 0, 0);
  await save(crop(c, 0, 0, img.width, img.height, 2400, Math.round((img.height * 2400) / img.width)), "mockup-2400.webp", 84);
  await save(crop(c, 0, 0, img.width, img.height, 1200, Math.round((img.height * 1200) / img.width)), "mockup-1200.webp", 84);
  // og:image 1200×630 (recorte central)
  const ogH = Math.round((img.width * 630) / 1200);
  await save(crop(c, 0, Math.round((img.height - ogH) / 2), img.width, ogH, 1200, 630), "og-image.jpg", 86);
  // cor média do tecido (para referência do material 3D)
  const s = c.getContext("2d").getImageData(1300, 2200, 120, 120).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < s.length; i += 4) { r += s[i]; g += s[i + 1]; b += s[i + 2]; }
  const n = s.length / 4;
  log("cor média do tecido no mockup:", `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
}

console.log("Pronto.");
