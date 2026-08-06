import { ArrowRight } from 'lucide-react'
import { useT } from '../context/LanguageContext'
import { Badge, Modal } from './ui'

export const ACTION_KEY = {
  created: 'actionCreated',
  updated: 'actionUpdated',
  enabled: 'actionEnabled',
  disabled: 'actionDisabled',
  toggled: 'actionToggled',
  deleted: 'actionDeleted',
}

export const ENTITY_KEY = {
  flag: 'entityFlag',
  targeting_rule: 'entityTargetingRule',
  environment_override: 'entityEnvironmentOverride',
  user_group_membership: 'entityGroupMembership',
  environment: 'entityEnvironment',
  user: 'entityUser',
}

function formatValue(value, emptyLabel) {
  if (value === undefined || value === null) return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : emptyLabel
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  if (value === '') return emptyLabel
  return String(value)
}

/**
 * Shows what one audit entry changed: a field-by-field before/after, then the
 * raw JSON either side for anything the field view can't convey.
 */
export default function AuditDiffModal({ entry, onClose }) {
  const t = useT()
  if (!entry) return null

  const diff = entry.diff || {}
  const fields = Object.keys(diff)

  return (
    <Modal
      open
      onClose={onClose}
      title={t('diffTitle', {
        action: t(ACTION_KEY[entry.action] || 'fieldAction'),
        entity: t(ENTITY_KEY[entry.entity_type] || 'entityTypeLabel'),
      })}
      description={t('diffSubtitle', {
        key: entry.entity_key || entry.entity_id,
        actor: entry.actor,
        date: new Date(entry.timestamp).toLocaleString(),
      })}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{t(ENTITY_KEY[entry.entity_type] || 'entityTypeLabel')}</Badge>
          {entry.environment_key && <Badge tone="neutral">{entry.environment_key}</Badge>}
          <Badge tone="neutral">{t('diffFieldsChanged', { count: fields.length })}</Badge>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-lg border border-border bg-surfaceMuted px-4 py-3 text-sm text-muted">
            {t('diffNoFieldChanges')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surfaceMuted">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-muted">
                    {t('fieldField')}
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-muted">
                    {t('fieldBefore')}
                  </th>
                  <th className="w-8" />
                  <th className="px-4 py-2.5 text-[11px] font-medium text-muted">
                    {t('fieldAfter')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field} className="border-b border-border/70 align-top last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{field}</td>
                    <td className="px-4 py-3">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-bad">
                        {formatValue(diff[field].before, t('empty'))}
                      </pre>
                    </td>
                    <td className="px-1 py-3 text-center">
                      <ArrowRight className="mx-auto h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    </td>
                    <td className="px-4 py-3">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-good">
                        {formatValue(diff[field].after, t('empty'))}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="rounded-lg border border-border bg-surfaceMuted">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-ink">
            {t('diffRawJson')}
          </summary>
          <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-medium text-muted">
                {t('fieldBefore')}
              </p>
              <pre className="max-h-56 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink">
                {JSON.stringify(entry.before_state ?? null, null, 2)}
              </pre>
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-medium text-muted">
                {t('fieldAfter')}
              </p>
              <pre className="max-h-56 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink">
                {JSON.stringify(entry.after_state ?? null, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      </div>
    </Modal>
  )
}
