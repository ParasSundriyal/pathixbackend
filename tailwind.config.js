module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "Inter", "sans-serif"],
        serif: ["Playfair Display", "serif"],
      },
      colors: {
        bg: {
          DEFAULT: "#181c2a",
          dark: "#0a0a13",
          glass: "rgba(255,255,255,0.08)",
        },
        accent: {
          gold: "#f6d365",
          gold2: "#fda085",
          blue: "#a3bffa",
          purple: "#7f9cf5",
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.18)",
        glow: "0 0 16px 0 #f6d36588, 0 2px 8px #232946cc",
        gold: "0 0 16px 0 #f6d36588, 0 2px 8px #fda085cc",
      },
    },
  },
  plugins: [],
}; 