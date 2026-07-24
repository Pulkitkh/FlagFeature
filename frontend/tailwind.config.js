/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F7FF',
        surface: '#FFFFFF',
        border: '#E6E8F7',
        ink: '#17203B',
        muted: '#69708D',
        accent: '#5B5CE2',
        accentDark: '#4747C7',
        good: '#0F9F77',
        warn: '#D58A1F',
        bad: '#DE526B',
        hoverBg: '#F3F3FD',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        soft: '0 8px 22px -12px rgba(65, 58, 157, 0.24)',
        card: '0 12px 32px -20px rgba(49, 46, 129, 0.22)',
        floating: '0 24px 52px -20px rgba(49, 46, 129, 0.30)',
        glow: '0 12px 30px -10px rgba(91, 92, 226, 0.55)',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
}
