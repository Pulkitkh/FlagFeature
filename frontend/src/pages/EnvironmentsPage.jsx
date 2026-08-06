import { useEffect, useState } from 'react'
import { Layers, Flag, Activity, Plus, Pencil } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { useT } from '../context/LanguageContext'
import { api } from '../api/client'
import { PageHeader, Section, Card, Badge, Button, Field, Input, Dropdown, Modal } from '../components/ui'

const ENV_ICON_TONE = {
  production: 'bad',
  staging: 'warn',
  development: 'good',
}

export default function EnvironmentsPage() {
  const { environments, refresh, loading } = useEnvironment()
  const t = useT()
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
      <Navbar title={t('environmentsTitle')} breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title={t('environmentsTitle')}
            description={t('environmentsSubtitle')}
            action={
              <Button icon={Plus} onClick={() => setShowForm(true)}>
                {t('addEnvironment')}
              </Button>
            }
          />

          <Section index={1} title={t('envPreviewTitle')} description={t('envPreviewHint')}>
            <Card>
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Field label={t('navFlags')}>
                  <Dropdown
                    value={selectedFlagKey}
                    onChange={setSelectedFlagKey}
                    mono
                    placeholder={t('chooseFlag')}
                    options={flags.map((flag) => ({ value: flag.key, label: flag.key, meta: flag }))}
                    renderOption={(option) => (
                      <span className="flex items-center gap-2">
                        <span className={`signal-dot ${option.meta.enabled ? 'signal-dot--live bg-good' : 'bg-muted'}`} />
                        <span className="font-mono">{option.label}</span>
                      </span>
                    )}
                    renderValue={(option) => (
                      <span className="flex items-center gap-2">
                        <span className={`signal-dot ${option.meta.enabled ? 'signal-dot--live bg-good' : 'bg-muted'}`} />
                        <span className="font-mono">{option.label}</span>
                      </span>
                    )}
                  />
                </Field>
                <div className="text-xs text-muted">{t('envPreviewShows')}</div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
                {previewLoading ? (
                  <div className="p-4 text-sm text-muted">{t('loadingPreview')}</div>
                ) : flagPreview.length === 0 ? (
                  <div className="p-4 text-sm text-muted">{t('noPreview')}</div>
                ) : (
                  <table className="w-full text-start text-sm">
                    <thead className="border-b border-border bg-surfaceMuted font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                      <tr>
                        <th className="px-4 py-3 text-start">{t('fieldEnvironment')}</th>
                        <th className="px-4 py-3 text-start">{t('colResolvedValue')}</th>
                        <th className="px-4 py-3 text-start">{t('fieldReason')}</th>
                        <th className="px-4 py-3 text-start">{t('colCache')}</th>
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
                              {result.cached ? t('cachedState') : t('liveState')}
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
              {environments.map((env, index) => (
                <Card key={env.id} className="h-full transition-colors hover:border-borderStrong">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surfaceMuted text-ink">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="flex items-baseline gap-2 font-mono text-[13px] font-semibold text-ink">
                          <span className="index-marker">[{String(index + 1).padStart(2, '0')}]</span>
                          {env.key}
                        </p>
                        <p className="text-xs text-muted">{env.name}</p>
                      </div>
                    </div>
                    <Badge tone={ENV_ICON_TONE[env.key] || 'neutral'} dot live={env.key === 'production'}>
                      {env.key === 'production' ? t('liveState') : t('activeState')}
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(env)}>
                      {t('edit')}
                    </Button>
                  </div>

                  <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Flag className="h-3.5 w-3.5" /> {t('flagsAvailable')}
                      </span>
                      <span className="font-medium text-ink">
                        {flagCount === null ? '—' : flagCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Activity className="h-3.5 w-3.5" /> {t('apiHealth')}
                      </span>
                      <span
                        className={`font-medium ${
                          apiHealthy === null ? 'text-muted' : apiHealthy ? 'text-good' : 'text-bad'
                        }`}
                      >
                        {apiHealthy === null
                          ? t('apiChecking')
                          : apiHealthy
                            ? t('apiHealthy')
                            : t('apiDegraded')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>{t('lastDeployment')}</span>
                      <span className="text-xs">{t('notTrackedYet')}</span>
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
        title={t('addEnvironment')}
        description={t('addEnvironmentHint')}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label={t('fieldKey')}>
            <Input
              required
              mono
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="qa"
            />
          </Field>
          <Field label={t('displayName')}>
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
              {t('cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('addEnvironment')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingEnv)}
        onClose={() => setEditingEnv(null)}
        title={t('editEnvironment')}
        description={t('editEnvironmentHint')}
      >
        <form onSubmit={handleUpdateEnvironment} className="space-y-4">
          <Field label={t('environmentKey')}>
            <Input value={editingEnv?.key || ''} disabled />
          </Field>
          <Field label={t('displayName')}>
            <Input required value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          {editError && <p className="text-sm text-bad">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditingEnv(null)}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={editSubmitting}>
              {t('saveChanges')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
