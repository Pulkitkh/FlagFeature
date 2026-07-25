import { useEnvironment } from '../context/EnvironmentContext'
import { Layers } from 'lucide-react'

const DOT_TONE = {
  development: 'bg-muted',
  staging: 'bg-warn',
  production: 'bg-bad',
}

export default function EnvironmentSwitcher() {
  const { environments, selectedEnv, setSelectedEnvKey, loading } = useEnvironment()

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-hoverBg" />
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-hairline">
      <Layers className="h-3.5 w-3.5 text-muted" />
      <span
        className={`signal-dot ${selectedEnv ? 'signal-dot--live' : ''} ${
          DOT_TONE[selectedEnv?.key] || 'bg-accent'
        }`}
      />
      <select
        value={selectedEnv?.key || ''}
        onChange={(e) => setSelectedEnvKey(e.target.value)}
        aria-label="Selected environment"
        className="bg-transparent text-sm font-semibold text-ink outline-none"
      >
        {environments.map((env) => (
          <option key={env.key} value={env.key}>
            {env.name}
          </option>
        ))}
      </select>
    </div>
  )
}
