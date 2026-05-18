/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#6D5DFE",
        accentPink: "#EC4899",
        accentBlue: "#60A5FA",
        accentOrange: "#F97316",
        accentTeal: "#14B8A6",
      },
      boxShadow: {
        card: "0 14px 44px rgba(15, 23, 42, 0.12)",
        soft: "0 12px 34px rgba(109, 93, 254, 0.22)",
      },
    },
  },
  plugins: [],
};
