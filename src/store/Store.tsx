import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { engine } from "../engine/TryOnEngine";
import { findShade, productById } from "../data/catalog";

export interface CartItem {
  productId: string;
  shadeId: string;
  qty: number;
}

interface StoreValue {
  // the look currently shown in every mirror on the site
  lipShade: string | null;
  hairShade: string | null;
  lipIntensity: number;
  hairIntensity: number;
  setLipShade: (id: string | null) => void;
  setHairShade: (id: string | null) => void;
  setIntensity: (kind: "lip" | "hair", v: number) => void;
  clearLook: () => void;
  // bag
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addToCart: (shadeId: string, qty?: number) => void;
  setQty: (shadeId: string, qty: number) => void;
  removeFromCart: (shadeId: string) => void;
  cartCount: number;
  cartTotal: number;
  // wishlist
  wishlist: string[];
  toggleWish: (shadeId: string) => void;
  // floating mirror + shade finder
  dockOpen: boolean;
  setDockOpen: (v: boolean) => void;
  finderOpen: boolean;
  setFinderOpen: (v: boolean) => void;
  // search overlay
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  // toast
  toast: string;
  notify: (t: string) => void;
}

const Ctx = createContext<StoreValue | null>(null);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode — the bag just won't persist */
  }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lipShade, setLipShade] = useState<string | null>(null);
  const [hairShade, setHairShade] = useState<string | null>(null);
  const [lipIntensity, setLip] = useState(0.75);
  const [hairIntensity, setHair] = useState(0.65);
  const [cart, setCart] = useState<CartItem[]>(() =>
    read<CartItem[]>("lumiere.bag", []).filter((i) => findShade(i.shadeId)),
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState<boolean>(() => read("lumiere.dock", false));
  const [finderOpen, setFinderOpen] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>(() => read<string[]>("lumiere.wish", []).filter((id) => findShade(id)));
  const [toast, setToast] = useState("");

  // keep the engine in sync with the chosen look
  useEffect(() => {
    const lip = findShade(lipShade);
    const hair = findShade(hairShade);
    engine.setLook({
      lip: lip ? { hex: lip.shade.hex, finish: lip.product.finish ?? "satin" } : null,
      hair: hair ? { hex: hair.shade.hex } : null,
    });
  }, [lipShade, hairShade]);
  useEffect(() => engine.setIntensity(lipIntensity, hairIntensity), [lipIntensity, hairIntensity]);
  useEffect(() => write("lumiere.bag", cart), [cart]);
  useEffect(() => write("lumiere.wish", wishlist), [wishlist]);
  useEffect(() => write("lumiere.dock", dockOpen), [dockOpen]);

  const toastTimer = useRef(0);
  const notify = useCallback((t: string) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const addToCart = useCallback((shadeId: string, qty = 1) => {
    const f = findShade(shadeId);
    if (!f) return;
    setCart((c) => {
      const ex = c.find((i) => i.shadeId === shadeId);
      if (ex) return c.map((i) => (i.shadeId === shadeId ? { ...i, qty: Math.min(9, i.qty + qty) } : i));
      return [...c, { productId: f.product.id, shadeId, qty }];
    });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const cartCount = cart.reduce((s, i) => s + i.qty, 0);
    const cartTotal = cart.reduce((s, i) => s + (productById(i.productId)?.price ?? 0) * i.qty, 0);
    return {
      lipShade, hairShade, lipIntensity, hairIntensity,
      setLipShade, setHairShade,
      setIntensity: (k, v) => (k === "lip" ? setLip(v) : setHair(v)),
      clearLook: () => { setLipShade(null); setHairShade(null); },
      cart, cartOpen, setCartOpen, addToCart,
      setQty: (id, q) => setCart((c) => c.map((i) => (i.shadeId === id ? { ...i, qty: Math.max(1, Math.min(9, q)) } : i))),
      removeFromCart: (id) => setCart((c) => c.filter((i) => i.shadeId !== id)),
      cartCount, cartTotal,
      wishlist,
      toggleWish: (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id])),
      searchOpen, setSearchOpen,
      dockOpen, setDockOpen, finderOpen, setFinderOpen,
      toast, notify,
    };
  }, [lipShade, hairShade, lipIntensity, hairIntensity, cart, cartOpen, addToCart, toast, notify, wishlist, searchOpen, dockOpen, finderOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

/** Picks a shade on the right channel (lip or hair). */
export function useApplyShade() {
  const { setLipShade, setHairShade } = useStore();
  return useCallback(
    (shadeId: string | null, category: "lip" | "hair") => (category === "lip" ? setLipShade(shadeId) : setHairShade(shadeId)),
    [setLipShade, setHairShade],
  );
}
