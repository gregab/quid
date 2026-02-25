/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          light: "#faf9f7",
          dark: "#0c0a09",
        },
      },
      fontFamily: {
        sans: ["Geist"],
        "sans-medium": ["Geist-Medium"],
        "sans-semibold": ["Geist-SemiBold"],
        "sans-bold": ["Geist-Bold"],
        "serif-logo": ["CormorantGaramond-Regular"],
      },
    },
  },
  plugins: [],
};
