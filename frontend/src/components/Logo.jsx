/**
 * The FlagForge mark.
 *
 * The old mark was a stock icon dropped in a rounded square with a dot stuck
 * on the corner — three unrelated shapes fighting for 28 pixels, which is why
 * it read as muddy at the size it is actually used.
 *
 * This one is a single idea: a flag whose banner is divided into three bars
 * that step down in opacity. That is literally what the product does — a flag
 * rolled out to a percentage of traffic — so the mark describes the thing
 * rather than decorating it. Three bars is also the smallest count that still
 * reads as a progression rather than as stripes.
 *
 * Everything is drawn from `currentColor`, so the mark inherits whatever it
 * sits on: ink on the light sidebar, surface on the dark hero slab, accent on
 * the login screen. No second asset, no theme variants.
 */
export default function Logo({ className = '', title }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      className={className}
      fill="none"
    >
      {/* The pole. Full height, rounded, slightly heavier than the bars so the
          mark has a spine and doesn't float. */}
      <rect x="4.6" y="3" width="3.4" height="26" rx="1.7" fill="currentColor" />

      {/* The banner: three bars at 100/62/34% opacity. The step is wide enough
          to survive both a dark and a light background, where a subtler ramp
          would collapse into a single block. */}
      <rect x="10.4" y="4.6" width="6.4" height="12.6" rx="1.6" fill="currentColor" />
      <rect x="18.2" y="4.6" width="5.2" height="12.6" rx="1.6" fill="currentColor" opacity="0.62" />
      <rect x="24.8" y="4.6" width="3.4" height="12.6" rx="1.6" fill="currentColor" opacity="0.34" />
    </svg>
  )
}

/**
 * The mark on its own tile, for the sidebar and drawer lockups where it sits
 * against the page rather than inside a coloured header.
 */
export function LogoTile({ className = '' }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-ink text-surface shadow-hairline ${className}`}
    >
      {/* A diagonal sheen across the tile, the same violet-to-teal grade the
          shell uses — it keeps the tile from reading as a flat black chip. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/45 via-transparent to-accentAlt/35"
      />
      <Logo className="relative h-[62%] w-[62%]" />
    </span>
  )
}
