// Product catalog. In production this comes from the store backend (ASP.NET Core / Django API).
// Every shade carries the parameters the try-on engine needs: hex + finish.
import type { Finish } from "../engine/TryOnEngine";
import { hexToRgb, rgbToLab } from "../engine/color";

export type Category = "lip" | "hair";
export type Undertone = "warm" | "cool" | "neutral";
export type Depth = "light" | "medium" | "deep";

export interface Shade {
  id: string;
  name: string;
  hex: string;
  undertone: Undertone;
  depth: Depth;
}

export interface Product {
  id: string;
  slug: string;
  category: Category;
  name: string;
  latin: string;
  tagline: string;
  description: string;
  finish?: Finish;
  price: number; // toman
  size: string;
  details: string[];
  howTo: string;
  shades: Shade[];
}

export const FINISH_LABEL: Record<Finish, string> = { matte: "مات", satin: "ساتن", gloss: "براق" };
export const UNDERTONE_LABEL: Record<Undertone, string> = { warm: "گرم", cool: "سرد", neutral: "خنثی" };
export const DEPTH_LABEL: Record<Depth, string> = { light: "روشن", medium: "متوسط", deep: "تیره" };

export const PRODUCTS: Product[] = [
  {
    id: "velours",
    howTo: "از وسط لب بالا شروع کنید و به سمت گوشه‌ها بکشید. برای رنگ ملایم‌تر با نوک انگشت پخش کنید.",
    slug: "velours-matte",
    category: "lip",
    name: "رژ لب مخمل",
    latin: "Velours",
    tagline: "مات پودری، بدون خشکی",
    description:
      "رنگ کامل با یک بار کشیدن و سطحی مات و نرم مثل مخمل. فرمول سبک با روغن هسته‌ی انگور که لب را تا آخر روز خشک نمی‌کند.",
    finish: "matte",
    price: 790000,
    size: "۳٫۵ گرم",
    details: ["ماندگاری تا ۸ ساعت", "بدون پارابن", "تست‌نشده روی حیوانات"],
    shades: [
      { id: "vel-rose", name: "رز خاکی", hex: "#a24a5a", undertone: "neutral", depth: "medium" },
      { id: "vel-brick", name: "آجری", hex: "#a4412e", undertone: "warm", depth: "medium" },
      { id: "vel-wheat", name: "نود گندمی", hex: "#b9806c", undertone: "warm", depth: "light" },
      { id: "vel-mocha", name: "موکا", hex: "#8a4b3c", undertone: "warm", depth: "deep" },
      { id: "vel-berry", name: "توت وحشی", hex: "#7a1f45", undertone: "cool", depth: "deep" },
      { id: "vel-cherry", name: "آلبالویی", hex: "#6e1428", undertone: "cool", depth: "deep" },
    ],
  },
  {
    id: "soie",
    howTo: "مستقیم روی لب بکشید. برای رنگ عمیق‌تر یک لایه‌ی دوم اضافه کنید.",
    slug: "soie-satin",
    category: "lip",
    name: "رژ لب ابریشم",
    latin: "Soie",
    tagline: "ساتن نیمه‌براق با درخشش ملایم",
    description:
      "رنگ پرپیگمنت با براقیت آرام ابریشم. لب‌ها پرتر و شاداب‌تر دیده می‌شوند و رنگ یکدست می‌ماند.",
    finish: "satin",
    price: 850000,
    size: "۳٫۸ گرم",
    details: ["حاوی ویتامین E", "قابل لایه‌لایه زدن", "بدون پارابن"],
    shades: [
      { id: "soi-red", name: "قرمز کلاسیک", hex: "#c0182a", undertone: "neutral", depth: "medium" },
      { id: "soi-petal", name: "گلبرگ نود", hex: "#c98b7a", undertone: "neutral", depth: "light" },
      { id: "soi-rose", name: "گل محمدی", hex: "#b8355a", undertone: "cool", depth: "medium" },
      { id: "soi-cinnamon", name: "دارچینی", hex: "#9a5040", undertone: "warm", depth: "medium" },
      { id: "soi-plum", name: "آلوی شب", hex: "#4a1430", undertone: "cool", depth: "deep" },
    ],
  },
  {
    id: "rosee",
    howTo: "با اپلیکاتور روی وسط لب بزنید و پخش کنید. روی رژ مات هم برای حجم بیشتر می‌نشیند.",
    slug: "rosee-gloss",
    category: "lip",
    name: "رژ براق شبنم",
    latin: "Rosée",
    tagline: "براق شیشه‌ای، سبک و بدون چسبندگی",
    description:
      "درخشش شیشه‌ای با رنگ شفاف که روی رنگ طبیعی لب می‌نشیند. تنها یا روی رژ مات، برای حجم بیشتر.",
    finish: "gloss",
    price: 690000,
    size: "۶ میلی‌لیتر",
    details: ["بدون چسبندگی", "حاوی روغن جوجوبا", "مناسب استفاده‌ی روزانه"],
    shades: [
      { id: "ros-coral", name: "مرجانی", hex: "#e8735a", undertone: "warm", depth: "light" },
      { id: "ros-peach", name: "هلویی", hex: "#e39a7f", undertone: "warm", depth: "light" },
      { id: "ros-candy", name: "صورتی آبنباتی", hex: "#e5508c", undertone: "cool", depth: "light" },
      { id: "ros-mulberry", name: "شاه‌توت", hex: "#9b2f5a", undertone: "cool", depth: "medium" },
    ],
  },
  {
    id: "teinte",
    howTo: "روی موی خشک و نشسته بزنید، ۳۵ دقیقه صبر کنید و بشویید. قبل از استفاده تست حساسیت پوست انجام دهید.",
    slug: "teinte-hair-color",
    category: "hair",
    name: "رنگ موی ماندگار",
    latin: "Teinte",
    tagline: "رنگ یکدست با براقیت طبیعی",
    description:
      "رنگ دائم با فرمول کراتین‌دار که رنگ را تا ۸ هفته یکدست نگه می‌دارد. پوشش کامل موهای سفید.",
    price: 420000,
    size: "کیت کامل",
    details: ["پوشش ۱۰۰٪ موی سفید", "بدون آمونیاک", "همراه با ماسک بعد از رنگ"],
    shades: [
      { id: "hair-copper", name: "مسی آتشین", hex: "#b5531f", undertone: "warm", depth: "medium" },
      { id: "hair-honey", name: "بلوند عسلی", hex: "#d9a85b", undertone: "warm", depth: "light" },
      { id: "hair-choco", name: "شکلاتی", hex: "#4b2a1a", undertone: "neutral", depth: "deep" },
      { id: "hair-wine", name: "شرابی", hex: "#6e1530", undertone: "cool", depth: "deep" },
      { id: "hair-rosegold", name: "رزگلد", hex: "#d68a86", undertone: "cool", depth: "light" },
      { id: "hair-ash", name: "خاکستری دودی", hex: "#8f8c8e", undertone: "cool", depth: "light" },
      { id: "hair-midnight", name: "آبی نیمه‌شب", hex: "#1f3a7a", undertone: "cool", depth: "deep" },
    ],
  },
];

export interface CuratedLook {
  id: string;
  name: string;
  note: string;
  lip: string; // shade id
  hair: string; // shade id
}

export const LOOKS: CuratedLook[] = [
  { id: "paris", name: "عصر پاریسی", note: "قرمز کلاسیک روی موی شکلاتی؛ ساده و همیشگی.", lip: "soi-red", hair: "hair-choco" },
  { id: "autumn", name: "پاییز مسی", note: "آجری مات کنار مسی آتشین؛ گرم و جسور.", lip: "vel-brick", hair: "hair-copper" },
  { id: "velvet-night", name: "شب مخملی", note: "آلبالویی عمیق با موی شرابی برای مهمانی.", lip: "vel-cherry", hair: "hair-wine" },
  { id: "summer", name: "تابستان عسلی", note: "براق هلویی و بلوند عسلی؛ سبک و آفتابی.", lip: "ros-peach", hair: "hair-honey" },
];

// ---------- media ----------
// Studio renders of each shade live in /public/products/<shade-id>.webp — replace with real photography later.
export const shadeImage = (shadeId: string) => `${import.meta.env.BASE_URL}products/${shadeId}.webp`;
export const categoryImage = (c: Category) => `${import.meta.env.BASE_URL}products/cat-${c}.webp`;
export const BESTSELLERS = ["soi-red", "vel-rose", "ros-coral", "hair-copper", "vel-berry", "hair-honey", "soi-petal", "hair-choco"];
export const FREE_SHIPPING = 1500000;

// ---------- lookups ----------
export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export function findShade(shadeId: string | null | undefined) {
  if (!shadeId) return null;
  for (const p of PRODUCTS) {
    const s = p.shades.find((x) => x.id === shadeId);
    if (s) return { product: p, shade: s };
  }
  return null;
}
export const byCategory = (c: Category) => PRODUCTS.filter((p) => p.category === c);

const fa = new Intl.NumberFormat("fa-IR");
export const toman = (n: number) => `${fa.format(n)} تومان`;
export const faNum = (n: number) => fa.format(n);

/** Ranks shades of a category for a skin reading. Approximate guidance, not a diagnosis. */
export function recommend(category: Category, undertone: Undertone, depth: Depth, count = 3) {
  const all = byCategory(category).flatMap((p) => p.shades.map((s) => ({ product: p, shade: s })));
  const depthScore = (d: Depth) => {
    // Lips: deeper skin carries deeper shades; lighter skin suits light-to-medium.
    const order: Depth[] = ["light", "medium", "deep"];
    return 2 - Math.abs(order.indexOf(d) - order.indexOf(depth));
  };
  return all
    .map((x) => ({
      ...x,
      score:
        (x.shade.undertone === undertone ? 3 : x.shade.undertone === "neutral" || undertone === "neutral" ? 1.5 : 0) +
        depthScore(x.shade.depth),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// ---------- colour matching ----------

/** Perceptual colour distance (CIE76 in Lab). ~2 is barely visible, >10 is clearly different. */
export function deltaE(a: [number, number, number], b: [number, number, number]) {
  const [l1, a1, b1] = rgbToLab(a), [l2, a2, b2] = rgbToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Closest catalogue shades to a measured colour, with a 0–100 similarity score. */
export function matchShades(rgb: [number, number, number], category: Category = "lip", count = 3) {
  return byCategory(category)
    .flatMap((p) => p.shades.map((s) => ({ product: p, shade: s, d: deltaE(rgb, hexToRgb(s.hex) as [number, number, number]) })))
    .sort((x, y) => x.d - y.d)
    .slice(0, count)
    .map((x) => ({ ...x, similarity: Math.max(0, Math.round(100 - x.d * 2.2)) }));
}
