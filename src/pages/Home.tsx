import { Link } from "react-router-dom";
import { BESTSELLERS, LOOKS, PRODUCTS, categoryImage, findShade, shadeImage, toman } from "../data/catalog";
import { ProductCard } from "../components/ProductCard";
import { IconCamera } from "../components/Icons";
import AilaHero from "../components/AilaHero";
import { ShadeMarquee } from "../components/ShadeMarquee";
import { useStore } from "../store/Store";

export default function Home() {
  const { setFinderOpen, setDockOpen } = useStore();
  return (
    <>
      <AilaHero />
      <ShadeMarquee />

      <section className="wrap cats reveal" aria-label="دسته‌بندی‌ها">
        <Link to="/shop/lip" className="cat cat--lip">
          <img src={categoryImage("lip")} alt="" />
          <div className="cat__text">
            <h2>رژ لب</h2>
            <p>۱۵ رنگ در سه بافت مات، ساتن و براق</p>
            <span className="link">خرید رژ لب</span>
          </div>
        </Link>
        <Link to="/shop/hair" className="cat cat--hair">
          <img src={categoryImage("hair")} alt="" />
          <div className="cat__text">
            <h2>رنگ مو</h2>
            <p>۷ رنگ ماندگار، از بلوند عسلی تا آبی نیمه‌شب</p>
            <span className="link">خرید رنگ مو</span>
          </div>
        </Link>
        <Link to="/studio" className="cat cat--dark">
          <div className="cat__text">
            <IconCamera width={34} height={34} />
            <h2>آینه‌ی مجازی</h2>
            <p>هر رنگ را قبل از خرید، زنده روی صورت خودتان ببینید.</p>
            <span className="btn btn--light">روشن کردن آینه</span>
          </div>
        </Link>
      </section>

      <section className="sect--tint reveal" aria-labelledby="best-title">
        <div className="wrap">
        <header className="sect__head">
          <div>
            <h2 id="best-title">پرفروش‌های این هفته</h2>
            <p>محبوب‌ترین رنگ‌های لومیر؛ هر کدام را می‌توانید همین حالا روی صورتتان ببینید.</p>
          </div>
          <Link to="/shop/lip" className="link">مشاهده‌ی همه</Link>
        </header>
        <div className="grid4">
          {BESTSELLERS.map((id) => {
            const f = findShade(id)!;
            return <ProductCard key={id} product={f.product} shade={f.shade} badge="پرفروش" />;
          })}
        </div>
        </div>
      </section>

      <section className="band reveal" aria-labelledby="band-title">
        <div className="wrap band__inner">
          <div className="band__media">
            <img src={shadeImage("soi-red")} alt="" />
            <img src={shadeImage("hair-copper")} alt="" />
          </div>
          <div className="band__text">
            <span className="eyebrow">آینه‌ی مجازی لومیر</span>
            <h2 id="band-title">رنگ را روی صورت خودتان انتخاب کنید، نه روی عکس مدل.</h2>
            <ol className="steps">
              <li><strong>دوربین را روشن کنید</strong>یا یک عکس از روبه‌رو انتخاب کنید.</li>
              <li><strong>رنگ‌ها را عوض کنید</strong>رژ روی لب و رنگ مو فقط روی موها می‌نشیند.</li>
              <li><strong>مقایسه کنید و بخرید</strong>قبل و بعد، چهار رنگ کنار هم، پیشنهاد بر اساس پوست.</li>
            </ol>
            <div className="band__cta">
              <Link to="/studio" className="btn btn--solid btn--lg"><IconCamera width={18} height={18} /> روشن کردن آینه</Link>
              <span className="band__note">تصویر شما روی همین دستگاه پردازش می‌شود.</span>
            </div>
            <div className="band__extras">
              <button onClick={() => setDockOpen(true)}>
                <strong>آینه‌ی شناور</strong>
                آینه همراهتان در فروشگاه می‌ماند؛ نشانگر را روی هر محصول ببرید.
              </button>
              <button onClick={() => setFinderOpen(true)}>
                <strong>رنگ از روی عکس</strong>
                عکس رژی که دوست دارید را بدهید، رنگش را پیدا می‌کنیم.
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap sect reveal" aria-labelledby="col-title">
        <header className="sect__head">
          <div>
            <h2 id="col-title">خرید بر اساس مجموعه</h2>
            <p>سه بافت رژ لب و یک رنگ موی ماندگار، هر کدام با پالت رنگ خودش.</p>
          </div>
        </header>
        <div className="collections">
          {PRODUCTS.map((p) => (
            <Link key={p.id} to={`/p/${p.slug}`} className="coll" style={{ ["--tint" as string]: p.shades[0].hex }}>
              <div className="coll__media"><img src={shadeImage(p.shades[0].id)} alt="" loading="lazy" /></div>
              <span className="coll__latin">{p.latin}</span>
              <strong>{p.name}</strong>
              <span className="coll__meta">{p.tagline}</span>
              <span className="coll__dots">
                {p.shades.map((s) => <i key={s.id} style={{ background: s.hex }} />)}
              </span>
              <span className="coll__price">از {toman(p.price)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sect--tint reveal" aria-labelledby="looks-title">
        <div className="wrap">
        <header className="sect__head">
          <div>
            <h2 id="looks-title">لوک‌های آماده</h2>
            <p>ترکیب رژ و رنگ مو که با یک کلیک روی صورت خودتان می‌بینید.</p>
          </div>
          <Link to="/looks" className="link">همه‌ی لوک‌ها</Link>
        </header>
        <div className="looks-row">
          {LOOKS.map((l) => {
            const lip = findShade(l.lip)!, hair = findShade(l.hair)!;
            return (
              <Link key={l.id} to={`/studio?lip=${l.lip}&hair=${l.hair}`} className="lookcard">
                <div className="lookcard__media">
                  <span style={{ ["--tint" as string]: hair.shade.hex }}><img src={shadeImage(l.hair)} alt="" loading="lazy" /></span>
                  <span style={{ ["--tint" as string]: lip.shade.hex }}><img src={shadeImage(l.lip)} alt="" loading="lazy" /></span>
                </div>
                <strong>{l.name}</strong>
                <span>{lip.shade.name} و {hair.shade.name}</span>
              </Link>
            );
          })}
        </div>
        </div>
      </section>
    </>
  );
}
