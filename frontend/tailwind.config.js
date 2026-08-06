/**
 * Colours come from CSS variables (see src/styles/index.css) so the same class
 * names resolve to different values under `data-theme="dark"`. The variables
 * hold "R G B" triples rather than colours, which is what lets Tailwind's
 * opacity modifiers (bg-surface/60, border-bad/25) keep working.
 *
 * @type {import('tailwindcss').Config}
 */
const token =
  (name) =>
  ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${name}))` : `rgb(var(${name}) / ${opacityValue})`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token('--bg'),
        surface: token('--surface'),
        surfaceMuted: token('--surface-muted'),
        surfaceSunken: token('--surface-sunken'),
        border: token('--border'),
        borderStrong: token('--border-strong'),
        ink: token('--ink'),
        muted: token('--muted'),
        accent: token('--accent'),
        accentDark: token('--accent-dark'),
        accentSoft: token('--accent-soft'),
        accentAlt: token('--accent-alt'),
        good: token('--good'),
        goodSoft: token('--good-soft'),
        warn: token('--warn'),
        warnSoft: token('--warn-soft'),
        bad: token('--bad'),
        badSoft: token('--bad-soft'),
        hoverBg: token('--hover-bg'),
      },
      fontFamily: {
        // Source Serif carries titles, Source Sans does the work, Source Code
        // carries anything the API produced. Siblings, so they cut together.
        display: ['"Source Serif 4"', 'Charter', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // Shadow strength is a variable too: a 6% black shadow is invisible on
        // a dark surface, so the dark theme raises the alpha.
        hairline: '0 1px 2px rgb(var(--shadow-color) / var(--shadow-hairline))',
        soft: '0 1px 2px rgb(var(--shadow-color) / var(--shadow-soft-near)), 0 6px 16px -10px rgb(var(--shadow-color) / var(--shadow-soft-far))',
        card: '0 1px 2px rgb(var(--shadow-color) / var(--shadow-card-near)), 0 10px 24px -14px rgb(var(--shadow-color) / var(--shadow-card-far))',
        floating: '0 16px 40px -12px rgb(var(--shadow-color) / var(--shadow-floating))',
      },
      maxWidth: {
        content: '1280px',
      },
      backgroundImage: {
        dots: 'radial-gradient(rgb(var(--dot) / var(--dot-alpha)) 1px, transparent 1px)',
      },
      backgroundSize: {
        dots: '24px 24px',
      },
      borderRadius: {
        // A touch softer than machined, a touch tighter than a marketing card.
        xl: '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'rise-in': 'rise-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'trace-in': 'trace-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
