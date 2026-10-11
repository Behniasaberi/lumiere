import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { engine, type CameraError } from "../engine/TryOnEngine";

export function useEngine() {
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  return engine;
}

const CAMERA_MSG: Record<CameraError, string> = {
  insecure: "دوربین فقط روی آدرس امن کار می‌کند. سایت را با localhost یا https باز کنید.",
  denied: "اجازه‌ی دوربین داده نشد. روی آیکون دوربین در نوار آدرس بزنید و اجازه دهید.",
  notfound: "دوربینی روی این دستگاه پیدا نشد. می‌توانید عکس انتخاب کنید.",
  busy: "دوربین دست برنامه‌ی دیگری است. آن را ببندید و دوباره امتحان کنید.",
  unknown: "دوربین روشن نشد. دوباره امتحان کنید یا عکس انتخاب کنید.",
};

interface Props {
  shape?: "oval" | "frame";
  split?: number | null;
  onSplit?: (v: number) => void;
  compact?: boolean;
}

export function TryOnStage({ shape = "frame", split = null, onSplit, compact }: Props) {
  const e = useEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const c = canvasRef.current!;
    engine.attach(c);
    engine.init(); // start loading models as soon as a mirror is on screen
    return () => engine.detach(c);
  }, []);

  useEffect(() => {
    engine.setSplit(split);
    return () => engine.setSplit(null);
  }, [split]);

  const startCam = async () => {
    setError("");
    setStarting(true);
    const err = await engine.startCamera();
    setStarting(false);
    if (err) setError(CAMERA_MSG[err]);
  };
  const pickPhoto = () => fileRef.current?.click();
  const onFile = async (f?: File) => {
    if (!f) return;
    setError("");
    try {
      await engine.loadPhoto(f);
    } catch {
      setError("این فایل تصویر نیست. یک عکس JPG یا PNG انتخاب کنید.");
    }
  };

  const modelsFailed = e.face === "failed" && e.hairModel === "failed";
  const loading = e.face === "loading" || e.hairModel === "loading";
  const pct = (v: number) => Math.round(v * 100).toLocaleString("fa-IR") + "٪";
  const loadingText =
    e.face === "loading"
      ? `آینه در حال آماده شدن است… ${pct(e.loadProgress.face)}`
      : e.hairModel === "loading"
        ? `رژ آماده است؛ رنگ مو در حال بارگذاری… ${pct(e.loadProgress.hair)}`
        : "";
  const hint =
    e.hint === "no-face"
      ? "صورت پیدا نشد. رو به دوربین و در نور خوب قرار بگیرید."
      : e.hint === "no-hair"
        ? "مو دیده نمی‌شود. کمی عقب بروید تا موها در قاب باشند."
        : "";

  // drag the before/after divider
  const dragging = useRef(false);
  const setFromPointer = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    onSplit?.(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  return (
    <div className={`stage stage--${shape}${compact ? " stage--compact" : ""}`}>
      <div
        className="stage__view"
        onPointerDown={(ev) => {
          if (split === null) return;
          dragging.current = true;
          (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
          setFromPointer(ev.clientX, ev.currentTarget);
        }}
        onPointerMove={(ev) => dragging.current && setFromPointer(ev.clientX, ev.currentTarget)}
        onPointerUp={() => (dragging.current = false)}
      >
        <canvas ref={canvasRef} className={`stage__canvas${e.isMirrored ? " is-mirrored" : ""}`} hidden={!e.hasSource} />

        {!e.hasSource && (
          <div className="stage__empty">
            <p className="stage__lead">آینه خاموش است</p>
            <p className="stage__sub">دوربین را روشن کنید یا یک عکس از روبه‌رو انتخاب کنید.</p>
            <div className="stage__actions">
              <button className="btn btn--solid" onClick={startCam} disabled={starting}>
                {starting ? "در حال روشن کردن…" : "روشن کردن دوربین"}
              </button>
              <button className="btn btn--line" onClick={pickPhoto}>انتخاب عکس</button>
            </div>
            {error && <p className="stage__error" role="alert">{error}</p>}
          </div>
        )}

        {e.hasSource && split !== null && (
          <div className="stage__split" style={{ left: `${split * 100}%` }} aria-hidden="true">
            <span className="stage__split-tag stage__split-tag--before">قبل</span>
            <span className="stage__split-knob" />
            <span className="stage__split-tag stage__split-tag--after">بعد</span>
          </div>
        )}

        {e.hasSource && (hint || loading) && (
          <p className="stage__hint" role="status">{loading ? loadingText : hint}</p>
        )}
      </div>

      {e.hasSource && !compact && (
        <div className="stage__bar">
          {e.sourceKind === "photo" ? (
            <button className="link" onClick={startCam}>استفاده از دوربین</button>
          ) : (
            <button className="link" onClick={() => engine.stopCamera()}>خاموش کردن دوربین</button>
          )}
          <button className="link" onClick={pickPhoto}>عکس دیگر</button>
          {error && <span className="stage__error">{error}</span>}
        </div>
      )}

      {modelsFailed && (
        <p className="stage__error stage__error--block" role="alert">
          فایل‌های هوش مصنوعی بارگذاری نشدند. پوشه‌ی public/models را بررسی کنید (راهنما در README).
        </p>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => { onFile(ev.target.files?.[0]); ev.target.value = ""; }} />
    </div>
  );
}
