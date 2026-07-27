import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, Pencil, Plus } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { api } from '../api/client'
import { useEnvironment } from '../context/EnvironmentContext'
import { useToast } from '../context/ToastContext'
import { environmentDot } from '../components/EnvironmentSwitcher'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  Modal,
  PageHeader,
  Section,
} from '../components/ui'

const REASON_LABEL = {
  user_targeting: 'User targeting',
  group_targeting: 'Group targeting',
  percentage_rollout: 'Percentage rollout',
  environment_override_enabled: 'Override (on)',
  environment_override_disabled: 'Override (off)',
  default_value: 'Default value',
  flag_disabled: 'Flag disabled',
}

export default function EnvironmentsPage() {
  const { environments, refresh, loading } = useEnvironment()
  const toast = useToast()

  const [flags, setFlags] = useState([])
  const [coverage, setCoverage] = useState([])
  const [selectedFlagKey, setSelectedFlagKey] = useState('')
  const [preview, setPreview] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState(null)
  const [creating, setCreating] = useState(false)

  const [editingEnv, setEditingEnv] = useState(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const loadWorkspace = useCallback(() => {
    api
      .listFlags()
      .then((items) => {
        setFlags(items)
        setSelectedFlagKey((current) => current || items[0]?.key || '')
      })
      .catch(() => setFlags([]))

    api
      .getOverview()
      .then((data) => setCoverage(data.environment_coverage))
      .catch(() => setCoverage([]))
  }, [])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  // Evaluate the chosen flag in every environment at once.
  useEffect(() => {
    if (!selectedFlagKey || environments.length === 0) {
      setPreview([])
      return
    }

    let cancelled = false
    setPreviewLoading(true)

    Promise.all(
      environments.map((env) =>
        api
          .evaluateFlag({ flag_key: selectedFlagKey, environment_key: env.key })
          // The environment travels with its own result. Previously the results
          // were filtered and then zipped back by index, so one failed lookup
          // shifted every row onto the wrong environment.
          .then((result) => ({ env, result }))
          .catch(() => ({ env, result: null }))
      )
    )
      .then((rows) => !cancelled && setPreview(rows))
      .finally(() => !cancelled && setPreviewLoading(false))

    return () => {
      cancelled = true
    }
  }, [selectedFlagKey, environments])

  const coverageByKey = useMemo(
    () => Object.fromEntries(coverage.map((entry) => [entry.key, entry])),
    [coverage]
  )

  async function handleCreate(event) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      await api.createEnvironment({ key: newKey.trim(), name: newName.trim() })
      setNewKey('')
      setNewName('')
      setShowCreate(false)
      toast.success('Environment created')
      refresh()
      loadWorkspace()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateEnvironment(event) {
    event.preventDefault()
    if (!editingEnv) return

    setEditSubmitting(true)
    setEditError(null)
    try {
      await api.updateEnvironment(editingEnv.key, { name: editName.trim() })
      setEditingEnv(null)
      toast.success('Environment renamed')
      refresh()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <AppLayout title="Environments" breadcrumb="FlagForge">
      <PageHeader
        eyebrow="Manage releases"
        title="Environments"
        description="Every flag can behave differently per environment. Roll out to development first, then staging, then production — without touching the global default."
        action={
          <Button icon={Plus} onClick={() => setShowCreate(true)}>
            Add environment
          </Button>
        }
      />

      <Section>
        <Card padded={false}>
          <CardHeader
            icon={Layers}
            title="Flag preview across environments"
            description="Pick a flag to see how it resolves everywhere at once"
            action={
              <Dropdown
                value={selectedFlagKey}
                onChange={setSelectedFlagKey}
                mono
                placeholder="Choose a flag"
                className="w-56"
                options={flags.map((flag) => ({ value: flag.key, label: flag.key, meta: flag }))}
                renderOption={(option) => (
                  <span className="flex items-center gap-2">
                    <span
                      className={`signal-dot ${option.meta.enabled ? 'bg-good' : 'bg-muted'}`}
                      aria-hidden="true"
                    />
                    <span className="truncate font-mono">{option.label}</span>
                  </span>
                )}
                renderValue={(option) => (
                  <span className="flex items-center gap-2">
                    <span
                      className={`signal-dot ${option.meta.enabled ? 'bg-good' : 'bg-muted'}`}
                      aria-hidden="true"
                    />
                    <span className="truncate font-mono">{option.label}</span>
                  </span>
                )}
              />
            }
          />

          <div className="overflow-x-auto">
            {previewLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-surfaceMuted" />
                ))}
              </div>
            ) : preview.length === 0 ? (
              <p className="p-5 text-sm text-muted">
                {flags.length === 0
                  ? 'Create a flag first — then you can compare it across environments here.'
                  : 'Select a flag to preview it.'}
              </p>
            ) : (
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-surfaceMuted">
                  <tr>
                    <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-label text-muted">
                      Environment
                    </th>
                    <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-label text-muted">
                      Resolved value
                    </th>
                    <th className="px-5 py-3 text-2xs font-semibold uppercase tracking-label text-muted">
                      Decided by
                    </th>
                    <th className="px-5 py-3 text-right text-2xs font-semibold uppercase tracking-label text-muted">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(({ env, result }) => (
                    <tr key={env.key} className="border-b border-border/70 last:border-0">
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <span className={`signal-dot ${environmentDot(env.key)}`} aria-hidden="true" />
                          <span className="font-medium text-ink">{env.name}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-accent">
                        {result ? JSON.stringify(result.value) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted">
                        {result ? REASON_LABEL[result.reason] || result.reason : 'Unavailable'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {result ? (
                          <Badge tone={result.cached ? 'warn' : 'good'} dot live={!result.cached}>
                            {result.cached ? 'Cached' : 'Live'}
                          </Badge>
                        ) : (
                          <Badge tone="bad">Error</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </Section>

      <Section title="All environments" description="Configuration counts come from the live API.">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-xl bg-surfaceMuted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {environments.map((env) => {
              const stats = coverageByKey[env.key]
              return (
                <Card key={env.id} interactive className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-ink">
                        <Layers className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{env.name}</p>
                        <p className="truncate font-mono text-xs text-muted">{env.key}</p>
                      </div>
                    </div>
                    <span
                      className={`signal-dot signal-dot--live mt-3 ${environmentDot(env.key)}`}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Real per-environment numbers — this card used to show the
                      same global flag count for every environment. */}
                  <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                    <Stat label="Flags with targeting" value={stats?.targeted_flags ?? '—'} />
                    <Stat label="Environment overrides" value={stats?.overridden_flags ?? '—'} />
                    <Stat
                      label="Average rollout"
                      value={
                        stats?.avg_rollout === null || stats?.avg_rollout === undefined
                          ? '—'
                          : `${stats.avg_rollout}%`
                      }
                    />
                  </dl>

                  <div className="mt-auto flex justify-end pt-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Pencil}
                      onClick={() => {
                        setEditingEnv(env)
                        setEditName(env.name)
                        setEditError(null)
                      }}
                    >
                      Rename
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add environment"
        description="e.g. qa, canary, sandbox — whatever your rollout process needs."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" form="create-env-form" loading={creating}>
              Add environment
            </Button>
          </>
        }
      >
        <form id="create-env-form" onSubmit={handleCreate} className="space-y-5">
          <Field label="Key" hint="Used by the API. Lowercase, no spaces.">
            {(id) => (
              <Input
                id={id}
                required
                mono
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                placeholder="qa"
              />
            )}
          </Field>
          <Field label="Display name">
            {(id) => (
              <Input
                id={id}
                required
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="QA"
              />
            )}
          </Field>
          {createError && <p className="text-sm text-bad">{createError}</p>}
        </form>
      </Modal>

      <Modal
        open={Boolean(editingEnv)}
        onClose={() => setEditingEnv(null)}
        title="Rename environment"
        description="The key is permanent — applications evaluate against it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingEnv(null)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="edit-env-form" loading={editSubmitting}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-env-form" onSubmit={handleUpdateEnvironment} className="space-y-5">
          <Field label="Environment key">
            {(id) => <Input id={id} mono value={editingEnv?.key || ''} disabled />}
          </Field>
          <Field label="Display name">
            {(id) => (
              <Input
                id={id}
                required
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            )}
          </Field>
          {editError && <p className="text-sm text-bad">{editError}</p>}
        </form>
      </Modal>
    </AppLayout>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono font-medium text-ink">{value}</dd>
    </div>
  )
}
