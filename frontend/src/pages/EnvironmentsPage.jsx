import { useEffect, useState } from 'react'
import { Layers, Flag, Activity, Plus, Pencil } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { api } from '../api/client'
import { PageHeader, Section, Card, Badge, Button, Field, Input, Select, Modal } from '../components/ui'

const ENV_ICON_TONE = {
  production: 'bad',
  staging: 'warn',
  development: 'good',
}

export default function EnvironmentsPage() {
  const { environments, refresh, loading } = useEnvironment()
  const [flagCount, setFlagCount] = useState(null)
  const [apiHealthy, setApiHealthy] = useState(null)
  const [flags, setFlags] = useState([])
  const [selectedFlagKey, setSelectedFlagKey] = useState('')
  const [flagPreview, setFlagPreview] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingEnv, setEditingEnv] = useState(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  useEffect(() => {
    api
      .listFlags()
      .then((items) => {
        setFlags(items)
        setFlagCount(items.length)
        setSelectedFlagKey((current) => current || items[0]?.key || '')
      })
      .catch(() => setFlagCount(null))
    api.health().then((h) => setApiHealthy(h.status === 'ok')).catch(() => setApiHealthy(false))
  }, [])

  useEffect(() => {
    if (!selectedFlagKey || environments.length === 0) {
      setFlagPreview([])
      return
    }

    setPreviewLoading(true)
    Promise.all(
      environments.map((env) =>
        api.evaluateFlag({ flag_key: selectedFlagKey, environment_key: env.key }).catch(() => null)
      )
    )
      .then((results) => setFlagPreview(results.filter(Boolean)))
      .finally(() => setPreviewLoading(false))
  }, [selectedFlagKey, environments])

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.createEnvironment({ key, name })
      setKey('')
      setName('')
      setShowForm(false)
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(env) {
    setEditingEnv(env)
    setEditName(env.name)
    setEditError(null)
  }

  async function handleUpdateEnvironment(e) {
    e.preventDefault()
    if (!editingEnv) return

    setEditSubmitting(true)
    setEditError(null)
    try {
      await api.updateEnvironment(editingEnv.key, { name: editName })
      setEditingEnv(null)
      refresh()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title="Environments" breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title="Environments"
            description="Every flag can be independently overridden per environment."
            action={
              <Button icon={Plus} onClick={() => setShowForm(true)}>
                Add environment
              </Button>
            }
          />

          <Section
            title="Environment flag preview"
            description="Pick a flag to see how it resolves in each environment."
          >
            <Card>
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Flag">
                  <Select value={selectedFlagKey} onChange={(e) => setSelectedFlagKey(e.target.value)}>
                    {flags.map((flag) => (
                      <option key={flag.key} value={flag.key}>
                        {flag.key}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="text-xs text-muted">
                  Shows the resolved value, rule reason, and cache status.
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
                {previewLoading ? (
                  <div className="p-4 text-sm text-muted">Loading preview…</div>
                ) : flagPreview.length === 0 ? (
                  <div className="p-4 text-sm text-muted">No preview available yet.</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-surfaceMuted text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                      <tr>
                        <th className="px-4 py-3">Environment</th>
                        <th className="px-4 py-3">Resolved value</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Cache</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flagPreview.map((result, index) => (
                        <tr
                          key={environments[index]?.key || index}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3 font-medium text-ink">{environments[index]?.name}</td>
                          <td className="px-4 py-3 font-mono text-accentDark">{JSON.stringify(result.value)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">{result.reason}</td>
                          <td className="px-4 py-3">
                            <Badge tone={result.cached ? 'warn' : 'good'} dot live={!result.cached}>
                              {result.cached ? 'Cached' : 'Live'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </Section>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-surfaceMuted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {environments.map((env) => (
                <Card key={env.id} className="h-full transition-shadow hover:shadow-card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-ink">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-mono text-sm font-semibold text-ink">{env.key}</p>
                        <p className="text-xs text-muted">{env.name}</p>
                      </div>
                    </div>
                    <Badge tone={ENV_ICON_TONE[env.key] || 'neutral'} dot live={env.key === 'production'}>
                      {env.key === 'production' ? 'Live' : 'Active'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(env)}>
                      Edit
                    </Button>
                  </div>

                  <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Flag className="h-3.5 w-3.5" /> Flags available
                      </span>
                      <span className="font-medium text-ink">
                        {flagCount === null ? '—' : flagCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Activity className="h-3.5 w-3.5" /> API health
                      </span>
                      <span
                        className={`font-medium ${
                          apiHealthy === null ? 'text-muted' : apiHealthy ? 'text-good' : 'text-bad'
                        }`}
                      >
                        {apiHealthy === null ? 'Checking…' : apiHealthy ? 'Healthy' : 'Degraded'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Last deployment</span>
                      <span className="text-xs">Not tracked yet</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add environment"
        description="e.g. qa, canary, sandbox — anything your rollout process needs."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Key">
            <Input
              required
              mono
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="qa"
            />
          </Field>
          <Field label="Display name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="QA"
            />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Add environment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingEnv)}
        onClose={() => setEditingEnv(null)}
        title="Edit environment"
        description="Update the display name without changing the key."
      >
        <form onSubmit={handleUpdateEnvironment} className="space-y-4">
          <Field label="Environment key">
            <Input value={editingEnv?.key || ''} disabled />
          </Field>
          <Field label="Display name">
            <Input required value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          {editError && <p className="text-sm text-bad">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditingEnv(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={editSubmitting}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
