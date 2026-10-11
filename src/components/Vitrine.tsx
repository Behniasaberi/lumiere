import { Link } from "react-router-dom";
import { Counter3D } from "./Counter3D";
import { TryOnStage } from "./TryOnStage";
import { findShade, toman, FINISH_LABEL } from "../data/catalog";
import { useStore } from "../store/Store";

/** The 3D counters next to a live mirror: pick a product on the counter, see it on your face. */
export default function Vitrine() {
  const { lipShade, hairShade, setLipShade, setHairShade, addToCart, notify } = useStore();
  const lip = findShade(lipShade);
  const hair = findShade(hairShade);

  const pick = (kind: "lip" | "hair", id: string) => {
    const cur = kind === "lip" ? lipShade : hairShade;
    (kind === "lip" ? setLipShade : setHairShade)(cur === id ? null : id);
  };

  const Picked = ({ f, kind }: { f: ReturnType<typeof findShade>; kind: "lip" | "hair" }) =>
    f ? (
      <div className="vitrine__picked">
        <i style={{ background: f.shade.hex }} />
        <div>
          <strong>{f.shade.name}</strong>
          <span>{f.product.name}{f.product.finish ? `، ${FINISH_LABEL[f.product.finish]}` : ""}، {toman(f.product.price)}</span>
        </div>
        <button className="btn btn--solid btn--sm" onClick={() => { addToCart(f.shade.id); notify(`${f.product.name}، ${f.shade.name} به سبد اضافه شد`); }}>
          افزودن به سبد
        </button>
        <Link className="link" to={`/p/${f.product.slug}?shade=${f.shade.id}`}>جزئیات</Link>
      </div>
    ) : (
      <p className="vitrine__prompt">{kind === "lip" ? "یک رژ لب را از ویترین بردارید." : "یک رنگ مو را از ویترین انتخاب کنید."}</p>
    );

  return (
    <section className="vitrine" aria-labelledby="vitrine-title">
      <header className="section__head vitrine__head">
        <h2 id="vitrine-title">ویترین</h2>
        <p>محصول را از ویترین بردارید تا رنگش در آینه روی صورت شما بنشیند.</p>
      </header>
      <div className="vitrine__body">
        <div className="vitrine__counters">
          <div className="vitrine__counter">
            <h3>رژ لب</h3>
            <Counter3D kind="lip" selectedId={lipShade} onSelect={(id) => pick("lip", id)} />
            <Picked f={lip} kind="lip" />
          </div>
          <div className="vitrine__counter">
            <h3>رنگ مو</h3>
            <Counter3D kind="hair" selectedId={hairShade} onSelect={(id) => pick("hair", id)} />
            <Picked f={hair} kind="hair" />
          </div>
        </div>
        <aside className="vitrine__mirror">
          <TryOnStage shape="oval" compact />
        </aside>
      </div>
    </section>
  );
}
