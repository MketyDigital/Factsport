import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fact: {
          red: '#D50032', // ESPN-like Red
          dark: '#1A1A1A',
        }
      }
    },
  },
  plugins: [],
};
export default config;
