import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

/**
 * Replaces window.confirm for destructive actions, so a delete can show what
 * is about to be destroyed, report a failure inline, and stay on-brand.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  children,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function handleClose() {
    if (busy) return
    setError(null)
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={handleConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 rounded-lg border border-warn/25 bg-warnSoft p-3.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        <div className="min-w-0 text-sm text-inkSubtle">
          {children || 'This action cannot be undone.'}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </Modal>
  )
}
