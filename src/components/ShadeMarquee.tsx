// An endless ribbon of every shade in the catalogue — pauses on hover, each opens its product.
import { Link } from "react-router-dom";
import { PRODUCTS } from "../data/catalog";

const ALL = PRODUCTS.flatMap((p) => p.shades.map((s) => ({ p, s })));

export function ShadeMarquee() {
  // three identical rows: the track slides one row-width, so the strip is always full, even on very wide screens
  const row = (copy: number) =>
    ALL.map(({ p, s }) => (
      <Link
        key={copy + "-" + s.id}
        to={`/p/${p.slug}?shade=${s.id}`}
        className="marquee__item"
        tabIndex={copy ? -1 : undefined}
        aria-hidden={copy ? true : undefined}
      >
        <i style={{ background: s.hex }} />
        <span>{s.name}</span>
      </Link>
    ));
  return (
    <section className="marquee" aria-label="همه‌ی رنگ‌ها">
      <div className="marquee__track" dir="ltr">
        {[0, 1, 2].map((c) => (
          <div key={c} className="marquee__row" dir="rtl" aria-hidden={c ? true : undefined}>{row(c)}</div>
        ))}
      </div>
    </section>
  );
}
