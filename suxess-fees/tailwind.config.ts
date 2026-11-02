import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#0B5C2E",
          gold: "#D4A017",
          dark: "#0A3D1F",
          blue: "#1B6CA8",
          navy: "#0F2744",
        },
      },
    },
  },
  plugins: [],
};

export default config;
