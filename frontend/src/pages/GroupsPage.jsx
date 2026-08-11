import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Plus, Trash2, Layers, Pencil, UserPlus, X, ChevronDown } from 'lucide-react'
import Navbar from '../components/Navbar'
import { useEnvironment } from '../context/EnvironmentContext'
import { useT } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import {
  PageHeader,
  Section,
  StatCard,
  Card,
  Badge,
  Button,
  Field,
  Input,
  Textarea,
  Dropdown,
} from '../components/ui'

const ENV_DOT_COLOR = { production: 'bg-bad', staging: 'bg-warn', development: 'bg-good' }

export default function GroupsPage() {
  const { environments, selected } = useEnvironment()
  const { isAdmin } = useAuth()
  const t = useT()

  const [selectedEnvKey, setSelectedEnvKey] = useState(selected?.key || '')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [groupKey, setGroupKey] = useState('')
  const [userIdsInput, setUserIdsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const selectedEnv = useMemo(
    () => environments.find((env) => env.key === selectedEnvKey) || selected,
    [environments, selectedEnvKey, selected]
  )

  const totalUsers = useMemo(
    () => new Set(groups.flatMap((group) => group.user_ids)).size,
    [groups]
  )

  useEffect(() => {
    if (selected?.key && !selectedEnvKey) setSelectedEnvKey(selected.key)
  }, [selected?.key, selectedEnvKey])

  const load = useCallback(() => {
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

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (!selectedEnvKey) return
    setSaving(true)
    setError(null)
    try {
      await api.upsertUserGroup(selectedEnvKey, {
        group_key: groupKey.trim(),
        user_ids: parseList(userIdsInput),
      })
      setGroupKey('')
      setUserIdsInput('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  /** Adds to the existing membership rather than replacing it. */
  async function addMembers(group, raw) {
    const additions = parseList(raw)
    if (!additions.length) return
    const merged = Array.from(new Set([...group.user_ids, ...additions]))
    await api.upsertUserGroup(selectedEnvKey, { group_key: group.group_key, user_ids: merged })
    load()
  }

  async function removeMember(group, userId) {
    await api.deleteUserGroupMember(selectedEnvKey, group.group_key, userId)
    load()
  }

  /**
   * Rename is a compose of the two endpoints the API already has: write the
   * membership under the new key, then drop it from the old one. There is no
   * rename endpoint, and adding one would mean touching a backend that works.
   *
   * The cost is that targeting rules referencing the old key keep referencing
   * it — the dialog says so, because silently breaking a rollout would be worse
   * than making the user do one more step.
   */
  async function renameGroup(group, nextKey) {
    const target = nextKey.trim()
    if (!target || target === group.group_key) return

    await api.upsertUserGroup(selectedEnvKey, { group_key: target, user_ids: group.user_ids })
    for (const userId of group.user_ids) {
      await api.deleteUserGroupMember(selectedEnvKey, group.group_key, userId)
    }
    setExpanded(target)
    load()
  }

  /** A group is its memberships; removing them all removes the group. */
  async function deleteGroup(group) {
    if (!confirm(t('deleteGroupConfirm', { key: group.group_key, count: group.user_ids.length }))) {
      return
    }
    for (const userId of group.user_ids) {
      await api.deleteUserGroupMember(selectedEnvKey, group.group_key, userId)
    }
    setExpanded(null)
    load()
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title={t('groupsTitle')} breadcrumb="FlagForge" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title={t('groupsTitle')}
            description={t('groupsSubtitle')}
            meta={
              <>
                <span>{t('memberCount', { count: totalUsers })}</span>
                <span>{t('groupCount', { count: groups.length })}</span>
              </>
            }
          />

          <Section>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard
                label={t('fieldEnvironment')}
                value={selectedEnv?.name || '—'}
                icon={Layers}
                tone="accent"
              />
              <StatCard label={t('statGroups')} value={groups.length} icon={Users} tone="good" />
              <StatCard
                label={t('statUniqueUsers')}
                value={totalUsers}
                icon={Users}
                tone="neutral"
              />
            </div>
          </Section>

          <Section title={t('fieldEnvironment')} description={t('groupsScopedHint')}>
            <div className="max-w-sm">
              <Dropdown
                value={selectedEnvKey}
                onChange={setSelectedEnvKey}
                placeholder={t('chooseEnvironment')}
                options={environments.map((env) => ({ value: env.key, label: env.name }))}
                renderOption={(option) => (
                  <span className="flex items-center gap-2">
                    <span
                      className={`signal-dot signal-dot--live ${ENV_DOT_COLOR[option.value] || 'bg-muted'}`}
                    />
                    {option.label}
                  </span>
                )}
                renderValue={(option) => (
                  <span className="flex items-center gap-2">
                    <span
                      className={`signal-dot signal-dot--live ${ENV_DOT_COLOR[option.value] || 'bg-muted'}`}
                    />
                    {option.label}
                  </span>
                )}
              />
            </div>
          </Section>

          {error && (
            <p className="mb-4 rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
              {error}
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Section title={t('createGroupTitle')} description={t('createGroupHint')}>
              <Card>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Field label={t('groupKey')}>
                    <Input
                      mono
                      required
                      value={groupKey}
                      onChange={(e) => setGroupKey(e.target.value)}
                      placeholder="beta_users"
                    />
                  </Field>
                  <Field label={t('userIds')} hint={t('userIdsHint')}>
                    <Textarea
                      mono
                      rows={5}
                      value={userIdsInput}
                      onChange={(e) => setUserIdsInput(e.target.value)}
                      placeholder="alice@example.com, bob@example.com"
                    />
                  </Field>
                  <Button
                    type="submit"
                    loading={saving}
                    icon={Plus}
                    className="w-full"
                    disabled={!isAdmin}
                  >
                    {t('saveGroup')}
                  </Button>
                </form>
              </Card>
            </Section>

            <Section title={t('existingGroups')} description={t('existingGroupsHint')}>
              {loading ? (
                <div className="h-44 animate-pulse rounded-xl bg-hoverBg" />
              ) : groups.length === 0 ? (
                <Card tone="outline" className="px-6 py-14 text-center">
                  <p className="text-sm text-muted">{t('noGroupsYet')}</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <GroupCard
                      key={group.group_key}
                      group={group}
                      isAdmin={isAdmin}
                      expanded={expanded === group.group_key}
                      onToggle={() =>
                        setExpanded((current) =>
                          current === group.group_key ? null : group.group_key
                        )
                      }
                      onAddMembers={addMembers}
                      onRemoveMember={removeMember}
                      onRename={renameGroup}
                      onDelete={deleteGroup}
                      onError={setError}
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * One group, with its management inline rather than behind a modal — editing a
 * membership is something you do repeatedly while looking at the rest of the
 * list, and a dialog would hide exactly the context you're comparing against.
 */
function GroupCard({
  group,
  isAdmin,
  expanded,
  onToggle,
  onAddMembers,
  onRemoveMember,
  onRename,
  onDelete,
  onError,
}) {
  const t = useT()
  const [renaming, setRenaming] = useState(false)
  const [nextKey, setNextKey] = useState(group.group_key)
  const [addInput, setAddInput] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action) {
    setBusy(true)
    try {
      await action()
      onError(null)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surfaceMuted"
      >
        <span className="signal-dot signal-dot--live shrink-0 bg-good" />
        <span className="min-w-0 flex-1 truncate identifier text-[13px] font-semibold text-ink">
          {group.group_key}
        </span>
        <Badge tone="neutral" mono>
          {t('memberCount', { count: group.user_ids.length })}
        </Badge>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="animate-fade-in border-t border-border bg-surfaceMuted p-4">
          {/* ── Members ───────────────────────────────────────────── */}
          <p className="mb-2 text-[11px] font-medium text-muted">
            {t('userIds')}
          </p>
          {group.user_ids.length === 0 ? (
            <p className="text-sm text-muted">{t('noMembers')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {group.user_ids.map((userId) => (
                <span
                  key={userId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 identifier text-[11px] text-ink"
                >
                  {userId}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => run(() => onRemoveMember(group, userId))}
                      aria-label={t('removeFromGroup')}
                      title={t('removeFromGroup')}
                      className="rounded text-muted transition-colors hover:text-bad"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {isAdmin && (
            <>
              {/* ── Add members ─────────────────────────────────────── */}
              <form
                className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(async () => {
                    await onAddMembers(group, addInput)
                    setAddInput('')
                  })
                }}
              >
                <div className="flex-1">
                  <Field label={t('addMembers')} hint={t('addMembersHint')}>
                    <Input
                      mono
                      value={addInput}
                      onChange={(e) => setAddInput(e.target.value)}
                      placeholder="carol@example.com"
                    />
                  </Field>
                </div>
                <Button type="submit" size="sm" icon={UserPlus} loading={busy} className="sm:mb-5">
                  {t('add')}
                </Button>
              </form>

              {/* ── Rename / delete ─────────────────────────────────── */}
              <div className="mt-4 border-t border-border pt-4">
                {renaming ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      run(async () => {
                        await onRename(group, nextKey)
                        setRenaming(false)
                      })
                    }}
                  >
                    <Field label={t('newGroupKey')} hint={t('renameGroupWarning')}>
                      <Input
                        mono
                        autoFocus
                        required
                        value={nextKey}
                        onChange={(e) => setNextKey(e.target.value)}
                      />
                    </Field>
                    <div className="mt-3 flex gap-2">
                      <Button type="submit" size="sm" loading={busy}>
                        {t('save')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRenaming(false)
                          setNextKey(group.group_key)
                        }}
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Pencil}
                      onClick={() => setRenaming(true)}
                    >
                      {t('renameGroup')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      loading={busy}
                      onClick={() => run(() => onDelete(group))}
                    >
                      {t('deleteGroup')}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
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
