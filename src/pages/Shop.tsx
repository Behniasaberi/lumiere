import { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { byCategory, FINISH_LABEL, UNDERTONE_LABEL, type Undertone } from "../data/catalog";
import { ProductCard } from "../components/ProductCard";
import { TryOnStage } from "../components/TryOnStage";
import { useApplyShade, useStore } from "../store/Store";
import { IconCamera } from "../components/Icons";

export default function Shop() {
  const { cat } = useParams();
  if (cat !== "lip" && cat !== "hair") return <Navigate to="/shop/lip" replace />;
  return <ShopList key={cat} cat={cat} />;
}

type Sort = "featured" | "price-asc" | "price-desc";

function ShopList({ cat }: { cat: "lip" | "hair" }) {
  const [params] = useSearchParams();
  const products = byCategory(cat);
  const [lines, setLines] = useState<string[]>([]);
  const [tones, setTones] = useState<Undertone[]>(() => {
    const t = params.get("tone");
    return t === "warm" || t === "cool" || t === "neutral" ? [t] : [];
  });
  const [sort, setSort] = useState<Sort>("featured");
  const [mirror, setMirror] = useState(false);
  const apply = useApplyShade();
  const { lipShade, hairShade, setFinderOpen } = useStore();
  const selected = cat === "lip" ? lipShade : hairShade;

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const tiles = useMemo(() => {
    const list = products
      .filter((p) => !lines.length || lines.includes(p.id))
      .flatMap((p) => p.shades.filter((s) => !tones.length || tones.includes(s.undertone)).map((s) => ({ p, s })));
    if (sort === "price-asc") list.sort((a, b) => a.p.price - b.p.price);
    if (sort === "price-desc") list.sort((a, b) => b.p.price - a.p.price);
    return list;
  }, [products, lines, tones, sort]);

  const title = cat === "lip" ? "رژ لب" : "رنگ مو";
  const active = lines.length + tones.length;

  return (
    <div className="wrap shop">
      <nav className="crumbs" aria-label="مسیر">
        <Link to="/">خانه</Link><span aria-hidden="true">/</span><span>{title}</span>
      </nav>
      <header className="shop__head">
        <div>
          <h1>{title}</h1>
          <p>{tiles.length.toLocaleString("fa-IR")} محصول</p>
        </div>
        <div className="shop__tools">
          <button className={`toggle${mirror ? " is-on" : ""}`} role="switch" aria-checked={mirror} onClick={() => setMirror((m) => !m)}>
            <IconCamera width={18} height={18} /> آینه کنار فهرست
            <span className="toggle__track"><span /></span>
          </button>
          <label className="select">
            <span>مرتب‌سازی</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="featured">پیشنهاد لومیر</option>
              <option value="price-asc">ارزان‌ترین</option>
              <option value="price-desc">گران‌ترین</option>
            </select>
          </label>
        </div>
      </header>

      <div className={`shop__layout${mirror ? " shop__layout--mirror" : ""}`}>
        <aside className="filters">
          {mirror ? (
            <div className="filters__mirror">
              <TryOnStage shape="oval" compact />
              <p className="note">نشانگر را روی هر محصول ببرید تا رنگش روی صورتتان بنشیند.</p>
            </div>
          ) : (
            <>
              {cat === "lip" && (
                <fieldset className="fgroup">
                  <legend>مجموعه</legend>
                  {products.map((p) => (
                    <label key={p.id} className="check">
                      <input type="checkbox" checked={lines.includes(p.id)} onChange={() => setLines((l) => toggle(l, p.id))} />
                      <span>{p.name}</span>
                      <small>{FINISH_LABEL[p.finish!]}</small>
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset className="fgroup">
                <legend>تُن رنگ</legend>
                {(["warm", "cool", "neutral"] as const).map((t) => (
                  <label key={t} className="check">
                    <input type="checkbox" checked={tones.includes(t)} onChange={() => setTones((x) => toggle(x, t))} />
                    <span>{UNDERTONE_LABEL[t]}</span>
                  </label>
                ))}
              </fieldset>
              {active > 0 && (
                <button className="link" onClick={() => { setLines([]); setTones([]); }}>پاک کردن فیلترها</button>
              )}
              {cat === "lip" && (
                <button className="filters__promo filters__promo--finder" onClick={() => setFinderOpen(true)}>
                  <strong>رنگ را از عکس پیدا کنید</strong>
                  <span>عکس رژی که دوست دارید را بدهید؛ نزدیک‌ترین رنگ ما را پیدا می‌کنیم.</span>
                </button>
              )}
              <Link to="/studio" className="filters__promo">
                <IconCamera width={24} height={24} />
                <strong>مطمئن نیستید؟</strong>
                <span>رنگ مناسب پوستتان را آینه‌ی مجازی پیشنهاد می‌دهد.</span>
              </Link>
            </>
          )}
        </aside>

        {tiles.length === 0 ? (
          <div className="empty">
            <p>محصولی با این فیلترها نیست.</p>
            <button className="btn btn--line" onClick={() => { setLines([]); setTones([]); }}>پاک کردن فیلترها</button>
          </div>
        ) : (
          <div className="grid3">
            {tiles.map(({ p, s }) => (
              <ProductCard
                key={s.id}
                product={p}
                shade={s}
                inlineTry={mirror}
                active={mirror && selected === s.id}
                onHoverTry={mirror ? () => apply(s.id, cat) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
