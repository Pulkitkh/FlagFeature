import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react'
import Navbar from '../components/Navbar'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Badge,
  Button,
  Card,
  Cell,
  Dropdown,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Row,
  StatCard,
  Table,
  TableSkeleton,
} from '../components/ui'

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer — read only' },
  { value: 'admin', label: 'Admin — can change everything' },
]

const COLUMNS = ['Person', 'Role', 'Status', 'Last signed in', '']

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Never'
}

export default function AccountsPage() {
  const { user: currentUser } = useAuth()

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .listAccounts()
      .then((data) => {
        setAccounts(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const admins = accounts.filter((account) => account.role === 'admin' && account.is_active)
    return {
      total: accounts.length,
      admins: admins.length,
      inactive: accounts.filter((account) => !account.is_active).length,
    }
  }, [accounts])

  async function mutate(account, payload) {
    setBusyId(account.id)
    setError(null)
    try {
      await api.updateAccount(account.id, payload)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title="Accounts" breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title="Accounts"
            description="Who can sign in, and what they're allowed to do. Admins change flags; viewers can see everything but change nothing."
            action={
              <Button icon={UserPlus} onClick={() => setShowInvite(true)}>
                Add account
              </Button>
            }
          />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label="Accounts" value={stats.total} icon={UserCheck} tone="accent" />
            <StatCard label="Admins" value={stats.admins} icon={ShieldCheck} tone="good" />
            <StatCard label="Deactivated" value={stats.inactive} icon={UserX} tone="neutral" />
          </div>

          {error && (
            <Card className="mb-6 border-bad/25 bg-badSoft">
              <p className="text-sm text-bad">{error}</p>
            </Card>
          )}

          {loading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No accounts yet"
              description="Add one to let someone else into the console."
            />
          ) : (
            <Table columns={COLUMNS}>
              {accounts.map((account) => {
                const isSelf = account.id === currentUser?.id
                return (
                  <Row key={account.id}>
                    <Cell>
                      <span className="block truncate text-sm font-medium text-ink">
                        {account.name || '—'}
                        {isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted">
                        {account.email}
                      </span>
                    </Cell>
                    <Cell>
                      <div className="w-48">
                        <Dropdown
                          value={account.role}
                          onChange={(role) => mutate(account, { role })}
                          options={ROLE_OPTIONS}
                        />
                      </div>
                    </Cell>
                    <Cell>
                      <Badge tone={account.is_active ? 'good' : 'neutral'} dot live={account.is_active}>
                        {account.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                    </Cell>
                    <Cell className="whitespace-nowrap font-mono text-xs text-muted">
                      {formatDate(account.last_login_at)}
                    </Cell>
                    <Cell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={KeyRound}
                          className="whitespace-nowrap"
                          onClick={() => setResetTarget(account)}
                        >
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant={account.is_active ? 'danger' : 'success'}
                          loading={busyId === account.id}
                          // Deactivating yourself would lock you out mid-session;
                          // the backend refuses it too.
                          disabled={isSelf && account.is_active}
                          title={
                            isSelf && account.is_active
                              ? "You can't deactivate your own account"
                              : undefined
                          }
                          className="whitespace-nowrap"
                          onClick={() => mutate(account, { is_active: !account.is_active })}
                        >
                          {account.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </Cell>
                  </Row>
                )
              })}
            </Table>
          )}
        </div>
      </div>

      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            setShowInvite(false)
            load()
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordDialog
          account={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => {
            setResetTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function InviteDialog({ onClose, onCreated }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.createAccount({ email: email.trim(), name: name.trim(), password, role })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add an account"
      description="Set a starting password and share it with them — they can change it once they're in."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
          />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Shah" />
        </Field>
        <Field label="Starting password" hint="At least 8 characters.">
          <Input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="something-they-can-change"
          />
        </Field>
        <Field label="Role">
          <Dropdown value={role} onChange={setRole} options={ROLE_OPTIONS} />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" icon={Plus} loading={saving}>
            Add account
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordDialog({ account, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.updateAccount(account.id, { password })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password for ${account.email}`}
      description="They'll need this to sign in. Existing sessions keep working until the token expires."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input
            type="text"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" icon={KeyRound} loading={saving}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
