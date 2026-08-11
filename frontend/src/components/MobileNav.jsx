import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useT } from '../context/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { SidebarBrand, SidebarFooter, SidebarNav } from './Sidebar'

/**
 * Below `lg` the sidebar rail is hidden, which used to leave a phone with no
 * way to reach any page but the one it landed on. This is the same navigation
 * as a drawer: a trigger in the header, a scrim, and the shared nav list.
 *
 * It slides from the inline-start edge, so it comes from the left in English
 * and from the right in Arabic without a second implementation.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const panelRef = useRef(null)
  const t = useT()

  // A tap on a link navigates and the drawer must go with it — otherwise the
  // new page renders underneath an open drawer.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)

    // The page behind must not scroll while the drawer is up — on iOS that
    // scroll otherwise happens under the overlay and is deeply confusing.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('openMenu')}
        aria-expanded={open}
        className="-ms-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hoverBg hover:text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/*
        Portalled to <body> on purpose. The header carries `backdrop-blur`, and
        a backdrop-filter makes an element a containing block for any
        `position: fixed` descendant — so rendered in place the overlay sizes
        itself to the 56px header instead of the viewport, and the drawer comes
        out as a clipped strip across the top.
      */}
      {open &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 animate-fade-in bg-ink/50 backdrop-blur-sm lg:hidden"
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('navManage')}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              className="flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto border-e border-border bg-surfaceSunken bg-gradient-to-b from-accent/[0.09] via-transparent to-accentAlt/[0.07] shadow-floating focus:outline-none motion-safe:animate-drawer-in"
              // The home indicator on a notched phone sits over the last row.
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-center justify-between gap-2 pe-2">
                <div className="min-w-0 flex-1">
                  <SidebarBrand onNavigate={() => setOpen(false)} />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hoverBg hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 pb-2 pt-5">
                <span className="text-[11px] font-medium text-muted">{t('navManage')}</span>
              </div>

              <SidebarNav onNavigate={() => setOpen(false)} dense={false} />

              {/* The header has no room for these on a phone, so they live
                  here. Both stay reachable in one tap from any page. */}
              <div className="mt-5 border-t border-border px-5 pb-1 pt-4">
                <span className="text-[11px] font-medium text-muted">{t('preferences')}</span>
                <div className="mt-2.5 flex items-center gap-2">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>

              <SidebarFooter />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
