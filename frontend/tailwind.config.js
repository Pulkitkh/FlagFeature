/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F0F1F4',
        surface: '#FFFFFF',
        surfaceMuted: '#F6F7F9',
        border: '#DDE0E5',
        borderStrong: '#C6CAD1',
        ink: '#13161C',
        muted: '#5B6270',
        accent: '#2454C7',
        accentDark: '#173C93',
        accentSoft: '#E9EFFC',
        good: '#166B47',
        goodSoft: '#E4F3EB',
        warn: '#93590A',
        warnSoft: '#FBEFDA',
        bad: '#A6291F',
        badSoft: '#FAEAE8',
        hoverBg: '#EBEDF1',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        hairline: '0 1px 2px rgba(19, 22, 28, 0.06)',
        soft: '0 1px 2px rgba(19, 22, 28, 0.04), 0 6px 16px -10px rgba(19, 22, 28, 0.12)',
        card: '0 1px 2px rgba(19, 22, 28, 0.04), 0 10px 24px -14px rgba(19, 22, 28, 0.14)',
        floating: '0 16px 40px -12px rgba(19, 22, 28, 0.22)',
      },
      maxWidth: {
        content: '1280px',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(19,22,28,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(19,22,28,0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '28px 28px',
      },
    },
  },
  plugins: [],
}
