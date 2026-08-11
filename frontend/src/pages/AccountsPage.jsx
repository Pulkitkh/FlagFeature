import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react'
import Navbar from '../components/Navbar'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import {
  Badge,
  Button,
  Card,
  Cell,
  Dropdown,
  EmptyState,
  Field,
  Input,
  LeadCell,
  Modal,
  PageHeader,
  Row,
  StatCard,
  Table,
  TableSkeleton,
} from '../components/ui'

// Values are the API's role enum; only the labels translate.
const ROLE_KEYS = [
  { value: 'viewer', labelKey: 'roleViewerOption' },
  { value: 'admin', labelKey: 'roleAdminOption' },
]

export default function AccountsPage() {
  const { user: currentUser } = useAuth()
  const t = useT()
  const roleOptions = ROLE_KEYS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))
  const formatDate = (value) => (value ? new Date(value).toLocaleString() : t('never'))

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
      <Navbar title={t('accountsTitle')} breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title={t('accountsTitle')}
            description={t('accountsSubtitle')}
            action={
              <Button icon={UserPlus} onClick={() => setShowInvite(true)}>
                {t('addAccount')}
              </Button>
            }
          />

          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label={t('statAccounts')} value={stats.total} icon={UserCheck} tone="accent" />
            <StatCard label={t('statAdmins')} value={stats.admins} icon={ShieldCheck} tone="good" />
            <StatCard
              label={t('statDeactivated')}
              value={stats.inactive}
              icon={UserX}
              tone="neutral"
            />
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
              title={t('noAccountsTitle')}
              description={t('noAccountsHint')}
            />
          ) : (
            <Table
              columns={[
                t('colPerson'),
                t('fieldRole'),
                t('fieldStatus'),
                t('colLastSignedIn'),
                { label: '', align: 'end' },
              ]}
            >
              {accounts.map((account) => {
                const isSelf = account.id === currentUser?.id
                return (
                  <Row key={account.id}>
                    <LeadCell>
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {account.name || '—'}
                        {isSelf && <span className="ms-2 text-xs text-muted">{t('labelYou')}</span>}
                      </span>
                      <span className="block truncate identifier text-[11px] text-muted">
                        {account.email}
                      </span>
                    </LeadCell>
                    <Cell>
                      <div className="w-48">
                        <Dropdown
                          value={account.role}
                          onChange={(role) => mutate(account, { role })}
                          options={roleOptions}
                        />
                      </div>
                    </Cell>
                    <Cell>
                      <Badge tone={account.is_active ? 'good' : 'neutral'} dot live={account.is_active}>
                        {account.is_active ? t('activeState') : t('deactivatedState')}
                      </Badge>
                    </Cell>
                    <Cell className="whitespace-nowrap identifier text-xs text-muted">
                      {formatDate(account.last_login_at)}
                    </Cell>
                    <Cell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={KeyRound}
                          className="whitespace-nowrap"
                          onClick={() => setResetTarget(account)}
                        >
                          {t('resetPassword')}
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
                              ? t('cannotDeactivateSelf')
                              : undefined
                          }
                          className="whitespace-nowrap"
                          onClick={() => mutate(account, { is_active: !account.is_active })}
                        >
                          {account.is_active ? t('deactivate') : t('reactivate')}
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
  const t = useT()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError(t('passwordTooShort'))
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
      title={t('addAccountTitle')}
      description={t('addAccountHint')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('email')}>
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
          />
        </Field>
        <Field label={t('fieldName')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Shah" />
        </Field>
        <Field label={t('startingPassword')} hint={t('passwordMinHint')}>
          <Input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="something-they-can-change"
          />
        </Field>
        <Field label={t('fieldRole')}>
          <Dropdown
            value={role}
            onChange={setRole}
            options={ROLE_KEYS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
          />
        </Field>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button type="submit" icon={Plus} loading={saving}>
            {t('addAccount')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordDialog({ account, onClose, onDone }) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password.length < 8) {
      setError(t('passwordTooShort'))
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
      title={t('resetPasswordFor', { email: account.email })}
      description={t('resetPasswordHint')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('newPassword')} hint={t('passwordMinHint')}>
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
            {t('cancel')}
          </Button>
          <Button type="submit" icon={KeyRound} loading={saving}>
            {t('resetPassword')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
