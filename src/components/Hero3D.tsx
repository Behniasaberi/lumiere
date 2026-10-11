import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HeroScene } from "../three/HeroScene";
import { byCategory, findShade, toman, FINISH_LABEL } from "../data/catalog";
import { useStore } from "../store/Store";

// Each text panel is visible over a slice of the scroll progress.
const PANELS = [
  { id: "intro", from: -1, to: 0.12 },
  { id: "lip", from: 0.2, to: 0.42 },
  { id: "hair", from: 0.56, to: 0.78 },
  { id: "final", from: 0.86, to: 2 },
] as const;

export default function Hero3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sceneRef = useRef<HeroScene | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const { lipShade, hairShade, setLipShade, setHairShade, addToCart, notify } = useStore();

  const lip = findShade(lipShade) ?? findShade("soi-red")!;
  const hair = findShade(hairShade) ?? findShade("hair-copper")!;

  // create the scene (three.js is loaded on demand)
  useEffect(() => {
    let disposed = false;
    import("../three/HeroScene")
      .then(({ HeroScene }) => {
        if (disposed || !stageRef.current) return;
        try {
          sceneRef.current = new HeroScene(stageRef.current);
          setReady(true);
        } catch (e) {
          console.error(e);
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => sceneRef.current?.setLipColor(lip.shade.hex), [lip.shade.hex, ready]);
  useEffect(() => sceneRef.current?.setHairColor(hair.shade.hex), [hair.shade.hex, ready]);

  // scroll → progress → scene + panel visibility (no React re-render per frame)
  useEffect(() => {
    const sec = sectionRef.current!;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = sec.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      sceneRef.current?.setProgress(p);
      sceneRef.current?.setVisible(r.bottom > 0 && r.top < innerHeight);
      for (const pn of PANELS) {
        const el = panelRefs.current[pn.id];
        if (!el) continue;
        const fade = 0.05;
        const o = Math.min(1, Math.max(0, Math.min((p - pn.from) / fade, (pn.to - p) / fade)));
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - o) * 16}px)`;
        el.style.visibility = o < 0.02 ? "hidden" : "visible";
        el.toggleAttribute("inert", o < 0.5);
      }
      sec.style.setProperty("--hint", String(p < 0.03 ? 1 : 0));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  // jump to a stage of the story
  const goTo = (p: number) => {
    const sec = sectionRef.current!;
    const top = sec.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (sec.offsetHeight - innerHeight) * p, behavior: "smooth" });
  };

  const tryOn = () => navigate("/studio");

  return (
    <section className={`hero3d${failed ? " hero3d--flat" : ""}`} ref={sectionRef} aria-label="معرفی لومیر">
      <div className="hero3d__sticky">
        <div className="hero3d__stage" ref={stageRef} aria-hidden="true" />

        <div className="hero3d__panels">
          <div className="hero3d__panel" ref={(el) => (panelRefs.current.intro = el)}>
            <h1 className="hero3d__title">اول در آینه،<br />بعد در سبد.</h1>
            <p className="hero3d__lead">
              رژ لب و رنگ مو را زنده روی صورت خودتان امتحان کنید. تصویر دوربین روی دستگاه خودتان می‌ماند و جایی فرستاده نمی‌شود.
            </p>
            <div className="hero3d__cta">
              <button className="btn btn--solid" onClick={() => goTo(0.3)}>دیدن رنگ‌ها</button>
              <button className="btn btn--line" onClick={tryOn}>روشن کردن آینه</button>
            </div>
          </div>

          <div className="hero3d__panel" ref={(el) => (panelRefs.current.lip = el)}>
            <span className="hero3d__kicker">رژ لب</span>
            <h2 className="hero3d__shade">{lip.shade.name}</h2>
            <p className="hero3d__meta">
              {lip.product.name}، {FINISH_LABEL[lip.product.finish!]}، {toman(lip.product.price)}
            </p>
            <div className="hero3d__groups">
              {byCategory("lip").map((p) => (
                <div key={p.id} className="hero3d__group">
                  <span>{FINISH_LABEL[p.finish!]}</span>
                  <div className="hero3d__dots">
                    {p.shades.map((s) => (
                      <button
                        key={s.id}
                        className={`dot${s.id === lip.shade.id ? " is-active" : ""}`}
                        style={{ background: s.hex }}
                        aria-label={s.name}
                        aria-pressed={s.id === lip.shade.id}
                        onClick={() => setLipShade(s.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hero3d__cta">
              <button className="btn btn--solid" onClick={() => { setLipShade(lip.shade.id); tryOn(); }}>روی صورتم ببینم</button>
              <button className="btn btn--line" onClick={() => { addToCart(lip.shade.id); notify(`${lip.product.name}، ${lip.shade.name} به سبد اضافه شد`); }}>
                افزودن به سبد
              </button>
            </div>
          </div>

          <div className="hero3d__panel" ref={(el) => (panelRefs.current.hair = el)}>
            <span className="hero3d__kicker">رنگ مو</span>
            <h2 className="hero3d__shade">{hair.shade.name}</h2>
            <p className="hero3d__meta">{hair.product.name}، {toman(hair.product.price)}</p>
            <div className="hero3d__dots hero3d__dots--lg">
              {hair.product.shades.map((s) => (
                <button
                  key={s.id}
                  className={`dot dot--lg${s.id === hair.shade.id ? " is-active" : ""}`}
                  style={{ background: s.hex }}
                  aria-label={s.name}
                  aria-pressed={s.id === hair.shade.id}
                  onClick={() => setHairShade(s.id)}
                />
              ))}
            </div>
            <div className="hero3d__cta">
              <button className="btn btn--solid" onClick={() => { setHairShade(hair.shade.id); tryOn(); }}>روی موهایم ببینم</button>
              <button className="btn btn--line" onClick={() => { addToCart(hair.shade.id); notify(`${hair.product.name}، ${hair.shade.name} به سبد اضافه شد`); }}>
                افزودن به سبد
              </button>
            </div>
          </div>

          <div className="hero3d__panel" ref={(el) => (panelRefs.current.final = el)}>
            <h2 className="hero3d__title hero3d__title--sm">حالا هر دو را<br />روی صورت خودتان ببینید.</h2>
            <ul className="hero3d__look">
              <li><i style={{ background: lip.shade.hex }} />{lip.product.name}، {lip.shade.name}</li>
              <li><i style={{ background: hair.shade.hex }} />{hair.product.name}، {hair.shade.name}</li>
            </ul>
            <div className="hero3d__cta">
              <button className="btn btn--solid" onClick={() => { setLipShade(lip.shade.id); setHairShade(hair.shade.id); tryOn(); }}>
                روشن کردن آینه
              </button>
              <button
                className="btn btn--line"
                onClick={() => { addToCart(lip.shade.id); addToCart(hair.shade.id); notify("هر دو به سبد اضافه شدند"); }}
              >
                افزودن هر دو، {toman(lip.product.price + hair.product.price)}
              </button>
            </div>
          </div>
        </div>

        <div className="hero3d__hint" aria-hidden="true">
          <span />
          برای دیدن ادامه اسکرول کنید
        </div>
      </div>
    </section>
  );
}
