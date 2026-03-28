/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        ink: {
          50: '#FAFAF7',
          100: '#F4F4EE',
          200: '#E8E8DF',
          300: '#D1D1C4',
          400: '#A8A898',
          500: '#807F6E',
          600: '#5C5B4C',
          700: '#3D3C30',
          800: '#252419',
          900: '#141409',
          950: '#0A0A04',
        },
        accent: '#C8102E',
        'accent-dark': '#FF3355',
      },
      letterSpacing: {
        widest: '0.25em',
        'ultra-wide': '0.35em',
      },
    },
  },
  plugins: [],
}
