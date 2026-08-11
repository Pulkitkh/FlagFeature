import { Check, Minus, PowerOff, Percent, Users, UserCheck, Layers, CornerDownRight } from 'lucide-react'
import { useT } from '../context/LanguageContext'

/**
 * The evaluation engine's priority ladder, with the step that actually decided
 * the value lit up.
 *
 * This is the one screen in the console that explains *why* a flag resolved the
 * way it did. The API already returns a `reason`; all this does is put that
 * reason back into the ordered chain it came from, so "true because of a
 * percentage rollout" is visible as a position in a sequence rather than as a
 * string you have to know how to read.
 *
 * Steps above the deciding one were evaluated and didn't match; steps below it
 * were never reached. Those are genuinely different states and are drawn
 * differently.
 */
const STEPS = [
  { reason: 'flag_disabled', labelKey: 'stepKillSwitch', icon: PowerOff },
  { reason: 'user_targeting', labelKey: 'stepUserTargeting', icon: UserCheck },
  { reason: 'group_targeting', labelKey: 'stepGroupTargeting', icon: Users },
  { reason: 'percentage_rollout', labelKey: 'stepPercentage', icon: Percent },
  {
    // The engine reports the override with its outcome baked into the code.
    reason: 'environment_override',
    matches: (r) => r.startsWith('environment_override'),
    labelKey: 'stepEnvOverride',
    icon: Layers,
  },
  { reason: 'default_value', labelKey: 'stepDefault', icon: CornerDownRight },
]

function decidingIndex(reason) {
  if (!reason) return -1
  return STEPS.findIndex((step) =>
    step.matches ? step.matches(reason) : step.reason === reason
  )
}

export default function DecisionTrace({ result, loading }) {
  const t = useT()
  const active = decidingIndex(result?.reason)

  if (loading) {
    return (
      <div className="space-y-2">
        {STEPS.map((step) => (
          <div key={step.reason} className="h-11 animate-pulse rounded-lg bg-hoverBg" />
        ))}
      </div>
    )
  }

  return (
    <ol className="relative space-y-1.5">
      {STEPS.map((step, index) => {
        const isActive = index === active
        const isSkipped = active >= 0 && index < active
        const isUnreached = active >= 0 && index > active
        const Icon = step.icon

        return (
          <li
            key={step.reason}
            className="animate-trace-in"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <div
              className={`relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                isActive
                  ? 'border-accentDark bg-accent text-bg shadow-soft'
                  : isSkipped
                    ? 'border-border bg-surface text-muted'
                    : 'border-dashed border-border bg-transparent text-muted/60'
              }`}
            >
              <span
                className={`identifier text-[11px] tnum ${isActive ? 'text-bg/70' : 'text-muted/70'}`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-bg' : ''}`} />

              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${
                  isActive ? 'font-semibold' : 'font-medium'
                }`}
              >
                {t(step.labelKey)}
              </span>

              {isActive && (
                <span className="flex items-center gap-1.5 rounded-md bg-bg/15 px-2 py-0.5 text-[11px] font-semibold">
                  <Check className="h-3 w-3" />
                  {t('traceDecided')}
                </span>
              )}
              {isSkipped && (
                <span className="flex items-center gap-1 text-[11px] font-medium">
                  <Minus className="h-3 w-3" />
                  {t('traceSkipped')}
                </span>
              )}
              {isUnreached && (
                <span className="text-[11px] font-medium">
                  {t('traceNotReached')}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
