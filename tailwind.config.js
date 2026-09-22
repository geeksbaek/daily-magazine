/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Hahmlet', '"Noto Serif KR"', '"Apple SD Gothic Neo"', 'serif'],
        text: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', '"Apple SD Gothic Neo"', 'sans-serif'],
      },
      colors: {
        paper: { DEFAULT: 'var(--paper)', 2: 'var(--paper-2)', 3: 'var(--paper-3)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        rule: { DEFAULT: 'var(--rule)', 2: 'var(--rule-2)' },
        accent: { DEFAULT: 'var(--accent)', ink: 'var(--accent-ink)', soft: 'var(--accent-soft)' },
        mark: { DEFAULT: 'var(--mark)', ink: 'var(--mark-ink)' },
      },
      maxWidth: {
        wrap: '1180px',
        prose: '640px',
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
}
