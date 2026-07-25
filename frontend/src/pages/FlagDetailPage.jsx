import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Power, PowerOff, History, Sparkles, Play } from 'lucide-react'
import { api } from '../api/client'
import FlagForm from '../components/FlagForm'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { Card, Badge, Button, Section, Field, Input, Textarea, Select } from '../components/ui'

export default function FlagDetailPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { selected: selectedEnv } = useEnvironment()

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
  }, [flag, selectedEnv, testUserId])

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
    if (!confirm(`Delete flag "${key}"? This can't be undone.`)) return
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
        user_context: testUserId.trim() ? { user_id: testUserId.trim() } : {},
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
        user_context: testUserId.trim() ? { user_id: testUserId.trim() } : {},
      })
      setTestResult(result)
    } catch (err) {
      setTestResult(null)
      setTestError(err.message)
    } finally {
      setTestLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title="Flag details" breadcrumb="FlagForge / Flags" />
        <div className="p-6 text-sm text-muted">Loading…</div>
      </div>
    )
  }

  if (error || !flag) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title="Flag details" breadcrumb="FlagForge / Flags" />
        <div className="p-6">
          <Card className="border-bad/20 bg-badSoft text-sm text-bad">
            {error || 'Flag not found'}
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
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to flags
          </button>

          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl font-semibold text-ink">{flag.key}</h1>
                <Badge tone={flag.enabled ? 'good' : 'neutral'} dot live={flag.enabled}>
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{flag.description || 'No description'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
                Edit
              </Button>
              <Button variant="danger" icon={Trash2} onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* General information */}
            <Section title="General information" className="lg:col-span-2 mb-0">
              <Card>
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                  <Detail label="Type" value={flag.type} mono />
                  <Detail label="Default value" value={JSON.stringify(flag.default_value)} mono />
                  <Detail
                    label="Global status"
                    value={flag.enabled ? 'Enabled' : 'Disabled'}
                    tone={flag.enabled ? 'good' : 'bad'}
                  />
                  <Detail label="Owner team" value={flag.owner_team || '—'} />
                  <Detail label="Created" value={new Date(flag.created_at).toLocaleString()} />
                  <Detail label="Updated" value={new Date(flag.updated_at).toLocaleString()} />
                </dl>
              </Card>
            </Section>

            {/* Environment resolution */}
            <Section title={`Resolved in ${selectedEnv?.name || 'environment'}`} className="mb-0">
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
                        {evalResult.cached ? 'Cached' : 'Live'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">reason: {evalResult.reason}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">Couldn't evaluate.</p>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    icon={Power}
                    onClick={() => handleToggleForEnvironment(true)}
                    className="flex-1"
                  >
                    Turn on here
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={PowerOff}
                    onClick={() => handleToggleForEnvironment(false)}
                    className="flex-1"
                  >
                    Turn off here
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Sets an environment override without changing the global default.
                </p>
              </Card>
            </Section>
          </div>

          <Section
            title="Targeting rule panel"
            description={`Rules apply to ${selectedEnv?.name || 'the selected environment'}.`}
          >
            <Card>
              {targetingLoading ? (
                <div className="h-44 animate-pulse rounded-xl bg-hoverBg" />
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Priority summary</p>
                      <p className="text-xs text-muted">
                        User IDs, then groups, then percentage rollout, then environment override.
                      </p>
                    </div>
                    <Badge tone="accent">
                      {targetingRules.user_ids.length || targetingRules.group_keys.length || targetingRules.percentage !== null
                        ? 'Configured'
                        : 'No targeting rules'}
                    </Badge>
                  </div>

                  {targetingError && <p className="text-sm text-bad">{targetingError}</p>}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="User IDs whitelist" hint="Comma or newline separated user IDs">
                      <Textarea
                        rows={4}
                        value={userIdInput}
                        onChange={(e) => setUserIdInput(e.target.value)}
                        placeholder="alice@example.com, bob@example.com"
                      />
                    </Field>

                    <div className="space-y-3">
                      <Field
                        label="Group selector"
                        hint={availableGroups.length ? 'Choose one or more existing groups' : 'No groups seeded yet'}
                      >
                        <Select
                          multiple
                          size={Math.max(4, Math.min(availableGroups.length || 4, 8))}
                          value={selectedGroupKeys}
                          onChange={(e) =>
                            setSelectedGroupKeys(
                              Array.from(e.target.selectedOptions).map((option) => option.value)
                            )
                          }
                          className="min-h-[11rem]"
                        >
                          {availableGroups.map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Extra group keys" hint="Add groups not yet in the selector">
                        <Input
                          value={extraGroupKeysInput}
                          onChange={(e) => setExtraGroupKeysInput(e.target.value)}
                          placeholder="beta_users, internal_team"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border border-border/60 bg-bg/40">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">Current whitelist</p>
                      {parseList(userIdInput).length === 0 ? (
                        <p className="mt-2 text-sm text-muted">No user IDs added yet.</p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {parseList(userIdInput).map((userId) => (
                            <Badge key={userId} tone="accent">
                              {userId}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>

                    <Card className="border border-border/60 bg-bg/40">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">Selected groups</p>
                      {selectedGroupKeys.length === 0 && parseList(extraGroupKeysInput).length === 0 ? (
                        <p className="mt-2 text-sm text-muted">No groups selected yet.</p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[...selectedGroupKeys, ...parseList(extraGroupKeysInput)].map((group) => (
                            <Badge key={group} tone="good">
                              {group}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  <Field
                    label="Percentage rollout"
                    hint={`Enabled for ${Math.round(Number(percentage) || 0)}% of users`}
                  >
                    <div className="space-y-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={percentage}
                        onChange={(e) => setPercentage(Number(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
                      />
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>0%</span>
                        <span className="font-mono text-ink">{Math.round(Number(percentage) || 0)}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </Field>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveTargeting} loading={targetingSaving} icon={Sparkles}>
                      Save targeting rules
                    </Button>
                    <p className="text-xs text-muted">
                      Targeting changes invalidate the cache for this flag immediately.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </Section>

          <Section
            title="Evaluation test panel"
            description="Type a fake user ID and optional groups to see what the flag resolves to."
          >
            <Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Test user ID">
                  <Input
                    value={testUserId}
                    onChange={(e) => setTestUserId(e.target.value)}
                    placeholder="alice@example.com"
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
                        {testResult.cached ? 'Cached' : 'Live'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted">Resolved by {testResult.reason}</p>
                  </div>
                ) : testError ? (
                  <p className="text-sm text-bad">{testError}</p>
                ) : (
                  <p className="text-sm text-muted">No evaluation yet.</p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  The panel re-evaluates after a short pause so you can see rule priority changes quickly.
                </p>
                <Button size="sm" variant="secondary" icon={Play} onClick={runTestEvaluation} loading={testLoading}>
                  Run evaluation
                </Button>
              </div>
            </Card>
          </Section>

          {/* History */}
          <Section title="History" description="Every change to this flag's configuration">
            <Card padded={false}>
              {versions.length === 0 ? (
                <p className="p-4 text-sm text-muted">No version history yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hoverBg">
                        <History className="h-3.5 w-3.5 text-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          v{v.version_number} &middot; {v.change_note || 'Updated'}
                        </p>
                        <p className="text-xs text-muted">
                          {new Date(v.created_at).toLocaleString()} by {v.created_by}
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
