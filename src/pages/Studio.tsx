import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  byCategory, findShade, LOOKS, recommend, toman, FINISH_LABEL, UNDERTONE_LABEL, DEPTH_LABEL,
  type Category, type Shade, type Product,
} from "../data/catalog";
import { engine, type SkinReading, type Lighting } from "../engine/TryOnEngine";
import { TryOnStage, useEngine } from "../components/TryOnStage";
import { useApplyShade, useStore } from "../store/Store";

const LIGHTS: { id: Lighting; label: string; swatch: string; where: string }[] = [
  { id: "none", label: "بدون فیلتر", swatch: "linear-gradient(135deg,#fff,#e8e6e4)", where: "" },
  { id: "day", label: "نور روز", swatch: "linear-gradient(135deg,#fff7e0,#ffe2a8)", where: "نور روز" },
  { id: "office", label: "اداره", swatch: "linear-gradient(135deg,#eef4ff,#c9d9ff)", where: "نور مهتابی اداره" },
  { id: "evening", label: "مهمانی شب", swatch: "linear-gradient(135deg,#ffcf9a,#9a5a3a)", where: "نور گرم و کم شب" },
];

export default function Studio() {
  const e = useEngine();
  const [params] = useSearchParams();
  const store = useStore();
  const apply = useApplyShade();
  const [tab, setTab] = useState<Category>(() => (params.get("tab") === "hair" ? "hair" : "lip"));
  const [line, setLine] = useState<string>("all");
  const [split, setSplit] = useState<number | null>(null);
  const [compare, setCompare] = useState<{ items: { product: Product; shade: Shade }[]; images: string[] } | null>(null);
  const [skin, setSkin] = useState<SkinReading | null | "none">(null);

  useEffect(() => () => engine.setLighting("none"), []);

  // a shared look link: /studio?lip=…&hair=…
  useEffect(() => {
    const lip = params.get("lip"), hair = params.get("hair");
    if (lip && findShade(lip)) store.setLipShade(lip);
    if (hair && findShade(hair)) store.setHairShade(hair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = tab === "lip" ? store.lipShade : store.hairShade;
  const intensity = tab === "lip" ? store.lipIntensity : store.hairIntensity;
  const lip = findShade(store.lipShade);
  const hair = findShade(store.hairShade);
  const lookItems = [lip, hair].filter(Boolean) as { product: Product; shade: Shade }[];
  const lookTotal = lookItems.reduce((s, x) => s + x.product.price, 0);
  const ready = e.hasSource && (tab === "lip" ? e.face === "ready" : e.hairModel === "ready");

  const snap = async () => {
    const label = lookItems.map((x) => x.shade.name).join("، ") || "لومیر";
    const blob = await engine.snapshot(label);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lumiere-look.jpg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    store.notify("عکس ذخیره شد");
  };

  const openCompare = () => {
    const all = byCategory(tab).flatMap((p) => p.shades.map((s) => ({ product: p, shade: s })));
    const first = all.find((x) => x.shade.id === selected);
    const rest = all.filter((x) => x.shade.id !== selected);
    // spread the picks across the palette so the four differ
    const picks = [first ?? rest[0], ...[0.2, 0.5, 0.8].map((f) => rest[Math.floor(f * rest.length)])]
      .filter((x, i, arr) => x && arr.findIndex((y) => y?.shade.id === x.shade.id) === i)
      .slice(0, 4);
    runCompare(picks);
  };
  const runCompare = (items: { product: Product; shade: Shade }[]) => {
    const looks = items.map(({ product, shade }) =>
      tab === "lip"
        ? { lip: { hex: shade.hex, finish: product.finish ?? "satin" }, hair: hair ? { hex: hair.shade.hex } : null }
        : { hair: { hex: shade.hex }, lip: lip ? { hex: lip.shade.hex, finish: lip.product.finish ?? "satin" } : null },
    );
    const images = engine.renderVariants(looks);
    if (images) setCompare({ items, images });
  };

  const readSkin = () => setSkin(engine.readSkin() ?? "none");

  const copyLink = async () => {
    const q = new URLSearchParams();
    if (store.lipShade) q.set("lip", store.lipShade);
    if (store.hairShade) q.set("hair", store.hairShade);
    const url = `${location.origin}/studio?${q}`;
    try {
      await navigator.clipboard.writeText(url);
      store.notify("لینک این لوک کپی شد");
    } catch {
      store.notify(url);
    }
  };

  const products = byCategory(tab).filter((p) => line === "all" || p.id === line);
  const current = findShade(selected);
  const railRef = useRef<HTMLDivElement>(null);

  // keep the chosen swatch centred in the rail
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>(".rail-swatch.is-active");
    if (!rail || !el) return;
    const r = rail.getBoundingClientRect(), x = el.getBoundingClientRect();
    rail.scrollBy({ left: x.left + x.width / 2 - (r.left + r.width / 2), behavior: "smooth" });
  }, [selected, tab, line]);

  return (
    <div className="studio2">
      <aside className="studio2__panel glass">
        <div className="seg" role="tablist" data-active={tab}>
          <span className="seg__thumb" aria-hidden="true" />
          {(["lip", "hair"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className="seg__btn" onClick={() => { setTab(t); setLine("all"); }}>
              {t === "lip" ? "رژ لب" : "رنگ مو"}
            </button>
          ))}
        </div>

        <div className="studio2__now" key={current?.shade.id ?? "none"}>
          {current ? (
            <>
              <span className="studio2__swatch" style={{ background: current.shade.hex }} />
              <div>
                <h1 className="studio2__name">{current.shade.name}</h1>
                <p className="studio2__meta">
                  {current.product.name}{current.product.finish ? `، ${FINISH_LABEL[current.product.finish]}` : ""}، {toman(current.product.price)}
                </p>
              </div>
            </>
          ) : (
            <div>
              <h1 className="studio2__name studio2__name--muted">{tab === "lip" ? "رنگ رژ را انتخاب کنید" : "رنگ مو را انتخاب کنید"}</h1>
              <p className="studio2__meta">از نوار رنگ‌ها زیر آینه.</p>
            </div>
          )}
        </div>

        <div className="lightpick">
          <span>نور محیط</span>
          <div className="lightpick__opts" role="radiogroup" aria-label="نور محیط">
            {LIGHTS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={e.currentLighting === l.id}
                className={e.currentLighting === l.id ? "is-on" : ""}
                onClick={() => engine.setLighting(l.id)}
              >
                <i style={{ background: l.swatch }} />
                {l.label}
              </button>
            ))}
          </div>
          {e.currentLighting !== "none" && <p className="note">ببینید این رنگ زیر {LIGHTS.find((l) => l.id === e.currentLighting)!.where} چطور دیده می‌شود.</p>}
        </div>

        <label className="soft-range">
          <span>شدت رنگ <b>{Math.round(intensity * 100).toLocaleString("fa-IR")}٪</b></span>
          <input
            type="range" min={0.1} max={1} step={0.01} value={intensity}
            style={{ ["--fill" as string]: `${((intensity - 0.1) / 0.9) * 100}%` }}
            onChange={(ev) => store.setIntensity(tab, parseFloat(ev.target.value))}
          />
        </label>
        {tab === "hair" && <p className="note">روی موی تیره، رنگ‌های روشن بدون دکلره کمرنگ‌تر از این تصویر می‌نشینند.</p>}

        <div className="studio2__look">
          <h2>لوک شما</h2>
          {lookItems.length === 0 ? (
            <p className="note">هنوز رنگی انتخاب نکرده‌اید.</p>
          ) : (
            <ul>
              {lookItems.map(({ product, shade }) => (
                <li key={shade.id}>
                  <i style={{ background: shade.hex }} />
                  <span>{shade.name}<small>{product.name}</small></span>
                  <button
                    className="icon-btn icon-btn--sm"
                    aria-label={`برداشتن ${shade.name}`}
                    onClick={() => apply(null, product.category)}
                  >✕</button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="btn btn--solid btn--block"
            disabled={!lookItems.length}
            onClick={() => {
              lookItems.forEach((x) => store.addToCart(x.shade.id));
              store.notify(lookItems.length > 1 ? "کل لوک به سبد اضافه شد" : "به سبد اضافه شد");
            }}
          >
            {lookItems.length > 1 ? `افزودن لوک به سبد، ${toman(lookTotal)}` : lookItems.length ? `افزودن به سبد، ${toman(lookTotal)}` : "افزودن به سبد"}
          </button>
          <div className="look__links">
            <button className="link" onClick={copyLink} disabled={!lookItems.length}>کپی لینک لوک</button>
            <button className="link link--quiet" onClick={store.clearLook} disabled={!lookItems.length}>پاک کردن همه</button>
          </div>
        </div>

        <div className="studio2__looks">
          <h2>لوک‌های آماده</h2>
          <div className="look-row look-row--tight">
            {LOOKS.map((l) => (
              <button key={l.id} className="look-chip" onClick={() => { store.setLipShade(l.lip); store.setHairShade(l.hair); }}>
                <span className="look-chip__pair">
                  <i style={{ background: findShade(l.hair)!.shade.hex }} />
                  <i style={{ background: findShade(l.lip)!.shade.hex }} />
                </span>
                <span className="look-chip__name">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="studio2__main">
        <div className="studio2__mirror">
          <TryOnStage split={split} onSplit={setSplit} />
          {e.hasSource && (
            <div className="studio2__tools glass" role="toolbar" aria-label="ابزارهای آینه">
              <button className={`tool${split !== null ? " is-on" : ""}`} aria-pressed={split !== null} onClick={() => setSplit(split === null ? 0.5 : null)}>
                قبل و بعد
              </button>
              <button className="tool" onClick={openCompare} disabled={!ready}>مقایسه‌ی چهار رنگ</button>
              <button className="tool" onClick={readSkin} disabled={e.face !== "ready"}>رنگ مناسب پوست من</button>
              <button className="tool" onClick={snap}>ذخیره‌ی عکس</button>
            </div>
          )}
          <button className="finder-cta" onClick={() => store.setFinderOpen(true)}>
            رنگ رژی را در یک عکس دیده‌اید؟ <strong>از روی عکس پیدایش کنید</strong>
          </button>
        </div>

        <div className="studio2__railbar">
          {tab === "lip" && (
            <div className="chips chips--soft">
              {(["all", ...byCategory("lip").map((p) => p.id)] as const).map((id) => {
                const p = byCategory("lip").find((x) => x.id === id);
                return (
                  <button key={id} className={`chip${line === id ? " is-active" : ""}`} onClick={() => setLine(id)}>
                    {p ? `${p.name.replace("رژ لب ", "").replace("رژ براق ", "")}، ${FINISH_LABEL[p.finish!]}` : "همه"}
                  </button>
                );
              })}
            </div>
          )}
          <div className="rail2" ref={railRef} role="listbox" aria-label="رنگ‌ها">
            {products.flatMap((p) =>
              p.shades.map((s) => (
                <button
                  key={s.id}
                  role="option"
                  aria-selected={selected === s.id}
                  className={`rail-swatch${selected === s.id ? " is-active" : ""}`}
                  onClick={() => apply(selected === s.id ? null : s.id, tab)}
                >
                  <i style={{ background: s.hex }} />
                  <span>{s.name}</span>
                </button>
              )),
            )}
          </div>
        </div>
      </div>

      {compare && (
        <Modal title="مقایسه‌ی چهار رنگ" onClose={() => setCompare(null)}>
          <div className="compare">
            {compare.items.map((x, i) => (
              <figure key={x.shade.id} className="compare__item">
                <img src={compare.images[i]} alt={`${x.product.name}، ${x.shade.name}`} />
                <figcaption>
                  <span><i style={{ background: x.shade.hex }} />{x.shade.name}</span>
                  <button className="btn btn--line btn--sm" onClick={() => { apply(x.shade.id, tab); setCompare(null); }}>
                    همین را بزن
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </Modal>
      )}

      {skin && (
        <Modal title="رنگ مناسب پوست شما" onClose={() => setSkin(null)}>
          {skin === "none" ? (
            <p className="note">صورت در تصویر پیدا نشد. رو به دوربین و در نور روز دوباره امتحان کنید.</p>
          ) : (
            <SkinResult reading={skin} onPick={(id, c) => { apply(id, c); setSkin(null); }} />
          )}
        </Modal>
      )}
    </div>
  );
}

function SkinResult({ reading, onPick }: { reading: SkinReading; onPick: (id: string, c: Category) => void }) {
  const lips = recommend("lip", reading.undertone, reading.depth, 3);
  const hairs = recommend("hair", reading.undertone, reading.depth, 2);
  const [r, g, b] = reading.rgb.map(Math.round);
  return (
    <div className="skin">
      <div className="skin__read">
        <span className="skin__swatch" style={{ background: `rgb(${r},${g},${b})` }} />
        <p>
          زیرتُن پوست شما <strong>{UNDERTONE_LABEL[reading.undertone]}</strong> و عمق رنگ آن <strong>{DEPTH_LABEL[reading.depth]}</strong> به نظر می‌رسد.
        </p>
      </div>
      <h4>رژ لب‌های پیشنهادی</h4>
      <div className="skin__picks">
        {lips.map(({ product, shade }) => (
          <button key={shade.id} className="swatch" onClick={() => onPick(shade.id, "lip")}>
            <i style={{ background: shade.hex }} />
            <span>{shade.name}<small>{product.name}</small></span>
          </button>
        ))}
      </div>
      <h4>رنگ موهای پیشنهادی</h4>
      <div className="skin__picks">
        {hairs.map(({ shade }) => (
          <button key={shade.id} className="swatch" onClick={() => onPick(shade.id, "hair")}>
            <i style={{ background: shade.hex }} />
            <span>{shade.name}</span>
          </button>
        ))}
      </div>
      <p className="note">این تخمین به نور محیط بستگی دارد. نتیجه‌ی دقیق‌تر در نور روز و بدون آرایش به دست می‌آید.</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__panel">
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
