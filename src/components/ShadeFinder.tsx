// "Find this shade": read the lip colour from any photo and match it to the catalogue.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { engine, type LipColorReading } from "../engine/TryOnEngine";
import { rgbToHex } from "../engine/color";
import { matchShades, shadeImage, toman, FINISH_LABEL } from "../data/catalog";
import { useStore } from "../store/Store";
import { IconCamera, IconClose } from "./Icons";

type State = { kind: "idle" } | { kind: "reading" } | { kind: "error"; msg: string } | { kind: "done"; reading: LipColorReading };

export function ShadeFinder() {
  const { finderOpen, setFinderOpen, setLipShade, addToCart, notify, dockOpen } = useStore();
  const [st, setSt] = useState<State>({ kind: "idle" });
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!finderOpen) return;
    setSt({ kind: "idle" });
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && setFinderOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [finderOpen, setFinderOpen]);

  if (!finderOpen) return null;

  const read = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setSt({ kind: "error", msg: "این فایل تصویر نیست. یک عکس JPG یا PNG انتخاب کنید." });
    setSt({ kind: "reading" });
    try {
      const r = await engine.readLipColor(f);
      if (r) setSt({ kind: "done", reading: r });
      else if (engine.face === "failed") setSt({ kind: "error", msg: "فایل‌های هوش مصنوعی بارگذاری نشدند. پوشه‌ی public/models را بررسی کنید." });
      else setSt({ kind: "error", msg: "لبی در این عکس پیدا نشد. عکسی انتخاب کنید که صورت از روبه‌رو و لب‌ها واضح باشند." });
    } catch {
      setSt({ kind: "error", msg: "این عکس باز نشد. عکس دیگری را امتحان کنید." });
    }
  };

  const matches = st.kind === "done" ? matchShades(st.reading.rgb) : [];

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="پیدا کردن رنگ از عکس">
      <div className="modal__scrim" onClick={() => setFinderOpen(false)} />
      <div className="modal__panel finder">
        <div className="modal__head">
          <h2>رنگ را از عکس پیدا کنید</h2>
          <button className="icon-btn" onClick={() => setFinderOpen(false)} aria-label="بستن"><IconClose /></button>
        </div>

        {(st.kind === "idle" || st.kind === "error") && (
          <>
            <p className="note">عکس یک رژ لبی که دوست دارید را انتخاب کنید؛ از یک مجله، اینستاگرام یا عکس خودتان. نزدیک‌ترین رنگ‌های لومیر را پیدا می‌کنیم. عکس روی دستگاه شما پردازش می‌شود.</p>
            <label
              className={`drop${drag ? " is-drag" : ""}`}
              onDragOver={(ev) => { ev.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(ev) => { ev.preventDefault(); setDrag(false); read(ev.dataTransfer.files[0]); }}
            >
              <input ref={inputRef} type="file" accept="image/*" hidden onChange={(ev) => { read(ev.target.files?.[0]); ev.target.value = ""; }} />
              <strong>عکس را اینجا رها کنید</strong>
              <span>یا</span>
              <span className="btn btn--solid">انتخاب عکس</span>
            </label>
            {st.kind === "error" && <p className="finder__error" role="alert">{st.msg}</p>}
          </>
        )}

        {st.kind === "reading" && (
          <div className="finder__reading" role="status">
            <span className="spinner" />
            در حال پیدا کردن لب‌ها و خواندن رنگ…
          </div>
        )}

        {st.kind === "done" && (
          <div className="finder__result">
            <div className="finder__source">
              <img src={st.reading.crop} alt="لب‌ها در عکس انتخاب‌شده" />
              <div>
                <span className="finder__swatch" style={{ background: rgbToHex(st.reading.rgb) }} />
                <span>رنگ خوانده‌شده</span>
              </div>
            </div>
            <h3>نزدیک‌ترین رنگ‌های لومیر</h3>
            <ol className="finder__list">
              {matches.map((m, i) => (
                <li key={m.shade.id} className={i === 0 ? "is-best" : ""}>
                  <img src={shadeImage(m.shade.id)} alt="" />
                  <div className="finder__info">
                    <strong>{m.shade.name}</strong>
                    <span>{m.product.name}، {FINISH_LABEL[m.product.finish!]}، {toman(m.product.price)}</span>
                    <div className="meter" aria-label={`شباهت ${m.similarity} درصد`}>
                      <span style={{ width: `${m.similarity}%`, background: m.shade.hex }} />
                    </div>
                    <small>{m.similarity.toLocaleString("fa-IR")}٪ شباهت</small>
                  </div>
                  <div className="finder__actions">
                    <button
                      className="btn btn--solid btn--sm"
                      onClick={() => {
                        setLipShade(m.shade.id);
                        setFinderOpen(false);
                        if (!dockOpen) navigate("/studio");
                      }}
                    >
                      <IconCamera width={15} height={15} /> روی صورتم
                    </button>
                    <button className="btn btn--line btn--sm" onClick={() => { addToCart(m.shade.id); notify(`${m.shade.name} به سبد اضافه شد`); }}>
                      افزودن
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button className="link" onClick={() => setSt({ kind: "idle" })}>امتحان با عکس دیگر</button>
          </div>
        )}
      </div>
    </div>
  );
}
