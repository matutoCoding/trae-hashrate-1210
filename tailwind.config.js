/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        brand: {
          50: "#EAF1F8",
          100: "#C5D7EB",
          200: "#9FBBDC",
          300: "#6F97C7",
          400: "#3F72B0",
          500: "#0F4C81",
          600: "#0D4270",
          700: "#0A3458",
          800: "#082742",
          900: "#051829",
        },
        warning: {
          yellow: "#FFC107",
          orange: "#FF6B35",
          red: "#E63946",
        },
        success: {
          500: "#2A9D8F",
          600: "#238577",
        },
        hazard: {
          500: "#6A4C93",
          600: "#5A4080",
        },
        ink: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
      },
      fontFamily: {
        sans: [
          '"Source Han Sans CN"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', '"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(15, 76, 129, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        "card-hover":
          "0 10px 30px rgba(15, 76, 129, 0.1), 0 4px 10px rgba(15, 23, 42, 0.05)",
        glow: "0 0 0 3px rgba(15, 76, 129, 0.15)",
      },
      borderRadius: {
        lg2: "10px",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.25)" },
        },
        shimmer: {
          "0%": { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up .5s ease-out both",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
