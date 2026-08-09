import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  Check,
  History,
  LayoutGrid,
  Pencil,
  Percent,
  Play,
  Power,
  PowerOff,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import FlagForm from '../components/FlagForm'
import EvaluationChart from '../components/EvaluationChart'
import DecisionTrace from '../components/DecisionTrace'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { useT } from '../context/LanguageContext'
import { Card, Badge, Button, Section, Field, Input, Textarea, Tabs } from '../components/ui'

const TYPE_LABEL_KEY = { boolean: 'typeBoolean', string: 'typeString', number: 'typeNumber' }

export default function FlagDetailPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { selected: selectedEnv, environments } = useEnvironment()
  const t = useT()

  const [tab, setTab] = useState('overview')
  const [flag, setFlag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [versions, setVersions] = useState([])
  const [matrix, setMatrix] = useState([])
  const [targetingLoading, setTargetingLoading] = useState(false)
  const [targetingSaving, setTargetingSaving] = useState(false)
  const [targetingError, setTargetingError] = useState(null)
  const [targetingRules, setTargetingRules] = useState({
    user_ids: [],
    group_keys: [],
    percentage: null,
  })
  const [availableGroups, setAvailableGroups] = useState([])
  const [userIdInput, setUserIdInput] = useState('')
  const [selectedGroupKeys, setSelectedGroupKeys] = useState([])
  const [extraGroupKeysInput, setExtraGroupKeysInput] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [testUserId, setTestUserId] = useState('')
  const [testGroups, setTestGroups] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .getFlag(key)
      .then((data) => {
        setFlag(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    api.getFlagVersions(key).then(setVersions).catch(() => setVersions([]))
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!flag || !selectedEnv) return
    setEvalLoading(true)
    api
      .evaluateFlag({ flag_key: flag.key, environment_key: selectedEnv.key })
      .then(setEvalResult)
      .catch(() => setEvalResult(null))
      .finally(() => setEvalLoading(false))
  }, [flag, selectedEnv])

  // How the flag lands in every environment at once — the question people
  // actually open this page to answer.
  useEffect(() => {
    if (!flag || environments.length === 0) return
    let cancelled = false

    Promise.all(
      environments.map((env) =>
        api
          .evaluateFlag({ flag_key: flag.key, environment_key: env.key })
          .then((result) => ({ env, result }))
          .catch(() => ({ env, result: null }))
      )
    ).then((rows) => !cancelled && setMatrix(rows))

    return () => {
      cancelled = true
    }
  }, [flag, environments])

  useEffect(() => {
    if (!flag || !selectedEnv) return
    setTargetingLoading(true)
    Promise.all([
      api.getTargetingRules(flag.key, selectedEnv.key),
      api.listEnvironmentGroups(selectedEnv.key),
    ])
      .then(([rules, groups]) => {
        const mergedGroups = Array.from(
          new Set([...(groups || []), ...(rules.group_keys || [])])
        ).sort()
        setAvailableGroups(mergedGroups)
        setTargetingRules(rules)
        setUserIdInput((rules.user_ids || []).join(', '))
        setSelectedGroupKeys((rules.group_keys || []).filter((g) => mergedGroups.includes(g)))
        setExtraGroupKeysInput(
          (rules.group_keys || []).filter((g) => !mergedGroups.includes(g)).join(', ')
        )
        setPercentage(rules.percentage ?? 0)
        setTargetingError(null)
      })
      .catch((err) => {
        if (isNotFoundError(err)) {
          setAvailableGroups([])
          setTargetingRules({ user_ids: [], group_keys: [], percentage: null })
          setUserIdInput('')
          setSelectedGroupKeys([])
          setExtraGroupKeysInput('')
          setPercentage(0)
          setTargetingError(null)
          return
        }
        setTargetingError(err.message)
      })
      .finally(() => setTargetingLoading(false))
  }, [flag, selectedEnv])

  useEffect(() => {
    if (!flag || !selectedEnv) return
    const timer = setTimeout(() => runTestEvaluation(), 250)
    return () => clearTimeout(timer)
  }, [flag, selectedEnv, testUserId, testGroups])

  async function handleUpdate(payload) {
    setSubmitting(true)
    setEditError(null)
    try {
      await api.updateFlag(key, payload)
      setShowEdit(false)
      load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t('deleteFlagConfirm', { key }))) return
    await api.deleteFlag(key)
    navigate('/flags')
  }

  async function handleToggleForEnvironment(nextEnabled) {
    if (!selectedEnv) return
    await api.setEnvironmentOverride(key, selectedEnv.key, { enabled: nextEnabled })
    const result = await api.evaluateFlag({ flag_key: key, environment_key: selectedEnv.key })
    setEvalResult(result)
    runTestEvaluation()
  }

  async function handleSaveTargeting() {
    if (!selectedEnv) return
    setTargetingSaving(true)
    setTargetingError(null)
    try {
      const mergedGroupKeys = Array.from(
        new Set([...selectedGroupKeys, ...parseList(extraGroupKeysInput)])
      )
      const rules = await api.setTargetingRules(flag.key, selectedEnv.key, {
        user_ids: parseList(userIdInput),
        group_keys: mergedGroupKeys,
        percentage: Number.isFinite(Number(percentage)) ? Number(percentage) : null,
      })
      setTargetingRules(rules)
      setUserIdInput((rules.user_ids || []).join(', '))
      setSelectedGroupKeys(rules.group_keys || [])
      setExtraGroupKeysInput('')
      setPercentage(rules.percentage ?? 0)

      const refreshed = await api.evaluateFlag({
        flag_key: flag.key,
        environment_key: selectedEnv.key,
        user_context: buildTestContext(),
      })
      setEvalResult(refreshed)
      setTestResult(refreshed)
    } catch (err) {
      setTargetingError(err.message)
    } finally {
      setTargetingSaving(false)
    }
  }

  async function runTestEvaluation() {
    if (!flag || !selectedEnv) return
    setTestLoading(true)
    setTestError(null)
    try {
      const result = await api.evaluateFlag({
        flag_key: flag.key,
        environment_key: selectedEnv.key,
        user_context: buildTestContext(),
      })
      setTestResult(result)
    } catch (err) {
      setTestResult(null)
      setTestError(err.message)
    } finally {
      setTestLoading(false)
    }
  }

  function buildTestContext() {
    const context = {}
    if (testUserId.trim()) context.user_id = testUserId.trim()
    const groups = parseList(testGroups)
    if (groups.length) context.groups = groups
    return context
  }

  function toggleGroup(group) {
    setSelectedGroupKeys((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group]
    )
  }

  const hasTargeting =
    targetingRules.user_ids.length ||
    targetingRules.group_keys.length ||
    targetingRules.percentage !== null

  const tabs = useMemo(
    () => [
      { id: 'overview', label: t('tabOverview'), icon: LayoutGrid },
      { id: 'targeting', label: t('tabTargeting'), icon: Target },
      { id: 'analytics', label: t('tabAnalytics'), icon: BarChart3 },
      { id: 'history', label: t('tabHistory'), icon: History, count: versions.length },
    ],
    [t, versions.length]
  )

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title={t('flagDetails')} breadcrumb="FlagForge" />
        <div className="p-6 text-sm text-muted">{t('loading')}</div>
      </div>
    )
  }

  if (error || !flag) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title={t('flagDetails')} breadcrumb="FlagForge" />
        <div className="p-6">
          <Card className="border-bad/25 bg-badSoft text-sm text-bad">
            {error || t('flagNotFound')}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title={flag.key} breadcrumb={t('navFlags')} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <button
            onClick={() => navigate('/flags')}
            className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="rtl-flip h-3 w-3" />
            {t('backToFlags')}
          </button>

          {/* ── Identity band ─────────────────────────────────────────── */}
          <div className="animate-rise-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate font-mono text-[22px] font-semibold tracking-tight text-ink">
                    {flag.key}
                  </h1>
                  <Badge tone={flag.enabled ? 'good' : 'neutral'} dot live={flag.enabled}>
                    {flag.enabled ? t('enabled') : t('disabled')}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {flag.description || t('noDescription')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
                  {t('edit')}
                </Button>
                <Button variant="danger" icon={Trash2} onClick={handleDelete}>
                  {t('delete')}
                </Button>
              </div>
            </div>

            {/* Metadata as one monospace strip: it is all API-side truth, so it
                reads as a readout rather than as six labelled cards. */}
            <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 text-[12px]">
              <Meta label={t('fieldType')}>
                {TYPE_LABEL_KEY[flag.type] ? t(TYPE_LABEL_KEY[flag.type]) : flag.type}
              </Meta>
              <Meta label={t('defaultValue')}>{JSON.stringify(flag.default_value)}</Meta>
              <Meta label={t('ownerTeam')}>{flag.owner_team || '—'}</Meta>
              <Meta label={t('createdAt')}>{new Date(flag.created_at).toLocaleDateString()}</Meta>
              <Meta label={t('updatedAt')}>{new Date(flag.updated_at).toLocaleString()}</Meta>
            </dl>
          </div>

          <Tabs tabs={tabs} active={tab} onChange={setTab} className="mt-6" />

          {/* ── Overview ──────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Section title={t('decisionTrace')} description={t('decisionTraceHint')}>
                <Card padded={false}>
                  {/* The inputs sit above the trace so changing the user
                      re-lights the ladder in place — that pairing is the whole
                      point of the panel. */}
                  <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
                    <Field label={t('testUserId')}>
                      <Input
                        mono
                        value={testUserId}
                        onChange={(e) => setTestUserId(e.target.value)}
                        placeholder="alice@example.com"
                      />
                    </Field>
                    <Field label={t('testGroups')} hint={t('testGroupsHint')}>
                      <Input
                        mono
                        value={testGroups}
                        onChange={(e) => setTestGroups(e.target.value)}
                        placeholder="beta_users, premium_plan"
                      />
                    </Field>
                  </div>

                  <div className="p-4">
                    <DecisionTrace result={testResult} loading={testLoading && !testResult} />

                    {testError && <p className="mt-3 text-sm text-bad">{testError}</p>}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      {testResult ? (
                        <p className="flex items-baseline gap-2.5">
                          <span className="text-[11px] font-medium text-muted">
                            {t('traceResult')}
                          </span>
                          <span className="font-mono text-lg font-semibold text-accent">
                            {JSON.stringify(testResult.value)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted">{t('noEvaluationYet')}</p>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Play}
                        onClick={runTestEvaluation}
                        loading={testLoading}
                      >
                        {t('runEvaluation')}
                      </Button>
                    </div>
                  </div>
                </Card>
              </Section>

              <div>
                <Section
                  title={t('resolvedIn', {
                    environment: selectedEnv?.name || t('environmentFallback'),
                  })}
                >
                  <Card>
                    {evalLoading ? (
                      <div className="h-14 animate-pulse rounded-lg bg-hoverBg" />
                    ) : evalResult ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-2xl font-semibold text-accent">
                            {JSON.stringify(evalResult.value)}
                          </p>
                          <Badge
                            tone={evalResult.cached ? 'warn' : 'good'}
                            dot
                            live={!evalResult.cached}
                          >
                            {evalResult.cached ? t('cachedState') : t('liveState')}
                          </Badge>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted">
                          {t('reasonPrefix', { reason: evalResult.reason })}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted">{t('couldNotEvaluate')}</p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        icon={Power}
                        onClick={() => handleToggleForEnvironment(true)}
                      >
                        {t('turnOnHere')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={PowerOff}
                        onClick={() => handleToggleForEnvironment(false)}
                      >
                        {t('turnOffHere')}
                      </Button>
                    </div>
                    <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
                      {t('overrideHint')}
                    </p>
                  </Card>
                </Section>

                <Section title={t('envMatrix')} description={t('envMatrixHint')}>
                  <Card padded={false}>
                    <ul className="divide-y divide-border">
                      {matrix.map(({ env, result }) => (
                        <li
                          key={env.key}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className={`signal-dot ${
                                result?.value ? 'signal-dot--live bg-good' : 'bg-muted'
                              }`}
                            />
                            <span className="truncate text-[13px] font-medium text-ink">
                              {env.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] font-semibold text-accent">
                            {result ? JSON.stringify(result.value) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </Section>
              </div>
            </div>
          )}

          {/* ── Targeting ─────────────────────────────────────────────── */}
          {tab === 'targeting' && (
            <div className="mt-7">
              <Section
                title={t('targetingPanel')}
                description={t('targetingApplyTo', {
                  environment: selectedEnv?.name || t('selectedEnvironmentFallback'),
                })}
                action={
                  <Badge tone={hasTargeting ? 'accent' : 'neutral'}>
                    {hasTargeting ? t('targetingConfigured') : t('targetingNone')}
                  </Badge>
                }
              >
                {targetingLoading ? (
                  <div className="h-64 animate-pulse rounded-xl bg-hoverBg" />
                ) : (
                  <div className="space-y-4">
                    <Card tone="inset">
                      <p className="text-[11px] font-medium text-muted">
                        {t('prioritySummary')}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink">
                        {t('priorityOrder')}
                      </p>
                    </Card>

                    {targetingError && (
                      <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
                        {targetingError}
                      </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <RulePanel
                        icon={Check}
                        title={t('userWhitelist')}
                        hint={t('userWhitelistHint')}
                      >
                        <Textarea
                          mono
                          rows={3}
                          value={userIdInput}
                          onChange={(e) => setUserIdInput(e.target.value)}
                          placeholder="alice@example.com, bob@example.com"
                        />
                        <p className="mb-1.5 mt-3 text-[11px] font-medium text-muted">
                          {t('appliesTo')}
                        </p>
                        {parseList(userIdInput).length === 0 ? (
                          <p className="text-sm text-muted">{t('noUserIdsYet')}</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {parseList(userIdInput).map((userId) => (
                              <Chip
                                key={userId}
                                onRemove={() =>
                                  setUserIdInput(
                                    parseList(userIdInput)
                                      .filter((id) => id !== userId)
                                      .join(', ')
                                  )
                                }
                                title={t('clickToRemove')}
                              >
                                {userId}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </RulePanel>

                      <RulePanel
                        icon={Users}
                        title={t('groupTargeting')}
                        hint={t('groupTargetingHint')}
                      >
                        {availableGroups.length === 0 ? (
                          <p className="text-sm text-muted">
                            {t('noGroupsSeeded', { link: t('groupsTitle') })}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {availableGroups.map((group) => {
                              const isSelected = selectedGroupKeys.includes(group)
                              return (
                                <button
                                  key={group}
                                  type="button"
                                  onClick={() => toggleGroup(group)}
                                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                                    isSelected
                                      ? 'border-accentDark bg-accent text-bg'
                                      : 'border-border bg-surface text-muted hover:border-borderStrong hover:text-ink'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                  {group}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        <p className="mb-1.5 mt-3 text-[11px] font-medium text-muted">
                          {t('extraGroupKeys')}
                        </p>
                        <Input
                          mono
                          value={extraGroupKeysInput}
                          onChange={(e) => setExtraGroupKeysInput(e.target.value)}
                          placeholder="beta_users, internal_team"
                        />
                        {parseList(extraGroupKeysInput).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {parseList(extraGroupKeysInput).map((group) => (
                              <Chip
                                key={group}
                                tone="good"
                                onRemove={() =>
                                  setExtraGroupKeysInput(
                                    parseList(extraGroupKeysInput)
                                      .filter((g) => g !== group)
                                      .join(', ')
                                  )
                                }
                                title={t('clickToRemove')}
                              >
                                {group}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </RulePanel>
                    </div>

                    <RulePanel
                      icon={Percent}
                      title={t('percentageRollout')}
                      hint={t('percentageHint')}
                      action={
                        <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-sm font-semibold text-ink tnum">
                          {Math.round(Number(percentage) || 0)}%
                        </span>
                      }
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={percentage}
                        onChange={(e) => setPercentage(Number(e.target.value))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
                      />
                      {/* Preset stops: the percentages a rollout actually steps
                          through, so the common path is one click not a drag. */}
                      <div className="mt-2 flex items-center justify-between">
                        {[0, 1, 5, 10, 25, 50, 100].map((stop) => (
                          <button
                            key={stop}
                            type="button"
                            onClick={() => setPercentage(stop)}
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] tnum transition-colors ${
                              Math.round(Number(percentage) || 0) === stop
                                ? 'bg-accent text-bg'
                                : 'text-muted hover:bg-surface hover:text-ink'
                            }`}
                          >
                            {stop}%
                          </button>
                        ))}
                      </div>
                    </RulePanel>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                      <p className="text-[11px] text-muted">{t('cacheInvalidateHint')}</p>
                      <Button
                        onClick={handleSaveTargeting}
                        loading={targetingSaving}
                        icon={Sparkles}
                      >
                        {t('saveTargetingRules')}
                      </Button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ── Analytics ─────────────────────────────────────────────── */}
          {tab === 'analytics' && (
            <div className="mt-7">
              <Section
                title={t('evaluationAnalytics')}
                description={t('evaluationAnalyticsHint')}
              >
                <EvaluationChart
                  flagKey={flag.key}
                  environmentKey={selectedEnv?.key}
                  environmentName={selectedEnv?.name}
                />
              </Section>
            </div>
          )}

          {/* ── History ───────────────────────────────────────────────── */}
          {tab === 'history' && (
            <div className="mt-7">
              <Section title={t('history')} description={t('historyHint')}>
                <Card padded={false}>
                  {versions.length === 0 ? (
                    <p className="p-4 text-sm text-muted">{t('noHistoryYet')}</p>
                  ) : (
                    <ol className="relative">
                      {versions.map((v, index) => (
                        <li key={v.id} className="relative flex gap-4 px-4 py-3.5">
                          {/* A spine down the left, so the list reads as a
                              sequence of releases rather than as rows. */}
                          <span className="relative flex flex-col items-center">
                            <span className="z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-[9px] font-semibold text-muted tnum">
                              {v.version_number}
                            </span>
                            {index < versions.length - 1 && (
                              <span className="absolute top-6 h-full w-px bg-border" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1 pb-1">
                            <p className="text-[13px] text-ink">
                              {v.change_note || t('versionUpdated')}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted">
                              {t('versionBy', {
                                date: new Date(v.created_at).toLocaleString(),
                                actor: v.created_by,
                              })}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </Section>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <FlagForm
          initialFlag={flag}
          onSubmit={handleUpdate}
          onCancel={() => {
            setShowEdit(false)
            setEditError(null)
          }}
          submitting={submitting}
          error={editError}
        />
      )}
    </div>
  )
}

function Meta({ label, children }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono font-medium text-ink">{children}</dd>
    </div>
  )
}

function RulePanel({ icon: Icon, title, hint, action, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surfaceMuted text-ink">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{hint}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Chip({ children, onRemove, tone = 'accent', title }) {
  const tones = {
    accent: 'border-accent/30 bg-accentSoft text-accentDark',
    good: 'border-good/30 bg-goodSoft text-good',
  }
  return (
    <button
      type="button"
      onClick={onRemove}
      title={title}
      className={`group inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors hover:border-bad/40 hover:bg-badSoft hover:text-bad ${tones[tone]}`}
    >
      {children}
      <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
    </button>
  )
}

function isNotFoundError(err) {
  return /not found/i.test(err?.message || '')
}

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
