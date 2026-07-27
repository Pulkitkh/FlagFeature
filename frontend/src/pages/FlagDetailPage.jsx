import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  History,
  Pencil,
  Percent,
  Play,
  Power,
  PowerOff,
  Save,
  Trash2,
  Users,
  UserSquare2,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import FlagForm from '../components/FlagForm'
import { api } from '../api/client'
import { useEnvironment } from '../context/EnvironmentContext'
import { useToast } from '../context/ToastContext'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Textarea,
} from '../components/ui'

const TEST_DEBOUNCE_MS = 300

const REASON_LABEL = {
  user_targeting: 'User targeting',
  group_targeting: 'Group targeting',
  percentage_rollout: 'Percentage rollout',
  environment_override_enabled: 'Environment override (on)',
  environment_override_disabled: 'Environment override (off)',
  default_value: 'Default value',
  flag_disabled: 'Kill switch — flag disabled globally',
}

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isNotFound(err) {
  return err?.status === 404 || /not found/i.test(err?.message || '')
}

export default function FlagDetailPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { selected: selectedEnv } = useEnvironment()

  const [flag, setFlag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [versions, setVersions] = useState([])

  const [showEdit, setShowEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [evalResult, setEvalResult] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [overrideBusy, setOverrideBusy] = useState(null)

  const [targetingLoading, setTargetingLoading] = useState(false)
  const [targetingSaving, setTargetingSaving] = useState(false)
  const [targetingError, setTargetingError] = useState(null)
  const [availableGroups, setAvailableGroups] = useState([])
  const [userIdInput, setUserIdInput] = useState('')
  const [selectedGroupKeys, setSelectedGroupKeys] = useState([])
  const [extraGroupKeysInput, setExtraGroupKeysInput] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [targetedValue, setTargetedValue] = useState('')

  const [testUserId, setTestUserId] = useState('')
  const [testGroups, setTestGroups] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState(null)

  const isBoolean = flag?.type === 'boolean'

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

  const refreshEvaluation = useCallback(async () => {
    if (!flag || !selectedEnv) return
    setEvalLoading(true)
    try {
      setEvalResult(await api.evaluateFlag({ flag_key: flag.key, environment_key: selectedEnv.key }))
    } catch {
      setEvalResult(null)
    } finally {
      setEvalLoading(false)
    }
  }, [flag, selectedEnv])

  useEffect(() => {
    refreshEvaluation()
  }, [refreshEvaluation])

  // Load the targeting rules for the environment currently selected in the navbar.
  useEffect(() => {
    if (!flag || !selectedEnv) return
    let cancelled = false

    setTargetingLoading(true)
    Promise.all([
      api.getTargetingRules(flag.key, selectedEnv.key),
      api.listEnvironmentGroups(selectedEnv.key),
    ])
      .then(([rules, groups]) => {
        if (cancelled) return
        const known = Array.from(new Set([...(groups || []), ...(rules.group_keys || [])])).sort()
        setAvailableGroups(known)
        setUserIdInput((rules.user_ids || []).join(', '))
        setSelectedGroupKeys(rules.group_keys || [])
        setExtraGroupKeysInput('')
        setPercentage(rules.percentage ?? 0)
        setTargetedValue(rules.value === null || rules.value === undefined ? '' : String(rules.value))
        setTargetingError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (isNotFound(err)) {
          setAvailableGroups([])
          setUserIdInput('')
          setSelectedGroupKeys([])
          setExtraGroupKeysInput('')
          setPercentage(0)
          setTargetedValue('')
          setTargetingError(null)
          return
        }
        setTargetingError(err.message)
      })
      .finally(() => !cancelled && setTargetingLoading(false))

    return () => {
      cancelled = true
    }
  }, [flag, selectedEnv])

  const runTestEvaluation = useCallback(async () => {
    if (!flag || !selectedEnv) return

    const userContext = {}
    if (testUserId.trim()) userContext.user_id = testUserId.trim()
    const groups = parseList(testGroups)
    if (groups.length) userContext.groups = groups

    setTestLoading(true)
    setTestError(null)
    try {
      setTestResult(
        await api.evaluateFlag({
          flag_key: flag.key,
          environment_key: selectedEnv.key,
          user_context: userContext,
        })
      )
    } catch (err) {
      setTestResult(null)
      setTestError(err.message)
    } finally {
      setTestLoading(false)
    }
  }, [flag, selectedEnv, testUserId, testGroups])

  // Debounced so typing a user ID doesn't fire a request per keystroke.
  const testRef = useRef(runTestEvaluation)
  testRef.current = runTestEvaluation
  useEffect(() => {
    if (!flag || !selectedEnv) return
    const timer = setTimeout(() => testRef.current(), TEST_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [flag, selectedEnv, testUserId, testGroups])

  async function handleUpdate(payload) {
    setSubmitting(true)
    setEditError(null)
    try {
      await api.updateFlag(key, payload)
      setShowEdit(false)
      toast.success('Flag updated')
      load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    await api.deleteFlag(key)
    toast.success('Flag deleted', { description: `${key} is gone.` })
    navigate('/flags')
  }

  async function handleToggleForEnvironment(nextEnabled) {
    if (!selectedEnv) return
    setOverrideBusy(nextEnabled ? 'on' : 'off')
    try {
      await api.setEnvironmentOverride(key, selectedEnv.key, { enabled: nextEnabled })
      await refreshEvaluation()
      await runTestEvaluation()
      toast.success(
        `${flag.key} is now forced ${nextEnabled ? 'on' : 'off'} in ${selectedEnv.name}`
      )
    } catch (err) {
      // This used to reject silently and leave the card showing a stale value.
      toast.error("Couldn't set the override", { description: err.message })
    } finally {
      setOverrideBusy(null)
    }
  }

  async function handleSaveTargeting() {
    if (!selectedEnv) return
    setTargetingSaving(true)
    setTargetingError(null)
    try {
      const payload = {
        user_ids: parseList(userIdInput),
        group_keys: Array.from(new Set([...selectedGroupKeys, ...parseList(extraGroupKeysInput)])),
        percentage: Number(percentage) > 0 ? Number(percentage) : null,
      }
      if (!isBoolean && targetedValue !== '') {
        payload.value = flag.type === 'number' ? Number(targetedValue) : targetedValue
      }

      const rules = await api.setTargetingRules(flag.key, selectedEnv.key, payload)
      setUserIdInput((rules.user_ids || []).join(', '))
      setSelectedGroupKeys(rules.group_keys || [])
      setExtraGroupKeysInput('')
      setPercentage(rules.percentage ?? 0)
      setAvailableGroups((current) =>
        Array.from(new Set([...current, ...(rules.group_keys || [])])).sort()
      )
      await refreshEvaluation()
      await runTestEvaluation()
      toast.success('Targeting rules saved', { description: 'The cache was cleared immediately.' })
    } catch (err) {
      setTargetingError(err.message)
    } finally {
      setTargetingSaving(false)
    }
  }

  function toggleGroup(group) {
    setSelectedGroupKeys((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group]
    )
  }

  const targetedUserIds = useMemo(() => parseList(userIdInput), [userIdInput])
  const extraGroups = useMemo(() => parseList(extraGroupKeysInput), [extraGroupKeysInput])
  const hasTargeting =
    targetedUserIds.length > 0 || selectedGroupKeys.length > 0 || Number(percentage) > 0

  if (loading) {
    return (
      <AppLayout title="Flag details" breadcrumb="FlagForge / Flags">
        <div className="space-y-5">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-surfaceMuted" />
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="h-52 animate-pulse rounded-xl bg-surfaceMuted lg:col-span-2" />
            <div className="h-52 animate-pulse rounded-xl bg-surfaceMuted" />
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !flag) {
    return (
      <AppLayout title="Flag details" breadcrumb="FlagForge / Flags">
        <EmptyState
          icon={ArrowLeft}
          tone="bad"
          title="Flag not found"
          description={error || `No flag with the key "${key}" exists.`}
          action={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/flags')}>
              Back to flags
            </Button>
          }
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title={flag.key} breadcrumb="FlagForge / Flags">
      <button
        type="button"
        onClick={() => navigate('/flags')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to flags
      </button>

      <PageHeader
        title={<span className="font-mono">{flag.key}</span>}
        description={flag.description || 'No description yet.'}
        action={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setShowEdit(true)}>
              Edit
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={flag.enabled ? 'good' : 'neutral'} dot live={flag.enabled}>
          {flag.enabled ? 'Enabled globally' : 'Disabled globally'}
        </Badge>
        <Badge tone="neutral">{flag.type}</Badge>
        <Badge tone="neutral">default: {JSON.stringify(flag.default_value)}</Badge>
        {flag.owner_team && <Badge tone="accent">{flag.owner_team}</Badge>}
      </div>

      {/* items-start: cards size to their own content instead of every card in
          a row stretching to the tallest one and trailing empty space. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* Left column: what the flag is, and the rules that shape it. */}
        <div className="space-y-5 lg:col-span-2">
          {/* General information */}
          <Card padded={false}>
            <CardHeader
              icon={UserSquare2}
              title="General information"
              description="The flag's global configuration"
            />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3">
              <Detail label="Type" value={flag.type} mono />
              <Detail label="Default value" value={JSON.stringify(flag.default_value)} mono />
              <Detail
                label="Global status"
                value={flag.enabled ? 'Enabled' : 'Disabled'}
                tone={flag.enabled ? 'good' : 'bad'}
              />
              <Detail label="Owner team" value={flag.owner_team || '—'} />
              <Detail label="Created" value={new Date(flag.created_at).toLocaleString()} />
              <Detail label="Last updated" value={new Date(flag.updated_at).toLocaleString()} />
            </dl>
          </Card>

          {/* Targeting rules */}
          <Card padded={false}>
            <CardHeader
              icon={Users}
              title="Targeting rules"
              description={`Applied in ${selectedEnv?.name || 'the selected environment'}`}
              action={
                <Badge tone={hasTargeting ? 'accent' : 'neutral'}>
                  {hasTargeting ? 'Configured' : 'No rules'}
                </Badge>
              }
            />

            {targetingLoading ? (
              <div className="p-5">
                <div className="h-56 animate-pulse rounded-lg bg-surfaceMuted" />
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <p className="rounded-lg border border-border bg-surfaceMuted px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                  Evaluated in order: <strong className="text-ink">user IDs</strong> →{' '}
                  <strong className="text-ink">groups</strong> →{' '}
                  <strong className="text-ink">percentage rollout</strong> →{' '}
                  <strong className="text-ink">environment override</strong> → default value.
                </p>

                {targetingError && (
                  <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
                    {targetingError}
                  </p>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  {/* User whitelist */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">User whitelist</p>
                        <p className="text-xs text-muted">Highest priority — always wins</p>
                      </div>
                    </div>
                    <Textarea
                      rows={3}
                      mono
                      value={userIdInput}
                      onChange={(event) => setUserIdInput(event.target.value)}
                      placeholder="alice@example.com, bob@example.com"
                      aria-label="Targeted user IDs"
                    />
                    <div className="mt-3 flex min-h-[1.75rem] flex-wrap gap-2">
                      {targetedUserIds.length === 0 ? (
                        <p className="text-xs text-muted">No user IDs added yet.</p>
                      ) : (
                        targetedUserIds.map((userId) => (
                          <Chip
                            key={userId}
                            onRemove={() =>
                              setUserIdInput(
                                targetedUserIds.filter((item) => item !== userId).join(', ')
                              )
                            }
                          >
                            {userId}
                          </Chip>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Group targeting */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
                        <Users className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">Group targeting</p>
                        <p className="text-xs text-muted">Click to select, click again to remove</p>
                      </div>
                    </div>

                    {availableGroups.length === 0 ? (
                      <p className="text-xs text-muted">
                        No groups defined for this environment yet — add one on the{' '}
                        <strong className="text-ink">User groups</strong> page.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableGroups.map((group) => {
                          const isSelected = selectedGroupKeys.includes(group)
                          return (
                            <button
                              key={group}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => toggleGroup(group)}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs font-semibold transition-colors ${
                                isSelected
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-ink'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                              {group}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="mt-4">
                      <Field label="Add group keys" hint="Comma separated — useful before members exist.">
                        {(id) => (
                          <Input
                            id={id}
                            mono
                            value={extraGroupKeysInput}
                            onChange={(event) => setExtraGroupKeysInput(event.target.value)}
                            placeholder="internal_team, premium_plan"
                          />
                        )}
                      </Field>
                      {extraGroups.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {extraGroups.map((group) => (
                            <Chip
                              key={group}
                              tone="good"
                              onRemove={() =>
                                setExtraGroupKeysInput(
                                  extraGroups.filter((item) => item !== group).join(', ')
                                )
                              }
                            >
                              {group}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Percentage rollout */}
                <div className="rounded-xl border border-border p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
                        <Percent className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">Percentage rollout</p>
                        <p className="text-xs text-muted">
                          Enabled for {Math.round(Number(percentage) || 0)}% of users — the same user
                          always lands in the same bucket
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md border border-border bg-surfaceMuted px-2.5 py-1 font-mono text-sm font-semibold text-accent">
                      {Math.round(Number(percentage) || 0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={percentage}
                    onChange={(event) => setPercentage(Number(event.target.value))}
                    aria-label="Rollout percentage"
                    className="w-full"
                    style={{
                      background: `linear-gradient(to right, rgb(var(--accent)) ${percentage}%, rgb(var(--surface-sunken)) ${percentage}%)`,
                    }}
                  />
                  <div className="mt-2 flex justify-between text-xs text-muted">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Non-boolean flags need to say what value a matched rule serves. */}
                {!isBoolean && (
                  <div className="rounded-xl border border-border p-4">
                    <Field
                      label="Value served to targeted users"
                      hint={`Leave blank to serve the flag's default (${JSON.stringify(
                        flag.default_value
                      )}).`}
                    >
                      {(id) => (
                        <Input
                          id={id}
                          mono
                          type={flag.type === 'number' ? 'number' : 'text'}
                          step={flag.type === 'number' ? 'any' : undefined}
                          value={targetedValue}
                          onChange={(event) => setTargetedValue(event.target.value)}
                          placeholder={flag.type === 'number' ? '42' : 'variant-b'}
                        />
                      )}
                    </Field>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <p className="text-xs text-muted">
                    Saving clears this flag's cache for {selectedEnv?.name || 'the environment'}{' '}
                    immediately.
                  </p>
                  <Button icon={Save} onClick={handleSaveTargeting} loading={targetingSaving}>
                    Save targeting rules
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: live resolution and the test panel, kept in view
            while the targeting rules on the left are edited. */}
        <div className="space-y-5 lg:sticky lg:top-24">
          {/* Resolution in the selected environment */}
          <Card padded={false}>
            <CardHeader
              icon={Power}
              title={`Resolved in ${selectedEnv?.name || 'environment'}`}
              description="What /evaluate returns right now"
            />
            <div className="p-5">
              {evalLoading ? (
                <div className="h-20 animate-pulse rounded-lg bg-surfaceMuted" />
              ) : evalResult ? (
                <div className="rounded-lg border border-border bg-surfaceMuted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-mono text-2xl font-semibold text-accent">
                      {JSON.stringify(evalResult.value)}
                    </p>
                    <Badge tone={evalResult.cached ? 'warn' : 'good'} dot live={!evalResult.cached}>
                      {evalResult.cached ? 'Cached' : 'Live'}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {REASON_LABEL[evalResult.reason] || evalResult.reason}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">Couldn't evaluate this flag.</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="success"
                  size="sm"
                  icon={Power}
                  loading={overrideBusy === 'on'}
                  disabled={Boolean(overrideBusy)}
                  onClick={() => handleToggleForEnvironment(true)}
                >
                  Force on
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={PowerOff}
                  loading={overrideBusy === 'off'}
                  disabled={Boolean(overrideBusy)}
                  onClick={() => handleToggleForEnvironment(false)}
                >
                  Force off
                </Button>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted">
                Sets an environment override without touching the global default. Targeting rules
                still win over it.
              </p>
            </div>
          </Card>

          {/* Evaluation test panel */}
          <Card padded={false}>
            <CardHeader
              icon={Play}
              title="Evaluation test panel"
              description="Try a user against the live rules"
            />
            <div className="space-y-4 p-5">
              <Field label="Test user ID">
                {(id) => (
                  <Input
                    id={id}
                    mono
                    value={testUserId}
                    onChange={(event) => setTestUserId(event.target.value)}
                    placeholder="alice@example.com"
                  />
                )}
              </Field>

              <Field label="Test groups" hint="Comma separated. Added to any stored memberships.">
                {(id) => (
                  <Input
                    id={id}
                    mono
                    value={testGroups}
                    onChange={(event) => setTestGroups(event.target.value)}
                    placeholder="beta_users, premium_plan"
                  />
                )}
              </Field>

              <div className="rounded-xl border border-dashed border-border bg-surfaceMuted p-4">
                {testLoading ? (
                  <div className="h-14 animate-pulse rounded-lg bg-surfaceSunken" />
                ) : testResult ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-mono text-2xl font-semibold text-accent">
                        {JSON.stringify(testResult.value)}
                      </p>
                      <Badge tone={testResult.cached ? 'warn' : 'good'} dot live={!testResult.cached}>
                        {testResult.cached ? 'Cached' : 'Live'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-muted">
                      Resolved by {REASON_LABEL[testResult.reason] || testResult.reason}
                    </p>
                  </>
                ) : testError ? (
                  <p className="text-sm text-bad">{testError}</p>
                ) : (
                  <p className="text-sm text-muted">Enter a user to evaluate.</p>
                )}
              </div>

              <Button
                variant="secondary"
                icon={Play}
                onClick={runTestEvaluation}
                loading={testLoading}
                className="w-full"
              >
                Run evaluation
              </Button>
            </div>
          </Card>
        </div>

        {/* Version history */}
        <Card padded={false} className="lg:col-span-3">
          <CardHeader
            icon={History}
            title="Version history"
            description="Every change to this flag's global configuration"
            action={
              <Badge tone="neutral">
                {versions.length} version{versions.length === 1 ? '' : 's'}
              </Badge>
            }
          />
          {versions.length === 0 ? (
            <p className="p-5 text-sm text-muted">No version history yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {versions.map((version) => (
                <li key={version.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted">
                    <History className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      <span className="font-mono font-semibold">v{version.version_number}</span>
                      <span className="mx-1.5 text-muted">·</span>
                      {version.change_note || 'Updated'}
                    </p>
                    <p className="text-xs text-muted">by {version.created_by}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
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

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete ${flag.key}?`}
        confirmLabel="Delete flag"
      >
        This removes the flag, its version history, and every targeting rule and environment
        override attached to it. Applications calling <code className="font-mono">/evaluate</code>{' '}
        for this key will start getting a 404.
      </ConfirmDialog>
    </AppLayout>
  )
}

function Detail({ label, value, mono, tone }) {
  const toneClass = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-label text-muted">{label}</dt>
      <dd className={`mt-1 truncate text-sm ${mono ? 'font-mono' : ''} ${toneClass}`} title={value}>
        {value}
      </dd>
    </div>
  )
}
