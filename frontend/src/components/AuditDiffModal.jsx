import { ArrowRight } from 'lucide-react'
import { Badge, Modal } from './ui'

function formatValue(value) {
  if (value === undefined || value === null) return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(empty)'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  if (value === '') return '(empty)'
  return String(value)
}

/**
 * Shows what one audit entry changed: a field-by-field before/after, then the
 * raw JSON either side for anything the field view can't convey.
 */
export default function AuditDiffModal({ entry, onClose }) {
  if (!entry) return null

  const diff = entry.diff || {}
  const fields = Object.keys(diff)

  return (
    <Modal
      open
      onClose={onClose}
      title={`${entry.action} ${entry.entity_type}`}
      description={`${entry.entity_key || entry.entity_id} · by ${entry.actor} · ${new Date(
        entry.timestamp
      ).toLocaleString()}`}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{entry.entity_type}</Badge>
          {entry.environment_key && <Badge tone="neutral">{entry.environment_key}</Badge>}
          <Badge tone="neutral">{fields.length} field{fields.length === 1 ? '' : 's'} changed</Badge>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-lg border border-border bg-surfaceMuted px-4 py-3 text-sm text-muted">
            This entry recorded no field-level changes.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surfaceMuted">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Field
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Before
                  </th>
                  <th className="w-8" />
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field} className="border-b border-border/70 align-top last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{field}</td>
                    <td className="px-4 py-3">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-bad">
                        {formatValue(diff[field].before)}
                      </pre>
                    </td>
                    <td className="px-1 py-3 text-center">
                      <ArrowRight className="mx-auto h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    </td>
                    <td className="px-4 py-3">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-good">
                        {formatValue(diff[field].after)}
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
            Raw JSON
          </summary>
          <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Before
              </p>
              <pre className="max-h-56 overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink">
                {JSON.stringify(entry.before_state ?? null, null, 2)}
              </pre>
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                After
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
