import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/pinyon-script/400.css";
import "@fontsource-variable/manrope/index.css";
import "./styles/main.css";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

import { drop, popes, creed, toRoman, buyLink } from "./drop.js";
import medallionData from "./data/medallions.json";
import logoStacked from "./assets/logo-stacked.svg?raw";
import logoLine from "./assets/logo-line.svg?raw";
import sealSvg from "./assets/seal.svg?raw";

gsap.registerPlugin(ScrollTrigger, SplitText);

const BASE = import.meta.env.BASE_URL;
const asset = (p) => `${BASE}assets/${p}`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const html = document.documentElement;

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const isMobile = () => innerWidth < 820 || innerWidth / innerHeight < 0.9;
const SUCC_STEPS = popes.length + 2;

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
document.body.classList.add("is-loading");
html.style.setProperty("--succ-steps", SUCC_STEPS);
if (finePointer) html.classList.add("has-cursor");

// --------------------------------------------------------------------------
// Conteúdo dinâmico (vem de drop.js)
// --------------------------------------------------------------------------
const svgs = { "logo-stacked": logoStacked, "logo-line": logoLine, seal: sealSvg };
$$("[data-svg]").forEach((el) => (el.innerHTML = svgs[el.dataset.svg]));

$("#popes").innerHTML = popes
  .map(
    (p, i) => `
  <article class="pope" data-i="${i}" aria-hidden="true">
    <p class="pope__num"><span>${p.number}º papa</span><b>${toRoman(p.number)}</b></p>
    <h3 class="pope__latin">${p.latin}</h3>
    <p class="pope__name">${p.name}<span>${p.years}</span></p>
    <blockquote class="pope__quote">“${p.quote}”<cite>${p.source}</cite></blockquote>
    <p class="pope__text">${p.text}</p>
    <img class="pope__img" src="${asset(`popes/${String(i + 1).padStart(2, "0")}.webp`)}" alt="Medalhão de ${p.name} na arte das costas" loading="lazy" />
  </article>`
  )
  .join("");

$("#railList").innerHTML = popes
  .map((p, i) => `<li><button type="button" data-go="${i}" aria-label="${p.name}">${toRoman(p.number)}</button></li>`)
  .join("");

$("#creedWords").innerHTML = creed
  .map((c) => `<li class="${c.gold ? "is-gold" : ""}"><span class="creed__word">${c.word}</span><span class="creed__gloss">${c.gloss}<cite>${c.source}</cite></span></li>`)
  .join("");

const marqueeWords = ["UNA", "SANTA", "CATÓLICA", "APOSTÓLICA"];
$("#marquee").innerHTML = Array.from({ length: 4 }, () =>
  marqueeWords.map((w) => `<span class="${w === "CATÓLICA" ? "is-gold" : ""}">${w}</span><span class="dot">·</span>`).join("")
).join("");

let chosenSize = null;
$("#sizes").innerHTML = drop.sizes.map((s) => `<button type="button" aria-pressed="false" data-size="${s}">${s}</button>`).join("");
if (drop.price) {
  $("#price").textContent = drop.price;
  $("#price").hidden = false;
}
if (drop.instagram) {
  const ig = $("#instagram");
  ig.href = drop.instagram.startsWith("http") ? drop.instagram : `https://instagram.com/${drop.instagram.replace("@", "")}`;
  ig.hidden = false;
}
$("#specColor").textContent = drop.color;
$(".turn__hint").textContent = finePointer
  ? "Passe o cursor sobre os medalhões das costas — e clique para conhecer cada um."
  : "Toque nos medalhões das costas para conhecer cada um.";
$("#year").textContent = new Date().getFullYear();

// --------------------------------------------------------------------------
// 3D
// --------------------------------------------------------------------------
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

let stage = null;
if (hasWebGL()) {
  try {
    const { Stage } = await import("./three/Stage.js");
    stage = new Stage($("#gl"), {
      medallions: medallionData.medallions,
      fabric: drop.fabric,
      mobile: isMobile(),
      reduced,
      assets: { back4k: asset("print-back-4k.webp"), back2k: asset("print-back-2k.webp"), front: asset("print-front.webp") },
    });
  } catch (err) {
    console.warn("WebGL indisponível, usando fotos.", err);
    stage = null;
  }
}
if (import.meta.env.DEV) window.__stage = stage;
if (!stage) {
  html.classList.add("no-webgl");
  html.style.setProperty("--no-webgl-hero", `url("${asset("mockup-1200.webp")}")`);
}

// --------------------------------------------------------------------------
// Rolagem suave
// --------------------------------------------------------------------------
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  if (import.meta.env.DEV) window.__lenis = lenis;
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollToY = (y, immediate = false) => {
  if (lenis) lenis.scrollTo(y, { duration: immediate ? 0 : 1.8, immediate, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: y, behavior: immediate || reduced ? "auto" : "smooth" });
};
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.id === "buy") return;
  const id = a.getAttribute("href").slice(1);
  const el = id ? document.getElementById(id) : null;
  e.preventDefault();
  scrollToY(id === "top" || !el ? 0 : el.getBoundingClientRect().top + scrollY);
});

// --------------------------------------------------------------------------
// Medidas e trilha de câmera
// --------------------------------------------------------------------------
const el = {
  hero: $(".hero"),
  turn: $(".turn"),
  succ: $(".succession"),
  creed: $(".creed"),
  real: $(".real"),
  drop: $(".drop"),
  footer: $(".footer"),
  topbar: $(".topbar"),
  word: $("#backdropWord"),
  intro: $("#succIntro"),
  popeCards: $$(".pope"),
  railItems: $$("#railList li"),
  railGrow: $("#railGrow"),
  creedItems: $$("#creedWords li"),
  marquee: $("#marquee"),
};
let M = null;

function measure() {
  const top = (n) => n.getBoundingClientRect().top + scrollY;
  const box = (n) => ({ top: top(n), h: n.offsetHeight });
  M = {
    W: innerWidth,
    H: innerHeight,
    mobile: isMobile(),
    hero: box(el.hero),
    turn: box(el.turn),
    succ: box(el.succ),
    creed: box(el.creed),
    real: box(el.real),
    drop: box(el.drop),
    footer: box(el.footer),
  };
}

function buildKeys() {
  if (!stage?.shirt) return;
  const { H, mobile } = M;
  const S = stage, sh = stage.shirt, PI = Math.PI;
  const keys = [];
  const base = { halo: 0, beams: 0.5, leaves: 1, spin: 0, calm: 0, candle: 1, focus: -1, focusAmt: 0 };
  const K = (at, s, interactive = "none") => keys.push({ at, s: { ...base, ...s }, interactive });

  // 1. Abertura: vista 3/4, câmera um pouco acima (aparece o avesso da gola)
  const hero = S.frameShirt({ rot: -0.6, visH: mobile ? 2.9 : 2.42, visW: mobile ? 2.25 : 0, sy: mobile ? 0.02 : -0.04, elev: 0.12 });
  K(M.hero.top, { ...hero, halo: 1, beams: 1 }, "drag");
  K(M.hero.top + H * 0.28, { ...hero, halo: 1, beams: 1 }, "drag");

  // 2. A camisa vira: de costas, de lado na tela
  const side = mobile ? { sx: 0, sy: 0.34, visH: 3.4, visW: 2.2, elev: 0.08 } : { sx: 0.42, sy: 0, visH: 2.38, elev: 0.08 };
  const backWide = S.frameShirt({ rot: PI, ...side });
  K(M.turn.top + H * 0.2, { ...S.frameShirt({ rot: PI * 0.6, ...side }), halo: 0.5, beams: 0.8 });
  K(M.turn.top + M.turn.h - H * 1.1, { ...backWide, halo: 0.25, beams: 0.6 }, "both");
  K(M.turn.top + M.turn.h - H * 0.35, { ...backWide, halo: 0.2, beams: 0.5 }, "both");

  // 3. A sucessão: o título da arte e depois cada medalhão
  const s0 = M.succ.top;
  const titleView = mobile ? { sx: 0, sy: 0.4, visW: 0.92 } : { sx: 0.36, visH: 0.78 };
  const medalView = mobile ? { sx: 0, sy: 0.4, visW: 0.33 } : { sx: 0.3, visH: 0.47 };
  const title = S.frameAnchor(sh.titleAnchor, { rot: PI, ...titleView, tilt: 0.2 });
  K(s0 + H * 0.15, { ...title, beams: 0.25, leaves: 0.5, calm: 1 }, "hover");
  K(s0 + H * 0.55, { ...title, beams: 0.25, leaves: 0.5, calm: 1 }, "hover");
  popes.forEach((_, i) => {
    const at = s0 + H * (1 + i);
    const s = { ...S.frameAnchor(sh.anchors[i], { rot: PI, ...medalView }), beams: 0.15, leaves: 0.3, calm: 1, focus: i, focusAmt: 1, candle: 0.85 };
    K(at - H * 0.2, s, "hover");
    K(at + H * 0.2, s, "hover");
  });
  K(s0 + H * (popes.length + 0.95), { ...backWide, halo: 0.15, calm: 0.4, focus: popes.length - 1, focusAmt: 0 }, "both");

  // 4. A frente: o Credo
  const c0 = M.creed.top;
  const frontSide = mobile ? { sx: 0, sy: 0.34, visH: 3.4, visW: 2.2, elev: 0.08 } : { sx: -0.42, sy: 0, visH: 2.38, elev: 0.08 };
  const chestView = mobile ? { sx: 0, sy: 0.42, visW: 0.5 } : { sx: -0.36, visH: 0.6 };
  const chest = S.frameAnchor(sh.frontAnchor, { rot: PI * 2, ...chestView, tilt: 0.35 });
  K(c0 + H * 0.3, { ...S.frameShirt({ rot: PI * 2, ...frontSide }), halo: 0.35, beams: 0.6 }, "drag");
  K(c0 + H * 0.95, { ...chest, calm: 1, beams: 0.3, leaves: 0.5 });
  K(c0 + M.creed.h - H * 1.25, { ...chest, calm: 1, beams: 0.3, leaves: 0.5 });
  K(c0 + M.creed.h - H * 0.45, { ...S.frameShirt({ rot: PI * 2, ...frontSide }), halo: 0.35, beams: 0.6 });

  // 6. Garantir: vitrine girando
  const dropView = mobile ? { sx: 0, sy: 0.3, visH: 3.9, visW: 2.6, elev: 0.1 } : { sx: 0.42, visH: 2.42, elev: 0.1 };
  const dropShot = S.frameShirt({ rot: PI * 2 - 0.6, ...dropView });
  K(M.real.top + M.real.h * 0.5, { ...dropShot, halo: 0.8, beams: 1 });
  K(M.drop.top, { ...dropShot, halo: 1, beams: 1, spin: 0.32 }, "drag");
  K(M.drop.top + M.drop.h, { ...dropShot, halo: 1, beams: 1, spin: 0.32 }, "drag");

  S.setKeys(keys);
}

function relayout() {
  measure();
  stage?.resize();
  buildKeys();
  ScrollTrigger.refresh();
}
let lastW = innerWidth, lastH = innerHeight, resizeTimer = 0;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // no celular a barra de endereço muda a altura o tempo todo: só refaz em mudanças reais
    const changed = innerWidth !== lastW || Math.abs(innerHeight - lastH) > 140;
    stage?.resize();
    if (!changed) return;
    lastW = innerWidth; lastH = innerHeight;
    relayout();
  }, 180);
});

// --------------------------------------------------------------------------
// Interface guiada pela rolagem
// --------------------------------------------------------------------------
let activePope = -2, activeWord = -2;

function setPope(i) {
  if (i === activePope) return;
  const prev = el.popeCards[activePope];
  if (prev) {
    prev.classList.remove("is-active");
    prev.classList.add("is-leaving");
    prev.setAttribute("aria-hidden", "true");
    setTimeout(() => prev.classList.remove("is-leaving"), 450);
  }
  activePope = i;
  const next = el.popeCards[i];
  if (next) {
    next.classList.remove("is-leaving");
    next.classList.add("is-active");
    next.setAttribute("aria-hidden", "false");
  }
  el.railItems.forEach((li, j) => {
    li.classList.toggle("is-active", j === i);
    li.classList.toggle("is-past", i >= 0 && j < i);
  });
}

function setWord(i) {
  if (i === activeWord) return;
  activeWord = i;
  el.creedItems.forEach((li, j) => {
    li.classList.toggle("is-active", j === i);
    li.classList.toggle("is-past", j < i);
  });
}

let marqueeX = 0;
function updateUI(y, dt) {
  if (!M) return;
  const { H } = M;

  // palavra gigante de fundo
  const hp = clamp(y / (H * 0.9), 0, 1.4);
  el.word.style.opacity = String(clamp(1 - hp * 1.15, 0, 1));
  el.word.style.transform = `translate(-50%, calc(-50% - ${y * 0.22}px)) scale(${1 + hp * 0.06})`;

  // sucessão
  const local = y - M.succ.top;
  const step = (local - H) / H;
  const on = local > -H * 0.35 && local < M.succ.h - H * 0.75;
  el.succ.classList.toggle("is-in", on);
  el.succ.classList.toggle("is-on", on && step > -0.55);
  el.intro.classList.toggle("is-out", step > -0.55);
  setPope(on && step > -0.55 ? clamp(Math.round(step), 0, popes.length - 1) : -1);
  el.railGrow.style.strokeDashoffset = String(1 - clamp(step / (popes.length - 1), 0, 1));

  // Credo: uma palavra por vez
  const cl = y - M.creed.top;
  setWord(cl < H * 0.95 ? -1 : clamp(Math.floor((cl - H * 0.95) / (H * 0.42)), 0, creed.length - 1));

  // topo escuro sobre a seção clara
  const overLight = y + 40 >= M.real.top && y + 40 < M.real.top + M.real.h;
  el.topbar.classList.toggle("is-light", overLight);

  // pausa o 3D quando uma seção sólida cobre a tela
  if (stage) {
    const coveredReal = y >= M.real.top && y + H <= M.real.top + M.real.h;
    const coveredFoot = y >= M.footer.top;
    stage.active = !(coveredReal || coveredFoot);
  }

  // faixa: anda sozinha e acelera com a rolagem
  const v = lenis ? lenis.velocity : 0;
  marqueeX -= (40 + Math.abs(v) * 14) * dt;
  const half = el.marquee.scrollWidth / 2;
  if (half > 0 && -marqueeX > half) marqueeX += half;
  el.marquee.style.transform = `translate3d(${marqueeX}px,0,0) skewX(${clamp(-v * 0.35, -8, 8)}deg)`;
}

const goPope = (i) => M && scrollToY(M.succ.top + M.H * (1 + i));
$("#railList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (b) goPope(+b.dataset.go);
});

// --------------------------------------------------------------------------
// Cursor, hover nos medalhões, arrastar
// --------------------------------------------------------------------------
const cursor = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
const cursorEl = $("#cursor"), ringEl = $(".cursor__ring"), dotEl = $(".cursor__dot"), labelEl = $("#cursorLabel");
const tipEl = $("#medalTip");
let overLink = false, dragged = false, downAt = null;

addEventListener("pointermove", (e) => {
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  stage?.setPointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (stage?.drag.active) {
    stage.pointerMove(e.clientX);
    if (downAt && Math.abs(e.clientX - downAt.x) > 6) dragged = true;
  }
}, { passive: true });

const interactiveSel = "a, button, input, label, .loupe, [data-magnetic]";
document.addEventListener("pointerover", (e) => { overLink = !!e.target.closest?.(interactiveSel); });
// sem seleção de texto nem "arrastar imagem" (o arraste é da camisa)
document.addEventListener("selectstart", (e) => e.preventDefault());
document.addEventListener("dragstart", (e) => e.preventDefault());

addEventListener("pointerdown", (e) => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  dragged = false;
  if (!stage || e.target.closest(interactiveSel)) return;
  stage.setPointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (stage.pointerDown(e.clientX)) {
    if (e.pointerType === "mouse") e.preventDefault();
    document.body.classList.add("is-dragging");
    $$(".drag-hint").forEach((h) => h.classList.add("is-gone"));
  }
});

const endDrag = (e) => {
  if (!stage) return;
  const wasDrag = stage.drag.active;
  stage.pointerUp();
  document.body.classList.remove("is-dragging");
  // toque/clique curto sobre um medalhão: vai para ele
  if (downAt && !dragged && performance.now() - downAt.t < 450 && !e.target.closest?.(interactiveSel)) {
    const i = stage.medallionAt((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (i >= 0) goPope(i);
  }
  if (!finePointer && !wasDrag) stage.hasPointer = false;
  downAt = null;
};
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);

if (stage) {
  stage.onHover = (i) => {
    tipEl.classList.toggle("is-on", i >= 0 && finePointer);
    if (i >= 0) {
      tipEl.querySelector("b").textContent = popes[i].latin;
      tipEl.querySelector("span").textContent = `${popes[i].name} · ${toRoman(popes[i].number)}`;
    }
  };
}

const solidSel = ".real, .footer, .marquee, .topbar, .loader";
function updateCursor() {
  if (!finePointer) return;
  // o cursor não "atravessa" seções sólidas até a camisa que está atrás delas
  if (stage) {
    const under = document.elementFromPoint(cursor.x, cursor.y);
    stage.blocked = !!under?.closest(solidSel);
  }
  cursor.rx += (cursor.x - cursor.rx) * 0.2;
  cursor.ry += (cursor.y - cursor.ry) * 0.2;
  dotEl.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
  ringEl.style.transform = `translate3d(${cursor.rx}px, ${cursor.ry}px, 0)`;
  const tipX = cursor.x + 26 + tipEl.offsetWidth > innerWidth - 12 ? cursor.x - 26 - tipEl.offsetWidth : cursor.x + 26;
  tipEl.style.transform = `translate3d(${tipX}px, ${cursor.y + 22}px, 0)`;
  const medal = !!stage && stage.hover >= 0;
  const drag = !!stage && !medal && (stage.overShirt || stage.drag.active) && !overLink;
  cursorEl.classList.toggle("is-medal", medal);
  cursorEl.classList.toggle("is-drag", drag);
  cursorEl.classList.toggle("is-link", overLink && !medal && !drag);
  labelEl.textContent = medal ? "ver" : drag ? "girar" : "";
}

// botões magnéticos
$$("[data-magnetic]").forEach((b) => {
  b.addEventListener("pointermove", (e) => {
    if (!finePointer) return;
    const r = b.getBoundingClientRect();
    gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: "power3.out" });
  });
  b.addEventListener("pointerleave", () => gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" }));
});

// --------------------------------------------------------------------------
// Lupa sobre a foto
// --------------------------------------------------------------------------
{
  const fig = $("#loupe"), lens = $("#loupeLens"), img = fig.querySelector("img");
  const ZOOM = 2.6;
  const move = (e) => {
    const r = fig.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const lw = lens.offsetWidth;
    lens.style.left = `${x - lw / 2}px`;
    lens.style.top = `${y - lw / 2}px`;
    lens.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
    lens.style.backgroundPosition = `${-(x * ZOOM - lw / 2)}px ${-(y * ZOOM - lw / 2)}px`;
  };
  fig.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
    if (!/2400/.test(img.currentSrc)) lens.style.backgroundImage = `url("${asset("mockup-2400.webp")}")`;
    fig.classList.add("is-zoom");
    move(e);
  });
  fig.addEventListener("pointermove", (e) => e.pointerType === "mouse" && move(e));
  fig.addEventListener("pointerleave", () => fig.classList.remove("is-zoom"));
}

// --------------------------------------------------------------------------
// Compra
// --------------------------------------------------------------------------
{
  const buy = $("#buy"), note = $("#buyNote"), defaultNote = note.textContent;
  const refresh = () => {
    const link = buyLink(chosenSize);
    buy.href = link || "#drop";
    buy.target = link ? "_blank" : "";
    buy.rel = link ? "noopener" : "";
  };
  $("#sizes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-size]");
    if (!b) return;
    chosenSize = b.dataset.size;
    $$("#sizes button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    note.textContent = defaultNote;
    refresh();
  });
  // o botão sempre abre o WhatsApp; se a pessoa escolheu um tamanho, ele já vai na mensagem
  buy.addEventListener("click", (e) => {
    if (!buyLink(chosenSize)) {
      e.preventDefault();
      note.textContent = "As vendas desta edição abrem em breve.";
    }
  });
  if (drop.whatsapp) {
    const d = drop.whatsapp.replace(/^55/, "");
    $("#buyContact").textContent = `Atendimento pelo WhatsApp · (${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;
  }
  refresh();
}

// --------------------------------------------------------------------------
// Revelações de texto
// --------------------------------------------------------------------------
function setupReveals() {
  if (reduced) return;
  $$("[data-split]").forEach((h) => {
    const split = SplitText.create(h, { type: "lines", mask: "lines", linesClass: "split-line" });
    gsap.from(split.lines, { yPercent: 108, duration: 1.3, ease: "expo.out", stagger: 0.09, scrollTrigger: { trigger: h, start: "top 88%" } });
  });
  $$("[data-reveal]").forEach((n) => {
    gsap.from(n, { y: 30, autoAlpha: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: n, start: "top 92%" } });
  });
  gsap.from(".specs > div", { y: 30, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: ".specs", start: "top 90%" } });
  gsap.from(".loupe", { clipPath: "inset(12% 8% 12% 8%)", duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: ".loupe", start: "top 85%" } });
  gsap.to(".seal svg", { rotate: 360, ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.6 } });
}

// --------------------------------------------------------------------------
// Loop
// --------------------------------------------------------------------------
let ready = false;
gsap.ticker.add((_t, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  updateCursor();
  if (!ready) return;
  const y = scrollY;
  if (stage && !stage.freeze) stage.scrollTo(y);
  updateUI(y, dt);
  stage?.tick(dt);
});

// --------------------------------------------------------------------------
// Abertura
// --------------------------------------------------------------------------
async function boot() {
  const romanEl = $("#loaderRoman"), barEl = $("#loaderBar");
  const load = { progress: 0, shown: 0 };
  const t0 = performance.now();
  const minTime = reduced || (import.meta.env.DEV && location.search.includes("fast")) ? 250 : 2300;
  // baseado no relógio (não na taxa de quadros): termina no tempo certo mesmo com a aba em segundo plano
  const tickLoader = () => {
    load.shown = Math.max(load.shown, Math.min(load.progress, (performance.now() - t0) / minTime));
    const eased = 1 - (1 - load.shown) ** 2.2;
    romanEl.textContent = toRoman(Math.max(1, Math.round(eased * 267)));
    barEl.style.transform = `scaleX(${eased})`;
  };
  gsap.ticker.add(tickLoader);

  try {
    await Promise.all([
      stage ? stage.load((p) => (load.progress = Math.max(load.progress, p * 0.85))) : Promise.resolve(),
      document.fonts.ready,
    ]);
  } catch (err) {
    console.error(err);
    stage = null;
    html.classList.add("no-webgl");
    html.style.setProperty("--no-webgl-hero", `url("${asset("mockup-1200.webp")}")`);
  }
  load.progress = 1;
  await new Promise((res) => setTimeout(res, Math.max(0, minTime - (performance.now() - t0)) + 60));
  load.shown = 1;
  tickLoader();
  gsap.ticker.remove(tickLoader);
  romanEl.textContent = "CCLXVII";

  scrollTo(0, 0);
  measure();
  buildKeys();
  setupReveals();
  ready = true;

  const tl = gsap.timeline({ defaults: { ease: "expo.inOut" } });
  tl.to(".loader__inner", { autoAlpha: 0, y: -30, duration: 0.8, ease: "power2.in", delay: 0.35 })
    .to(".loader__curtain--top", { yPercent: -100, duration: 1.4 }, "<0.55")
    .to(".loader__curtain--bottom", { yPercent: 100, duration: 1.4 }, "<")
    .add(() => { $("#loader").style.pointerEvents = "none"; }, "<0.3");
  if (stage) tl.to(stage, { intro: 1, duration: reduced ? 0.01 : 2.6, ease: "power3.out" }, "<-0.1");
  tl.from(el.word.firstElementChild, { autoAlpha: 0, scale: 1.08, duration: 2.4, ease: "power2.out" }, "<0.2")
    .fromTo(".hero__script", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 2.2, ease: "power2.inOut" }, "<0.5")
    .from(".hero__top > *, .hero__bottom > *, .topbar > *, .seal--hero", { y: 24, autoAlpha: 0, duration: 1.2, stagger: 0.07, ease: "expo.out", clearProps: "opacity,visibility" }, "<0.4")
    .from(".hero .drag-hint", { autoAlpha: 0, duration: 1, clearProps: "opacity,visibility" }, "<0.6")
    .add(() => {
      $("#loader").remove();
      document.body.classList.remove("is-loading");
      lenis?.start();
    });
}

boot();
