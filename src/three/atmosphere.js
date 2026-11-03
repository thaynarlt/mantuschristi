import * as THREE from "three";
import { leafTextures, dustSprite } from "./textures.js";

const rand = (a, b) => a + Math.random() * (b - a);

// --------------------------------------------------------------------------
// Folhas douradas caindo (as da arte). O cursor sopra as folhas.
// --------------------------------------------------------------------------
export class Leaves {
  constructor(count) {
    this.group = new THREE.Group();
    this.amount = 1;
    this.bounds = { x: 3.4, top: 2.6, bottom: -2.6, z0: -2.2, z1: 0.7 };
    const [almond, maple] = leafTextures();
    this.sets = [[almond, 0.62], [maple, 0.38]].map(([tex, share]) => {
      const n = Math.max(1, Math.round(count * share));
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e9b65c"), map: tex, alphaTest: 0.5, side: THREE.DoubleSide,
        metalness: 0.8, roughness: 0.3, envMapIntensity: 1.4,
      });
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const leaves = Array.from({ length: n }, () => this.spawn({}, true));
      return { mesh, leaves, n };
    });
    this.dummy = new THREE.Object3D();
    this.tmp = new THREE.Vector3();
    this.closest = new THREE.Vector3();
  }

  spawn(l, anywhere = false) {
    const b = this.bounds;
    l.p = new THREE.Vector3(rand(-b.x, b.x), anywhere ? rand(b.bottom, b.top) : b.top + rand(0, 0.6), rand(b.z0, b.z1));
    l.v = new THREE.Vector3();
    l.size = rand(0.045, 0.085);
    l.fall = rand(0.1, 0.2);
    l.sway = rand(0.15, 0.4);
    l.freq = rand(0.5, 1.2);
    l.phase = rand(0, Math.PI * 2);
    l.axis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    l.spin = rand(0.6, 2.2) * (Math.random() < 0.5 ? -1 : 1);
    l.angle = rand(0, Math.PI * 2);
    l.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)));
    return l;
  }

  update(dt, t, ray, eye) {
    const b = this.bounds;
    for (const set of this.sets) {
      const visible = Math.round(set.n * this.amount);
      set.mesh.count = visible;
      for (let i = 0; i < visible; i++) {
        const l = set.leaves[i];
        // empurrão do cursor: distância do ponto ao raio da câmera
        if (ray) {
          ray.closestPointToPoint(l.p, this.closest);
          this.tmp.subVectors(l.p, this.closest);
          const d = this.tmp.length();
          if (d < 0.45) {
            this.tmp.normalize().multiplyScalar((0.45 - d) * 9 * dt);
            l.v.add(this.tmp);
            l.spin += (0.45 - d) * 6 * dt * Math.sign(l.spin);
          }
        }
        l.v.multiplyScalar(Math.exp(-1.6 * dt));
        l.p.x += (Math.sin(t * l.freq + l.phase) * l.sway + l.v.x) * dt;
        l.p.y += (-l.fall + l.v.y) * dt;
        l.p.z += (Math.cos(t * l.freq * 0.7 + l.phase) * l.sway * 0.4 + l.v.z) * dt;
        l.spin += (Math.sign(l.spin) * 1.2 - l.spin) * 0.2 * dt;
        l.angle += l.spin * dt;
        if (l.p.y < b.bottom || Math.abs(l.p.x) > b.x + 1) this.spawn(l);
        this.dummy.position.copy(l.p);
        this.dummy.quaternion.setFromAxisAngle(l.axis, l.angle).multiply(l.q);
        // folhas coladas na câmera (nos closes) somem em vez de virarem borrões gigantes
        const near = eye ? Math.min(1, Math.max(0, (l.p.distanceTo(eye) - 0.3) / 0.6)) : 1;
        this.dummy.scale.setScalar(l.size * near);
        this.dummy.updateMatrix();
        set.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// --------------------------------------------------------------------------
// Poeira suspensa na luz
// --------------------------------------------------------------------------
export class Dust {
  constructor(count) {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    this.seed = Array.from({ length: count }, () => [rand(-2.6, 2.6), rand(-1.8, 2.2), rand(-1.6, 0.9), rand(0, 6.28), rand(0.04, 0.12)]);
    for (let i = 0; i < count; i++) {
      const b = rand(0.25, 1);
      col.set([b, b * 0.82, b * 0.58], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.018, map: dustSprite(), vertexColors: true, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.count = count;
  }

  update(t) {
    const p = this.points.geometry.attributes.position;
    for (let i = 0; i < this.count; i++) {
      const [x, y, z, ph, sp] = this.seed[i];
      p.setXYZ(
        i,
        x + Math.sin(t * sp + ph) * 0.18,
        ((y + t * sp * 0.35 + 1.8) % 4.0) - 1.8,
        z + Math.cos(t * sp * 0.8 + ph) * 0.12
      );
    }
    p.needsUpdate = true;
  }
}

// --------------------------------------------------------------------------
// Auréola com raios (eco dos nimbos dos medalhões e dos raios do logo)
// --------------------------------------------------------------------------
export class Halo {
  constructor() {
    this.group = new THREE.Group();
    const gold = new THREE.Color("#e5b35a");
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    // anéis e raios finos: alfa baixo para não escurecerem o fundo HTML
    const thin = { ...additive, premultipliedAlpha: true };
    this.ringMat = new THREE.MeshBasicMaterial({ color: gold, opacity: 0.55, ...thin });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.205, 1.212, 256), this.ringMat);
    this.ring2 = new THREE.Mesh(new THREE.RingGeometry(1.255, 1.258, 256), this.ringMat.clone());
    this.ring2.material.opacity = 0.22;

    const rays = [], n = 96;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const long = i % 4 === 0, mid = i % 2 === 0;
      const r0 = 1.31, r1 = long ? 1.72 : mid ? 1.52 : 1.42;
      rays.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rays, 3));
    this.raysMat = new THREE.LineBasicMaterial({ color: gold, opacity: 0.2, ...thin });
    this.rays = new THREE.LineSegments(rg, this.raysMat);

    // brilho quente atrás da camisa (alfa 0: soma luz sem tapar o fundo em HTML atrás do canvas)
    this.glowMat = new THREE.ShaderMaterial({
      ...additive,
      premultipliedAlpha: true,
      uniforms: { uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color("#8c3b30") } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec2 vUv; uniform float uOpacity; uniform vec3 uColor; void main(){ float d = length(vUv - 0.5) * 2.0; float g = exp(-d * d * 3.2); gl_FragColor = vec4(uColor * g * uOpacity, 0.0); }",
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), this.glowMat);
    this.glow.position.z = -0.3;

    this.group.add(this.glow, this.ring, this.ring2, this.rays);
    this.group.position.z = -1.1;
    this.opacity = 1;
  }

  update(t, amount) {
    this.rays.rotation.z = t * 0.025;
    this.ring2.rotation.z = -t * 0.01;
    const a = amount;
    this.ringMat.opacity = 0.55 * a;
    this.ring2.material.opacity = 0.22 * a;
    this.raysMat.opacity = (0.16 + Math.sin(t * 0.8) * 0.04) * a;
    this.glowMat.uniforms.uOpacity.value = 0.2 * Math.max(a, 0.3);
    this.group.visible = a > 0.001 || this.glowMat.uniforms.uOpacity.value > 0.001;
  }
}

// --------------------------------------------------------------------------
// Feixes de luz (vitral de catedral)
// --------------------------------------------------------------------------
export class Beams {
  constructor() {
    this.group = new THREE.Group();
    this.uniforms = { uTime: { value: 0 }, uOpacity: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, premultipliedAlpha: true,
      uniforms: this.uniforms,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: /* glsl */ `
        varying vec2 vUv; uniform float uTime; uniform float uOpacity;
        void main(){
          float across = pow(1.0 - min(1.0, abs(vUv.x - 0.5) * 2.0), 1.8);
          float along = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
          float n = 0.7 + 0.3 * sin(vUv.y * 7.0 - uTime * 0.35 + vUv.x * 3.0) * sin(vUv.x * 11.0 + uTime * 0.2);
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.52) * across * along * n * 0.05 * uOpacity, 0.0);
        }`,
    });
    const make = (w, h, x, y, z, rz) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z); m.rotation.z = rz;
      this.group.add(m);
    };
    make(1.1, 7, -1.3, 1.2, -1.4, -0.42);
    make(0.55, 7, -0.55, 1.6, -1.2, -0.36);
    make(0.8, 7, 1.7, 1.4, -1.6, 0.3);
  }

  update(t, amount) {
    this.uniforms.uTime.value = t;
    this.uniforms.uOpacity.value = amount;
    this.group.visible = amount > 0.001;
  }
}
