/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        comic: ['"Comic Sans MS"', '"Chalkboard SE"', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        cartoon: '4px 4px 0px rgba(0, 0, 0, 0.2)',
        'cartoon-hover': '2px 2px 0px rgba(0, 0, 0, 0.2)',
        'cartoon-panel': '6px 6px 0px rgba(0, 0, 0, 0.15)',
      }
    },
  },
  plugins: [],
}
