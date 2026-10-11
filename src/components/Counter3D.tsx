// 3D vitrine: a tiered lipstick stand or a hair-color swatch rail, rendered with three.js.
// Hover lifts a product, click picks it (and the mirror applies the shade).
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { byCategory, toman, type Product, type Shade } from "../data/catalog";

interface Props {
  kind: "lip" | "hair";
  selectedId: string | null;
  onSelect: (shadeId: string) => void;
}

interface Item {
  group: THREE.Group;
  product: Product;
  shade: Shade;
  base: THREE.Vector3;
  lift: number; // 0..1 animated
  phase: number;
}

const GOLD = new THREE.MeshPhysicalMaterial({ color: 0xe2c690, metalness: 1, roughness: 0.24 });
const LACQUER = new THREE.MeshPhysicalMaterial({ color: 0x1b1517, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });

export function Counter3D({ kind, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const [hover, setHover] = useState<{ item: { p: Product; s: Shade }; x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);

  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const wrap = wrapRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);
    renderer.domElement.className = "counter3d__canvas";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 1.35;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    // lights
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    scene.add(key, new THREE.AmbientLight(0xfff4f0, 0.35));

    // the counter slab (porcelain stone) + soft floor shadow
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.3, 4.2),
      new THREE.MeshPhysicalMaterial({ color: 0xf6f1ef, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, map: marbleTexture() }),
    );
    slab.position.y = -0.15;
    slab.receiveShadow = true;
    scene.add(slab);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(12.02, 0.04, 4.22), GOLD);
    edge.position.y = -0.31;
    scene.add(edge);

    const items: Item[] = [];
    const pickables: THREE.Object3D[] = [];
    const products = byCategory(kind);

    if (kind === "lip") {
      // tiered acrylic stand: one tier per collection, back tiers higher
      const tiers = [...products].reverse(); // gloss front, matte back
      tiers.forEach((p, t) => {
        const z = 1.4 - t * 1.4;
        const y = t * 0.75;
        const width = p.shades.length * 1.05 + 0.6;
        if (y > 0) {
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(width, y, 0.9),
            new THREE.MeshPhysicalMaterial({ color: 0xf3eceb, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }),
          );
          step.position.set(0, y / 2, z);
          step.castShadow = true;
          step.receiveShadow = true;
          scene.add(step);
        }
        p.shades.forEach((s, i) => {
          const g = p.finish === "gloss" ? glossTube(s.hex) : lipstick(s.hex, p.finish === "matte" ? 0.72 : 0.38);
          const x = (i - (p.shades.length - 1) / 2) * 1.05;
          g.position.set(x, y, z);
          g.rotation.y = -0.5 + (i % 2) * 0.12;
          addItem(g, p, s);
        });
      });
      camera.position.set(0, 4.9, 10.8);
      camera.lookAt(0, 1.5, -0.4);
    } else {
      // gold rail with hanging hair tresses
      const p = products[0];
      const n = p.shades.length;
      const span = (n - 1) * 1.15;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, span + 1.6, 24), GOLD);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 3.55, 0);
      rail.castShadow = true;
      scene.add(rail);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.55, 20), GOLD);
        post.position.set((sx * (span + 1.6)) / 2, 3.55 / 2, 0);
        post.castShadow = true;
        scene.add(post);
      }
      p.shades.forEach((s, i) => {
        const g = tress(s.hex);
        g.position.set(i * 1.15 - span / 2, 3.55, 0);
        addItem(g, p, s);
      });
      camera.position.set(0, 2.6, 9.2);
      camera.lookAt(0, 2.0, 0);
    }

    function addItem(g: THREE.Group, product: Product, shade: Shade) {
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.userData.shadeId = shade.id;
          pickables.push(o);
        }
      });
      scene.add(g);
      items.push({ group: g, product, shade, base: g.position.clone(), lift: 0, phase: Math.random() * Math.PI * 2 });
    }
    const baseCam = camera.position.clone();
    const lookAt = kind === "lip" ? new THREE.Vector3(0, 1.5, -0.4) : new THREE.Vector3(0, 2.0, 0);

    // sizing
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // pull the camera back on narrow screens so everything fits
      const fit = Math.max(1, 1.55 / camera.aspect);
      camera.position.copy(baseCam).sub(lookAt).multiplyScalar(fit).add(lookAt);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // pointer
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(9, 9);
    const parallax = new THREE.Vector2();
    let hovered: Item | null = null;
    const pick = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      parallax.set(ndc.x, ndc.y);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      return hit ? items.find((it) => it.shade.id === hit.object.userData.shadeId) ?? null : null;
    };
    const onMove = (ev: PointerEvent) => {
      const it = pick(ev);
      if (it !== hovered) {
        hovered = it;
        renderer.domElement.style.cursor = it ? "pointer" : "default";
        if (!it) setHover(null);
      }
      if (it) {
        const r = renderer.domElement.getBoundingClientRect();
        setHover({ item: { p: it.product, s: it.shade }, x: ev.clientX - r.left, y: ev.clientY - r.top });
      }
    };
    const onLeave = () => {
      hovered = null;
      parallax.set(0, 0);
      setHover(null);
    };
    const onClick = (ev: PointerEvent) => {
      const it = pick(ev);
      if (it) onSelectRef.current(it.shade.id);
    };
    const el = renderer.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerup", onClick);

    // render only while visible
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(wrap);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      for (const it of items) {
        const sel = it.shade.id === selectedRef.current;
        const target = sel ? 1 : it === hovered ? 0.55 : 0;
        it.lift += (target - it.lift) * Math.min(1, dt * 8);
        const g = it.group;
        if (kind === "lip") {
          g.position.y = it.base.y + it.lift * 0.7;
          g.position.z = it.base.z + it.lift * 0.5;
          g.rotation.y = sel && !reduced ? -0.5 + t * 0.9 : -0.5 + Math.sin(it.phase) * 0.12;
        } else {
          g.position.z = it.base.z + it.lift * 0.9;
          g.rotation.z = reduced ? 0 : Math.sin(t * 0.9 + it.phase) * 0.025 * (1 - it.lift);
          g.rotation.y = sel && !reduced ? Math.sin(t * 1.2) * 0.35 : 0;
        }
      }
      // gentle parallax
      camera.position.x += (parallax.x * 0.35 - camera.position.x) * 0.05;
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerup", onClick);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as THREE.Material;
          if (mat !== GOLD && mat !== LACQUER) mat.dispose();
        }
      });
      pmrem.dispose();
      renderer.dispose();
      el.remove();
    };
  }, [kind]);

  return (
    <div className={`counter3d counter3d--${kind}`} ref={wrapRef}>
      {failed && <p className="counter3d__fallback">مرورگر شما نمایش سه‌بعدی را پشتیبانی نمی‌کند.</p>}
      {hover && (
        <div className="counter3d__tip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.item.s.name}</strong>
          <span>{hover.item.p.name}، {toman(hover.item.p.price)}</span>
        </div>
      )}
    </div>
  );
}

// ---------------- models ----------------

function lipstick(hex: string, roughness: number) {
  const g = new THREE.Group();
  const r = 0.27;
  // case
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.05, 48), LACQUER);
  caseMesh.position.y = 0.525;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.004, r + 0.004, 0.05, 48), GOLD);
  band.position.y = 1.02;
  // sleeve
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.42, 48), GOLD);
  sleeve.position.y = 1.26;
  // bullet with a slanted tip
  const h = 0.62, br = r * 0.72;
  const geo = new THREE.CylinderGeometry(br, br, h, 48, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const cut = h / 2 - ((x + br) / (2 * br)) * 0.34; // slanted plane
    if (y > cut) pos.setY(i, cut);
  }
  geo.computeVertexNormals();
  const bullet = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness, clearcoat: roughness < 0.5 ? 0.7 : 0, clearcoatRoughness: 0.2 }),
  );
  bullet.position.y = 1.47 + h / 2 - 0.02;
  g.add(caseMesh, band, sleeve, bullet);
  return g;
}

function glossTube(hex: string) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.2, 1.0, 8, 32),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: 0.08, clearcoat: 1, transmission: 0.35, thickness: 0.5, ior: 1.5 }),
  );
  body.position.y = 0.7;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.7, 40), LACQUER);
  cap.position.y = 1.6;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.04, 40), GOLD);
  ring.position.y = 1.26;
  g.add(body, cap, ring);
  return g;
}

let strandTex: THREE.CanvasTexture | null = null;
function strands() {
  if (strandTex) return strandTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 16;
  const x = c.getContext("2d")!;
  x.fillStyle = "#808080";
  x.fillRect(0, 0, 256, 16);
  for (let i = 0; i < 256; i++) {
    const v = 90 + Math.random() * 90;
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(i, 0, 1, 16);
  }
  strandTex = new THREE.CanvasTexture(c);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  return strandTex;
}

function tress(hex: string) {
  const g = new THREE.Group();
  // a flattened, tapering lock of hair hanging from a clasp
  const len = 2.7;
  const geo = new THREE.CylinderGeometry(0.34, 0.24, len, 48, 24, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = (len / 2 - y) / len; // 0 top .. 1 tip
    pos.setZ(i, pos.getZ(i) * 0.32);
    pos.setX(i, pos.getX(i) + Math.sin(k * Math.PI * 1.2) * 0.04); // soft wave
  }
  geo.computeVertexNormals();
  const tex = strands().clone();
  tex.needsUpdate = true;
  tex.repeat.set(3, 1);
  const hair = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(hex), roughness: 0.5, bumpMap: tex, bumpScale: 1.2,
      sheen: 0.45, sheenColor: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.35,
    }),
  );
  hair.position.y = -0.3 - len / 2;
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.24), LACQUER);
  clasp.position.y = -0.25;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.25), GOLD);
  clip.position.y = -0.4;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 12, 32), GOLD);
  hook.position.y = -0.05;
  g.add(hair, clasp, clip, hook);
  return g;
}

function marbleTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f7f2f0";
  x.fillRect(0, 0, 512, 512);
  x.globalAlpha = 0.12;
  for (let v = 0; v < 14; v++) {
    x.strokeStyle = v % 3 ? "#b9a9a6" : "#cbb48c";
    x.lineWidth = 0.6 + Math.random() * 1.6;
    x.beginPath();
    let px = Math.random() * 512, py = 0;
    x.moveTo(px, py);
    while (py < 512) {
      px += (Math.random() - 0.5) * 60;
      py += 20 + Math.random() * 30;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
