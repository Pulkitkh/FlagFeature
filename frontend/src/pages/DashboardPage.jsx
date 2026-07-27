import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Flag,
  Layers,
  Percent,
  PlusCircle,
  RefreshCw,
  ToggleLeft,
  Trash2,
  Users,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import ActivityChart from '../components/charts/ActivityChart'
import BreakdownChart from '../components/charts/BreakdownChart'
import { api } from '../api/client'
import { useEnvironment } from '../context/EnvironmentContext'
import { environmentDot } from '../components/EnvironmentSwitcher'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Meter,
  PageHeader,
  StatCard,
} from '../components/ui'

// Short enough to sit on one line in the narrow dashboard column.
const RULE_LABELS = {
  user_targeting: 'User IDs',
  group_targeting: 'Groups',
  percentage_rollout: 'Rollout %',
  environment_override: 'Override',
}

// Full class names — Tailwind can't see through an interpolated `text-${tone}`.
const ACTION_META = {
  created: { icon: PlusCircle, className: 'text-good' },
  updated: { icon: RefreshCw, className: 'text-accent' },
  toggled: { icon: ToggleLeft, className: 'text-warn' },
  deleted: { icon: Trash2, className: 'text-bad' },
}

function relativeTime(dateStr) {
  const diffMin = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`
  return `${Math.round(diffMin / 1440)}d ago`
}

export default function DashboardPage() {
  const { selected, environments, error: envError } = useEnvironment()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .getOverview(selected?.key)
      .then((data) => {
        setOverview(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selected?.key])

  useEffect(() => {
    load()
  }, [load])

  const totals = overview?.totals
  const changesToday = overview?.activity?.at(-1)?.changes ?? 0
  const activeRules = overview
    ? Object.values(overview.rule_mix).reduce((sum, count) => sum + count, 0)
    : 0

  const ruleMixData = overview
    ? Object.entries(overview.rule_mix).map(([key, value]) => ({
        label: RULE_LABELS[key] || key,
        value,
      }))
    : []

  const coverageData =
    overview?.environment_coverage.map((env) => ({
      label: env.name,
      value: env.targeted_flags + env.overridden_flags,
    })) ?? []

  return (
    <AppLayout title="Dashboard" breadcrumb="FlagForge">
      <PageHeader
        eyebrow="Overview"
        title="Release control room"
        description="Everything currently shaping what your users see — flags in flight, targeting rules in force, and every configuration change of the last two weeks."
        action={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
            <ButtonLink to="/flags" iconRight={ArrowRight}>
              Manage flags
            </ButtonLink>
          </>
        }
      />

      {(error || envError) && (
        <Card className="mb-6 border-bad/25 bg-badSoft">
          <p className="text-sm text-bad">{error || envError}</p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Feature flags"
          value={totals?.flags ?? '—'}
          hint={totals ? `${totals.enabled} enabled · ${totals.disabled} off` : ' '}
          icon={Flag}
          tone="accent"
          loading={loading}
        />
        <StatCard
          label="Environments"
          value={totals?.environments ?? '—'}
          hint="Each with independent overrides"
          icon={Layers}
          tone="good"
          loading={loading}
        />
        <StatCard
          label="Active rules"
          value={activeRules}
          hint={`Targeting + overrides in ${selected?.name || 'this environment'}`}
          icon={Percent}
          tone="warn"
          loading={loading}
        />
        <StatCard
          label="Changes today"
          value={changesToday}
          hint={totals ? `${totals.groups} groups · ${totals.members} members` : ' '}
          icon={Activity}
          tone="neutral"
          loading={loading}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* flex-col + flex-1 lets the chart grow into the row's height instead
            of leaving dead space under a fixed-height plot. */}
        <Card padded={false} className="flex flex-col xl:col-span-2">
          <CardHeader
            icon={Activity}
            title="Configuration activity"
            description="Flag, rule and override changes over the last 14 days"
            action={
              <Badge tone="accent">
                {overview?.activity?.reduce((sum, point) => sum + point.changes, 0) ?? 0} total
              </Badge>
            }
          />
          <div className="flex min-h-[260px] flex-1 flex-col p-5">
            {loading ? (
              <div className="flex-1 animate-pulse rounded-lg bg-surfaceMuted" />
            ) : (
              <ActivityChart data={overview?.activity ?? []} height="100%" />
            )}
          </div>
        </Card>

        <Card padded={false}>
          <CardHeader
            icon={Flag}
            title="Flag health"
            description="Global switches, across all environments"
          />
          <div className="space-y-5 p-5">
            {loading || !totals ? (
              <div className="h-[220px] animate-pulse rounded-lg bg-surfaceMuted" />
            ) : (
              <>
                <Meter
                  label="Enabled globally"
                  value={totals.enabled}
                  total={totals.flags}
                  tone="good"
                  caption={
                    totals.flags
                      ? `${Math.round((totals.enabled / totals.flags) * 100)}% of your flags are live`
                      : 'No flags yet'
                  }
                />
                <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
                  {Object.entries(overview.by_type).map(([type, count]) => (
                    <div key={type} className="min-w-0">
                      <p className="truncate text-2xs font-semibold uppercase tracking-label text-muted">
                        {type}
                      </p>
                      <p className="mt-1 font-display text-xl font-semibold text-ink">{count}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-2xs font-semibold uppercase tracking-label text-muted">
                    Rules in {selected?.name || 'this environment'}
                  </p>
                  <BreakdownChart
                    data={ruleMixData}
                    height={152}
                    labelWidth={76}
                    valueLabel="Rules"
                    emptyHint="No targeting rules configured here yet."
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <CardHeader
            icon={Layers}
            title="Environment coverage"
            description="Flags carrying a targeting rule or override, per environment"
            action={
              <ButtonLink to="/environments" size="sm" variant="ghost" iconRight={ArrowRight}>
                Environments
              </ButtonLink>
            }
          />
          <div className="p-5">
            {loading ? (
              <div className="h-[200px] animate-pulse rounded-lg bg-surfaceMuted" />
            ) : (
              <>
                <BreakdownChart
                  data={coverageData}
                  height={Math.max(140, coverageData.length * 46)}
                  valueLabel="Configured flags"
                  emptyHint="No environment-specific configuration yet."
                />
                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {overview?.environment_coverage.map((env) => (
                    <div
                      key={env.key}
                      className="rounded-lg border border-border bg-surfaceMuted px-3.5 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`signal-dot ${environmentDot(env.key)}`} aria-hidden="true" />
                        <span className="truncate text-sm font-semibold text-ink">{env.name}</span>
                      </div>
                      <dl className="mt-2 space-y-1 text-xs text-muted">
                        <div className="flex items-center justify-between gap-2">
                          <dt>Targeted</dt>
                          <dd className="font-mono text-ink">{env.targeted_flags}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt>Overridden</dt>
                          <dd className="font-mono text-ink">{env.overridden_flags}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt>Avg rollout</dt>
                          <dd className="font-mono text-ink">
                            {env.avg_rollout === null ? '—' : `${env.avg_rollout}%`}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card padded={false}>
          <CardHeader
            icon={Activity}
            title="Recent changes"
            action={
              <ButtonLink to="/audit-log" size="sm" variant="ghost" iconRight={ArrowRight}>
                All
              </ButtonLink>
            }
          />
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-surfaceMuted" />
              ))}
            </div>
          ) : overview?.recent_activity?.length ? (
            <ul className="divide-y divide-border">
              {overview.recent_activity.map((entry) => {
                const meta = ACTION_META[entry.action] || { icon: Activity, className: 'text-muted' }
                const Icon = meta.icon
                return (
                  <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted ${meta.className}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        <span className="font-medium">{entry.action}</span>{' '}
                        <span className="font-mono text-xs text-muted">{entry.entity_type}</span>
                      </p>
                      <p className="text-xs text-muted">by {entry.actor}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {relativeTime(entry.timestamp)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title="No activity yet"
                description="Create your first flag and every change will land here."
                action={
                  <ButtonLink to="/flags" size="sm">
                    Create a flag
                  </ButtonLink>
                }
              />
            </div>
          )}
        </Card>
      </div>

      {!loading && environments.length === 0 && (
        <Card className="mt-6 border-dashed">
          <p className="text-sm text-muted">
            No environments found. They are seeded automatically on first load — check that the API
            is reachable.
          </p>
        </Card>
      )}
    </AppLayout>
  )
}
