// A small mirror that follows the shopper across the site. While it is on, hovering any
// product applies that shade live. It steps aside whenever a page shows its own mirror.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { engine } from "../engine/TryOnEngine";
import { useEngine } from "./TryOnStage";
import { useStore } from "../store/Store";
import { findShade } from "../data/catalog";
import { IconCamera, IconClose } from "./Icons";

export function FloatingMirror() {
  const e = useEngine();
  const { dockOpen, setDockOpen, lipShade, hairShade, setLipShade, setHairShade, notify } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [starting, setStarting] = useState(false);
  const onStudio = pathname.startsWith("/studio");

  useEffect(() => {
    const c = canvasRef.current;
    if (!dockOpen || onStudio || !c) return;
    engine.attach(c);
    engine.init();
    return () => engine.detach(c);
  }, [dockOpen, onStudio]);

  if (onStudio) return null;

  if (!dockOpen) {
    return (
      <button className="dock-pill" onClick={() => setDockOpen(true)} aria-label="باز کردن آینه‌ی شناور">
        <IconCamera width={18} height={18} /> آینه‌ی شناور
      </button>
    );
  }

  const covered = !!canvasRef.current && !e.isActive(canvasRef.current) && e.hasSource;
  const start = async () => {
    setStarting(true);
    const err = await engine.startCamera();
    setStarting(false);
    if (err) notify(err === "denied" ? "اجازه‌ی دوربین داده نشد." : "دوربین روشن نشد.");
  };
  const lip = findShade(lipShade), hair = findShade(hairShade);

  return (
    <aside className={`dock${covered ? " is-covered" : ""}`} aria-label="آینه‌ی شناور">
      <div className="dock__view">
        <canvas ref={canvasRef} className={`dock__canvas${e.isMirrored ? " is-mirrored" : ""}`} hidden={!e.hasSource} />
        {!e.hasSource && (
          <button className="dock__start" onClick={start} disabled={starting}>
            <IconCamera width={26} height={26} />
            {starting ? "…" : "روشن کردن"}
          </button>
        )}
        {e.hasSource && (e.face === "loading" || e.hairModel === "loading") && <span className="dock__loading" />}
      </div>
      <div className="dock__bar">
        <button className="icon-btn icon-btn--sm" onClick={() => setDockOpen(false)} aria-label="بستن آینه‌ی شناور"><IconClose width={16} height={16} /></button>
        <div className="dock__chips">
          {lip && <button title={`برداشتن ${lip.shade.name}`} onClick={() => setLipShade(null)} style={{ background: lip.shade.hex }} aria-label={`برداشتن ${lip.shade.name}`} />}
          {hair && <button title={`برداشتن ${hair.shade.name}`} onClick={() => setHairShade(null)} style={{ background: hair.shade.hex }} aria-label={`برداشتن ${hair.shade.name}`} />}
        </div>
        <button className="link" onClick={() => navigate("/studio")}>بزرگ‌تر</button>
      </div>
      <p className="dock__tip">{e.hasSource ? "نشانگر را روی هر محصول ببرید" : "با دوربین، رنگ‌ها را هنگام خرید ببینید"}</p>
    </aside>
  );
}
