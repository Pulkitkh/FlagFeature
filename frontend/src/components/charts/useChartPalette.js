import { useEffect, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'

const ROLES = {
  series1: '--series-1',
  series2: '--series-2',
  grid: '--grid',
  muted: '--muted',
  ink: '--ink',
  surface: '--surface',
  border: '--border',
}

const FALLBACK = {
  series1: 'rgb(42, 120, 214)',
  series2: 'rgb(235, 104, 52)',
  grid: 'rgb(231, 235, 241)',
  muted: 'rgb(102, 112, 133)',
  ink: 'rgb(15, 20, 25)',
  surface: 'rgb(255, 255, 255)',
  border: 'rgb(226, 231, 238)',
}

function readPalette() {
  if (typeof window === 'undefined') return FALLBACK

  const computed = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    Object.entries(ROLES).map(([role, variable]) => {
      const raw = computed.getPropertyValue(variable).trim()
      return [role, raw ? `rgb(${raw})` : FALLBACK[role]]
    })
  )
}

/**
 * Resolves the theme's chart tokens to concrete rgb() strings.
 *
 * Recharts writes colours into SVG attributes, where `var(--…)` support is
 * inconsistent, so the values are read off the document instead — and re-read
 * whenever the theme flips.
 */
export default function useChartPalette() {
  const { theme } = useTheme()
  const [palette, setPalette] = useState(readPalette)

  useEffect(() => {
    setPalette(readPalette())
  }, [theme])

  return palette
}
