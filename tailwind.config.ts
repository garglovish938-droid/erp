import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        indigo: {
          500: "#6366f1",
          600: "#4f46e5",
          650: "#4338ca",
          700: "#3730a3",
          750: "#312e81",
        },
        slate: {
          55: "#f8fafc",
          805: "#1e293b",
          955: "#0b1329",
        }
      },
    },
  },
  plugins: [],
};
export default config;
