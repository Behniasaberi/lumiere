/** @type {import('tailwindcss').Config} */
// Tailwind is used alongside the hand-written design system in src/styles/global.css.
// Preflight is off so Tailwind's reset never changes the existing pages.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: "#161616",
        mist: "#f3f1f0",
        rouge: { DEFAULT: "#c4102d", deep: "#9e0c23" },
        blush: "#fbf0f0",
        night: "#0f0d0e",
      },
      fontFamily: {
        heading: ['"Vazirmatn Variable"', "Vazirmatn", "system-ui", "sans-serif"],
        body: ['"Vazirmatn Variable"', "Vazirmatn", "system-ui", "sans-serif"],
        latin: ['"Alexandria"', '"Vazirmatn Variable"', "sans-serif"],
      },
      keyframes: {
        blink: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0" } },
        nudge: { "0%, 100%": { transform: "translateX(0)" }, "50%": { transform: "translateX(-10px)" } },
        reveal: {
          "0%": { opacity: "0", filter: "blur(12px)", transform: "translateY(6px)" },
          "100%": { opacity: "1", filter: "blur(0)", transform: "none" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        nudge: "nudge 1.6s ease-in-out infinite",
        reveal: "reveal 1.4s cubic-bezier(0.2,0.7,0.2,1) 0.15s both",
      },
    },
  },
  plugins: [],
};
