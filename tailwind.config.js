/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        brand: {
          50: '#EEF4FF', 100: '#DCE8FF', 200: '#B9D0FF', 300: '#8FB4FF', 400: '#5A8FFF', 500: '#1A6BFF',
          600: '#0A5CF5', 700: '#084AC7', 800: '#0A3A94',
        },
        navy: { 700: '#12264D', 800: '#0D1E3F', 900: '#0A1733', 950: '#071128' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};
