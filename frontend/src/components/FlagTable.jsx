import { useNavigate } from 'react-router-dom'
import { Flag, AlertCircle, ChevronRight, Code2 } from 'lucide-react'
import { Table, Row, Cell, TableSkeleton, EmptyState } from './ui/Table'
import Badge from './ui/Badge'

const TYPE_LABEL = { boolean: 'Boolean', string: 'String', number: 'Number' }

export default function FlagTable({ flags, loading, error }) {
  const navigate = useNavigate()
  if (loading) return <TableSkeleton rows={4} cols={5} />
  if (error) return <EmptyState icon={AlertCircle} title="Couldn't load flags" description={error} />
  if (flags.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="No flags yet"
        description="Create your first flag to start controlling a feature without a deploy."
      />
    )
  }

  return (
    <Table columns={['Feature flag', 'Type', 'Status', 'Owner', 'Description']}>
      {flags.map((flag) => (
        <Row key={flag.id} onClick={() => navigate(`/flags/${encodeURIComponent(flag.key)}`)}>
          <Cell>
            <div className="flex items-center gap-2.5">
              <span className={`signal-dot ${flag.enabled ? 'signal-dot--live bg-good' : 'bg-muted'}`} />
              <span className="font-mono text-sm font-semibold text-ink">{flag.key}</span>
            </div>
          </Cell>
          <Cell>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Code2 className="h-3.5 w-3.5" />
              {TYPE_LABEL[flag.type] || flag.type}
            </span>
          </Cell>
          <Cell>
            <Badge tone={flag.enabled ? 'good' : 'neutral'}>{flag.enabled ? 'Enabled' : 'Disabled'}</Badge>
          </Cell>
          <Cell className="text-muted">{flag.owner_team || '—'}</Cell>
          <Cell className="max-w-xs truncate text-muted">
            <span className="flex items-center gap-2">
              {flag.description || '—'}
              <ChevronRight className="ml-auto h-4 w-4 text-border" />
            </span>
          </Cell>
        </Row>
      ))}
    </Table>
  )
}
