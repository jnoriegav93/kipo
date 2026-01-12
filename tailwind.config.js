    /** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          500: '#FF6600', // Naranja Fibra
          600: '#CC5200',
        }
      }
    },
  },
  plugins: [],
}