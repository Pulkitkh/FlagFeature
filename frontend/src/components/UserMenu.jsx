import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, KeyRound, LogOut, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import { api } from '../api/client'
import { Badge, Button, Field, Input, Modal } from './ui'

function initials(user) {
  const source = (user?.name || user?.email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return (parts[0]?.[0] || '?').concat(parts[1]?.[0] || '').toUpperCase()
}

export default function UserMenu() {
  const navigate = useNavigate()
  const { user, isAdmin, signOut } = useAuth()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((isOpen) => !isOpen)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
            open ? 'border-accent bg-accentSoft' : 'border-border bg-surface hover:bg-surfaceMuted'
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white">
            {initials(user)}
          </span>
          <span className="hidden max-w-[9rem] truncate font-medium text-ink sm:block">
            {user.name || user.email}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute end-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-floating"
          >
            <div className="border-b border-border px-3 py-3">
              <p className="truncate text-sm font-semibold text-ink">{user.name || 'Signed in'}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              <div className="mt-2">
                <Badge tone={isAdmin ? 'accent' : 'neutral'} icon={isAdmin ? ShieldCheck : undefined}>
                  {isAdmin ? 'Admin' : 'Viewer — read only'}
                </Badge>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  navigate('/accounts')
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surfaceMuted"
              >
                <Users className="h-4 w-4 text-muted" />
                {t('navAccounts')}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setShowPasswordDialog(true)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surfaceMuted"
            >
              <KeyRound className="h-4 w-4 text-muted" />
              Change password
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                signOut()
                navigate('/login', { replace: true })
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-bad transition-colors hover:bg-badSoft"
            >
              <LogOut className="h-4 w-4" />
              {t('signOut')}
            </button>
          </div>
        )}
      </div>

      {showPasswordDialog && (
        <ChangePasswordDialog onClose={() => setShowPasswordDialog(false)} />
      )}
    </>
  )
}

function ChangePasswordDialog({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    // Caught here rather than at the API, so the message points at the field.
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.")
      return
    }
    if (newPassword.length < 8) {
      setError('Use at least 8 characters.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.changeOwnPassword(currentPassword, newPassword)
      setDone(true)
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
      title="Change password"
      description="You'll stay signed in on this device."
    >
      {done ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-good/25 bg-goodSoft px-3 py-2.5 text-sm text-good">
            Password changed. Use the new one next time you sign in.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-bad">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Change password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
