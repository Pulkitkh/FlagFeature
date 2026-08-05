import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Flag,
  Layers,
  LogIn,
  Percent,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import { api } from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeToggle from '../components/ThemeToggle'
import { Button, Card, Field, Input } from '../components/ui'

const HIGHLIGHTS = [
  { icon: Percent, titleKey: 'f1Title', copyKey: 'f1Copy' },
  { icon: Layers, titleKey: 'f2Title', copyKey: 'f2Copy' },
  { icon: ShieldCheck, titleKey: 'f3Title', copyKey: 'f3Copy' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, isAuthenticated } = useAuth()
  const t = useT()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [apiReachable, setApiReachable] = useState(null)

  // Send an already-signed-in user where they were headed.
  const destination = location.state?.from?.pathname || '/flags'
  useEffect(() => {
    if (isAuthenticated) navigate(destination, { replace: true })
  }, [isAuthenticated, destination, navigate])

  // Distinguishes "wrong password" from "the backend isn't running", which is
  // the more likely problem on a fresh checkout.
  useEffect(() => {
    api
      .health()
      .then(() => setApiReachable(true))
      .catch(() => setApiReachable(false))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left: the pitch. Hidden on small screens, where the form is all that matters. */}
      <aside className="hidden w-1/2 flex-col justify-between border-e border-border bg-surface p-12 lg:flex">
        <Link to="/" className="flex w-fit items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <Flag className="h-4 w-4" strokeWidth={2.5} />
            <span className="signal-dot signal-dot--live absolute -end-0.5 -top-0.5 bg-good ring-2 ring-surfaceMuted" />
          </span>
          <span>
            <span className="block font-display text-[15px] font-semibold leading-tight text-ink">
              FlagForge
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('tagline')}
            </span>
          </span>
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink">
            {t('heroTitle')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t('heroSubtitle')}</p>

          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, titleKey, copyKey }) => (
              <li key={titleKey} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{t(titleKey)}</span>
                  <span className="block text-xs text-muted">{t(copyKey)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted">
          {t('footerEval')}
        </p>
      </aside>

      {/* Right: the form. */}
      <main className="relative flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        {/* Both preferences are reachable before signing in — someone who can't
            read English needs the language picker on this screen, not inside. */}
        <div className="absolute end-6 top-6 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-ink lg:hidden"
          >
            <ArrowLeft className="rtl-flip h-3.5 w-3.5" />
            {t('backToHome')}
          </Link>

          <div className="mb-8 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
              <Flag className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {t('loginTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{t('loginSubtitle')}</p>

          {apiReachable === false && (
            <Card className="mt-6 border-bad/25 bg-badSoft">
              <p className="flex items-start gap-2 text-sm text-bad">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('loginApiDown')}
                </span>
              </p>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label={t('email')}>
              <Input
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@flagforge.local"
              />
            </Field>

            <Field label={t('password')}>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pe-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:bg-hoverBg hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
                {error}
              </p>
            )}

            <Button type="submit" icon={LogIn} loading={submitting} className="w-full">
              {t('signIn')}
            </Button>
          </form>

          <p className="mt-6 rounded-lg border border-border bg-surfaceMuted px-3.5 py-3 text-xs leading-relaxed text-muted">
            {t('loginFirstRun', { email: 'admin@flagforge.local', password: 'admin12345' })}
          </p>
        </div>
      </main>
    </div>
  )
}
