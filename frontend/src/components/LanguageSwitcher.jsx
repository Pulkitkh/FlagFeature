import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Globe, Search } from 'lucide-react'
import { LANGUAGES } from '../i18n/languages'
import { useLanguage } from '../context/LanguageContext'

/**
 * Forty-odd languages is too many to scan, so the menu opens with the search
 * box focused and matches on either the endonym or the English name — someone
 * looking for Bengali finds it by typing "Bengali" or "বাংলা".
 */
export default function LanguageSwitcher({ className = '', align = 'end' }) {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return

    searchRef.current?.focus()

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = LANGUAGES.find((entry) => entry.code === language)

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? LANGUAGES.filter(
          (entry) =>
            entry.label.toLowerCase().includes(needle) ||
            entry.english.toLowerCase().includes(needle) ||
            entry.code.toLowerCase().startsWith(needle)
        )
      : LANGUAGES

    // Preserve the declaration order within each region rather than sorting —
    // the list is already ordered by how widely each language is spoken.
    const byRegion = new Map()
    for (const entry of matches) {
      if (!byRegion.has(entry.region)) byRegion.set(entry.region, [])
      byRegion.get(entry.region).push(entry)
    }
    return [...byRegion.entries()]
  }, [query])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((isOpen) => !isOpen)
          setQuery('')
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
        title={t('language')}
        className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors ${
          open
            ? 'border-accent bg-accentSoft text-accentDark'
            : 'border-border bg-surface text-muted hover:bg-surfaceMuted hover:text-ink'
        }`}
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span className="hidden max-w-[8rem] truncate font-medium sm:block">
          {current?.label || 'English'}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language')}
          className={`absolute z-40 mt-2 w-72 animate-fade-in overflow-hidden rounded-xl border border-border bg-surface shadow-floating ${
            align === 'start' ? 'start-0' : 'end-0'
          }`}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('languageSearch')}
                className="w-full rounded-lg border border-border bg-surfaceMuted py-2 pe-3 ps-8 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {groups.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">{t('languageNoResults')}</p>
            )}

            {groups.map(([region, entries]) => (
              <div key={region}>
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {region}
                </p>
                {entries.map((entry) => {
                  const selected = entry.code === language
                  return (
                    <button
                      key={entry.code}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setLanguage(entry.code)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors ${
                        selected ? 'bg-accentSoft text-accentDark' : 'text-ink hover:bg-surfaceMuted'
                      }`}
                    >
                      {/* The endonym is written in its own script, so it gets its
                          own direction rather than inheriting the page's. */}
                      <span
                        className="min-w-0 flex-1 truncate font-medium"
                        dir={entry.dir === 'rtl' ? 'rtl' : 'ltr'}
                      >
                        {entry.label}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{entry.english}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
