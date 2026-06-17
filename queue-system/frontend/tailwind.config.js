/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amazon: {
          orange: '#FF9900',
          dark: '#131921',
          navy: '#232F3E',
          light: '#37475A',
          hover: '#F3A847'
        }
      }
    }
  },
  plugins: []
};
