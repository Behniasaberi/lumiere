// Procedural product models shared by the hero scene and the product-photo renders.
import * as THREE from "three";

export const mats = () => ({
  gold: new THREE.MeshPhysicalMaterial({ color: 0xe6cb98, metalness: 1, roughness: 0.2 }),
  lacquer: new THREE.MeshPhysicalMaterial({ color: 0x1b1719, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }),
});

const lathe = (pts: [number, number][], segs = 128) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);

export function bulletGeometry() {
  const r = 0.215, h = 0.72;
  const geo = new THREE.CylinderGeometry(r, r, h, 128, 56);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = (x + r) / (2 * r);
    const cut = h / 2 - k * 0.42 + Math.sin(k * Math.PI) * 0.03 - ((z * z) / (r * r)) * 0.02;
    if (y > cut) pos.setY(i, cut);
  }
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

export interface LipstickParts {
  group: THREE.Group;
  inner: THREE.Group;
  cap: THREE.Group;
  bullet: THREE.Mesh;
}

/** Lipstick with y=0 at the bottom of the case. `open` 0..1 twists the bullet up. */
export function lipstick(hex: string, finish: "matte" | "satin" | "gloss" = "satin", open = 1, m = mats()): LipstickParts {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    lathe([[0, 0], [0.3, 0], [0.33, 0.015], [0.345, 0.06], [0.345, 1.04], [0.338, 1.08], [0.32, 1.1], [0, 1.1]]),
    m.lacquer,
  );
  const band = new THREE.Mesh(lathe([[0.31, 1.08], [0.352, 1.085], [0.352, 1.14], [0.31, 1.145]]), m.gold);
  const foot = new THREE.Mesh(lathe([[0.3, 0.0], [0.348, 0.02], [0.348, 0.05], [0.3, 0.06]]), m.gold);
  const inner = new THREE.Group();
  const sleeve = new THREE.Mesh(lathe([[0, 0], [0.27, 0], [0.275, 0.02], [0.275, 0.55], [0.262, 0.57], [0, 0.57]]), m.gold);
  const bullet = new THREE.Mesh(
    bulletGeometry(),
    new THREE.MeshPhysicalMaterial({
      color: hex,
      roughness: finish === "matte" ? 0.62 : 0.3,
      clearcoat: finish === "matte" ? 0 : 0.6,
      clearcoatRoughness: 0.2,
      sheen: finish === "matte" ? 0.6 : 0.2,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.3),
    }),
  );
  bullet.position.y = 0.56;
  inner.add(sleeve, bullet);
  inner.position.y = 0.55 + open * 0.5;
  const cap = new THREE.Group();
  const shell = new THREE.Mesh(
    lathe([[0.325, 0], [0.355, 0], [0.362, 0.03], [0.362, 1.0], [0.352, 1.05], [0.32, 1.075], [0, 1.075], [0, 1.045], [0.325, 1.045]]),
    m.lacquer,
  );
  const ring = new THREE.Mesh(lathe([[0.355, 0], [0.366, 0.0], [0.366, 0.07], [0.355, 0.07]]), m.gold);
  const logo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 64), m.gold);
  logo.position.y = 1.08;
  cap.add(shell, ring, logo);
  cap.position.y = 1.1;
  group.add(base, band, foot, inner, cap);
  return { group, inner, cap, bullet };
}

/** Lip gloss: tinted bottle + lacquer cap with a doe-foot wand. y=0 at the bottom. */
export function glossTube(hex: string, m = mats()) {
  const group = new THREE.Group();
  const bottle = new THREE.Mesh(
    lathe([[0, 0], [0.2, 0], [0.23, 0.04], [0.235, 0.12], [0.235, 1.18], [0.2, 1.24], [0.12, 1.26], [0.12, 1.32], [0, 1.32]], 96),
    new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, transmission: 0.25, thickness: 0.6, ior: 1.5 }),
  );
  const cap = new THREE.Mesh(lathe([[0, 0], [0.19, 0], [0.2, 0.02], [0.2, 0.86], [0.185, 0.9], [0, 0.9]], 96), m.lacquer);
  cap.position.y = 1.3;
  const ring = new THREE.Mesh(lathe([[0.19, 0], [0.206, 0], [0.206, 0.05], [0.19, 0.05]], 96), m.gold);
  ring.position.y = 1.3;
  group.add(bottle, cap, ring);
  return group;
}

/** A hair-colour swatch: a thick lock of fine strands with uneven ends, held by a gold clip. y=0 at the clip. */
export function hairSwatch(hex: string, m = mats(), strands?: THREE.Texture) {
  const group = new THREE.Group();
  const bump = strands ?? strandTexture();
  const alpha = strandEnds();
  const streaks = strandStreaks();
  const base = new THREE.Color(hex);
  const layers = [
    { z: -0.04, w: 0.95, tone: -0.05, phase: 0.0 },
    { z: 0.0, w: 0.9, tone: 0.0, phase: 0.0 },
    { z: 0.04, w: 0.82, tone: 0.04, phase: 0.0 },
  ];
  const L = 3.6;
  for (const ly of layers) {
    const geo = new THREE.PlaneGeometry(1, 1, 48, 220);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), s = 1 - uv.getY(i); // s: 0 at clip, 1 at the ends
      const width = ly.w * (0.55 + 0.5 * Math.sin(Math.min(1, s * 1.6) * Math.PI * 0.5)) * (1 - s * 0.35);
      const x = (u - 0.5) * width + Math.sin(s * 4 + ly.phase) * 0.08 * s;
      const y = -s * L;
      const curl = Math.cos((u - 0.5) * Math.PI) * 0.12; // rounded cross-section
      const z = ly.z + curl + Math.sin(s * 3.1 + ly.phase) * 0.16 * s;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const c = base.clone().offsetHSL(0, 0, ly.tone);
    const mat = new THREE.MeshPhysicalMaterial({
      color: c, roughness: 0.42, sheen: 1, sheenRoughness: 0.32,
      sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.5),
      map: streaks, bumpMap: bump, bumpScale: 2.2, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(geo, mat));
  }
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.32), m.gold);
  clip.position.y = 0.06;
  group.add(clip);
  return group;
}

function strandStreaks() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 4;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 1024; i++) {
    const v = 175 + Math.random() * 80;
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(i, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function strandEnds() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, 1024, 512);
  x.fillStyle = "#fff";
  for (let i = 0; i < 1024; i++) {
    const edge = Math.abs(i - 512) / 512; // outer strands end earlier
    const len = 0.82 + Math.random() * 0.18 - edge * 0.12;
    // uv v=1 is the top of the plane (the clip), so strands grow downward from the top
    x.fillRect(i, 0, 1, Math.round(512 * len));
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = true;
  return t;
}

export function strandTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 4;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 512; i++) {
    const v = 110 + Math.random() * 100;
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(i, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  return t;
}
