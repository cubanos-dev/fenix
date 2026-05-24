import { cn } from '@/lib/cn'
import type { Overview } from '@/lib/queries'

export function MetricStrip({ overview }: { overview: Overview }) {
  const metrics = [
    { label: 'versions', value: overview.totalVersions },
    { label: 'phases', value: overview.totalPhases },
    { label: 'green', value: overview.phasesGreen, tone: 'ok' as const },
    { label: 'in-flight', value: overview.phasesInFlight, tone: 'in-flight' as const },
    { label: 'halted', value: overview.phasesHalted, tone: 'halted' as const },
    { label: 'feedback', value: overview.pendingFeedback, tone: 'in-flight' as const },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={cn(
            'rounded-lg border border-border bg-card px-4 py-3',
            m.value > 0 && m.tone === 'halted' && 'border-destructive/40',
            m.value > 0 && m.tone === 'ok' && 'border-primary/40',
          )}
        >
          <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</div>
        </div>
      ))}
    </div>
  )
}
