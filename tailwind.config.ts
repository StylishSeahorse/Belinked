import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151515",
        paper: "#fbfaf7",
        moss: "#49634d",
        coral: "#db6b57",
        aqua: "#2f8f9d"
      },
      boxShadow: {
        soft: "0 14px 35px rgba(21, 21, 21, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
