// Hero scene that the visitor "scrubs" with the mouse (desktop) or a finger drag (mobile):
// progress 0 → 1 rotates the lipstick, lifts the cap away and twists the bullet up.
// Like scrubbing a product video, but rendered live, so it stays sharp and can change shade.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { lipstick, mats } from "./models";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;

export class ScrubScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  private pmrem: THREE.PMREMGenerator;
  private clock = new THREE.Clock();
  private ro: ResizeObserver;
  private raf = 0;
  private visible = true;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  private target = 0;
  private p = 0;
  private aspect = 1;
  private root = new THREE.Group();
  private parts: ReturnType<typeof lipstick>;
  private color = new THREE.Color("#c0182a");
  private glow: THREE.Mesh;

  constructor(private host: HTMLElement) {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(1.75, devicePixelRatio));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.domElement.className = "block w-full h-full";
    host.appendChild(r.domElement);

    this.pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    // studio lighting for a dark set: a soft key from above plus warm and cool rims
    const key = new THREE.SpotLight(0xfff3ea, 60, 30, 0.5, 0.8, 1.6);
    key.position.set(-2, 7, 6);
    const rimWarm = new THREE.DirectionalLight(0xffc2a8, 3.2);
    rimWarm.position.set(5, 2, -4);
    const rimCool = new THREE.DirectionalLight(0xcfdcff, 2.4);
    rimCool.position.set(-5, 3, -3);
    this.scene.add(key, key.target, rimWarm, rimCool, new THREE.AmbientLight(0xffffff, 0.12));

    const m = mats();
    this.parts = lipstick(this.color.getStyle(), "satin", 0, m);
    const body = this.parts.group;
    body.position.y = -1.2; // centre the closed lipstick
    this.root.add(body);
    this.scene.add(this.root);

    // a faint pool of light under the product
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,170,160,0.55)");
    grad.addColorStop(1, "rgba(255,170,160,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.scene.add(this.glow);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  /** 0 = closed lipstick, 1 = fully open and turned. */
  setProgress(p: number) {
    this.target = clamp(p);
  }
  get progress() {
    return this.target;
  }
  setColor(hex: string) {
    this.color.set(hex);
  }
  setVisible(v: boolean) {
    this.visible = v;
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

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
    // ease toward the scrub position so fast flicks still feel smooth
    this.p += (this.target - this.p) * (1 - Math.exp(-dt * 7));
    const p = this.p;

    const dist = 10;
    const halfH = Math.tan(THREE.MathUtils.degToRad(14)) * dist;
    const halfW = halfH * this.aspect;
    const narrow = this.aspect < 0.9;
    const ax = narrow ? 0 : -halfW * 0.36;
    const ay = narrow ? halfH * 0.36 : -0.05;
    const sc = narrow ? 0.7 : 1.05;

    const open = smooth(0.08, 0.42, p); // cap lifts away
    const twist = smooth(0.32, 0.78, p); // bullet twists up

    const { inner, cap, bullet } = this.parts;
    this.root.position.set(ax, ay + Math.sin(t * 0.9) * 0.06, lerp(0, 0.6, open));
    this.root.scale.setScalar(sc);
    this.root.rotation.set(lerp(0.08, 0.02, open), -0.6 + p * Math.PI * 1.55 + Math.sin(t * 0.5) * 0.04, lerp(0.22, 0.06, open));
    inner.position.y = 0.55 + twist * 0.5;
    inner.rotation.y = twist * Math.PI * 0.9;
    cap.position.set(lerp(0, -0.85, open), 1.1 + lerp(0, 0.95, open), lerp(0, -0.25, open));
    cap.rotation.set(lerp(0, 0.35, open), 0, lerp(0, 0.85, open));
    (bullet.material as THREE.MeshPhysicalMaterial).color.lerp(this.color, 1 - Math.exp(-dt * 6));

    const floor = -halfH * 0.86;
    this.glow.position.set(ax, narrow ? ay - 2.0 * sc : floor, 0);
    const gs = (narrow ? 3.2 : 4.2) * (0.9 + open * 0.2);
    this.glow.scale.set(gs, gs * 0.5, 1);
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.35 + twist * 0.25;

    this.camera.position.set(0, 0.2, lerp(dist, dist - 0.6, open));
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  };
}
