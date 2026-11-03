import * as THREE from "three";
import { Shirt } from "./shirt.js";
import { knitNormalTexture, ribNormalTexture, grainTexture } from "./textures.js";
import { Leaves, Dust, Halo, Beams } from "./atmosphere.js";

const TAU = Math.PI * 2;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const NUM_KEYS = ["rot", "x", "y", "halo", "beams", "leaves", "spin", "calm", "candle"];

// Estúdio fotográfico em miniatura, usado só como reflexo/luz ambiente:
// softbox quente no alto à esquerda, recortes dourado e rosado atrás, rebatedor e chão vinho.
function studioEnvironment() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), new THREE.MeshBasicMaterial({ color: 0x140409, side: THREE.BackSide })));
  const panel = (w, h, intensity, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(5, 3.6, 7, "#fff4ec", -3.6, 4, 3.2);
  panel(1.3, 7, 5.5, "#f2b45e", -5.6, 1, -4.2);
  panel(1.3, 7, 3.8, "#ff9e8c", 5.6, 0.4, -4.2);
  panel(4, 2.6, 1.3, "#ffd9c4", 4.2, -0.4, 5);
  panel(12, 2.2, 0.7, "#5a1626", 0, -4.8, 0.5);
  return scene;
}

export class Stage {
  constructor(canvas, { medallions, fabric, mobile, reduced, assets }) {
    this.opts = { medallions, fabric, mobile, reduced, assets };
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }));
    this.dpr = Math.min(window.devicePixelRatio, mobile ? 1.75 : 2);
    this.perf = { acc: 0, frames: 0 };
    r.setPixelRatio(this.dpr);
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.95;
    r.setClearColor(0x000000, 0);
    // sombra macia da luz principal (as mangas e as dobras sombreiam o próprio tecido)
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.03, 60);
    this.camera.position.set(0, 0, 6);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(studioEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 0.24;
    pmrem.dispose();

    // luz de estúdio: chave à frente/esquerda e do alto (modela peito e lateral), recortes dourado e rosado por trás
    this.hemi = new THREE.HemisphereLight(0xffd9c0, 0x1a0308, 0.1);
    this.key = new THREE.DirectionalLight(0xfff6f0, 3.7);
    this.key.position.set(-2.6, 2.5, 3.2);
    this.key.castShadow = true;
    const sm = mobile ? 1024 : 2048;
    this.key.shadow.mapSize.set(sm, sm);
    Object.assign(this.key.shadow.camera, { left: -1.25, right: 1.25, top: 1.25, bottom: -1.25, near: 1, far: 12 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.012;
    this.key.shadow.radius = mobile ? 3 : 5;
    this.rimL = new THREE.DirectionalLight(0xf3b25b, 1.9);
    this.rimL.position.set(-3.6, 1.4, -2.8);
    this.rimR = new THREE.DirectionalLight(0xff8f7a, 1.2);
    this.rimR.position.set(3.6, 0.5, -2.4);
    this.fill = new THREE.DirectionalLight(0xffd9c4, 0.1);
    this.fill.position.set(2, -0.8, 4);
    this.scene.add(this.hemi, this.key, this.rimL, this.rimR, this.fill);
    this.candle = new THREE.PointLight(0xffd9b5, 0, 0, 2);
    this.scene.add(this.candle);

    this.halo = new Halo();
    this.beams = new Beams();
    this.leaves = new Leaves(reduced ? 0 : mobile ? 22 : 46);
    this.dust = new Dust(reduced ? 0 : mobile ? 160 : 340);
    this.scene.add(this.halo.group, this.beams.group, this.leaves.group, this.dust.points);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0.3);
    this.hasPointer = false;
    this.keys = [];
    this.target = null;
    this.cur = null;
    this.drag = { active: false, offset: 0, vel: 0, lastX: 0, idle: 0, allowed: true };
    this.spinOffset = 0;
    this.intro = 0;
    this.hover = -1;
    this.active = true;
    this.onHover = () => {};
    this.time = 0;
  }

  async load(onProgress) {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => onProgress?.(loaded / total);
    const loader = new THREE.TextureLoader(manager);
    const { assets, mobile } = this.opts;
    const T = (label) => import.meta.env.DEV && console.log(`[stage] ${label}: ${(performance.now() - t0).toFixed(0)} ms`);
    const t0 = performance.now();
    const [back, front] = await Promise.all([loader.loadAsync(mobile ? assets.back2k : assets.back4k), loader.loadAsync(assets.front)]);
    T("texturas da arte");
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    for (const t of [back, front]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
    }
    const textures = { back, front, knit: knitNormalTexture(this.renderer), rib: ribNormalTexture(this.renderer), grain: grainTexture(this.renderer) };
    T("texturas procedurais");
    this.shirt = new Shirt({ textures, medallions: this.opts.medallions, color: this.opts.fabric, light: mobile });
    this.scene.add(this.shirt.group);
    T("geometria da camisa");
    this.resize();
    this.renderer.compile(this.scene, this.camera);
    T("shaders compilados");
  }

  // ------------------------------------------------------------------ enquadramentos
  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get tanHalf() { return Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)); }

  // distância para que uma área (visW × visH, em unidades do mundo) caiba na tela
  fit(visH = 0, visW = 0) {
    const t = this.tanHalf;
    return Math.max(visH / (2 * t), visW / (2 * t * this.camera.aspect));
  }

  // câmera olhando para `center` ao longo de `normal`, com o assunto deslocado na tela (sx, sy em -1..1)
  view(center, normal, d, sx = 0, sy = 0) {
    const t = this.tanHalf;
    const look = center.clone().add(new THREE.Vector3(-sx * d * t * this.camera.aspect, -sy * d * t, 0));
    const cam = look.clone().addScaledVector(normal, d);
    return { cam: cam.toArray(), look: look.toArray() };
  }

  poseMatrix(rot, x, y) {
    const m = new THREE.Matrix4().makeRotationY(rot);
    m.setPosition(x, y, 0);
    return m.multiply(new THREE.Matrix4().makeTranslation(0, this.shirt.pivot.position.y, 0));
  }

  // enquadra a camisa inteira (elev: câmera um pouco acima, olhando de leve para baixo)
  frameShirt({ rot, x = 0, y = 0, visH = 2.25, visW = 1.95, sx = 0, sy = 0, elev = 0 }) {
    const d = this.fit(visH, visW);
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    return { rot, x, y, ...this.view(new THREE.Vector3(x, y, 0), dir, d, sx, sy) };
  }

  // enquadra um ponto da superfície (medalhão, estampa da frente)
  frameAnchor(anchor, { rot, x = 0, y = 0, visH = 0, visW = 0, sx = 0, sy = 0, tilt = 0.55 }) {
    const m = this.poseMatrix(rot, x, y);
    const p = anchor.point.clone().applyMatrix4(m);
    const n = anchor.normal.clone().transformDirection(m);
    n.lerp(new THREE.Vector3(0, 0, 1), 1 - tilt).normalize();
    return { rot, x, y, ...this.view(p, n, this.fit(visH, visW), sx, sy) };
  }

  // ------------------------------------------------------------------ trilha de keyframes
  setKeys(keys) {
    this.keys = keys.sort((a, b) => a.at - b.at);
  }

  stateAt(scroll) {
    const k = this.keys;
    if (!k.length) return null;
    const edge = (key) => ({ ...key.s, cam: [...key.s.cam], look: [...key.s.look], interactive: key.interactive ?? "none" });
    if (scroll <= k[0].at) return edge(k[0]);
    if (scroll >= k[k.length - 1].at) return edge(k[k.length - 1]);
    let i = 0;
    while (scroll > k[i + 1].at) i++;
    const a = k[i], b = k[i + 1];
    const raw = (scroll - a.at) / Math.max(1, b.at - a.at);
    const t = b.linear ? raw : ease(raw);
    const s = {};
    for (const key of NUM_KEYS) s[key] = THREE.MathUtils.lerp(a.s[key] ?? 0, b.s[key] ?? 0, t);
    s.cam = a.s.cam.map((v, j) => THREE.MathUtils.lerp(v, b.s.cam[j], t));
    s.look = a.s.look.map((v, j) => THREE.MathUtils.lerp(v, b.s.look[j], t));
    // foco nos medalhões: troca no meio do trajeto e "respira" durante a viagem
    s.focus = raw < 0.5 ? a.s.focus ?? -1 : b.s.focus ?? -1;
    const fa = THREE.MathUtils.lerp(a.s.focusAmt ?? 0, b.s.focusAmt ?? 0, t);
    s.focusAmt = a.s.focus !== b.s.focus && a.s.focus >= 0 && b.s.focus >= 0 ? fa * (1 - 0.75 * Math.sin(Math.PI * raw)) : fa;
    s.interactive = (raw < 0.5 ? a : b).interactive ?? "none";
    return s;
  }

  scrollTo(scroll) {
    this.target = this.stateAt(scroll);
    if (!this.cur && this.target) {
      this.cur = { ...this.target, cam: [...this.target.cam], look: [...this.target.look] };
    }
  }

  // ------------------------------------------------------------------ interação
  setPointer(nx, ny) {
    this.pointer.set(nx, ny);
    this.hasPointer = true;
  }

  hitShirt() {
    if (!this.shirt) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.shirt.proxy, true)[0] ?? null;
  }

  // medalhão sob um ponto (para toque, sem hover)
  medallionAt(nx, ny) {
    this.setPointer(nx, ny);
    return this.probe().medal;
  }

  pointerDown(clientX) {
    const mode = this.target?.interactive;
    if (mode !== "drag" && mode !== "both") return false;
    if (!this.hitShirt()) return false;
    Object.assign(this.drag, { active: true, lastX: clientX, vel: 0, idle: 0 });
    return true;
  }

  pointerMove(clientX) {
    if (!this.drag.active) return;
    const dx = clientX - this.drag.lastX;
    this.drag.lastX = clientX;
    const delta = (dx / Math.max(window.innerWidth, 1)) * Math.PI * 2.2;
    this.drag.offset += delta;
    this.drag.vel = delta * 60;
  }

  pointerUp() {
    this.drag.active = false;
  }

  // um raycast por quadro: diz se o cursor está sobre a camisa e sobre qual medalhão
  probe() {
    const mode = this.target?.interactive ?? "none";
    if (!this.hasPointer || mode === "none" || this.blocked || !this.active) return { over: false, medal: -1 };
    const hit = this.hitShirt();
    if (!hit) return { over: false, medal: -1 };
    let medal = -1;
    if ((mode === "hover" || mode === "both") && hit.object === this.shirt.proxyTorso) {
      medal = this.shirt.medallionAt(this.shirt.proxyTorso.worldToLocal(hit.point.clone()));
    }
    return { over: mode === "drag" || mode === "both", medal };
  }

  // ------------------------------------------------------------------ quadro a quadro
  tick(dt) {
    if (!this.shirt || !this.target) return;
    if (!this.cur) this.cur = { ...this.target, cam: [...this.target.cam], look: [...this.target.look] };
    this.time += dt;
    const t = this.time, s = this.target, c = this.cur;
    const { reduced } = this.opts;

    // arraste: inércia e retorno suave para a volta completa mais próxima
    const d = this.drag;
    if (!d.active) {
      d.offset += d.vel * dt;
      d.vel *= Math.exp(-3.2 * dt);
      d.idle += dt;
      if (d.idle > 1.4 || (s.interactive !== "drag" && s.interactive !== "both")) {
        d.offset = damp(d.offset, Math.round(d.offset / TAU) * TAU, 2.2, dt);
      }
    }
    // giro contínuo (vitrine) na seção de compra
    if (s.spin > 0.001) this.spinOffset += s.spin * dt;
    else this.spinOffset = damp(this.spinOffset, Math.round(this.spinOffset / TAU) * TAU, 2.5, dt);

    const k = reduced ? 30 : 6.5;
    for (const key of NUM_KEYS) c[key] = damp(c[key] ?? 0, s[key] ?? 0, k, dt);
    for (let j = 0; j < 3; j++) {
      c.cam[j] = damp(c.cam[j], s.cam[j], reduced ? 30 : 5.2, dt);
      c.look[j] = damp(c.look[j], s.look[j], reduced ? 30 : 5.6, dt);
    }
    const sh = this.shirt.shared;
    sh.uFocus.value = Number.isFinite(s.focus) ? s.focus : -1;
    sh.uFocusAmt.value = damp(Number.isFinite(sh.uFocusAmt.value) ? sh.uFocusAmt.value : 0, Number.isFinite(s.focusAmt) ? s.focusAmt : 0, 5, dt);

    // ponteiro suavizado (luz-vela e inclinação)
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-4 * dt));
    const free = 1 - THREE.MathUtils.clamp(c.calm, 0, 1);
    const intro = this.intro, introK = 1 - intro;

    const g = this.shirt.group;
    g.position.set(c.x, c.y + (reduced ? 0 : Math.sin(t * 0.8) * 0.014 * free) + introK * 2.6, 0);
    g.rotation.set(
      (reduced ? 0 : -this.pointerSmooth.y * 0.06 * free),
      c.rot + d.offset + this.spinOffset + (reduced ? 0 : this.pointerSmooth.x * 0.16 * free + Math.sin(t * 0.45) * 0.035 * free) - introK * Math.PI * 1.35,
      reduced ? 0 : Math.sin(t * 0.6) * 0.012 * free
    );

    this.camera.position.set(c.cam[0], c.cam[1], c.cam[2] + introK * 1.6);
    this.camera.lookAt(c.look[0], c.look[1], c.look[2]);

    this.halo.group.position.x = c.x;
    this.halo.group.position.y = c.y;
    this.halo.update(t, c.halo * intro);
    this.beams.update(t, c.beams * intro);
    this.leaves.amount = c.leaves * intro;
    this.raycaster.setFromCamera(this.pointerSmooth, this.camera);
    this.leaves.update(dt, t, this.hasPointer ? this.raycaster.ray : null, this.camera.position);
    this.dust.update(t);
    this.shirt.shared.uTime.value = t;

    // luz-vela: acompanha o ponteiro, sempre com o mesmo brilho no assunto.
    // Fica um pouco acima do raio do cursor e é só um toque — a forma vem da luz principal.
    const dist = this.camera.position.distanceTo(new THREE.Vector3(...c.look));
    const dir = this.raycaster.ray.direction;
    this.candle.position.copy(this.camera.position).addScaledVector(dir, dist * 0.6);
    this.candle.position.y += dist * 0.12;
    this.candle.intensity = 1.25 * (dist * 0.4) ** 2 * c.candle * intro;

    // cursor sobre a camisa / sobre um medalhão
    const pr = this.probe();
    this.overShirt = pr.over;
    const hv = pr.medal;
    if (hv !== this.hover) {
      this.hover = hv;
      if (hv >= 0) this.shirt.shared.uHover.value = hv;
      this.onHover(hv);
    }
    this.shirt.shared.uHoverAmt.value = damp(this.shirt.shared.uHoverAmt.value, hv >= 0 ? 1 : 0, 8, dt);

    if (this.active) {
      this.renderer.render(this.scene, this.camera);
      this.adaptQuality(dt);
    }
  }

  // se o aparelho não sustentar ~48 fps, baixa a resolução interna em degraus (nunca abaixo de 1×)
  adaptQuality(dt) {
    if (this.intro < 1 || document.visibilityState !== "visible") return;
    const p = this.perf;
    p.acc += dt;
    p.frames++;
    if (p.acc < 1.5) return;
    const fps = p.frames / p.acc;
    p.acc = 0;
    p.frames = 0;
    if (fps < 48 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.resize();
    } else if (fps < 40 && this.key.castShadow) {
      // último degrau: sem sombra projetada (a oclusão assada nas dobras continua)
      this.key.castShadow = false;
    }
  }
}
