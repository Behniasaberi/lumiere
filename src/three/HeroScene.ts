// Scroll-driven hero: a floating lipstick that uncaps and twists up, then silk hair ribbons flow in.
// Pure three.js, procedural geometry (swap in .glb models later without touching the choreography).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const seg = (p: number, a: number, b: number) => smooth(clamp((p - a) / (b - a)));
const lerp = THREE.MathUtils.lerp;

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private pmrem: THREE.PMREMGenerator;
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver;
  private visible = true;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  private target = 0; // scroll progress 0..1
  private p = 0;
  private mouse = new THREE.Vector2();
  private aspect = 1;

  // objects
  private lip = new THREE.Group(); // whole lipstick
  private inner = new THREE.Group(); // sleeve + bullet (twists up)
  private cap = new THREE.Group();
  private bulletMat: THREE.MeshPhysicalMaterial;
  private lipColor = new THREE.Color("#c0182a");
  private ribbons: { mesh: THREE.Mesh; geo: THREE.BufferGeometry; phase: number; mat: THREE.MeshPhysicalMaterial; tone: number }[] = [];
  private ribbonGroup = new THREE.Group();
  private hairColor = new THREE.Color("#b5531f");
  private extras: THREE.Group[] = [];
  private shadows: { mesh: THREE.Mesh; follow: THREE.Object3D; size: number }[] = [];

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const r = this.renderer;
    r.setPixelRatio(Math.min(1.75, devicePixelRatio));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.domElement.className = "hero3d__canvas";
    host.appendChild(r.domElement);

    this.pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    this.scene.environmentIntensity = 1.2;

    const key = new THREE.DirectionalLight(0xfff6f0, 1.6);
    key.position.set(-4, 6, 6);
    const rim = new THREE.DirectionalLight(0xffe9e4, 1.2);
    rim.position.set(5, 2, -4);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

    // ---- materials
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xe6cb98, metalness: 1, roughness: 0.2 });
    const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x1d1719, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.bulletMat = new THREE.MeshPhysicalMaterial({ color: this.lipColor, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 0.4, sheenRoughness: 0.5 });

    // ---- lipstick (y=0 at the bottom of the case)
    const lathe = (pts: [number, number][], segs = 96) =>
      new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
    const base = new THREE.Mesh(
      lathe([[0, 0], [0.3, 0], [0.33, 0.015], [0.345, 0.06], [0.345, 1.04], [0.338, 1.08], [0.32, 1.1], [0, 1.1]]),
      lacquer,
    );
    const band = new THREE.Mesh(lathe([[0.31, 1.08], [0.352, 1.085], [0.352, 1.14], [0.31, 1.145]]), gold);
    const foot = new THREE.Mesh(lathe([[0.3, 0.0], [0.348, 0.02], [0.348, 0.05], [0.3, 0.06]]), gold);

    const sleeve = new THREE.Mesh(lathe([[0, 0], [0.27, 0], [0.275, 0.02], [0.275, 0.55], [0.262, 0.57], [0, 0.57]]), gold);
    const bullet = new THREE.Mesh(this.bulletGeometry(), this.bulletMat);
    bullet.position.y = 0.56;
    this.inner.add(sleeve, bullet);
    this.inner.position.y = 0.55; // retracted (hidden inside the case / under the cap)

    const capShell = new THREE.Mesh(
      lathe([[0.325, 0], [0.355, 0], [0.362, 0.03], [0.362, 1.0], [0.352, 1.05], [0.32, 1.075], [0, 1.075], [0, 1.045], [0.325, 1.045]]),
      lacquer,
    );
    (capShell.material as THREE.Material).side = THREE.DoubleSide;
    const capRing = new THREE.Mesh(lathe([[0.355, 0], [0.366, 0.0], [0.366, 0.07], [0.355, 0.07]]), gold);
    const capLogo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 64), gold);
    capLogo.position.y = 1.08;
    this.cap.add(capShell, capRing, capLogo);
    this.cap.position.y = 1.1;

    const body = new THREE.Group();
    body.add(base, band, foot, this.inner, this.cap);
    body.position.y = -1.1; // centre the closed lipstick around the origin
    this.lip.add(body);
    this.scene.add(this.lip);

    // ---- secondary floating pieces (fade out after the intro)
    const mini = (hex: string, s: number) => {
      const g = new THREE.Group();
      const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.35, clearcoat: 0.6 });
      const c = new THREE.Mesh(base.geometry, lacquer.clone());
      const b2 = new THREE.Mesh(band.geometry, gold);
      const sl = new THREE.Mesh(sleeve.geometry, gold);
      sl.position.y = 1.0;
      const bu = new THREE.Mesh(bullet.geometry, m);
      bu.position.y = 1.56;
      g.add(c, b2, sl, bu);
      g.scale.setScalar(s);
      return g;
    };
    const e1 = mini("#b8355a", 0.55);
    const e2 = mini("#e8735a", 0.42);
    this.extras.push(e1, e2);
    this.scene.add(e1, e2);

    // ---- silk hair ribbons
    const tex = strandTexture();
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(1, 1, 10, 180);
      const mat = new THREE.MeshPhysicalMaterial({
        color: this.hairColor.clone(), roughness: 0.34, metalness: 0,
        sheen: 1, sheenRoughness: 0.28, sheenColor: new THREE.Color(0xffffff),
        bumpMap: tex, bumpScale: 0.9, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.ribbonGroup.add(mesh);
      this.ribbons.push({ mesh, geo, phase: i * 2.1, mat, tone: [0, 0.22, -0.25][i] });
    }
    this.scene.add(this.ribbonGroup);

    // ---- soft blob shadows on an invisible floor
    const shadowTex = blobTexture();
    const addShadow = (follow: THREE.Object3D, size: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }),
      );
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.shadows.push({ mesh: m, follow, size });
    };
    addShadow(this.lip, 1.6);
    addShadow(this.ribbonGroup, 3.2);
    addShadow(e1, 0.8);
    addShadow(e2, 0.6);

    // ---- events
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    this.loop();
  }

  private bulletGeometry() {
    const r = 0.215, h = 0.72;
    const geo = new THREE.CylinderGeometry(r, r, h, 96, 48);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // slanted, slightly convex cut surface
      const k = (x + r) / (2 * r);
      const cut = h / 2 - k * 0.42 + Math.sin(k * Math.PI) * 0.03 - (z * z) / (r * r) * 0.02;
      if (y > cut) pos.setY(i, cut);
    }
    geo.translate(0, h / 2, 0);
    geo.computeVertexNormals();
    return geo;
  }

  // ---------- public API ----------
  setProgress(p: number) {
    this.target = clamp(p);
  }
  setLipColor(hex: string) {
    this.lipColor.set(hex);
  }
  setHairColor(hex: string) {
    this.hairColor.set(hex);
  }
  setVisible(v: boolean) {
    this.visible = v;
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- internals ----------
  private onPointer = (e: PointerEvent) => {
    this.mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  };

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.reduced ? 0 : this.clock.elapsedTime;
    this.p += (this.target - this.p) * Math.min(1, dt * 6);
    const p = this.p;

    // layout: objects on the left on wide screens, on top on narrow ones
    const dist = 11;
    const halfH = Math.tan(THREE.MathUtils.degToRad(15)) * dist;
    const halfW = halfH * this.aspect;
    const narrow = this.aspect < 0.95;
    const ax = narrow ? 0 : -halfW * 0.4;
    const ay = narrow ? halfH * 0.3 : -0.2;
    const sc = narrow ? 0.72 : 1;

    // stages
    const open = seg(p, 0.06, 0.3); // uncap + twist up
    const hair = seg(p, 0.4, 0.62); // ribbons flow in, lipstick steps back
    const fin = seg(p, 0.76, 0.92); // both together

    // lipstick
    const bob = Math.sin(t * 0.9) * 0.08;
    const lx = ax + lerp(lerp(0, -1.25, hair), -1.1, fin) * sc;
    const ly = ay + (lerp(lerp(-0.05, 0.0, open), 0.3, hair) - 0.45 * fin) * sc + bob;
    const lz = lerp(lerp(0, 0.9, open), -2.4, hair) + 1.9 * fin;
    this.lip.position.set(lx, ly, lz);
    this.lip.scale.setScalar(sc * lerp(1.15, 1.25, open));
    this.lip.rotation.set(0, -0.5 + t * 0.18 + open * 1.2, lerp(0.32, 0.12, open) + lerp(0, -0.18, fin));
    this.inner.position.y = lerp(0.55, 1.05, open);
    this.cap.position.set(lerp(0, -0.8, open), 1.1 + lerp(0, 1.15, open) + Math.sin(t * 1.1 + 1) * 0.05 * open, lerp(0, -0.35, open));
    this.cap.rotation.set(lerp(0, 0.35, open), 0, lerp(0, 0.75, open));
    this.bulletMat.color.lerp(this.lipColor, Math.min(1, dt * 5));

    // extras drift away as the story moves on
    const fade = 1 - seg(p, 0.15, 0.35);
    const [e1, e2] = this.extras;
    e1.position.set(ax + 1.9 * sc, ay - 1.2 * sc + Math.sin(t * 0.7 + 2) * 0.12 - (1 - fade) * 3, -2.6);
    e1.rotation.set(0.2, t * 0.25, -0.5);
    e2.position.set(ax - 2.0 * sc, ay + 1.6 * sc + Math.sin(t * 0.8) * 0.1 + (1 - fade) * 3, -3.4);
    e2.rotation.set(-0.15, -t * 0.2, 0.6);
    e1.visible = e2.visible = fade > 0.01;

    // ribbons
    const rg = this.ribbonGroup;
    rg.visible = hair > 0.001;
    rg.position.set(ax + lerp(0.6, 1.0, fin) * sc, ay + lerp(-7, -0.1, hair) * sc, lerp(0.4, -0.6, fin));
    rg.scale.setScalar(sc);
    rg.rotation.z = -0.18;
    if (rg.visible) this.updateRibbons(t, dt);

    // shadows under each floating object
    const floorY = -halfH * 0.92;
    for (const s of this.shadows) {
      const o = s.follow;
      const h = Math.max(0.2, o.position.y - floorY);
      s.mesh.position.set(o.position.x, floorY, o.position.z);
      const k = s.size * o.scale.x * (0.8 + h * 0.12);
      s.mesh.scale.set(k, k * 0.55, 1);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (o.visible ? 0.55 : 0) / (1 + h * 0.35);
    }

    // camera with a little parallax
    const cam = this.camera;
    cam.position.x += (this.mouse.x * 0.35 - cam.position.x) * 0.04;
    cam.position.y += (-this.mouse.y * 0.2 - cam.position.y) * 0.04;
    cam.position.z = dist;
    cam.lookAt(0, 0, 0);

    this.renderer.render(this.scene, cam);
  };

  private updateRibbons(t: number, dt: number) {
    const L = 4.6, W = 0.62;
    this.ribbons.forEach((rb, idx) => {
      const tone = rb.tone;
      const target = this.hairColor.clone().offsetHSL(0, tone > 0 ? -0.04 : 0.02, tone * 0.5);
      rb.mat.color.lerp(target, Math.min(1, dt * 5));
      rb.mat.sheenColor.copy(rb.mat.color).lerp(new THREE.Color(0xffffff), 0.45);
      const pos = rb.geo.attributes.position as THREE.BufferAttribute;
      const uv = rb.geo.attributes.uv as THREE.BufferAttribute;
      const off = (idx - 1) * 0.55;
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i), s = uv.getY(i);
        const ph = rb.phase + t * 0.55;
        const cx = off + Math.sin(s * 3.6 + ph) * 0.42 + Math.sin(s * 7.1 + ph * 1.3) * 0.06;
        const cy = (s - 0.5) * L;
        const cz = Math.cos(s * 2.8 + ph * 0.8) * 0.6;
        const tw = s * 2.6 + ph * 0.5 + idx;
        const w = (u - 0.5) * W * (0.55 + 0.45 * Math.sin(s * Math.PI));
        pos.setXYZ(i, cx + Math.cos(tw) * w, cy, cz + Math.sin(tw) * w);
      }
      pos.needsUpdate = true;
      rb.geo.computeVertexNormals();
    });
  }
}

function strandTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 4;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 256; i++) {
    const v = 110 + Math.random() * 100;
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(i, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(70,45,50,0.55)");
  g.addColorStop(0.5, "rgba(70,45,50,0.18)");
  g.addColorStop(1, "rgba(70,45,50,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
