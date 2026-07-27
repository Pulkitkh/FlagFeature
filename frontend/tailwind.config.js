/** @type {import('tailwindcss').Config} */

// Every colour resolves to a CSS variable holding an "R G B" triple, so the
// light/dark themes swap in one place and opacity modifiers still work.
const token = (name) => ({ opacityValue }) =>
  opacityValue === undefined ? `rgb(var(${name}))` : `rgb(var(${name}) / ${opacityValue})`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('--canvas'),
        surface: token('--surface'),
        surfaceMuted: token('--surface-muted'),
        surfaceSunken: token('--surface-sunken'),
        border: token('--border'),
        borderStrong: token('--border-strong'),
        ink: token('--ink'),
        inkSubtle: token('--ink-subtle'),
        muted: token('--muted'),
        accent: token('--accent'),
        accentHover: token('--accent-hover'),
        accentSoft: token('--accent-soft'),
        good: token('--good'),
        goodSoft: token('--good-soft'),
        warn: token('--warn'),
        warnSoft: token('--warn-soft'),
        bad: token('--bad'),
        badSoft: token('--bad-soft'),
        series1: token('--series-1'),
        series2: token('--series-2'),
        grid: token('--grid'),
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        label: '0.09em',
      },
      boxShadow: {
        hairline: '0 1px 2px rgb(var(--shadow-color) / 0.06)',
        soft: '0 1px 2px rgb(var(--shadow-color) / 0.05), 0 6px 16px -10px rgb(var(--shadow-color) / 0.14)',
        card: '0 1px 2px rgb(var(--shadow-color) / 0.05), 0 12px 28px -16px rgb(var(--shadow-color) / 0.18)',
        lifted: '0 2px 4px rgb(var(--shadow-color) / 0.06), 0 20px 40px -20px rgb(var(--shadow-color) / 0.28)',
        floating: '0 24px 56px -16px rgb(var(--shadow-color) / 0.34)',
      },
      maxWidth: {
        content: '1360px',
      },
      spacing: {
        sidebar: '17rem',
      },
      animation: {
        'rise-in': 'rise-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'dialog-in': 'dialog-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-in': 'toast-in 0.24s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
