import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        terracota: "#993908",
        deepGreen: "#014029",
        offWhite: "#F2EFEB",
        accent: "#f59e72"
      },
      fontFamily: {
        sans: ["var(--font-red-hat)", "system-ui", "sans-serif"]
      },
      dropShadow: {
        card: "0 15px 35px rgba(1, 64, 41, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
