// Landing hero: a dark studio set with a 3D lipstick the visitor scrubs with the mouse
// (or a finger on mobile), and "Aila", the virtual colour advisor, offering shortcuts
// into the site's try-on features. Styled with Tailwind.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ScrubScene } from "../three/ScrubScene";
import { useTypewriter } from "../hooks/useTypewriter";
import { useStore } from "../store/Store";
import { findShade, shadeImage } from "../data/catalog";
import { IconCamera } from "./Icons";

const SENSITIVITY = 0.8;
const SHADES = ["soi-red", "vel-rose", "ros-coral", "vel-berry", "soi-petal", "vel-mocha", "ros-candy"];
const LINE = "خوش آمدید. رنگی که دنبالش هستید همین نزدیکی‌هاست. امروز از کجا شروع کنیم؟";

export default function AilaHero() {
  const navigate = useNavigate();
  const { setFinderOpen, setDockOpen, setLipShade, setHairShade, notify, lipShade } = useStore();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ScrubScene | null>(null);
  const [ready, setReady] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const [moved, setMoved] = useState(false);
  const [pillsIn, setPillsIn] = useState(false);
  const [shade, setShade] = useState(lipShade && SHADES.includes(lipShade) ? lipShade : SHADES[0]);
  const { displayed, done } = useTypewriter(LINE);

  // three.js is loaded only for this section
  useEffect(() => {
    let off = false;
    import("../three/ScrubScene")
      .then(({ ScrubScene }) => {
        if (off || !stageRef.current) return;
        try {
          sceneRef.current = new ScrubScene(stageRef.current);
          setReady(true);
        } catch {
          setNoGl(true);
        }
      })
      .catch(() => setNoGl(true));
    const t = window.setTimeout(() => setPillsIn(true), 400);
    return () => {
      off = true;
      window.clearTimeout(t);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setColor(findShade(shade)!.shade.hex);
  }, [shade, ready]);

  // picking a shade opens the lipstick so the colour is visible
  const pickShade = (id: string) => {
    setShade(id);
    const s = sceneRef.current;
    if (s && s.progress < 0.8) s.setProgress(0.85);
    setMoved(true);
  };

  // scrub: horizontal mouse movement anywhere on the page (desktop) or a finger drag on the hero (touch)
  useEffect(() => {
    const sec = sectionRef.current!;
    let prevX: number | null = null;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sceneRef.current?.setVisible(visible);
    });
    io.observe(sec);
    const scrub = (x: number) => {
      const s = sceneRef.current;
      if (prevX !== null && s) {
        const delta = x - prevX;
        s.setProgress(s.progress + (delta / window.innerWidth) * SENSITIVITY);
        if (Math.abs(delta) > 2) setMoved(true);
      }
      prevX = x;
    };
    const onMouse = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !visible) return;
      scrub(e.clientX);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") prevX = e.clientX;
    };
    const onTouchMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") scrub(e.clientX);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") prevX = null;
    };
    window.addEventListener("pointermove", onMouse, { passive: true });
    sec.addEventListener("pointerdown", onDown, { passive: true });
    sec.addEventListener("pointermove", onTouchMove, { passive: true });
    sec.addEventListener("pointerup", onUp, { passive: true });
    sec.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMouse);
      sec.removeEventListener("pointerdown", onDown);
      sec.removeEventListener("pointermove", onTouchMove);
      sec.removeEventListener("pointerup", onUp);
      sec.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const pills: { label: string; run: () => void }[] = [
    {
      label: "رژی که به پوستم بیاید",
      run: () => { navigate("/studio"); notify("دوربین را روشن کنید و «رنگ مناسب پوست من» را بزنید."); },
    },
    { label: "رنگ مو را امتحان کنم", run: () => navigate("/studio?tab=hair") },
    { label: "رنگ را از عکس پیدا کن", run: () => setFinderOpen(true) },
    {
      label: "یک لوک برای امشب",
      run: () => { setLipShade("vel-cherry"); setHairShade("hair-wine"); navigate("/studio"); },
    },
  ];

  const current = findShade(shade)!;

  const pill =
    "inline-flex items-center justify-center whitespace-nowrap rounded-full border text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.45em] mx-[0.2em] mb-[0.5em] cursor-pointer transition-colors duration-200 font-body";

  return (
    <section
      ref={sectionRef}
      aria-label="معرفی لومیر"
      className="relative isolate overflow-hidden text-white select-none h-[calc(100svh-100px)] md:h-[calc(100svh-152px)] min-h-[560px] bg-[radial-gradient(ellipse_70%_80%_at_28%_45%,#2b2225_0%,#141112_55%,#0b0a0a_100%)] [touch-action:pan-y]"
    >
      {/* soft light that takes the colour of the chosen shade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[30%] z-0 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[90px] transition-colors duration-1000 md:left-[28%] md:top-1/2 md:h-[560px] md:w-[560px] md:opacity-35 md:blur-[120px]"
        style={{ backgroundColor: current.shade.hex }}
      />

      {/* 3D stage */}
      <div ref={stageRef} className="absolute inset-0 z-0" aria-hidden="true">
        {noGl && (
          <img src={shadeImage("soi-red")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 md:object-[30%_center]" />
        )}
      </div>

      {/* readable side of the frame */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-black/10 to-transparent md:bg-gradient-to-l md:from-black/55 md:via-black/10" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1360px] flex-col justify-end pb-10 px-5 sm:px-8 md:justify-center md:pb-0 md:px-10">
        <div className="max-w-xl">
          {/* 1. intro: Aila appears — blurred at first, then comes into focus */}
          <div className="mb-5 flex items-center gap-3 animate-reveal sm:mb-7">
            <span
              aria-hidden="true"
              className="relative h-11 w-11 shrink-0 rounded-full shadow-[0_0_30px_-4px_var(--orb)] transition-[background,box-shadow] duration-1000 sm:h-12 sm:w-12"
              style={{
                ["--orb" as string]: current.shade.hex,
                background: `radial-gradient(circle at 32% 28%, #fff 0%, ${current.shade.hex} 38%, #1a1214 100%)`,
              }}
            >
              <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: current.shade.hex }} />
            </span>
            <p className="font-heading leading-snug" style={{ fontSize: "clamp(15px, 2.6vw, 18px)" }}>
              <span className="block font-semibold">سلام، من آیلا هستم</span>
              <span className="block font-light text-white/65">مشاور رنگ مجازی لومیر</span>
            </p>
          </div>

          {/* 2. typewriter */}
          <p
            className="mb-5 font-heading font-light sm:mb-6"
            style={{ fontSize: "clamp(20px, 4.2vw, 30px)", lineHeight: 1.55, minHeight: "3.1em" }}
            aria-label={LINE}
          >
            <span aria-hidden="true">{displayed}</span>
            {!done && <span aria-hidden="true" className="ms-[2px] inline-block h-[1.05em] w-[2px] animate-blink bg-white align-middle" />}
          </p>

          {/* 3. action pills */}
          <div
            className="flex flex-wrap gap-y-1 transition-[opacity,transform] duration-[400ms] ease-out"
            style={{ opacity: pillsIn ? 1 : 0, transform: pillsIn ? "none" : "translateY(8px)" }}
          >
            {pills.map((p) => (
              <button key={p.label} onClick={p.run} className={`${pill} border-black/10 bg-white text-ink hover:bg-ink hover:text-white hover:border-white/30`}>
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setDockOpen(true)}
              className={`${pill} gap-2 border-white bg-transparent text-white hover:bg-white hover:text-ink sm:gap-3`}
            >
              <span className="underline underline-offset-4">آینه را همراهم بیاور</span>
              <IconCamera width={14} height={14} />
            </button>
          </div>
        </div>
      </div>

      {/* shade picker for the 3D lipstick */}
      <div className="absolute end-5 top-5 z-10 flex flex-col items-end gap-2 sm:end-8 md:bottom-8 md:top-auto md:end-auto md:left-[15%] md:items-start">
        <Link
          to={`/p/${current.product.slug}?shade=${current.shade.id}`}
          className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/85 no-underline backdrop-blur-md transition-colors hover:bg-white/20 md:inline-flex"
        >
          <span className="font-semibold text-white">{current.shade.name}</span>
          <span className="text-white/60">{current.product.name}</span>
          <span aria-hidden="true">←</span>
        </Link>
        <div className="flex gap-1.5 rounded-full bg-white/10 p-1.5 backdrop-blur-md" role="radiogroup" aria-label="رنگ رژ در تصویر">
          {SHADES.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={id === shade}
              aria-label={findShade(id)!.shade.name}
              onClick={() => pickShade(id)}
              className={`h-5 w-5 rounded-full border-0 p-0 transition-transform duration-200 hover:scale-110 sm:h-6 sm:w-6 ${id === shade ? "ring-2 ring-white ring-offset-2 ring-offset-black/60" : ""}`}
              style={{ background: findShade(id)!.shade.hex }}
            />
          ))}
        </div>
      </div>

      {/* scrub hint, fades after the first move */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute start-1/2 top-1/2 z-[5] hidden -translate-x-1/2 items-center gap-3 text-[13px] text-white/70 transition-opacity duration-700 md:flex md:start-[30%] md:top-auto md:bottom-10 ${moved || !ready ? "opacity-0" : "opacity-100"}`}
      >
        <span className="animate-nudge text-lg">⟷</span> ماوس را به چپ و راست ببرید
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-[38%] z-[5] flex justify-center text-[13px] text-white/75 transition-opacity duration-700 md:hidden ${moved || !ready ? "opacity-0" : "opacity-100"}`}
      >
        <span className="rounded-full bg-black/30 px-3 py-1 backdrop-blur-sm"><span className="animate-nudge inline-block">⟷</span> انگشتتان را روی تصویر بکشید</span>
      </div>
    </section>
  );
}
