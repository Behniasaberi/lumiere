// Virtual try-on engine — lipstick (face landmarks) + hair color (segmentation).
// Ported from the prototype's app.js. Runs fully in the browser on MediaPipe Tasks Vision;
// no camera frame or photo ever leaves the device.
import { hexToRgb, rgbToHex, rgbToLab } from "./color";
import { GLCompositor, type HairParams, type LipParams } from "./glCompositor";
import { SIZE_HINT, WASM_SOURCES, download, modelSources } from "./assets";
import type { FaceLandmarker as FL, ImageSegmenter as IS, NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Finish = "matte" | "satin" | "gloss";
export interface Look {
  lip?: { hex: string; finish: Finish } | null;
  hair?: { hex: string } | null;
}
export type ModelState = "idle" | "loading" | "ready" | "failed";
export type CameraError = "insecure" | "denied" | "notfound" | "busy" | "unknown";
export type Hint = "" | "no-face" | "no-hair" | "low-light";
export type Lighting = "none" | "day" | "office" | "evening";

export interface LipColorReading {
  rgb: [number, number, number];
  crop: string; // data URL of the lips area, for display
}

export interface SkinReading {
  undertone: "warm" | "cool" | "neutral";
  depth: "light" | "medium" | "deep";
  rgb: [number, number, number];
}

interface Analysis {
  face: NormalizedLandmark[] | null;
  hair: { conf: Float32Array; w: number; h: number } | null;
}

const FACE_FILE = "face_landmarker.task";
const HAIR_FILE = "selfie_multiclass_256x256.tflite";
const WASM_FILE = "vision_wasm_internal.wasm";
// Multi-class selfie model: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 other
const HAIR_CLASS = 1;
const BODY_SKIN_CLASS = 2;
const FACE_SKIN_CLASS = 3;

// Face-mesh landmark indices tracing the lips (outer and inner contour).
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
// Cheek points used to read skin tone.
const CHEEKS = [50, 280, 117, 346, 205, 425];

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
const srcW = (s: Source) => (s as HTMLVideoElement).videoWidth || (s as HTMLImageElement).naturalWidth || s.width || 0;
const srcH = (s: Source) => (s as HTMLVideoElement).videoHeight || (s as HTMLImageElement).naturalHeight || s.height || 0;

function lum601(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
}

/** Closed Catmull-Rom curve through every landmark — round lip lines instead of a polygon. */
function smoothClosed(path: Path2D, pts: [number, number][]) {
  const n = pts.length;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    path.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  path.closePath();
}

/** One-Euro filter over all landmark coordinates: kills jitter when still, no lag when moving. */
class LandmarkFilter {
  private x: Float64Array | null = null;
  private dx: Float64Array | null = null;
  private last = 0;
  constructor(private minCutoff = 1.6, private beta = 22, private dCutoff = 1) {}
  reset() {
    this.x = this.dx = null;
  }
  apply(face: NormalizedLandmark[], now: number): NormalizedLandmark[] {
    const n = face.length * 2;
    if (!this.x || this.x.length !== n) {
      this.x = new Float64Array(n);
      this.dx = new Float64Array(n);
      face.forEach((p, i) => { this.x![i * 2] = p.x; this.x![i * 2 + 1] = p.y; });
      this.last = now;
      return face.map((p) => ({ ...p }));
    }
    const dt = Math.max(1 / 240, Math.min(0.2, (now - this.last) / 1000));
    this.last = now;
    const alpha = (cut: number) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
    const ad = alpha(this.dCutoff);
    const x = this.x, dx = this.dx!;
    return face.map((p, i) => {
      const o = { ...p };
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k, v = k ? p.y : p.x;
        dx[j] += ad * ((v - x[j]) / dt - dx[j]);
        x[j] += alpha(this.minCutoff + this.beta * Math.abs(dx[j])) * (v - x[j]);
      }
      o.x = x[i * 2];
      o.y = x[i * 2 + 1];
      return o;
    });
  }
}

export class TryOnEngine {
  // ---- public, observable state ----
  face: ModelState = "idle";
  hairModel: ModelState = "idle";
  delegate: "GPU" | "CPU" = "GPU";
  hint: Hint = "";
  /** Download progress 0..1: `face` covers the engine + face model (lipstick), `hair` the hair model. */
  loadProgress = { face: 0, hair: 0 };
  /** False when the browser has WebGL switched off — the AI models cannot run without it. */
  webgl = true;
  sourceKind: "none" | "camera" | "photo" = "none";

  private listeners = new Set<() => void>();
  private version = 0;

  // ---- models ----
  private fileset: unknown = null;
  private faceLandmarker: FL | null = null;
  private segmenter: IS | null = null;
  private faceBuf: Uint8Array | null = null;
  private hairBuf: Uint8Array | null = null;
  private initPromise: Promise<void> | null = null;
  private rebuilding = false;
  private lastTs = -1;

  // ---- source / output ----
  private video: HTMLVideoElement;
  private source: Source | null = null;
  private mirror = false;
  private target: HTMLCanvasElement | null = null;
  private tctx: CanvasRenderingContext2D | null = null;
  private targets: HTMLCanvasElement[] = []; // the most recently mounted mirror draws; others wait
  private lighting: Lighting = "none";

  // ---- look ----
  private look: Look = {};
  private lipIntensity = 0.75;
  private hairIntensity = 0.65;
  private split: number | null = null;

  // ---- render caches ----
  private layer = document.createElement("canvas");
  private lctx = this.layer.getContext("2d")!;
  private maskCanvas = document.createElement("canvas");
  private mctx = this.maskCanvas.getContext("2d")!;
  private sampleCanvas = document.createElement("canvas");
  private sctx = this.sampleCanvas.getContext("2d", { willReadFrequently: true })!;
  private maskImageData: ImageData | null = null;
  private hairLum = 0.25;
  private hairMissing = 0;
  private noFace = 0;
  private photoAnalysis: Analysis | null = null; // cached for still photos
  private lastAnalysis: Analysis = { face: null, hair: null };
  private dirty = true;
  private raf = 0;

  // ---- smoothing & transitions ----
  private smoothFace: NormalizedLandmark[] | null = null;
  private faceFilter = new LandmarkFilter();
  private glc: GLCompositor | null | undefined; // undefined = not tried yet
  private hairBytes: Uint8Array | null = null;
  private lipCanvas = document.createElement("canvas");
  private lipCtx = this.lipCanvas.getContext("2d", { willReadFrequently: true })!;
  private lipSample = document.createElement("canvas");
  private lipSampleCtx = this.lipSample.getContext("2d", { willReadFrequently: true })!;
  private lipMean = 0.45;
  private statsFresh = { hair: false, lip: false }; // first reading of a new source is taken as-is
  // frame pacing: only run the models when the camera delivered a new frame
  private videoFresh = true;
  private paced = false;
  private lastVideoFrame = 0;
  private watchGen = 0;
  // the camera frame the models saw — the same pixels are drawn, so colour never lags behind the face
  private still = document.createElement("canvas");
  private stillCtx = this.still.getContext("2d")!;
  private faceLost = 0;
  private prevHair: Float32Array | null = null;
  private lipView = { rgb: [0, 0, 0], alpha: 0, finish: "satin" as Finish };
  private hairView = { rgb: [0, 0, 0], alpha: 0 };
  private lastFrame = performance.now();

  constructor() {
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
  }

  // ===================== subscription (for React) =====================
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ===================== models =====================
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.loadModels();
    return this.initPromise;
  }

  private async loadModels() {
    // MediaPipe needs WebGL even in CPU mode; without it nothing can run, so say so up front
    try {
      const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
      this.webgl = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext(); // free the test context right away
    } catch {
      this.webgl = false;
    }
    if (!this.webgl) {
      this.face = this.hairModel = "failed";
      this.emit();
      return;
    }
    this.face = this.hairModel = "loading";
    this.emit();

    // progress across the parallel downloads (throttled emits)
    const bytes: Record<string, [number, number]> = {};
    let lastEmit = 0;
    const part = (keys: string[]) => {
      let a = 0, b = 0;
      for (const k of keys) {
        const v = bytes[k];
        a += v ? v[0] : 0;
        b += v ? v[1] : SIZE_HINT[k] ?? 0;
      }
      return b ? Math.min(1, a / b) : 0;
    };
    const track = (key: string) => (loaded: number, total: number) => {
      bytes[key] = [loaded, total];
      this.loadProgress = { face: part([WASM_FILE, FACE_FILE]), hair: part([HAIR_FILE]) };
      const now = performance.now();
      if (now - lastEmit > 150) {
        lastEmit = now;
        this.emit();
      }
    };

    // lipstick first: engine + face model download together; the big hair model waits its turn
    const faceDl = download(modelSources(FACE_FILE), track(FACE_FILE));
    faceDl.catch(() => {});
    let vision: typeof import("@mediapipe/tasks-vision");
    try {
      const [mod, wasm] = await Promise.all([
        import("@mediapipe/tasks-vision"),
        download(WASM_SOURCES.map((d) => `${d}/${WASM_FILE}`), track(WASM_FILE), { minBytes: 1_000_000 }),
      ]);
      vision = mod;
      const dir = wasm.source.slice(0, wasm.source.lastIndexOf("/"));
      const fs = await vision.FilesetResolver.forVisionTasks(dir);
      // hand MediaPipe the bytes we already have, so the 9 MB engine is never downloaded twice
      if (fs.wasmBinaryPath.endsWith(WASM_FILE)) {
        fs.wasmBinaryPath = URL.createObjectURL(new Blob([wasm.data], { type: "application/wasm" }));
      }
      this.fileset = fs;
    } catch (e) {
      console.error(e);
      this.face = this.hairModel = "failed";
      this.emit();
      return;
    }
    const { FaceLandmarker, ImageSegmenter } = vision;
    const localFileset = () => vision.FilesetResolver.forVisionTasks(WASM_SOURCES[WASM_SOURCES.length - 1]);
    const faceOpts = (buf: Uint8Array, d: "GPU" | "CPU") => ({
      baseOptions: { modelAssetBuffer: buf, delegate: d },
      runningMode: "VIDEO" as const,
      numFaces: 1,
    });
    const hairOpts = (buf: Uint8Array, d: "GPU" | "CPU") => ({
      baseOptions: { modelAssetBuffer: buf, delegate: d },
      runningMode: "VIDEO" as const,
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
    const withDelegate = async <T>(make: (d: "GPU" | "CPU") => Promise<T>) => {
      try {
        return await make(this.delegate);
      } catch (e) {
        if (this.delegate === "CPU") throw e;
        console.warn("GPU mode failed, using CPU", e);
        this.delegate = "CPU";
        return await make("CPU");
      }
    };
    // if the CDN copy of the engine can't start, fall back to the site's own copy
    const create = async <T>(make: (fs: never, d: "GPU" | "CPU") => Promise<T>) => {
      try {
        return await withDelegate((d) => make(this.fileset as never, d));
      } catch (e) {
        console.warn("[try-on] engine from CDN failed, using local copy", e);
        this.fileset = await localFileset();
        return await withDelegate((d) => make(this.fileset as never, d));
      }
    };
    // Rebuild on CPU if the GPU breaks at runtime (some drivers do).
    this.rebuildOnCpu = async () => {
      if (this.rebuilding || this.delegate === "CPU") return;
      this.rebuilding = true;
      this.delegate = "CPU";
      try {
        const fs = this.fileset as never;
        if (this.faceBuf) this.faceLandmarker = await FaceLandmarker.createFromOptions(fs, faceOpts(this.faceBuf, "CPU"));
        if (this.hairBuf) this.segmenter = await ImageSegmenter.createFromOptions(fs, hairOpts(this.hairBuf, "CPU"));
        this.lastTs = -1;
      } catch (e) {
        console.error(e);
      }
      this.rebuilding = false;
      this.dirty = true;
      this.emit();
    };

    try {
      this.faceBuf = (await faceDl).data;
      this.faceLandmarker = await create((fs, d) => FaceLandmarker.createFromOptions(fs, faceOpts(this.faceBuf!, d)));
      this.face = "ready";
    } catch (e) {
      console.error(e);
      this.face = "failed";
    }
    this.dirty = true;
    this.emit();

    this.loadHair = async () => {
      this.hairModel = "loading";
      this.emit();
      try {
        this.hairBuf ??= (await download(modelSources(HAIR_FILE), track(HAIR_FILE))).data;
        this.segmenter = await create((fs, d) => ImageSegmenter.createFromOptions(fs, hairOpts(this.hairBuf!, d)));
        this.hairModel = "ready";
      } catch (e) {
        console.error("[try-on] hair model failed", e);
        this.hairModel = "failed";
      }
      this.dirty = true;
      this.emit();
    };
    await this.loadHair();
  }
  private loadHair: () => Promise<void> = async () => {};
  /** Try the hair model again after a failure (shown as a button in the mirror). */
  retryHair() {
    if (this.hairModel === "failed" && this.webgl) this.loadHair();
  }
  private rebuildOnCpu: () => Promise<void> = async () => {};

  // ===================== sources =====================
  async startCamera(): Promise<CameraError | null> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return "insecure";
    let stream: MediaStream | null = null;
    let err: { name?: string } | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      err = e as { name?: string };
      // Some webcams reject the preferred size — retry with any camera.
      if (err.name === "OverconstrainedError" || err.name === "NotReadableError") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e2) {
          err = e2 as { name?: string };
        }
      }
    }
    if (!stream) {
      const n = err?.name;
      if (n === "NotAllowedError" || n === "SecurityError") return "denied";
      if (n === "NotFoundError") return "notfound";
      if (n === "NotReadableError" || n === "AbortError") return "busy";
      return "unknown";
    }
    this.stopCamera();
    this.video.srcObject = stream;
    await new Promise<void>((res) => {
      if (this.video.readyState >= 2) return res();
      this.video.onloadeddata = () => res();
    });
    try {
      await this.video.play();
    } catch {
      /* autoplay quirks — frames still arrive */
    }
    this.setSource(this.video, true, "camera");
    this.watchFrames();
    this.init();
    return null;
  }

  private watchFrames() {
    const v = this.video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    const gen = ++this.watchGen;
    this.paced = false;
    if (!v.requestVideoFrameCallback) return;
    const cb = () => {
      if (gen !== this.watchGen || !v.srcObject) return;
      this.videoFresh = true;
      this.paced = true;
      this.lastVideoFrame = performance.now();
      v.requestVideoFrameCallback!(cb);
    };
    v.requestVideoFrameCallback(cb);
  }

  stopCamera() {
    const s = this.video.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    if (this.sourceKind === "camera") this.setSource(null, false, "none");
  }

  loadPhoto(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        this.stopCamera();
        this.setSource(img, false, "photo");
        URL.revokeObjectURL(url);
        this.init();
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("not an image"));
      };
      img.src = url;
    });
  }

  private setSource(src: Source | null, mirror: boolean, kind: "none" | "camera" | "photo") {
    this.source = src;
    this.mirror = mirror;
    this.sourceKind = kind;
    this.photoAnalysis = null;
    this.smoothFace = null;
    this.faceFilter.reset();
    this.statsFresh = { hair: false, lip: false };
    this.prevHair = null;
    this.faceLost = 0;
    this.hint = "";
    this.noFace = this.hairMissing = 0;
    this.dirty = true;
    this.emit();
  }

  get isMirrored() {
    return this.mirror;
  }
  get hasSource() {
    return !!this.source;
  }

  // ===================== output =====================
  attach(canvas: HTMLCanvasElement) {
    this.targets = this.targets.filter((c) => c !== canvas).concat(canvas);
    this.useTop();
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }
  detach(canvas: HTMLCanvasElement) {
    this.targets = this.targets.filter((c) => c !== canvas);
    this.useTop();
  }
  /** True when this canvas is the one currently showing the mirror. */
  isActive(canvas: HTMLCanvasElement | null) {
    return !!canvas && this.target === canvas;
  }
  private useTop() {
    const top = this.targets[this.targets.length - 1] ?? null;
    if (top === this.target) return;
    this.target = top;
    this.tctx = top ? top.getContext("2d") : null;
    this.dirty = true;
    this.emit();
  }

  setLighting(l: Lighting) {
    this.lighting = l;
    this.dirty = true;
    this.emit();
  }
  get currentLighting() {
    return this.lighting;
  }

  setLook(look: Look) {
    this.look = look;
    this.dirty = true;
  }
  setIntensity(lip: number, hair: number) {
    this.lipIntensity = lip;
    this.hairIntensity = hair;
    this.dirty = true;
  }
  /** Before/after split: fraction of the *displayed* width (from the left) that shows the original. null = off. */
  setSplit(v: number | null) {
    this.split = v;
    this.dirty = true;
  }

  private setHint(h: Hint) {
    if (this.hint !== h) {
      this.hint = h;
      this.emit();
    }
  }

  private nextTs() {
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    return ts;
  }

  /** Runs the models that the current look needs on one frame. */
  private analyze(src: Source, needFace: boolean, needHair: boolean): Analysis {
    const out: Analysis = { face: null, hair: null };
    if (this.rebuilding) return out;
    const ts = this.nextTs();
    if (needHair && this.segmenter) {
      try {
        this.segmenter.segmentForVideo(src, ts, (res) => {
          const ms = res.confidenceMasks;
          const m = ms?.[HAIR_CLASS];
          if (m) {
            const conf = m.getAsFloat32Array().slice();
            // never colour skin: subtract face (and, softer, body) skin confidence
            const face = ms?.[FACE_SKIN_CLASS]?.getAsFloat32Array();
            const body = ms?.[BODY_SKIN_CLASS]?.getAsFloat32Array();
            if (face) {
              for (let i = 0; i < conf.length; i++) {
                const sk = Math.max(face[i], body ? body[i] * 0.8 : 0);
                conf[i] *= 1 - sk;
              }
            }
            out.hair = { conf, w: m.width, h: m.height };
          }
        });
      } catch (e) {
        this.rebuildOnCpu();
        console.warn(e);
      }
    }
    if (needFace && this.faceLandmarker) {
      try {
        const r = this.faceLandmarker.detectForVideo(src, ts);
        out.face = r.faceLandmarks?.[0] ?? null;
      } catch (e) {
        this.rebuildOnCpu();
        console.warn(e);
      }
    }
    return out;
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const animating = this.tween(dt);
    const src = this.source, ctx = this.tctx, canvas = this.target;
    if (!src || !ctx || !canvas) return;
    const w = srcW(src), h = srcH(src);
    if (!w || !h) return;
    const isPhoto = this.sourceKind === "photo";
    if (isPhoto && !this.dirty && !animating) return; // still photo: only redraw when something changed
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const view = this.viewLook();
    const needFace = !!view.lip;
    const needHair = !!view.hair;
    let a: Analysis;
    let img: Source = src;
    if (isPhoto) {
      // Analyse a still photo once (per needed model), then reuse the result for every shade change.
      const c = (this.photoAnalysis ??= { face: null, hair: null });
      const missFace = needFace && !c.face && !!this.faceLandmarker;
      const missHair = needHair && !c.hair && !!this.segmenter;
      if (missFace || missHair) {
        const r = this.analyze(src, missFace, missHair);
        if (r.face) c.face = r.face;
        if (r.hair) c.hair = r.hair;
      }
      a = c;
    } else {
      // camera: run the models once per *new* camera frame (not on every screen refresh);
      // repaints in between (shade fades) reuse the last result
      const fresh = !this.paced || this.videoFresh || now - this.lastVideoFrame > 250;
      const have = (!needFace || this.lastAnalysis.face) && (!needHair || this.lastAnalysis.hair);
      const st = this.still;
      const stale = st.width !== w || st.height !== h;
      if (fresh || !have || stale) {
        this.videoFresh = false;
        if (stale) {
          st.width = w;
          st.height = h;
        }
        this.stillCtx.drawImage(src, 0, 0, w, h);
        a = this.stabilize(this.analyze(st, needFace, needHair), needFace, needHair);
      } else if (this.dirty || animating) {
        a = this.lastAnalysis;
      } else return;
      img = st;
    }
    this.dirty = false;
    this.lastAnalysis = a;
    this.compose(ctx, img, w, h, a, view, !isPhoto, this.lipView.alpha, this.hairView.alpha);

    // Before / after split: paint the untouched original over one side.
    if (this.split !== null) {
      const p = Math.min(1, Math.max(0, this.split));
      const x0 = this.mirror ? w * (1 - p) : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, 0, w * p, h);
      ctx.clip();
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    }

    this.applyLighting(ctx, w, h);

    // User hints
    if (needFace && this.faceLandmarker) {
      if (a.face) this.noFace = 0;
      else this.noFace++;
    } else this.noFace = 0;
    if (this.noFace >= (isPhoto ? 1 : 15)) this.setHint("no-face");
    else if (needHair && this.hairMissing >= (isPhoto ? 1 : 30)) this.setHint("no-hair");
    else this.setHint("");
  };

  /** Moves the shown colors toward the chosen ones, so shade changes fade instead of jumping. */
  private tween(dt: number) {
    const k = 1 - Math.exp(-dt * 9);
    let moving = false;
    const step = (v: { rgb: number[]; alpha: number }, hex: string | undefined) => {
      if (hex) {
        const t = hexToRgb(hex);
        if (v.alpha < 0.02) v.rgb = t; // first appearance: start from the right color, just fade in
        for (let i = 0; i < 3; i++) {
          v.rgb[i] += (t[i] - v.rgb[i]) * k;
          if (Math.abs(t[i] - v.rgb[i]) > 0.5) moving = true;
        }
        v.alpha += (1 - v.alpha) * k;
        if (1 - v.alpha > 0.005) moving = true;
        else v.alpha = 1;
      } else if (v.alpha > 0) {
        v.alpha += (0 - v.alpha) * k;
        if (v.alpha < 0.005) v.alpha = 0;
        else moving = true;
      }
    };
    step(this.lipView, this.look.lip?.hex);
    if (this.look.lip) this.lipView.finish = this.look.lip.finish;
    step(this.hairView, this.look.hair?.hex);
    return moving;
  }

  private viewLook(): Look {
    return {
      lip: this.lipView.alpha > 0 ? { hex: rgbToHex(this.lipView.rgb), finish: this.lipView.finish } : null,
      hair: this.hairView.alpha > 0 ? { hex: rgbToHex(this.hairView.rgb) } : null,
    };
  }

  /** Temporal smoothing for live video: steadier lips, less hair-mask flicker. */
  private stabilize(a: Analysis, needFace: boolean, needHair: boolean): Analysis {
    let face = a.face;
    if (needFace) {
      if (face) {
        this.faceLost = 0;
        this.smoothFace = this.faceFilter.apply(face, performance.now());
        face = this.smoothFace;
      } else if (++this.faceLost <= 6 && this.smoothFace) {
        face = this.smoothFace; // hold the last position for a few frames instead of blinking
      } else {
        this.smoothFace = null;
        this.faceFilter.reset();
      }
    }
    let hair = a.hair;
    if (needHair) {
      if (hair) {
        const prev = this.prevHair;
        if (prev && prev.length === hair.conf.length) {
          const c = hair.conf;
          // steady where nothing moves, but follow at once where the head moved (no ghost colour)
          for (let i = 0; i < c.length; i++) {
            if (Math.abs(c[i] - prev[i]) < 0.35) c[i] = prev[i] * 0.45 + c[i] * 0.55;
          }
        }
        this.prevHair = hair.conf;
      } else if (this.prevHair && this.lastAnalysis.hair) {
        hair = this.lastAnalysis.hair;
      }
    } else this.prevHair = null;
    return { face, hair };
  }

  /** Draws the base image plus the look onto ctx. */
  private compose(
    ctx: CanvasRenderingContext2D, src: Source, w: number, h: number, a: Analysis, look: Look, smooth: boolean,
    lipK = 1, hairK = 1,
  ) {
    if (this.layer.width !== w || this.layer.height !== h) {
      this.layer.width = w;
      this.layer.height = h;
    }
    if (this.glc === undefined) this.glc = GLCompositor.create();
    if (this.glc) {
      const hair = look.hair && a.hair ? this.hairParams(src, a.hair, look.hair.hex, smooth, hairK) : null;
      const lip = look.lip && a.face ? this.lipParams(src, a.face, look.lip.hex, look.lip.finish, w, h, smooth, lipK) : null;
      try {
        const out = this.glc.render(src, w, h, hair, lip);
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.drawImage(out, 0, 0, w, h);
        ctx.restore();
        return;
      } catch (e) {
        console.warn("GPU compositor failed, falling back", e);
        this.glc = null;
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(src, 0, 0, w, h);
    ctx.restore();
    if (look.hair && a.hair) this.applyHair(ctx, src, a.hair, look.hair.hex, w, h, smooth, hairK);
    if (look.lip && a.face) this.applyLips(ctx, a.face, look.lip.hex, look.lip.finish, w, h, lipK);
  }

  // ===================== GPU path: per-frame inputs =====================
  /** Hair mask as bytes + the person's average hair brightness (to remap it onto the shade). */
  private hairParams(src: Source, mask: { conf: Float32Array; w: number; h: number }, color: string, smooth: boolean, k: number): HairParams | null {
    const { conf, w: mw, h: mh } = mask;
    const { sampleCanvas, sctx } = this;
    if (sampleCanvas.width !== mw || sampleCanvas.height !== mh) {
      sampleCanvas.width = mw;
      sampleCanvas.height = mh;
    }
    if (!this.hairBytes || this.hairBytes.length !== conf.length) this.hairBytes = new Uint8Array(conf.length);
    sctx.drawImage(src, 0, 0, mw, mh);
    const img = sctx.getImageData(0, 0, mw, mh).data;
    const bytes = this.hairBytes;
    let lumSum = 0, weight = 0;
    for (let i = 0; i < conf.length; i++) {
      const c = conf[i];
      bytes[i] = c <= 0 ? 0 : c >= 1 ? 255 : c * 255;
      if (c > 0.6) {
        const j = i * 4;
        lumSum += (0.299 * img[j] + 0.587 * img[j + 1] + 0.114 * img[j + 2]) / 255;
        weight++;
      }
    }
    if (weight < conf.length * 0.004) {
      this.hairMissing++;
      return null;
    }
    this.hairMissing = 0;
    const measured = Math.max(0.02, lumSum / weight);
    this.hairLum = smooth && this.statsFresh.hair ? this.hairLum + (measured - this.hairLum) * 0.15 : measured;
    this.statsFresh.hair = true;
    const rgb = hexToRgb(color).map((v) => v / 255) as [number, number, number];
    return { mask: bytes, mw, mh, rgb, mean: this.hairLum, amount: this.hairIntensity * k };
  }

  /** Crisp, curved lip shape in a small box around the mouth + the bare lips' brightness. */
  private lipParams(src: Source, lm: NormalizedLandmark[], color: string, finish: Finish, w: number, h: number, smooth: boolean, k: number): LipParams | null {
    const pts = (idx: number[]) => idx.map((i) => [lm[i].x * w, lm[i].y * h] as [number, number]);
    const outer = pts(LIPS_OUTER), inner = pts(LIPS_INNER);
    const faceWidth = Math.hypot((lm[454].x - lm[234].x) * w, (lm[454].y - lm[234].y) * h);
    const feather = Math.max(1, faceWidth / 120);
    const pad = Math.ceil(feather * 3 + 2);
    const xs = outer.map((p) => p[0]), ys = outer.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - pad), y0 = Math.max(0, Math.floor(Math.min(...ys)) - pad);
    const x1 = Math.min(w, Math.ceil(Math.max(...xs)) + pad), y1 = Math.min(h, Math.ceil(Math.max(...ys)) + pad);
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 6 || bh < 4) return null;

    const c = this.lipCanvas, g = this.lipCtx;
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    const shift = (p: [number, number]) => [p[0] - x0, p[1] - y0] as [number, number];
    const path = new Path2D();
    smoothClosed(path, outer.map(shift));
    const mouth = new Path2D();
    smoothClosed(mouth, inner.map(shift));
    path.addPath(mouth); // the open mouth (teeth) is cut out
    // red/blue = lip shape; green = a thin band along the inner lip line, the only place teeth can show
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#000";
    g.fillRect(0, 0, bw, bh);
    g.fillStyle = "#f0f";
    g.fill(path, "evenodd");
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "#0f0";
    g.lineWidth = feather * 3;
    g.lineJoin = "round";
    g.stroke(mouth);
    g.fillStyle = "#0f0";
    g.fill(mouth);
    g.globalCompositeOperation = "source-over";

    // bare-lip brightness: trimmed mean (ignores shine and dark creases)
    const sc = this.lipSample, sg = this.lipSampleCtx;
    if (sc.width !== bw || sc.height !== bh) {
      sc.width = bw;
      sc.height = bh;
    }
    sg.drawImage(src, x0, y0, bw, bh, 0, 0, bw, bh);
    const px = sg.getImageData(0, 0, bw, bh).data;
    const mk = g.getImageData(0, 0, bw, bh).data;
    const hist = new Uint32Array(256);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (mk[i] < 220) continue;
      hist[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])]++;
      n++;
    }
    if (n > 20) {
      const lo = n * 0.15, hi = n * 0.85;
      let seen = 0, sum = 0, cnt = 0;
      for (let v = 0; v < 256; v++) {
        const take = Math.max(0, Math.min(seen + hist[v], hi) - Math.max(seen, lo));
        sum += take * v;
        cnt += take;
        seen += hist[v];
      }
      const measured = cnt ? sum / cnt / 255 : this.lipMean;
      this.lipMean = smooth && this.statsFresh.lip ? this.lipMean + (measured - this.lipMean) * 0.2 : measured;
      this.statsFresh.lip = true;
    }
    const rgb = hexToRgb(color).map((v) => v / 255) as [number, number, number];
    const gloss = finish === "gloss" ? 0.75 : finish === "satin" ? 0.35 : 0;
    const matte = finish === "matte" ? 1 : finish === "satin" ? 0.25 : 0;
    return { mask: c, box: [x0, y0, bw, bh], feather, rgb, mean: this.lipMean, amount: this.lipIntensity * k, gloss, matte };
  }

  // ===================== hair (canvas fallback) =====================
  private applyHair(
    ctx: CanvasRenderingContext2D, src: Source,
    mask: { conf: Float32Array; w: number; h: number }, color: string, w: number, h: number, smooth: boolean, k = 1,
  ) {
    const { conf, w: mw, h: mh } = mask;
    const { maskCanvas, mctx, sampleCanvas, sctx, layer, lctx } = this;
    if (maskCanvas.width !== mw || maskCanvas.height !== mh || !this.maskImageData) {
      maskCanvas.width = sampleCanvas.width = mw;
      maskCanvas.height = sampleCanvas.height = mh;
      this.maskImageData = mctx.createImageData(mw, mh);
    }
    // 1) soft alpha mask + average hair brightness, at mask resolution
    sctx.drawImage(src, 0, 0, mw, mh);
    const img = sctx.getImageData(0, 0, mw, mh).data;
    const px = this.maskImageData.data;
    let lumSum = 0, weight = 0;
    for (let i = 0; i < conf.length; i++) {
      const c = conf[i], j = i * 4;
      px[j] = px[j + 1] = px[j + 2] = 255;
      px[j + 3] = c < 0.25 ? 0 : Math.min(255, ((c - 0.25) / 0.5) * 255);
      if (c > 0.6) {
        lumSum += (0.3 * img[j] + 0.59 * img[j + 1] + 0.11 * img[j + 2]) / 255;
        weight++;
      }
    }
    mctx.putImageData(this.maskImageData, 0, 0);
    // too little hair found: skip to avoid flicker
    if (weight < conf.length * 0.004) {
      this.hairMissing++;
      return;
    }
    this.hairMissing = 0;
    const measured = Math.max(0.02, lumSum / weight);
    this.hairLum = smooth ? this.hairLum + (measured - this.hairLum) * 0.15 : measured;

    // 2) brightness gain so the hair matches the shade
    const gain = Math.min(4, Math.max(0.35, (lum601(color) * 0.95) / this.hairLum));
    // 3) recolored layer: grayscale hair, brightness adjusted, tinted with the shade
    const blur = Math.max(1, w / 350);
    lctx.save();
    lctx.clearRect(0, 0, w, h);
    lctx.filter = `grayscale(1) brightness(${gain.toFixed(3)}) contrast(1.08)`;
    lctx.drawImage(src, 0, 0, w, h);
    lctx.filter = "none";
    lctx.globalCompositeOperation = "color";
    lctx.fillStyle = color;
    lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = "soft-light";
    lctx.globalAlpha = 0.35;
    lctx.fillRect(0, 0, w, h);
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = "destination-in";
    lctx.filter = `blur(${blur}px)`;
    lctx.drawImage(maskCanvas, 0, 0, w, h);
    lctx.restore();
    // 4) onto the picture
    ctx.save();
    ctx.globalAlpha = this.hairIntensity * k;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  // ===================== lips =====================
  private applyLips(ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], color: string, finish: Finish, w: number, h: number, k = 1) {
    const { lctx, layer } = this;
    const p = (i: number) => [lm[i].x * w, lm[i].y * h] as const;
    const faceWidth = Math.hypot((lm[454].x - lm[234].x) * w, (lm[454].y - lm[234].y) * h);
    const blur = Math.max(1, faceWidth / 140);
    const trace = (idx: number[]) => {
      idx.forEach((i, k) => {
        const [x, y] = p(i);
        if (k) lctx.lineTo(x, y);
        else lctx.moveTo(x, y);
      });
      lctx.closePath();
    };
    // 1) lip mask filled with the shade (outer contour minus open mouth)
    lctx.save();
    lctx.clearRect(0, 0, w, h);
    lctx.filter = `blur(${blur}px)`;
    lctx.fillStyle = color;
    lctx.beginPath();
    trace(LIPS_OUTER);
    trace(LIPS_INNER);
    lctx.fill("evenodd");
    lctx.restore();

    const a = this.lipIntensity * k;
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = a;
    ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = a * (finish === "matte" ? 0.6 : 0.45);
    ctx.drawImage(layer, 0, 0);
    if (finish === "matte") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a * 0.25;
      ctx.drawImage(layer, 0, 0);
    }
    ctx.restore();

    // 2) shine for satin / gloss: highlight on the lower lip, clipped to the lip mask
    if (finish === "gloss" || finish === "satin") {
      const [x14, y14] = p(14);
      const [x17, y17] = p(17);
      const cx = (x14 + x17) / 2, cy = (y14 + y17) / 2;
      const r = faceWidth * 0.12;
      lctx.save();
      lctx.globalCompositeOperation = "source-in";
      const g = lctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      lctx.fillStyle = g;
      lctx.fillRect(0, 0, w, h);
      lctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = finish === "gloss" ? 0.55 * a : 0.25 * a;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }

  /** Approximates how the whole picture looks under different light (applied after the look). */
  private applyLighting(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const l = this.lighting;
    if (l === "none") return;
    const pass = (op: GlobalCompositeOperation, color: string, alpha: number) => {
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
    };
    ctx.save();
    if (l === "day") {
      // bright, slightly warm daylight with a touch of lift
      pass("soft-light", "#fff4e6", 0.35);
      pass("screen", "#ffffff", 0.06);
    } else if (l === "office") {
      // cool fluorescent light: blue-green cast, flatter contrast
      pass("multiply", "#d9e6ff", 0.55);
      pass("screen", "#eef6ff", 0.12);
    } else {
      // warm, dim evening light (tungsten / candles)
      pass("multiply", "#ffb877", 0.5);
      pass("multiply", "#8a7a74", 0.22);
      pass("soft-light", "#ff9a4d", 0.15);
    }
    ctx.restore();
  }

  /**
   * Reads the lip colour from any photo (e.g. a lipstick look the person likes).
   * Uses the face model on the photo; the current mirror source is not touched.
   */
  async readLipColor(file: File): Promise<LipColorReading | null> {
    await this.init();
    if (!this.faceLandmarker) return null;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const frame = document.createElement("canvas");
      frame.width = w;
      frame.height = h;
      const fctx = frame.getContext("2d", { willReadFrequently: true })!;
      fctx.drawImage(img, 0, 0, w, h);
      const lm = this.analyze(frame, true, false).face;
      if (!lm) return null;

      // lip mask (outer contour minus the open mouth)
      const mask = document.createElement("canvas");
      mask.width = w;
      mask.height = h;
      const mctx = mask.getContext("2d", { willReadFrequently: true })!;
      const trace = (idx: number[]) => {
        idx.forEach((i, k) => (k ? mctx.lineTo(lm[i].x * w, lm[i].y * h) : mctx.moveTo(lm[i].x * w, lm[i].y * h)));
        mctx.closePath();
      };
      mctx.fillStyle = "#fff";
      mctx.beginPath();
      trace(LIPS_OUTER);
      trace(LIPS_INNER);
      mctx.fill("evenodd");

      const xs = LIPS_OUTER.map((i) => lm[i].x * w), ys = LIPS_OUTER.map((i) => lm[i].y * h);
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h, Math.ceil(Math.max(...ys)));
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 4 || bh < 4) return null;
      const px = fctx.getImageData(x0, y0, bw, bh).data;
      const mk = mctx.getImageData(x0, y0, bw, bh).data;
      const samples: [number, number, number, number][] = [];
      for (let i = 0; i < px.length; i += 4) {
        if (mk[i + 3] < 200) continue;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        samples.push([r, g, b, 0.3 * r + 0.59 * g + 0.11 * b]);
      }
      if (samples.length < 20) return null;
      // ignore shine and deep creases: keep the middle of the brightness range
      samples.sort((a, b) => a[3] - b[3]);
      const kept = samples.slice(Math.floor(samples.length * 0.15), Math.ceil(samples.length * 0.8));
      const rgb = [0, 0, 0] as [number, number, number];
      for (const s of kept) { rgb[0] += s[0]; rgb[1] += s[1]; rgb[2] += s[2]; }
      rgb[0] /= kept.length; rgb[1] /= kept.length; rgb[2] /= kept.length;

      // a padded crop of the mouth for the UI
      const pad = Math.round(Math.max(bw, bh) * 0.35);
      const cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad);
      const cw = Math.min(w - cx0, bw + pad * 2), ch = Math.min(h - cy0, bh + pad * 2);
      const crop = document.createElement("canvas");
      crop.width = cw;
      crop.height = ch;
      crop.getContext("2d")!.drawImage(frame, cx0, cy0, cw, ch, 0, 0, cw, ch);
      return { rgb, crop: crop.toDataURL("image/jpeg", 0.9) };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ===================== extras =====================
  /** Freezes the current frame and analyses it with both models. */
  private freeze(): { frame: HTMLCanvasElement; a: Analysis } | null {
    const src = this.source;
    if (!src) return null;
    const w = srcW(src), h = srcH(src);
    if (!w || !h) return null;
    const frame = document.createElement("canvas");
    frame.width = w;
    frame.height = h;
    frame.getContext("2d")!.drawImage(src, 0, 0, w, h);
    const a = this.analyze(frame, !!this.faceLandmarker, !!this.segmenter);
    return { frame, a };
  }

  /** Renders the same frozen frame with several looks — for side-by-side comparison. */
  renderVariants(looks: Look[], maxW = 520): string[] | null {
    const f = this.freeze();
    if (!f) return null;
    const { frame, a } = f;
    const w = frame.width, h = frame.height;
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const wctx = work.getContext("2d")!;
    const scale = Math.min(1, maxW / w);
    const out = document.createElement("canvas");
    out.width = Math.round(w * scale);
    out.height = Math.round(h * scale);
    const octx = out.getContext("2d")!;
    return looks.map((look) => {
      this.compose(wctx, frame, w, h, a, look, false);
      octx.save();
      octx.clearRect(0, 0, out.width, out.height);
      if (this.mirror) {
        octx.translate(out.width, 0);
        octx.scale(-1, 1);
      }
      octx.drawImage(work, 0, 0, out.width, out.height);
      octx.restore();
      return out.toDataURL("image/jpeg", 0.88);
    });
  }

  /** Estimates skin undertone and depth from the cheeks. Approximate — lighting matters. */
  readSkin(): SkinReading | null {
    const f = this.freeze();
    if (!f?.a.face) return null;
    const { frame, a } = f;
    const lm = a.face!;
    const w = frame.width, h = frame.height;
    const faceWidth = Math.hypot((lm[454].x - lm[234].x) * w, (lm[454].y - lm[234].y) * h);
    const r = Math.max(2, Math.round(faceWidth * 0.025));
    const fctx = frame.getContext("2d", { willReadFrequently: true })!;
    let R = 0, G = 0, B = 0, n = 0;
    for (const i of CHEEKS) {
      const x = Math.round(lm[i].x * w), y = Math.round(lm[i].y * h);
      const d = fctx.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
      for (let k = 0; k < d.length; k += 4) {
        R += d[k]; G += d[k + 1]; B += d[k + 2]; n++;
      }
    }
    if (!n) return null;
    const rgb: [number, number, number] = [R / n, G / n, B / n];
    const [L, A, Bb] = rgbToLab(rgb);
    const hue = (Math.atan2(Bb, A) * 180) / Math.PI;
    const undertone = hue > 60 ? "warm" : hue < 48 ? "cool" : "neutral";
    const depth = L > 66 ? "light" : L > 48 ? "medium" : "deep";
    return { undertone, depth, rgb };
  }

  /** Saves what the person sees (mirrored like the preview), with a small wordmark. */
  async snapshot(label: string): Promise<Blob | null> {
    const c = this.target;
    if (!c || !c.width) return null;
    const out = document.createElement("canvas");
    out.width = c.width;
    out.height = c.height;
    const o = out.getContext("2d")!;
    o.save();
    if (this.mirror) {
      o.translate(out.width, 0);
      o.scale(-1, 1);
    }
    o.drawImage(c, 0, 0);
    o.restore();
    const s = Math.max(14, Math.round(out.width / 48));
    o.fillStyle = "rgba(255,255,255,0.92)";
    o.font = `300 ${s}px Alexandria, sans-serif`;
    o.textBaseline = "bottom";
    o.fillText("LUMIÈRE", s, out.height - s);
    o.font = `${Math.round(s * 0.7)}px "Vazirmatn Variable", sans-serif`;
    o.textAlign = "right";
    o.direction = "rtl";
    o.fillText(label, out.width - s, out.height - s);
    return new Promise((res) => out.toBlob((b) => res(b), "image/jpeg", 0.92));
  }

  get latestFaceFound() {
    return !!this.lastAnalysis.face;
  }
}

export const engine = new TryOnEngine();
