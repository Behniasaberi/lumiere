/// <reference lib="webworker" />
// Hair segmentation on its own thread: the page, the camera picture and the lipstick stay smooth
// while the hair model works. Runs on the CPU (GPU read-back of the hair mask is unreliable on many devices).
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

// MediaPipe loads its engine with importScripts(), which throws in module workers — replace it
// with a synchronous fetch + global eval (synchronous XHR is allowed inside workers).
const g = self as unknown as { importScripts?: (url: string) => void };
{
  g.importScripts = (url: string) => {
    const x = new XMLHttpRequest();
    x.open("GET", url, false);
    x.send();
    if (x.status && (x.status < 200 || x.status >= 300)) throw new Error(`${url} → HTTP ${x.status}`);
    (0, eval)(x.responseText);
  };
}

let seg: ImageSegmenter | null = null;
let hairClass = 1;

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      hairClass = m.hairClass ?? 1;
      const fs = await FilesetResolver.forVisionTasks(m.wasmDir);
      if (m.wasmBinaryPath) fs.wasmBinaryPath = m.wasmBinaryPath;
      seg = await ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetBuffer: new Uint8Array(m.model), delegate: "CPU" },
        // IMAGE mode: every frame stands alone. In VIDEO mode this model uses the previous mask as a prior,
        // which trails behind the head when frames are far apart (slow phones).
        runningMode: "IMAGE",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
      postMessage({ type: "ready" });
    } else if (m.type === "frame") {
      const bmp = m.bitmap as ImageBitmap;
      const t0 = performance.now();
      let conf: Float32Array | null = null, w = 0, h = 0;
      seg!.segment(bmp, (res) => {
        const c = res.confidenceMasks?.[hairClass];
        if (c) {
          conf = c.getAsFloat32Array().slice();
          w = c.width;
          h = c.height;
        }
      });
      bmp.close();
      const out = conf as Float32Array | null;
      postMessage(
        { type: "mask", id: m.id, gen: m.gen, ms: performance.now() - t0, conf: out?.buffer ?? null, w, h },
        out ? [out.buffer] : [],
      );
    }
  } catch (e) {
    postMessage({ type: "error", id: m.id, gen: m.gen, message: String(e) });
  }
};
