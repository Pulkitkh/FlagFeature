import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, Plus, UserPlus, Users } from 'lucide-react'
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
  Chip,
  Dropdown,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatCard,
  Textarea,
} from '../components/ui'

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isNotFound(err) {
  return err?.status === 404 || /not found/i.test(err?.message || '')
}

export default function GroupsPage() {
  const { environments, selectedKey, setSelectedKey, selected } = useEnvironment()
  const toast = useToast()

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [groupKey, setGroupKey] = useState('')
  const [userIdsInput, setUserIdsInput] = useState('')
  const [saving, setSaving] = useState(false)

  // The page follows the navbar's environment rather than keeping a second,
  // separately-drifting selection.
  const envKey = selected?.key || selectedKey

  const loadGroups = useCallback(() => {
    if (!envKey) return
    setLoading(true)
    api
      .listUserGroups(envKey)
      .then((data) => {
        setGroups(data)
        setError(null)
      })
      .catch((err) => {
        setGroups([])
        setError(isNotFound(err) ? null : err.message)
      })
      .finally(() => setLoading(false))
  }, [envKey])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const totalUsers = useMemo(
    () => new Set(groups.flatMap((group) => group.user_ids)).size,
    [groups]
  )

  const pendingUsers = useMemo(() => parseList(userIdsInput), [userIdsInput])

  async function handleSave(event) {
    event.preventDefault()
    if (!envKey) return

    const userIds = pendingUsers
    if (!groupKey.trim() || userIds.length === 0) {
      setError('Add a group key and at least one user ID.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.upsertUserGroup(envKey, { group_key: groupKey.trim(), user_ids: userIds })
      setGroupKey('')
      setUserIdsInput('')
      toast.success('Group saved', {
        description: `${userIds.length} member${userIds.length === 1 ? '' : 's'} in ${groupKey.trim()}.`,
      })
      // Re-read rather than patching local state, so what's on screen is what
      // the API actually stored.
      loadGroups()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(group, userId) {
    if (!envKey) return
    try {
      await api.deleteUserGroupMember(envKey, group, userId)
      loadGroups()
    } catch (err) {
      toast.error("Couldn't remove member", { description: err.message })
    }
  }

  return (
    <AppLayout title="User groups" breadcrumb="FlagForge">
      <PageHeader
        eyebrow="Manage releases"
        title="User groups"
        description="Group memberships are scoped per environment. Target a group from any flag's targeting panel to run a beta with a real cohort."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Environment"
          value={selected?.name || '—'}
          hint="Switch it in the top bar"
          icon={Layers}
          tone="accent"
        />
        <StatCard
          label="Groups"
          value={groups.length}
          hint="Defined here"
          icon={Users}
          tone="good"
          loading={loading}
        />
        <StatCard
          label="Unique members"
          value={totalUsers}
          hint="Across all groups"
          icon={UserPlus}
          tone="neutral"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card padded={false} className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start">
          <CardHeader
            icon={UserPlus}
            title="Add members to a group"
            description="Creates the group if it doesn't exist"
          />
          <form onSubmit={handleSave} className="space-y-5 p-5">
            <Field label="Environment" hint="Also changes the environment for the whole console.">
              {(id) => (
                <Dropdown
                  id={id}
                  value={envKey || ''}
                  onChange={setSelectedKey}
                  placeholder="Choose an environment"
                  options={environments.map((env) => ({ value: env.key, label: env.name }))}
                  renderOption={(option) => (
                    <span className="flex items-center gap-2">
                      <span className={`signal-dot ${environmentDot(option.value)}`} aria-hidden="true" />
                      {option.label}
                    </span>
                  )}
                  renderValue={(option) => (
                    <span className="flex items-center gap-2">
                      <span className={`signal-dot ${environmentDot(option.value)}`} aria-hidden="true" />
                      {option.label}
                    </span>
                  )}
                />
              )}
            </Field>

            <Field label="Group key" hint="Lowercase, e.g. beta_users or internal_team.">
              {(id) => (
                <Input
                  id={id}
                  mono
                  value={groupKey}
                  onChange={(event) => setGroupKey(event.target.value)}
                  placeholder="beta_users"
                />
              )}
            </Field>

            <Field label="User IDs" hint="Comma or newline separated.">
              {(id) => (
                <Textarea
                  id={id}
                  mono
                  rows={5}
                  value={userIdsInput}
                  onChange={(event) => setUserIdsInput(event.target.value)}
                  placeholder="alice@example.com, bob@example.com"
                />
              )}
            </Field>

            {pendingUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingUsers.map((userId) => (
                  <Chip
                    key={userId}
                    tone="neutral"
                    onRemove={() =>
                      setUserIdsInput(pendingUsers.filter((item) => item !== userId).join(', '))
                    }
                  >
                    {userId}
                  </Chip>
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
                {error}
              </p>
            )}

            <Button type="submit" icon={Plus} loading={saving} className="w-full">
              Save group
            </Button>
          </form>
        </Card>

        <Card padded={false} className="lg:col-span-3">
          <CardHeader
            icon={Users}
            title="Existing groups"
            description={`Stored for ${selected?.name || 'this environment'}`}
            action={<Badge tone="accent">{groups.length}</Badge>}
          />

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-surfaceMuted" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title="No groups yet"
                description="Add a group on the left, then target it from any flag's targeting panel."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {groups.map((group) => (
                <li key={group.group_key} className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold text-ink">{group.group_key}</p>
                    <Badge tone="neutral">
                      {group.user_ids.length} member{group.user_ids.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.user_ids.map((userId) => (
                      <Chip
                        key={userId}
                        tone="neutral"
                        title="Remove from group"
                        onRemove={() => handleRemove(group.group_key, userId)}
                      >
                        {userId}
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
