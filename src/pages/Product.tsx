import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  productBySlug, toman, FINISH_LABEL, UNDERTONE_LABEL, faNum, shadeImage, categoryImage, byCategory, FREE_SHIPPING,
} from "../data/catalog";
import { TryOnStage } from "../components/TryOnStage";
import { ProductCard } from "../components/ProductCard";
import { IconCamera, IconHeart, IconReturn, IconShield, IconTruck } from "../components/Icons";
import { useApplyShade, useStore } from "../store/Store";

export default function Product() {
  const { slug } = useParams();
  const product = slug ? productBySlug(slug) : undefined;
  const [params, setParams] = useSearchParams();
  const apply = useApplyShade();
  const { addToCart, notify, wishlist, toggleWish } = useStore();
  const [view, setView] = useState<"photo" | "group" | "mirror">("photo");
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState<string | null>("desc");

  const shade = product?.shades.find((s) => s.id === params.get("shade")) ?? product?.shades[0];

  useEffect(() => {
    if (product && shade && view === "mirror") apply(shade.id, product.category);
  }, [product, shade, view, apply]);

  if (!product || !shade) return <Navigate to="/" replace />;
  const wished = wishlist.includes(shade.id);
  const related = byCategory(product.category)
    .filter((p) => p.id !== product.id)
    .flatMap((p) => p.shades.slice(0, 2).map((s) => ({ p, s })))
    .concat(product.shades.filter((s) => s.id !== shade.id).slice(0, 2).map((s) => ({ p: product, s })))
    .slice(0, 4);

  const sections = [
    { id: "desc", title: "توضیحات", body: <p>{product.description}</p> },
    { id: "feat", title: "ویژگی‌ها", body: <ul className="ticks">{product.details.map((d) => <li key={d}>{d}</li>)}<li>حجم: {product.size}</li></ul> },
    { id: "how", title: "نحوه‌ی استفاده", body: <p>{product.howTo}</p> },
  ];

  return (
    <div className="wrap pdp">
      <nav className="crumbs" aria-label="مسیر">
        <Link to="/">خانه</Link><span aria-hidden="true">/</span>
        <Link to={`/shop/${product.category}`}>{product.category === "lip" ? "رژ لب" : "رنگ مو"}</Link><span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="pdp__grid">
        <div className="gallery">
          <div className="gallery__thumbs" role="tablist" aria-label="تصاویر">
            <button role="tab" aria-selected={view === "photo"} className={view === "photo" ? "is-on" : ""} onClick={() => setView("photo")}>
              <img src={shadeImage(shade.id)} alt="" />
            </button>
            <button role="tab" aria-selected={view === "group"} className={view === "group" ? "is-on" : ""} onClick={() => setView("group")}>
              <img src={categoryImage(product.category)} alt="" />
            </button>
            <button role="tab" aria-selected={view === "mirror"} className={`gallery__try${view === "mirror" ? " is-on" : ""}`} onClick={() => setView("mirror")}>
              <IconCamera /><span>روی من</span>
            </button>
          </div>
          <div className="gallery__main">
            {view === "mirror" ? (
              <TryOnStage shape="frame" />
            ) : (
              <img key={view + shade.id} src={view === "photo" ? shadeImage(shade.id) : categoryImage(product.category)} alt={`${product.name}، ${shade.name}`} />
            )}
            {view !== "mirror" && (
              <button className="gallery__cta" onClick={() => setView("mirror")}>
                <IconCamera width={18} height={18} /> امتحان روی صورت من
              </button>
            )}
          </div>
        </div>

        <div className="buy">
          <span className="buy__latin">{product.latin}</span>
          <h1>{product.name}</h1>
          <p className="buy__tag">{product.tagline}</p>
          <p className="buy__price">{toman(product.price)}</p>

          <div className="buy__shades">
            <p className="buy__label">
              رنگ: <strong>{shade.name}</strong>
              <span>تُن {UNDERTONE_LABEL[shade.undertone]}{product.finish ? `، ${FINISH_LABEL[product.finish]}` : ""}</span>
            </p>
            <div className="shadegrid" role="radiogroup" aria-label="انتخاب رنگ">
              {product.shades.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={s.id === shade.id}
                  className={`shadegrid__item${s.id === shade.id ? " is-on" : ""}`}
                  onClick={() => setParams({ shade: s.id }, { replace: true })}
                >
                  <i style={{ background: s.hex }} />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="buy__row">
            <div className="qty qty--lg">
              <button onClick={() => setQty((q) => Math.min(9, q + 1))} aria-label="افزایش تعداد">+</button>
              <span>{faNum(qty)}</span>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="کاهش تعداد">−</button>
            </div>
            <button
              className="btn btn--solid btn--lg btn--grow"
              onClick={() => { addToCart(shade.id, qty); notify(`${product.name}، ${shade.name} به سبد اضافه شد`); }}
            >
              افزودن به سبد
            </button>
            <button
              className={`icon-btn icon-btn--box${wished ? " is-on" : ""}`}
              onClick={() => toggleWish(shade.id)}
              aria-label={wished ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
              aria-pressed={wished}
            >
              <IconHeart filled={wished} />
            </button>
          </div>
          <button className="btn btn--line btn--block" onClick={() => setView("mirror")}>
            <IconCamera width={18} height={18} /> امتحان این رنگ روی صورت من
          </button>

          <ul className="perks">
            <li><IconTruck /><span>ارسال رایگان برای سفارش‌های بالای {toman(FREE_SHIPPING)}</span></li>
            <li><IconShield /><span>ضمانت اصالت کالا</span></li>
            <li><IconReturn /><span>۷ روز ضمانت بازگشت</span></li>
          </ul>

          <div className="accordion">
            {sections.map((s) => (
              <div key={s.id} className={`acc${open === s.id ? " is-open" : ""}`}>
                <button className="acc__head" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {s.title}<span aria-hidden="true">{open === s.id ? "−" : "+"}</span>
                </button>
                <div className="acc__body"><div>{s.body}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="sect" aria-labelledby="rel-title">
        <header className="sect__head"><h2 id="rel-title">شاید این‌ها را هم بپسندید</h2></header>
        <div className="grid4">
          {related.map(({ p, s }) => <ProductCard key={s.id} product={p} shade={s} />)}
        </div>
      </section>
    </div>
  );
}
