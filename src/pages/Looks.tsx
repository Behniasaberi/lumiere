import { Link } from "react-router-dom";
import { LOOKS, findShade, shadeImage, toman } from "../data/catalog";
import { useStore } from "../store/Store";
import { IconCamera } from "../components/Icons";

export default function Looks() {
  const { addToCart, notify } = useStore();
  return (
    <div className="wrap looks-page">
      <nav className="crumbs" aria-label="مسیر">
        <Link to="/">خانه</Link><span aria-hidden="true">/</span><span>لوک‌ها</span>
      </nav>
      <header className="page-head">
        <h1>لوک‌ها</h1>
        <p>هر لوک یک رژ و یک رنگ موست که با هم امتحان می‌کنید و با هم می‌خرید.</p>
      </header>
      <div className="looks">
        {LOOKS.map((l) => {
          const lip = findShade(l.lip)!, hair = findShade(l.hair)!;
          const total = lip.product.price + hair.product.price;
          return (
            <article key={l.id} className="look-card">
              <div className="look-card__media">
                <img src={shadeImage(l.hair)} alt="" loading="lazy" />
                <img src={shadeImage(l.lip)} alt="" loading="lazy" />
              </div>
              <div className="look-card__text">
                <h2>{l.name}</h2>
                <p>{l.note}</p>
                <ul>
                  <li><i style={{ background: lip.shade.hex }} /><span>{lip.product.name}، {lip.shade.name}</span><em>{toman(lip.product.price)}</em></li>
                  <li><i style={{ background: hair.shade.hex }} /><span>{hair.product.name}، {hair.shade.name}</span><em>{toman(hair.product.price)}</em></li>
                </ul>
                <div className="look-card__actions">
                  <Link className="btn btn--solid" to={`/studio?lip=${l.lip}&hair=${l.hair}`}><IconCamera width={18} height={18} /> امتحان در آینه</Link>
                  <button className="btn btn--line" onClick={() => { addToCart(l.lip); addToCart(l.hair); notify(`لوک «${l.name}» به سبد اضافه شد`); }}>
                    افزودن هر دو، {toman(total)}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
