import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/Store";
import { FloatingMirror } from "./FloatingMirror";
import { ShadeFinder } from "./ShadeFinder";
import {
  PRODUCTS, byCategory, categoryImage, findShade, productById, shadeImage, toman, faNum,
  FINISH_LABEL, FREE_SHIPPING, UNDERTONE_LABEL,
} from "../data/catalog";
import {
  IconBag, IconCamera, IconClose, IconHeart, IconLock, IconMenu, IconReturn, IconSearch, IconShield, IconTruck, IconUser,
} from "./Icons";

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { setCartOpen, setSearchOpen } = useStore();
  useEffect(() => {
    window.scrollTo(0, 0);
    setCartOpen(false);
    setSearchOpen(false);
  }, [pathname, setCartOpen, setSearchOpen]);

  // sections marked .reveal fade in once as they enter the viewport
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { rootMargin: "0px 0px -10% 0px" },
    );
    const t = window.setTimeout(() => document.querySelectorAll(".reveal:not(.is-in)").forEach((el) => io.observe(el)), 60);
    return () => { window.clearTimeout(t); io.disconnect(); };
  }, [pathname]);
  return (
    <>
      <a className="skip" href="#main">رفتن به محتوا</a>
      <PromoBar />
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <ShadeFinder />
      <FloatingMirror />
      <Toast />
    </>
  );
}

// ---------------- promo bar ----------------
const PROMOS = [
  `ارسال رایگان برای سفارش‌های بالای ${toman(FREE_SHIPPING)}`,
  "رنگ‌ها را قبل از خرید، زنده روی صورت خودتان امتحان کنید",
  "۷ روز ضمانت بازگشت کالا",
];
function PromoBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % PROMOS.length), 4500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="promo" role="region" aria-label="اطلاعیه‌ها">
      <p key={i} className="promo__msg">{PROMOS[i]}</p>
    </div>
  );
}

// ---------------- header + mega menu ----------------
function Header() {
  const { cartCount, setCartOpen, setSearchOpen, wishlist, setFinderOpen } = useStore();
  const [mega, setMega] = useState<null | "lip" | "hair">(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const [mobile, setMobile] = useState(false);
  const { pathname } = useLocation();
  const closeT = useRef(0);
  useEffect(() => { setMega(null); setMobile(false); }, [pathname]);

  const open = (m: "lip" | "hair") => { window.clearTimeout(closeT.current); setMega(m); };
  const close = () => { closeT.current = window.setTimeout(() => setMega(null), 120); };

  return (
    <header className={`header${mega ? " has-mega" : ""}${scrolled ? " is-scrolled" : ""}`} onMouseLeave={close}>
      <div className="header__row">
        <button className="icon-btn header__burger" aria-label="منو" onClick={() => setMobile(true)}><IconMenu /></button>
        <button className="searchbar" onClick={() => setSearchOpen(true)}>
          <IconSearch width={18} height={18} />
          <span>جستجوی رنگ یا محصول…</span>
        </button>
        <Link to="/" className="logo" aria-label="لومیر، صفحه‌ی اصلی">
          <span className="logo__mark">LUMIÈRE</span>
          <span className="logo__sub">آینه‌ی رنگ لومیر</span>
        </Link>
        <div className="header__actions">
          <button className="icon-btn header__search-sm" aria-label="جستجو" onClick={() => setSearchOpen(true)}><IconSearch /></button>
          <button className="icon-btn" aria-label="حساب کاربری"><IconUser /></button>
          <button className="icon-btn badge-host" aria-label={`علاقه‌مندی‌ها، ${faNum(wishlist.length)}`}>
            <IconHeart />
            {wishlist.length > 0 && <span className="badge">{faNum(wishlist.length)}</span>}
          </button>
          <button className="icon-btn badge-host" onClick={() => setCartOpen(true)} aria-label={`سبد خرید، ${faNum(cartCount)} کالا`}>
            <IconBag />
            {cartCount > 0 && <span className="badge badge--accent">{faNum(cartCount)}</span>}
          </button>
        </div>
      </div>

      <nav className="nav" aria-label="منوی اصلی">
        <NavLink to="/shop/lip" onMouseEnter={() => open("lip")} onFocus={() => open("lip")}>رژ لب</NavLink>
        <NavLink to="/shop/hair" onMouseEnter={() => open("hair")} onFocus={() => open("hair")}>رنگ مو</NavLink>
        <NavLink to="/looks" onMouseEnter={close}>لوک‌ها</NavLink>
        <button className="nav__btn" onMouseEnter={close} onClick={() => setFinderOpen(true)}>رنگ از روی عکس</button>
        <NavLink to="/studio" className="nav__tryon" onMouseEnter={close}>
          <IconCamera width={17} height={17} /> آینه‌ی مجازی
        </NavLink>
      </nav>

      <div className={`mega${mega ? " is-open" : ""}`} onMouseEnter={() => mega && open(mega)} onMouseLeave={close}>
        {mega && <MegaPanel kind={mega} />}
      </div>

      {mobile && <MobileMenu onClose={() => setMobile(false)} />}
    </header>
  );
}

function MegaPanel({ kind }: { kind: "lip" | "hair" }) {
  const products = byCategory(kind);
  return (
    <div className="mega__inner">
      {kind === "lip" ? (
        <>
          <div className="mega__col">
            <h4>مجموعه‌ها</h4>
            {products.map((p) => (
              <Link key={p.id} to={`/p/${p.slug}`}>{p.name}<small>{FINISH_LABEL[p.finish!]}</small></Link>
            ))}
            <Link to="/shop/lip" className="mega__all">همه‌ی رژ لب‌ها</Link>
          </div>
          <div className="mega__col">
            <h4>بر اساس تُن</h4>
            {(["warm", "cool", "neutral"] as const).map((t) => (
              <Link key={t} to={`/shop/lip?tone=${t}`}>تُن {UNDERTONE_LABEL[t]}</Link>
            ))}
          </div>
          <div className="mega__col mega__col--wide">
            <h4>رنگ‌های محبوب</h4>
            <div className="mega__swatches">
              {["soi-red", "vel-rose", "ros-coral", "vel-berry", "soi-petal", "vel-mocha"].map((id) => {
                const f = findShade(id)!;
                return (
                  <Link key={id} to={`/p/${f.product.slug}?shade=${id}`} className="mega__swatch">
                    <i style={{ background: f.shade.hex }} />{f.shade.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mega__col mega__col--wide">
            <h4>{products[0].name}</h4>
            <div className="mega__swatches">
              {products[0].shades.map((s) => (
                <Link key={s.id} to={`/p/${products[0].slug}?shade=${s.id}`} className="mega__swatch">
                  <i style={{ background: s.hex }} />{s.name}
                </Link>
              ))}
            </div>
            <Link to="/shop/hair" className="mega__all">همه‌ی رنگ‌های مو</Link>
          </div>
        </>
      )}
      <Link to={`/shop/${kind}`} className="mega__feature">
        <img src={categoryImage(kind)} alt="" loading="lazy" />
        <span>
          <strong>{kind === "lip" ? "رنگ رژت را پیدا کن" : "رنگ موی تازه، بدون ریسک"}</strong>
          قبل از خرید، در آینه‌ی مجازی امتحان کن
        </span>
      </Link>
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="mmenu" role="dialog" aria-modal="true" aria-label="منو">
      <div className="mmenu__scrim" onClick={onClose} />
      <nav className="mmenu__panel">
        <div className="mmenu__head">
          <span className="logo__mark">LUMIÈRE</span>
          <button className="icon-btn" onClick={onClose} aria-label="بستن منو"><IconClose /></button>
        </div>
        <Link to="/studio" className="mmenu__tryon"><IconCamera /> آینه‌ی مجازی</Link>
        <Link to="/shop/lip">رژ لب</Link>
        {byCategory("lip").map((p) => <Link key={p.id} to={`/p/${p.slug}`} className="mmenu__sub">{p.name}</Link>)}
        <Link to="/shop/hair">رنگ مو</Link>
        <Link to="/looks">لوک‌ها</Link>
      </nav>
    </div>
  );
}

// ---------------- search ----------------
function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useStore();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!searchOpen) return;
    setQ("");
    setTimeout(() => inputRef.current?.focus(), 50);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSearchOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [searchOpen, setSearchOpen]);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    return PRODUCTS.flatMap((p) =>
      p.shades
        .filter((s) => s.name.includes(t) || p.name.includes(t) || p.latin.toLowerCase().includes(t.toLowerCase()) || (p.finish && FINISH_LABEL[p.finish].includes(t)))
        .map((s) => ({ p, s })),
    ).slice(0, 8);
  }, [q]);

  if (!searchOpen) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (results[0]) navigate(`/p/${results[0].p.slug}?shade=${results[0].s.id}`);
  };
  return (
    <div className="search" role="dialog" aria-modal="true" aria-label="جستجو">
      <div className="search__scrim" onClick={() => setSearchOpen(false)} />
      <div className="search__panel">
        <form className="search__form" onSubmit={submit}>
          <IconSearch />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="مثلاً قرمز، مات، بلوند…" aria-label="عبارت جستجو" />
          <button type="button" className="icon-btn" onClick={() => setSearchOpen(false)} aria-label="بستن جستجو"><IconClose /></button>
        </form>
        {q.trim() === "" ? (
          <div className="search__popular">
            <h4>جستجوهای پرتکرار</h4>
            <div className="chips">
              {["قرمز", "نود", "مات", "براق", "بلوند", "شکلاتی"].map((w) => (
                <button key={w} className="chip" onClick={() => setQ(w)}>{w}</button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <p className="search__empty">نتیجه‌ای برای «{q}» پیدا نشد. یک رنگ یا نوع محصول دیگر را امتحان کنید.</p>
        ) : (
          <ul className="search__results">
            {results.map(({ p, s }) => (
              <li key={s.id}>
                <Link to={`/p/${p.slug}?shade=${s.id}`}>
                  <img src={shadeImage(s.id)} alt="" />
                  <span><strong>{s.name}</strong>{p.name}</span>
                  <em>{toman(p.price)}</em>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------- footer ----------------
function Footer() {
  const [done, setDone] = useState(false);
  return (
    <footer className="footer">
      <div className="footer__news">
        <div>
          <h2>رنگ‌های تازه را زودتر از همه ببینید</h2>
          <p>هر ماه رنگ‌های جدید، لوک‌های فصل و پیشنهادهای ویژه‌ی اعضا، مستقیم در ایمیل شما.</p>
        </div>
        <form className="newsletter" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          {done ? (
            <p className="newsletter__done">عضو خبرنامه شدید. اولین ایمیل به‌زودی می‌رسد.</p>
          ) : (
            <div>
              <label htmlFor="nl" className="sr-only">ایمیل</label>
              <input id="nl" type="email" required placeholder="ایمیل شما" dir="ltr" />
              <button className="btn btn--rouge" type="submit">عضویت</button>
            </div>
          )}
        </form>
      </div>

      <ul className="trust">
        <li><span><IconTruck /></span><div><strong>ارسال سریع</strong>تهران ۲۴ ساعته، شهرستان ۲ تا ۴ روز</div></li>
        <li><span><IconShield /></span><div><strong>ضمانت اصالت</strong>همه‌ی محصولات مستقیم از برند</div></li>
        <li><span><IconReturn /></span><div><strong>۷ روز بازگشت</strong>برای محصول باز نشده، بدون پرسش</div></li>
        <li><span><IconLock /></span><div><strong>پرداخت امن</strong>از درگاه‌های بانکی معتبر</div></li>
      </ul>

      <div className="footer__main">
        <div className="footer__brand">
          <span className="logo__mark">LUMIÈRE</span>
          <p>رنگ را اول در آینه ببینید، بعد بخرید. تصویر دوربین شما روی دستگاه خودتان پردازش می‌شود و جایی فرستاده نمی‌شود.</p>
          <Link to="/studio" className="footer__try"><IconCamera width={18} height={18} /> روشن کردن آینه‌ی مجازی</Link>
        </div>
        <nav className="footer__cols" aria-label="لینک‌های پایین صفحه">
          <div>
            <h4>فروشگاه</h4>
            <Link to="/shop/lip">رژ لب</Link>
            <Link to="/shop/hair">رنگ مو</Link>
            <Link to="/looks">لوک‌ها</Link>
            <Link to="/studio">آینه‌ی مجازی</Link>
          </div>
          <div>
            <h4>خدمات مشتری</h4>
            <a href="#">پیگیری سفارش</a>
            <a href="#">شرایط ارسال</a>
            <a href="#">بازگشت کالا</a>
            <a href="#">سؤالات متداول</a>
          </div>
          <div>
            <h4>لومیر</h4>
            <a href="#">درباره‌ی ما</a>
            <a href="#">حریم خصوصی</a>
            <a href="#">تماس با ما</a>
          </div>
        </nav>
      </div>

      <div className="footer__giant" aria-hidden="true">LUMIÈRE</div>

      <div className="footer__bottom">
        <span>© ۱۴۰۵ لومیر. همه‌ی حقوق محفوظ است.</span>
        <span>پشتیبانی: شنبه تا پنجشنبه، ۹ تا ۱۸</span>
      </div>
    </footer>
  );
}

// ---------------- cart ----------------
function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, removeFromCart, cartTotal, notify, addToCart } = useStore();
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, setCartOpen]);
  const left = Math.max(0, FREE_SHIPPING - cartTotal);
  const pct = Math.min(100, (cartTotal / FREE_SHIPPING) * 100);
  const suggest = ["ros-peach", "soi-petal", "hair-honey"].filter((id) => !cart.some((c) => c.shadeId === id)).slice(0, 2);

  return (
    <div className={`drawer${cartOpen ? " is-open" : ""}`} aria-hidden={!cartOpen}>
      <div className="drawer__scrim" onClick={() => setCartOpen(false)} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="سبد خرید">
        <div className="drawer__head">
          <h2>سبد خرید</h2>
          <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="بستن سبد"><IconClose /></button>
        </div>
        {cart.length === 0 ? (
          <div className="drawer__empty">
            <IconBag width={40} height={40} />
            <p>سبد خرید شما خالی است.</p>
            <Link className="btn btn--solid" to="/studio">امتحان رنگ‌ها در آینه</Link>
          </div>
        ) : (
          <>
            <div className="ship">
              <p>{left > 0 ? <>تا ارسال رایگان <strong>{toman(left)}</strong> مانده است</> : <strong>ارسال این سفارش رایگان است</strong>}</p>
              <div className="ship__bar"><span style={{ width: `${pct}%` }} /></div>
            </div>
            <ul className="cart-list">
              {cart.map((item) => {
                const f = findShade(item.shadeId);
                const p = productById(item.productId);
                if (!f || !p) return null;
                return (
                  <li key={item.shadeId} className="cart-item">
                    <img src={shadeImage(f.shade.id)} alt="" className="cart-item__img" />
                    <div className="cart-item__info">
                      <Link to={`/p/${p.slug}?shade=${f.shade.id}`} className="cart-item__name">{p.name}</Link>
                      <span className="cart-item__shade"><i style={{ background: f.shade.hex }} /> {f.shade.name}</span>
                      <div className="qty">
                        <button onClick={() => setQty(item.shadeId, item.qty + 1)} aria-label="افزایش تعداد">+</button>
                        <span>{faNum(item.qty)}</span>
                        <button onClick={() => setQty(item.shadeId, item.qty - 1)} aria-label="کاهش تعداد">−</button>
                      </div>
                    </div>
                    <div className="cart-item__end">
                      <span>{toman(p.price * item.qty)}</span>
                      <button className="link link--quiet" onClick={() => removeFromCart(item.shadeId)}>حذف</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {suggest.length > 0 && (
              <div className="upsell">
                <h3>همراه این سفارش</h3>
                {suggest.map((id) => {
                  const f = findShade(id)!;
                  return (
                    <div key={id} className="upsell__item">
                      <img src={shadeImage(id)} alt="" />
                      <span><strong>{f.shade.name}</strong>{f.product.name}، {toman(f.product.price)}</span>
                      <button className="btn btn--line btn--sm" onClick={() => { addToCart(id); notify(`${f.shade.name} به سبد اضافه شد`); }}>افزودن</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="drawer__foot">
              <div className="drawer__total"><span>جمع سفارش</span><strong>{toman(cartTotal)}</strong></div>
              <button className="btn btn--solid btn--block btn--lg" onClick={() => notify("پرداخت در مرحله‌ی بعدی پروژه به درگاه وصل می‌شود.")}>
                تکمیل خرید
              </button>
              <p className="drawer__fine"><IconLock width={14} height={14} /> پرداخت امن از درگاه بانکی</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Toast() {
  const { toast } = useStore();
  return (
    <div className={`toast${toast ? " is-on" : ""}`} role="status" aria-live="polite">{toast}</div>
  );
}
