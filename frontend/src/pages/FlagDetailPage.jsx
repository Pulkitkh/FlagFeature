import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Power, PowerOff, History, Sparkles, Play, Check, X, Users, Percent } from 'lucide-react'
import { api } from '../api/client'
import FlagForm from '../components/FlagForm'
import EvaluationChart from '../components/EvaluationChart'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { useT } from '../context/LanguageContext'
import { Card, Badge, Button, Section, Field, Input, Textarea } from '../components/ui'

export default function FlagDetailPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { selected: selectedEnv } = useEnvironment()
  const t = useT()

  const [flag, setFlag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [versions, setVersions] = useState([])
  const [targetingLoading, setTargetingLoading] = useState(false)
  const [targetingSaving, setTargetingSaving] = useState(false)
  const [targetingError, setTargetingError] = useState(null)
  const [targetingRules, setTargetingRules] = useState({ user_ids: [], group_keys: [], percentage: null })
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

    api
      .getFlagVersions(key)
      .then(setVersions)
      .catch(() => setVersions([]))
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

  useEffect(() => {
    if (!flag || !selectedEnv) return
    setTargetingLoading(true)
    Promise.all([
      api.getTargetingRules(flag.key, selectedEnv.key),
      api.listEnvironmentGroups(selectedEnv.key),
    ])
      .then(([rules, groups]) => {
        const mergedGroups = Array.from(new Set([...(groups || []), ...(rules.group_keys || [])])).sort()
        setAvailableGroups(mergedGroups)
        setTargetingRules(rules)
        setUserIdInput((rules.user_ids || []).join(', '))
        setSelectedGroupKeys((rules.group_keys || []).filter((group) => mergedGroups.includes(group)))
        setExtraGroupKeysInput((rules.group_keys || []).filter((group) => !mergedGroups.includes(group)).join(', '))
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

    const timer = setTimeout(() => {
      runTestEvaluation()
    }, 250)

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
  }

  async function handleSaveTargeting() {
    if (!selectedEnv) return
    setTargetingSaving(true)
    setTargetingError(null)
    try {
      const mergedGroupKeys = Array.from(
        new Set([...selectedGroupKeys, ...parseList(extraGroupKeysInput)])
      )
      const payload = {
        user_ids: parseList(userIdInput),
        group_keys: mergedGroupKeys,
        percentage: Number.isFinite(Number(percentage)) ? Number(percentage) : null,
      }
      const rules = await api.setTargetingRules(flag.key, selectedEnv.key, payload)
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

  function removeUserId(userId) {
    setUserIdInput(parseList(userIdInput).filter((id) => id !== userId).join(', '))
  }

  function removeExtraGroup(group) {
    setExtraGroupKeysInput(parseList(extraGroupKeysInput).filter((g) => g !== group).join(', '))
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title={t('flagDetails')} breadcrumb="FlagForge / Flags" />
        <div className="p-6 text-sm text-muted">{t('loading')}</div>
      </div>
    )
  }

  if (error || !flag) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title={t('flagDetails')} breadcrumb="FlagForge / Flags" />
        <div className="p-6">
          <Card className="border-bad/20 bg-badSoft text-sm text-bad">
            {error || t('flagNotFound')}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title={flag.key} breadcrumb={`FlagForge / Flags / ${flag.key}`} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <button
            onClick={() => navigate('/flags')}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="rtl-flip h-3.5 w-3.5" />
            {t('backToFlags')}
          </button>

          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl font-semibold text-ink">{flag.key}</h1>
                <Badge tone={flag.enabled ? 'good' : 'neutral'} dot live={flag.enabled}>
                  {flag.enabled ? t('enabled') : t('disabled')}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{flag.description || t('noDescription')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
                {t('edit')}
              </Button>
              <Button variant="danger" icon={Trash2} onClick={handleDelete}>
                {t('delete')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* General information */}
            <Section title={t('generalInformation')} className="lg:col-span-2 mb-0">
              <Card>
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                  <Detail label={t('fieldType')} value={flag.type} mono />
                  <Detail
                    label={t('defaultValue')}
                    value={JSON.stringify(flag.default_value)}
                    mono
                  />
                  <Detail
                    label={t('globalStatus')}
                    value={flag.enabled ? t('enabled') : t('disabled')}
                    tone={flag.enabled ? 'good' : 'bad'}
                  />
                  <Detail label={t('ownerTeam')} value={flag.owner_team || '—'} />
                  <Detail label={t('createdAt')} value={new Date(flag.created_at).toLocaleString()} />
                  <Detail label={t('updatedAt')} value={new Date(flag.updated_at).toLocaleString()} />
                </dl>
              </Card>
            </Section>

            {/* Environment resolution */}
            <Section
              title={t('resolvedIn', {
                environment: selectedEnv?.name || t('environmentFallback'),
              })}
              className="mb-0"
            >
              <Card>
                {evalLoading ? (
                  <div className="h-16 rounded-lg bg-hoverBg animate-pulse" />
                ) : evalResult ? (
                  <div className="rounded-lg border border-border bg-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-lg font-semibold text-accent">
                        {JSON.stringify(evalResult.value)}
                      </p>
                      <Badge tone={evalResult.cached ? 'warn' : 'good'} dot live={!evalResult.cached}>
                        {evalResult.cached ? t('cachedState') : t('liveState')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t('reasonPrefix', { reason: evalResult.reason })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t('couldNotEvaluate')}</p>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    icon={Power}
                    onClick={() => handleToggleForEnvironment(true)}
                    className="flex-1"
                  >
                    {t('turnOnHere')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={PowerOff}
                    onClick={() => handleToggleForEnvironment(false)}
                    className="flex-1"
                  >
                    {t('turnOffHere')}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted">{t('overrideHint')}</p>
              </Card>
            </Section>
          </div>

          <Section
            title={t('targetingPanel')}
            description={t('targetingApplyTo', {
              environment: selectedEnv?.name || t('selectedEnvironmentFallback'),
            })}
          >
            <Card>
              {targetingLoading ? (
                <div className="h-44 animate-pulse rounded-xl bg-hoverBg" />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{t('prioritySummary')}</p>
                      <p className="text-xs text-muted">{t('priorityOrder')}</p>
                    </div>
                    <Badge tone="accent">
                      {targetingRules.user_ids.length || targetingRules.group_keys.length || targetingRules.percentage !== null
                        ? t('targetingConfigured')
                        : t('targetingNone')}
                    </Badge>
                  </div>

                  {targetingError && <p className="text-sm text-bad">{targetingError}</p>}

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-xl border border-border bg-surfaceMuted p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-accent">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{t('userWhitelist')}</p>
                          <p className="text-xs text-muted">{t('userWhitelistHint')}</p>
                        </div>
                      </div>
                      <Textarea
                        rows={3}
                        value={userIdInput}
                        onChange={(e) => setUserIdInput(e.target.value)}
                        placeholder="alice@example.com, bob@example.com"
                      />
                      <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {t('appliesTo')}
                      </p>
                      {parseList(userIdInput).length === 0 ? (
                        <p className="text-sm text-muted">{t('noUserIdsYet')}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {parseList(userIdInput).map((userId) => (
                            <button
                              key={userId}
                              type="button"
                              onClick={() => removeUserId(userId)}
                              className="group inline-flex items-center gap-1.5 rounded-md border border-accent/25 bg-accentSoft px-2.5 py-1 text-xs font-semibold text-accentDark transition-colors hover:border-bad/30 hover:bg-badSoft hover:text-bad"
                              title={t('clickToRemove')}
                            >
                              <span className="font-mono">{userId}</span>
                              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-border bg-surfaceMuted p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-accent">
                          <Users className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{t('groupTargeting')}</p>
                          <p className="text-xs text-muted">{t('groupTargetingHint')}</p>
                        </div>
                      </div>

                      {availableGroups.length === 0 ? (
                        <p className="text-sm text-muted">
                          {t('noGroupsSeeded', { link: t('groupsTitle') })}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableGroups.map((group) => {
                            const isSelected = selectedGroupKeys.includes(group)
                            return (
                              <button
                                key={group}
                                type="button"
                                onClick={() => toggleGroup(group)}
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold font-mono transition-colors ${
                                  isSelected
                                    ? 'border-accent bg-accent text-white'
                                    : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-ink'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                                {group}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {t('extraGroupKeys')}
                      </p>
                      <Input
                        value={extraGroupKeysInput}
                        onChange={(e) => setExtraGroupKeysInput(e.target.value)}
                        placeholder="beta_users, internal_team"
                      />
                      {parseList(extraGroupKeysInput).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {parseList(extraGroupKeysInput).map((group) => (
                            <button
                              key={group}
                              type="button"
                              onClick={() => removeExtraGroup(group)}
                              className="group inline-flex items-center gap-1.5 rounded-md border border-good/25 bg-goodSoft px-2.5 py-1 text-xs font-semibold font-mono text-good transition-colors hover:border-bad/30 hover:bg-badSoft hover:text-bad"
                              title={t('clickToRemove')}
                            >
                              {group}
                              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-surfaceMuted p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-accent">
                          <Percent className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{t('percentageRollout')}</p>
                          <p className="text-xs text-muted">{t('percentageHint')}</p>
                        </div>
                      </div>
                      <span className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-sm font-semibold text-accentDark">
                        {Math.round(Number(percentage) || 0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={percentage}
                      onChange={(e) => setPercentage(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
                    />
                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <p className="text-xs text-muted">{t('cacheInvalidateHint')}</p>
                    <Button onClick={handleSaveTargeting} loading={targetingSaving} icon={Sparkles} size="lg">
                      {t('saveTargetingRules')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Section>

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

          <Section
            title={t('testPanel')}
            description={t('testPanelHint')}
          >
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
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

              <div className="mt-4 rounded-xl border border-dashed border-border bg-surfaceMuted p-4">
                {testLoading ? (
                  <div className="h-14 animate-pulse rounded-xl bg-hoverBg" />
                ) : testResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-2xl font-semibold text-accent">
                        {JSON.stringify(testResult.value)}
                      </p>
                      <Badge tone={testResult.cached ? 'warn' : 'good'} dot live={!testResult.cached}>
                        {testResult.cached ? t('cachedState') : t('liveState')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted">
                      {t('resolvedBy', { reason: testResult.reason })}
                    </p>
                  </div>
                ) : testError ? (
                  <p className="text-sm text-bad">{testError}</p>
                ) : (
                  <p className="text-sm text-muted">{t('noEvaluationYet')}</p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">{t('rerunHint')}</p>
                <Button size="sm" variant="secondary" icon={Play} onClick={runTestEvaluation} loading={testLoading}>
                  {t('runEvaluation')}
                </Button>
              </div>
            </Card>
          </Section>

          {/* History */}
          <Section title={t('history')} description={t('historyHint')}>
            <Card padded={false}>
              {versions.length === 0 ? (
                <p className="p-4 text-sm text-muted">{t('noHistoryYet')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hoverBg">
                        <History className="h-3.5 w-3.5 text-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          v{v.version_number} &middot; {v.change_note || t('versionUpdated')}
                        </p>
                        <p className="text-xs text-muted">
                          {t('versionBy', {
                            date: new Date(v.created_at).toLocaleString(),
                            actor: v.created_by,
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
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

function isNotFoundError(err) {
  return /not found/i.test(err?.message || '')
}

function Detail({ label, value, mono, tone }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm ${mono ? 'font-mono' : ''} ${
          tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
