const plugin = require('tailwindcss/plugin')

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
        accentHover: token('--accent-hover'),
        accentMuted: token('--accent-muted'),
        accentSoft: token('--accent-soft'),
        accentAlt: token('--accent-alt'),
        good: token('--good'),
        goodSoft: token('--good-soft'),
        goodBorder: token('--good-border'),
        warn: token('--warn'),
        warnSoft: token('--warn-soft'),
        warnBorder: token('--warn-border'),
        bad: token('--bad'),
        badSoft: token('--bad-soft'),
        badBorder: token('--bad-border'),
        hoverBg: token('--hover-bg'),
      },
      fontFamily: {
        // `display` is not a second family — it is Archivo again, and the
        // width axis does the work (see .font-display in index.css). Keeping
        // one family across both roles is what makes the type read as a
        // system rather than as two fonts picked off a list.
        display: ['Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Deliberately not a monospace. Flag keys are identifiers in a UI,
        // not code on a page, and a downloaded developer face is what makes a
        // console look like a template. `.identifier` in index.css does the
        // distinguishing instead.
        mono: ['Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // The only mono left, and it is the one the OS already ships — used
        // where columns genuinely have to line up (API samples, JSON diffs).
        code: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
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
      /*
       * Motion is a system of three durations and three curves rather than a
       * number picked per component. Everything sits in the 120-260ms band
       * where a transition reads as responsive: below ~100ms it is a jump,
       * above ~300ms the interface feels like it is thinking.
       */
      transitionDuration: {
        fast: '120ms',   // colour and opacity — state you want acknowledged
        base: '180ms',   // the default: hovers, borders, small transforms
        slow: '260ms',   // things that travel: drawers, disclosure, overlays
      },
      transitionTimingFunction: {
        // Decelerating. Things arriving should arrive quickly and settle.
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        // Symmetric, for something that moves and comes back.
        'in-out-quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
      },
      animation: {
        'rise-in': 'rise-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'trace-in': 'trace-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'drawer-in': 'drawer-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        // Route changes. Short and shallow — a page arriving is a fact to
        // register, not an event to watch.
        'page-in': 'page-in 0.26s cubic-bezier(0.16, 1, 0.3, 1) both',
        // Table and list rows. Deliberately ease-out with no overshoot: a
        // springy row in a data table reads as sloppy, not lively.
        'row-in': 'row-in 0.3s cubic-bezier(0.25, 1, 0.5, 1) both',
      },
    },
  },
  plugins: [
    /*
     * `sm:` asks how wide the screen is, which is the wrong question for hit
     * targets: a phone in landscape is 852px wide and still has a thumb on it,
     * and a tablet is 768px with no mouse at all. `fine:` asks whether there is
     * a precise pointer, which is what actually decides how big a control
     * needs to be.
     */
    plugin(({ addVariant }) => {
      addVariant('fine', '@media (pointer: fine)')
      addVariant('coarse', '@media (pointer: coarse)')
    }),
  ],
}
