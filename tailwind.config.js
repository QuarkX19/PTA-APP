/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0B2A4A",       // Azul oscuro institucional
          gold: "#D4A017",       // Dorado institucional
          darkblue: "#001F3F",   // Azul más profundo
          black: "#000000",      // Negro puro
          yellow: "#FFB400",     // Amarillo quemado
          white: "#FFFFFF",      // Blanco para fondo
        },
      },
    },
  },
  plugins: [],
};
