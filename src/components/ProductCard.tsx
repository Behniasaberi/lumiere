import { useState } from "react";
import { engine } from "../engine/TryOnEngine";
import { Link, useNavigate } from "react-router-dom";
import { shadeImage, toman, FINISH_LABEL, type Product, type Shade } from "../data/catalog";
import { useApplyShade, useStore } from "../store/Store";
import { IconBag, IconCamera, IconHeart } from "./Icons";

interface Props {
  product: Product;
  shade: Shade;
  /** in mirror mode the try-on button applies in place instead of opening the studio */
  inlineTry?: boolean;
  onHoverTry?: () => void;
  active?: boolean;
  badge?: string;
}

export function ProductCard({ product, shade: initial, inlineTry, onHoverTry, active, badge }: Props) {
  const [shade, setShade] = useState(initial);
  const { addToCart, notify, wishlist, toggleWish, dockOpen } = useStore();
  const apply = useApplyShade();
  const navigate = useNavigate();
  const wished = wishlist.includes(shade.id);
  const url = `/p/${product.slug}?shade=${shade.id}`;

  // with the floating mirror on, products apply as you hover them
  const live = () => dockOpen && engine.hasSource;
  const tryOn = () => {
    apply(shade.id, product.category);
    if (!inlineTry && !live()) navigate("/studio");
  };
  const pick = (s: Shade) => {
    setShade(s);
    if (live()) apply(s.id, product.category);
  };

  return (
    <article
      className={`card card--${product.category}${active ? " is-active" : ""}`}
      style={{ ["--tint" as string]: shade.hex }}
      onMouseEnter={() => { onHoverTry?.(); if (live()) apply(shade.id, product.category); }}
    >
      <div className="card__media">
        <Link to={url} aria-label={`${product.name}، ${shade.name}`}>
          <img src={shadeImage(shade.id)} alt="" loading="lazy" key={shade.id} />
        </Link>
        {badge && <span className="card__badge">{badge}</span>}
        <button
          className={`card__wish${wished ? " is-on" : ""}`}
          onClick={() => { toggleWish(shade.id); notify(wished ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد"); }}
          aria-label={wished ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          aria-pressed={wished}
        >
          <IconHeart filled={wished} width={19} height={19} />
        </button>
        <button className="card__try" onClick={tryOn}>
          <IconCamera width={16} height={16} /> امتحان روی صورت من
        </button>
      </div>
      <div className="card__body">
        <div className="card__top">
          <span className="card__brand">{product.latin}</span>
          <div className="card__dots" role="group" aria-label="رنگ‌ها">
            {product.shades.slice(0, 5).map((s) => (
              <button
                key={s.id}
                className={`card__dot${s.id === shade.id ? " is-on" : ""}`}
                style={{ background: s.hex }}
                aria-label={s.name}
                aria-pressed={s.id === shade.id}
                onMouseEnter={() => pick(s)}
                onFocus={() => pick(s)}
                onClick={() => pick(s)}
              />
            ))}
            {product.shades.length > 5 && <span className="card__more">+{(product.shades.length - 5).toLocaleString("fa-IR")}</span>}
          </div>
        </div>
        <Link to={url} className="card__title">
          <strong>{product.name}</strong>
          <span className="card__shade"><i />{shade.name}{product.finish ? `، ${FINISH_LABEL[product.finish]}` : ""}</span>
        </Link>
        <div className="card__foot">
          <span className="card__price">{toman(product.price)}</span>
          <button
            className="card__add"
            aria-label={`افزودن ${product.name}، ${shade.name} به سبد`}
            onClick={() => { addToCart(shade.id); notify(`${product.name}، ${shade.name} به سبد اضافه شد`); }}
          >
            <IconBag width={18} height={18} />
            <span>افزودن</span>
          </button>
        </div>
      </div>
    </article>
  );
}
