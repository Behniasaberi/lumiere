import { useEffect, useState } from "react";

/**
 * Reveals `text` one character at a time. Splits by grapheme so Persian letters,
 * the zero-width non-joiner (نیم‌فاصله) and diacritics are never cut in half.
 */
export function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [count, setCount] = useState(0);
  const [chars] = useState(() => {
    const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
    return Seg ? [...new Seg("fa", { granularity: "grapheme" }).segment(text)].map((s) => s.segment) : Array.from(text);
  });

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(chars.length);
      return;
    }
    let iv = 0;
    const t = window.setTimeout(() => {
      iv = window.setInterval(() => {
        setCount((c) => {
          if (c + 1 >= chars.length) window.clearInterval(iv);
          return Math.min(chars.length, c + 1);
        });
      }, speed);
    }, startDelay);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, [chars, speed, startDelay]);

  return { displayed: chars.slice(0, count).join(""), done: count >= chars.length };
}
