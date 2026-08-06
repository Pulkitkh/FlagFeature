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

// A real /evaluate exchange rather than invented marketing copy — the contract
// is the product, so showing it is more honest than describing it.
const SAMPLE_REQUEST = `POST /evaluate
{
  "flag_key": "new-checkout",
  "user_id": "u-2841",
  "environment": "production"
}`

const SAMPLE_RESPONSE = `200 OK
{
  "value": true,
  "reason": "percentage_rollout",
  "cached": true
}`

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const t = useT()
  const enter = isAuthenticated ? '/flags' : '/login'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-surface">
              <Flag className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="signal-dot signal-dot--live absolute -end-1 -top-1 bg-accent ring-2 ring-bg" />
            </span>
            <span>
              <span className="block font-display text-[15px] font-semibold leading-none tracking-[-0.02em] text-ink">
                FlagForge
              </span>
              <span className="mt-1 block text-[11px] font-medium text-muted">
                {t('tagline')}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              to={enter}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink bg-ink px-4 text-[13px] font-semibold tracking-tight text-surface transition-colors hover:bg-ink/90"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isAuthenticated ? t('openConsole') : t('signIn')}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-6">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="grid items-center gap-14 py-20 lg:grid-cols-[minmax(0,1fr)_460px] lg:py-28">
          <div className="animate-rise-in">
            <p className="flex items-center gap-2.5 text-[11px] font-medium text-muted">
              <span className="signal-dot signal-dot--live bg-good" />
              {t('heroEyebrow')}
            </p>

            <h1 className="mt-6 max-w-2xl font-display text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-ink">
              {t('heroTitle')}
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
              {t('heroSubtitle')}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to={enter}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink bg-ink px-6 text-sm font-semibold tracking-tight text-surface transition-all hover:bg-ink/90 active:translate-y-px"
              >
                {isAuthenticated ? t('openConsole') : t('getStarted')}
                <ArrowRight className="rtl-flip h-4 w-4" />
              </Link>
              {/* FastAPI's own Swagger UI, on the backend rather than here. */}
              <a
                href={`${API_BASE_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-5 text-sm font-semibold tracking-tight text-ink transition-colors hover:border-borderStrong hover:bg-surfaceMuted"
              >
                <Terminal className="h-4 w-4 text-muted" />
                {t('apiReference')}
              </a>
            </div>
          </div>

          {/* Request above, response below: the exchange reads top to bottom
              the way it happens, and the divider is the round trip. */}
          <div className="animate-rise-in overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border bg-surfaceMuted px-4 py-2">
              <span className="text-[11px] font-medium text-muted">
                evaluate.http
              </span>
              <span className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-borderStrong" />
                <span className="h-2 w-2 rounded-full bg-borderStrong" />
                <span className="h-2 w-2 rounded-full bg-good" />
              </span>
            </div>
            <pre dir="ltr" className="overflow-x-auto px-5 py-4 font-mono text-[12px] leading-relaxed text-ink">
              {SAMPLE_REQUEST}
            </pre>
            <div className="flex items-center gap-3 border-y border-border bg-surfaceMuted px-5 py-1.5">
              <span className="h-px flex-1 bg-border" />
              <ArrowRight className="h-3 w-3 rotate-90 text-muted" />
              <span className="h-px flex-1 bg-border" />
            </div>
            <pre dir="ltr" className="overflow-x-auto px-5 py-4 font-mono text-[12px] leading-relaxed text-ink">
              {SAMPLE_RESPONSE}
            </pre>
          </div>
        </section>

        {/* ── Capabilities ─────────────────────────────────────────── */}
        <section className="border-t border-border py-20">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
              {t('featuresTitle')}
            </h2>
          </div>

          {/* Hairline-divided cells rather than four floating cards: it reads
              as one specification sheet, which is what it is. */}
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, titleKey, copyKey }, index) => (
              <div
                key={titleKey}
                className="group bg-surface p-6 transition-colors hover:bg-surfaceMuted"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4.5 w-4.5 text-ink" />
                  <span className="text-[11px] font-medium text-muted tnum">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-[15px] font-semibold tracking-tight text-ink">
                  {t(titleKey)}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{t(copyKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Closing ──────────────────────────────────────────────── */}
        <section className="border-t border-border py-20">
          <div className="flex flex-col items-start justify-between gap-8 rounded-xl border border-border bg-surface p-9 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
                {t('loginTitle')}
              </h2>
              <p className="mt-2 text-sm text-muted">{t('loginSubtitle')}</p>
            </div>
            <Link
              to={enter}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-ink bg-ink px-6 text-sm font-semibold tracking-tight text-surface transition-all hover:bg-ink/90 active:translate-y-px"
            >
              {isAuthenticated ? t('openConsole') : t('signIn')}
              <ArrowRight className="rtl-flip h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 font-mono text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footerStack')}</p>
          <p>{t('footerEval')}</p>
        </div>
      </footer>
    </div>
  )
}
