/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'positivus-green': '#B9FF66',
        'positivus-dark': '#191A23',
        'positivus-grey': '#F3F3F3',
        'positivus-white': '#FFFFFF',
        'positivus-border': '#191A23',
        'positivus-muted': '#767676',
        'positivus-slate': '#292A32',
        void: {
          950: '#191A23',
          900: '#1F202B',
          850: '#292A32',
          800: '#F3F3F3',
          700: '#E5E5E5',
          600: '#191A23',
          500: '#767676',
        },
      },
      fontFamily: {
        sans: ['"Calibri"', '"Carlito"', '"Candara"', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'positivus': '0px 5px 0px #191A23',
        'positivus-sm': '0px 3px 0px #191A23',
        'positivus-lg': '0px 8px 0px #191A23',
        'positivus-inset': 'inset 0px 2px 0px #191A23',
      },
    },
  },
  plugins: [],
};
