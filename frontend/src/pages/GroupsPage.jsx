import { useEffect, useMemo, useState } from 'react'
import { Users, Plus, Trash2, Layers } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { api } from '../api/client'
import { PageHeader, StatCard, Card, Badge, Button, Field, Input, Textarea, Dropdown } from '../components/ui'

const ENV_DOT_COLOR = { production: 'bg-bad', staging: 'bg-warn', development: 'bg-good' }

export default function GroupsPage() {
  const { environments, selected } = useEnvironment()
  const [selectedEnvKey, setSelectedEnvKey] = useState(selected?.key || '')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [groupKey, setGroupKey] = useState('')
  const [userIdsInput, setUserIdsInput] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedEnv = useMemo(
    () => environments.find((env) => env.key === selectedEnvKey) || selected,
    [environments, selectedEnvKey, selected]
  )

  const totalUsers = useMemo(
    () => new Set(groups.flatMap((group) => group.user_ids)).size,
    [groups]
  )

  useEffect(() => {
    if (selected?.key && !selectedEnvKey) {
      setSelectedEnvKey(selected.key)
    }
  }, [selected?.key, selectedEnvKey])

  useEffect(() => {
    if (!selectedEnvKey) return
    setLoading(true)
    api
      .listUserGroups(selectedEnvKey)
      .then((data) => {
        setGroups(data)
        setError(null)
      })
      .catch((err) => {
        if (isNotFoundError(err)) {
          setGroups([])
          setError(null)
          return
        }
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [selectedEnvKey])

  async function handleSave(e) {
    e.preventDefault()
    if (!selectedEnvKey) return
    setSaving(true)
    setError(null)
    try {
      await api.upsertUserGroup(selectedEnvKey, {
        group_key: groupKey,
        user_ids: parseList(userIdsInput),
      })
      const savedUsers = parseList(userIdsInput)
      setGroups((current) => {
        const withoutGroup = current.filter((entry) => entry.group_key !== groupKey)
        return [...withoutGroup, { group_key: groupKey, user_ids: savedUsers }].sort((a, b) =>
          a.group_key.localeCompare(b.group_key)
        )
      })
      setGroupKey('')
      setUserIdsInput('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(group, userId) {
    if (!selectedEnvKey) return
    try {
      await api.deleteUserGroupMember(selectedEnvKey, group, userId)
      setGroups((current) =>
        current
          .map((entry) =>
            entry.group_key === group
              ? { ...entry, user_ids: entry.user_ids.filter((value) => value !== userId) }
              : entry
          )
          .filter((entry) => entry.user_ids.length > 0)
      )
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title="User groups" breadcrumb="FlagForge" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title="User groups"
            description="Create group memberships for the current environment and target them from flag rules."
          />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Environment" value={selectedEnv?.name || '—'} icon={Layers} tone="accent" />
            <StatCard label="Groups" value={groups.length} icon={Users} tone="good" />
            <StatCard label="Unique users" value={totalUsers} icon={Users} tone="neutral" />
          </div>

          <Card className="mb-6">
            <div className="grid gap-4 md:grid-cols-[280px_auto] md:items-end">
              <Field label="Environment">
                <Dropdown
                  value={selectedEnvKey}
                  onChange={setSelectedEnvKey}
                  placeholder="Choose an environment"
                  options={environments.map((env) => ({ value: env.key, label: env.name, meta: env }))}
                  renderOption={(option) => (
                    <span className="flex items-center gap-2">
                      <span className={`signal-dot signal-dot--live ${ENV_DOT_COLOR[option.value] || 'bg-muted'}`} />
                      {option.label}
                    </span>
                  )}
                  renderValue={(option) => (
                    <span className="flex items-center gap-2">
                      <span className={`signal-dot signal-dot--live ${ENV_DOT_COLOR[option.value] || 'bg-muted'}`} />
                      {option.label}
                    </span>
                  )}
                />
              </Field>
              <p className="text-xs text-muted">
                Group memberships are scoped per environment — switch above to manage another one.
              </p>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
                  <Users className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Create group membership</h2>
                  <p className="text-xs text-muted">Add one group and many user IDs at once.</p>
                </div>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <Field label="Group key">
                  <Input mono value={groupKey} onChange={(e) => setGroupKey(e.target.value)} placeholder="beta_users" />
                </Field>
                <Field label="User IDs" hint="Comma or newline separated">
                  <Textarea
                    rows={5}
                    value={userIdsInput}
                    onChange={(e) => setUserIdsInput(e.target.value)}
                    placeholder="alice@example.com, bob@example.com"
                  />
                </Field>
                {error && <p className="text-sm text-bad">{error}</p>}
                <Button type="submit" loading={saving} icon={Plus} className="w-full sm:w-auto">
                  Save group
                </Button>
              </form>
            </Card>

            <Card padded={false}>
              <div className="flex items-center justify-between gap-2.5 border-b border-border p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-good">
                    <Layers className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">Existing groups</h2>
                    <p className="text-xs text-muted">Members currently stored for this environment.</p>
                  </div>
                </div>
                <Badge tone="good" dot live>{groups.length} groups</Badge>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="h-44 animate-pulse rounded-xl bg-hoverBg" />
                ) : groups.length === 0 ? (
                  <p className="text-sm text-muted">No groups yet.</p>
                ) : (
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <div
                        key={group.group_key}
                        className="relative overflow-hidden rounded-xl border border-border bg-surfaceMuted p-4"
                      >
                        <span className="absolute inset-y-0 left-0 w-1 bg-good" />
                        <div className="mb-2.5 flex items-center justify-between pl-2">
                          <p className="font-mono text-sm font-semibold text-ink">{group.group_key}</p>
                          <Badge tone="accent">{group.user_ids.length} users</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-2">
                          {group.user_ids.map((userId) => (
                            <button
                              key={userId}
                              type="button"
                              onClick={() => handleRemove(group.group_key, userId)}
                              className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-ink transition-colors hover:border-bad/30 hover:bg-badSoft hover:text-bad"
                              title="Remove from group"
                            >
                              {userId}
                              <Trash2 className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isNotFoundError(err) {
  return /not found/i.test(err?.message || '')
}