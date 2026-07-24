import { useEffect, useMemo, useState } from 'react'
import { Users, Plus, Trash2 } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { api } from '../api/client'
import { PageHeader, Card, Badge, Button, Field, Input, Textarea, Select } from '../components/ui'

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

          <Card className="mb-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Environment">
                <Select value={selectedEnvKey} onChange={(e) => setSelectedEnvKey(e.target.value)}>
                  {environments.map((env) => (
                    <option key={env.key} value={env.key}>
                      {env.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Badge tone="accent">{selectedEnv?.name || 'No environment selected'}</Badge>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Create group membership</h2>
                  <p className="text-xs text-muted">Add one group and many user IDs at once.</p>
                </div>
                <Users className="h-5 w-5 text-accent" />
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <Field label="Group key">
                  <Input value={groupKey} onChange={(e) => setGroupKey(e.target.value)} placeholder="beta_users" />
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
                <Button type="submit" loading={saving} icon={Plus}>
                  Save group
                </Button>
              </form>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Existing groups</h2>
                  <p className="text-xs text-muted">Members currently stored for this environment.</p>
                </div>
                <Badge tone="good">{groups.length} groups</Badge>
              </div>
              {loading ? (
                <div className="h-44 animate-pulse rounded-2xl bg-hoverBg" />
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted">No groups yet.</p>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group.group_key} className="rounded-2xl border border-border bg-white/70 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold text-ink">{group.group_key}</p>
                        <Badge tone="accent">{group.user_ids.length} users</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.user_ids.map((userId) => (
                          <span
                            key={userId}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-xs text-ink"
                          >
                            {userId}
                            <button
                              type="button"
                              className="text-bad hover:text-rose-700"
                              onClick={() => handleRemove(group.group_key, userId)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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