// Copies the MediaPipe engine (wasm) and the two AI models into /public,
// so the site never depends on a CDN or on Google's servers at runtime.
// 1) wasm  -> from node_modules/@mediapipe/tasks-vision/wasm
// 2) models -> from ../models (the prototype folder) if present, otherwise downloaded once.
import { cpSync, existsSync, mkdirSync, copyFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = join(pub, "mediapipe/wasm");
if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log("✓ MediaPipe engine copied to public/mediapipe/wasm");
}

const MODELS = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "hair_segmenter.tflite":
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
  "selfie_multiclass_256x256.tflite":
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
};
const modelsDst = join(pub, "models");
mkdirSync(modelsDst, { recursive: true });

const ok = (p) => existsSync(p) && statSync(p).size > 100000;

for (const [name, url] of Object.entries(MODELS)) {
  const dst = join(modelsDst, name);
  if (ok(dst)) continue;
  const local = join(root, "..", "models", name);
  if (ok(local)) {
    copyFileSync(local, dst);
    console.log(`✓ ${name} copied from ../models`);
    continue;
  }
  try {
    console.log(`… downloading ${name}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
    console.log(`✓ ${name} downloaded`);
  } catch (e) {
    console.warn(`✗ Could not get ${name} (${e.message}). Put it in public/models manually — see README.`);
  }
}
