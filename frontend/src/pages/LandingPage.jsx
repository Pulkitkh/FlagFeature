import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Flag,
  Layers,
  LogIn,
  Percent,
  PowerOff,
  ScrollText,
  Terminal,
} from 'lucide-react'
import { API_BASE_URL } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeToggle from '../components/ThemeToggle'

const FEATURES = [
  { icon: Percent, titleKey: 'f1Title', copyKey: 'f1Copy' },
  { icon: Layers, titleKey: 'f2Title', copyKey: 'f2Copy' },
  { icon: ScrollText, titleKey: 'f3Title', copyKey: 'f3Copy' },
  { icon: PowerOff, titleKey: 'f4Title', copyKey: 'f4Copy' },
]

// A small, honest snapshot of what the evaluation API actually returns —
// copied from a real /evaluate response rather than invented for the page.
const SAMPLE_RESPONSE = `POST /evaluate
{
  "flag_key": "new-checkout",
  "user_id": "u-2841",
  "environment": "production"
}

200 OK
{
  "value": true,
  "reason": "percentage_rollout",
  "cached": true
}`

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const t = useT()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-white">
              <Flag className="h-4 w-4" strokeWidth={2.25} />
              <span className="signal-dot signal-dot--live absolute -end-0.5 -top-0.5 bg-accent ring-2 ring-surface" />
            </span>
            <span>
              <span className="block font-display text-[15px] font-semibold leading-tight tracking-tight text-ink">
                FlagForge
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {t('tagline')}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              to={isAuthenticated ? '/flags' : '/login'}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-accentDark bg-accent px-4 text-sm font-semibold text-white shadow-hairline transition-colors hover:bg-accentDark"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isAuthenticated ? t('openConsole') : t('signIn')}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-6">
        {/* ---- Hero ---- */}
        <section className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-rise-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              <span className="signal-dot signal-dot--live bg-good" />
              {t('heroEyebrow')}
            </span>

            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
              {t('heroTitle')}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              {t('heroSubtitle')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? '/flags' : '/login'}
                className="inline-flex items-center gap-2 rounded-lg border border-accentDark bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-accentDark"
              >
                {isAuthenticated ? t('openConsole') : t('getStarted')}
                <ArrowRight className="rtl-flip h-4 w-4" />
              </Link>
              {/* FastAPI's own Swagger UI, on the backend rather than here. */}
              <a
                href={`${API_BASE_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-hairline transition-colors hover:border-borderStrong hover:bg-surfaceMuted"
              >
                <Terminal className="h-4 w-4 text-muted" />
                API reference
              </a>
            </div>
          </div>

          {/* The product's actual contract, shown rather than described. */}
          <div className="animate-rise-in overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center gap-2 border-b border-border bg-surfaceMuted px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-good/60" />
              <span className="ms-2 font-mono text-[11px] text-muted">evaluate.http</span>
            </div>
            <pre
              dir="ltr"
              className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-ink"
            >
              {SAMPLE_RESPONSE}
            </pre>
          </div>
        </section>

        {/* ---- Features ---- */}
        <section className="border-t border-border py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {t('featuresTitle')}
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, titleKey, copyKey }) => (
              <div
                key={titleKey}
                className="rounded-xl border border-border bg-surface p-5 shadow-hairline transition-shadow hover:shadow-card"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink">{t(titleKey)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(copyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Closing call to action ---- */}
        <section className="border-t border-border py-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-border bg-surface p-8 shadow-hairline sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
                {t('loginTitle')}
              </h2>
              <p className="mt-1.5 text-sm text-muted">{t('loginSubtitle')}</p>
            </div>
            <Link
              to={isAuthenticated ? '/flags' : '/login'}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-accentDark bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-hairline transition-colors hover:bg-accentDark"
            >
              {isAuthenticated ? t('openConsole') : t('signIn')}
              <ArrowRight className="rtl-flip h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>FlagForge — FastAPI, PostgreSQL, and Redis behind a React console.</p>
          <p className="font-mono">
            Evaluation on <span className="text-accentDark">POST /evaluate</span>, cached in Redis.
          </p>
        </div>
      </footer>
    </div>
  )
}
