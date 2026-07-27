import { useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronRight, Flag } from 'lucide-react'
import { Badge, Cell, EmptyState, Row, Table, TableSkeleton } from './ui'

const TYPE_LABEL = { boolean: 'Boolean', string: 'String', number: 'Number' }

const COLUMNS = [
  { label: 'Feature flag', width: '34%' },
  { label: 'Type', width: '10%' },
  { label: 'Status', width: '12%' },
  { label: 'Owner', width: '14%', hideBelow: 'md' },
  { label: 'Description', width: '26%', hideBelow: 'lg' },
  { label: '', width: '4%', align: 'right' },
]

export default function FlagTable({ flags, loading, error, onCreate }) {
  const navigate = useNavigate()

  if (loading) return <TableSkeleton rows={5} cols={5} />
  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        tone="bad"
        title="Couldn't load flags"
        description={error}
      />
    )
  }
  if (flags.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="No flags match"
        description="Create a flag to start controlling a feature without shipping a deploy, or clear your filters to see everything."
        action={onCreate}
      />
    )
  }

  return (
    <Table columns={COLUMNS}>
      {flags.map((flag) => (
        <Row key={flag.id} onClick={() => navigate(`/flags/${encodeURIComponent(flag.key)}`)}>
          <Cell>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`signal-dot ${flag.enabled ? 'signal-dot--live bg-good' : 'bg-muted'}`}
                aria-hidden="true"
              />
              <span className="truncate font-mono text-sm font-semibold text-ink">{flag.key}</span>
            </div>
          </Cell>
          <Cell>
            <span className="text-xs text-muted">{TYPE_LABEL[flag.type] || flag.type}</span>
          </Cell>
          <Cell>
            <Badge tone={flag.enabled ? 'good' : 'neutral'}>
              {flag.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Cell>
          <Cell hideBelow="md" className="text-muted">
            <span className="block truncate">{flag.owner_team || '—'}</span>
          </Cell>
          <Cell hideBelow="lg" className="text-muted">
            <span className="block truncate">{flag.description || '—'}</span>
          </Cell>
          <Cell align="right">
            <ChevronRight
              className="ml-auto h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </Cell>
        </Row>
      ))}
    </Table>
  )
}
