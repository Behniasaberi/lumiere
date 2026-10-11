// Where the try-on engine gets its heavy files (~30 MB), fastest source first.
// A global CDN is tried first; the site's own copy (/mediapipe, /models) is the fallback.
// Measured from Iran: Render ≈ 35 KB/s, jsDelivr ≈ 500 KB/s — the CDN turns minutes into seconds.

const BASE = import.meta.env.BASE_URL;
const env = import.meta.env as Record<string, string | undefined>;

/** Must match the installed @mediapipe/tasks-vision version (package.json). */
export const MEDIAPIPE_VERSION = "0.10.14";

export const WASM_SOURCES = [
  env.VITE_WASM_CDN ?? `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  BASE + "mediapipe/wasm",
];

// The two model files are committed to the repo, so jsDelivr can serve them from GitHub.
const MODEL_CDN = env.VITE_MODEL_CDN ?? "https://cdn.jsdelivr.net/gh/Behniasaberi/lumiere@main/public/models/";
export const modelSources = (file: string) => [MODEL_CDN + file, BASE + "models/" + file];

/** Approximate sizes, used for the progress bar when a server does not send Content-Length. */
export const SIZE_HINT: Record<string, number> = {
  "vision_wasm_internal.wasm": 9_400_000,
  "face_landmarker.task": 3_760_000,
  "selfie_multiclass_256x256.tflite": 16_400_000,
};

/**
 * Downloads a file with progress. Gives up on a source that stalls (no bytes for `stallMs`)
 * or returns a truncated/HTML body, and moves on to the next source.
 */
export async function download(
  sources: string[],
  onProgress: (loaded: number, total: number) => void,
  { minBytes = 100_000, stallMs = 15_000 } = {},
): Promise<{ data: Uint8Array; source: string }> {
  let lastErr: unknown = null;
  for (const url of sources) {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), stallMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok || !r.body) throw new Error(`${url} → HTTP ${r.status}`);
      if ((r.headers.get("content-type") ?? "").includes("text/html")) throw new Error(`${url} is a web page, not a model`);
      const name = url.split("/").pop()!.split("?")[0];
      const declared = r.headers.get("content-encoding") ? 0 : Number(r.headers.get("content-length") ?? 0);
      const total = declared || SIZE_HINT[name] || 0;
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        clearTimeout(timer);
        timer = setTimeout(() => ctrl.abort(), stallMs);
        chunks.push(value);
        loaded += value.length;
        onProgress(loaded, Math.max(total, loaded));
      }
      clearTimeout(timer);
      if (loaded < minBytes || (declared && loaded !== declared)) throw new Error(`${url} arrived incomplete (${loaded} bytes)`);
      const data = new Uint8Array(loaded);
      let o = 0;
      for (const c of chunks) {
        data.set(c, o);
        o += c.length;
      }
      onProgress(loaded, loaded);
      return { data, source: url };
    } catch (e) {
      clearTimeout(timer);
      console.warn("[try-on] source failed, trying the next one:", url, e);
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("no source");
}
