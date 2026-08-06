import { useNavigate } from 'react-router-dom'
import { Flag, AlertCircle, ChevronRight } from 'lucide-react'
import { Table, Row, Cell, LeadCell, TableSkeleton, EmptyState } from './ui/Table'
import Badge from './ui/Badge'
import { useT } from '../context/LanguageContext'

const TYPE_LABEL_KEY = { boolean: 'typeBoolean', string: 'typeString', number: 'typeNumber' }

export default function FlagTable({ flags, loading, error }) {
  const navigate = useNavigate()
  const t = useT()

  if (loading) return <TableSkeleton rows={4} cols={5} />
  if (error) {
    return <EmptyState icon={AlertCircle} title={t('flagsLoadError')} description={error} />
  }
  if (flags.length === 0) {
    return <EmptyState icon={Flag} title={t('noFlagsTitle')} description={t('noFlagsHint')} />
  }

  return (
    <Table
      columns={[
        t('colFeatureFlag'),
        t('fieldType'),
        t('fieldStatus'),
        t('colOwner'),
        t('fieldDescription'),
      ]}
    >
      {flags.map((flag) => (
        <Row key={flag.id} onClick={() => navigate(`/flags/${encodeURIComponent(flag.key)}`)}>
          <LeadCell>
            <div className="flex items-center gap-2.5">
              <span
                className={`signal-dot ${flag.enabled ? 'signal-dot--live bg-good' : 'bg-muted'}`}
              />
              <span className="font-mono text-[13px] font-semibold text-ink">{flag.key}</span>
            </div>
          </LeadCell>
          <Cell>
            {/* `flag.type` is an API value; the label around it is prose, so it
                translates while the underlying value never does. */}
            <span className="text-[12px] text-muted">
              {TYPE_LABEL_KEY[flag.type] ? t(TYPE_LABEL_KEY[flag.type]) : flag.type}
            </span>
          </Cell>
          <Cell>
            <Badge tone={flag.enabled ? 'good' : 'neutral'}>
              {flag.enabled ? t('enabled') : t('disabled')}
            </Badge>
          </Cell>
          <Cell className="text-[13px] text-muted">{flag.owner_team || '—'}</Cell>
          <Cell className="max-w-xs truncate text-[13px] text-muted">
            <span className="flex items-center gap-2">
              {flag.description || '—'}
              <ChevronRight className="rtl-flip ms-auto h-4 w-4 text-borderStrong" />
            </span>
          </Cell>
        </Row>
      ))}
    </Table>
  )
}
