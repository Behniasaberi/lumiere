// Product illustrations drawn in SVG so every shade renders in its exact color — no photo shoot needed
// for the prototype. Replace with product photography later; keep the shade hex for the try-on.
import { useId } from "react";
import type { Product } from "../data/catalog";

interface Props {
  product: Product;
  hex: string;
  className?: string;
}

export function ProductArt({ product, hex, className }: Props) {
  if (product.category === "hair") return <HairTress hex={hex} className={className} />;
  if (product.finish === "gloss") return <GlossTube hex={hex} className={className} />;
  return <LipstickBullet hex={hex} className={className} satin={product.finish === "satin"} />;
}

function LipstickBullet({ hex, className, satin }: { hex: string; className?: string; satin: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 120 280" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`b${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".35" stopColor="#fff" stopOpacity={satin ? ".32" : ".14"} />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`c${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#14100f" />
          <stop offset=".4" stopColor="#3a3134" />
          <stop offset="1" stopColor="#120e0f" />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8d7550" />
          <stop offset=".45" stopColor="#e3cfa5" />
          <stop offset="1" stopColor="#7c6544" />
        </linearGradient>
      </defs>
      {/* bullet */}
      <path d="M38 118 V58 Q38 40 50 30 L82 14 V118 Z" fill={hex} />
      <path d="M38 118 V58 Q38 40 50 30 L82 14 V118 Z" fill={`url(#b${id})`} />
      {/* inner sleeve */}
      <rect x="33" y="112" width="54" height="40" rx="2" fill={`url(#g${id})`} />
      {/* case */}
      <rect x="28" y="150" width="64" height="118" rx="3" fill={`url(#c${id})`} />
      <rect x="28" y="150" width="64" height="5" fill={`url(#g${id})`} opacity=".9" />
      <rect x="28" y="248" width="64" height="2" fill={`url(#g${id})`} opacity=".6" />
    </svg>
  );
}

function GlossTube({ hex, className }: { hex: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 120 280" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`t${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id={`k${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#14100f" />
          <stop offset=".4" stopColor="#3a3134" />
          <stop offset="1" stopColor="#120e0f" />
        </linearGradient>
      </defs>
      {/* cap */}
      <rect x="42" y="12" width="36" height="92" rx="6" fill={`url(#k${id})`} />
      {/* bottle */}
      <rect x="38" y="100" width="44" height="168" rx="14" fill={hex} opacity=".88" />
      <rect x="38" y="100" width="44" height="168" rx="14" fill={`url(#t${id})`} />
      <rect x="38" y="100" width="44" height="168" rx="14" fill="none" stroke="#fff" strokeOpacity=".5" />
    </svg>
  );
}

function HairTress({ hex, className }: { hex: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const strands = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 120 280" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`h${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".35" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
        <clipPath id={`p${id}`}>
          <path d="M40 40 C36 110 30 170 44 270 L80 270 C92 180 86 110 82 40 Z" />
        </clipPath>
      </defs>
      {/* clasp */}
      <rect x="36" y="20" width="50" height="24" rx="4" fill="#2a2326" />
      <rect x="36" y="38" width="50" height="3" fill="#cdb78f" />
      <g clipPath={`url(#p${id})`}>
        <rect x="20" y="40" width="80" height="240" fill={hex} />
        {strands.map((i) => (
          <path
            key={i}
            d={`M${40 + i * 5} 40 C${36 + i * 5} 120 ${48 + i * 4} 190 ${42 + i * 5} 280`}
            stroke="#000"
            strokeOpacity=".16"
            strokeWidth="1.2"
            fill="none"
          />
        ))}
        <rect x="20" y="40" width="80" height="240" fill={`url(#h${id})`} />
      </g>
    </svg>
  );
}
