import { cn } from '@/lib/cn'

const STEPS = [
  { id: 'planned', label: 'plan' },
  { id: 'contract', label: 'contract' },
  { id: 'checks', label: 'pin-checks' },
  { id: 'implement-a', label: 'impl·A' },
  { id: 'implement-b', label: 'impl·B' },
  { id: 'implement-c', label: 'impl·C' },
  { id: 'validate', label: 'validate' },
  { id: 'publish', label: 'publish' },
  { id: 'green', label: 'green' },
] as const

type Step = (typeof STEPS)[number]['id']

export function Pipeline({ status }: { status: string }) {
  const reached = (id: Step): 'done' | 'current' | 'pending' | 'halted' => {
    if (status === 'halted') {
      const i = STEPS.findIndex((s) => s.id === id)
      return i === 0 ? 'halted' : 'pending'
    }
    const currentIdx = STEPS.findIndex((s) => s.id === status)
    const stepIdx = STEPS.findIndex((s) => s.id === id)
    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'current'
    return 'pending'
  }

  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-mono">
      {STEPS.map((step, i) => {
        const state = reached(step.id)
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full border w-7 h-7 text-[10px] font-medium',
                state === 'done' && 'border-primary/50 bg-primary/15 text-primary',
                state === 'current' && 'border-primary bg-primary text-primary-foreground animate-pulse',
                state === 'pending' && 'border-border bg-muted/20 text-muted-foreground',
                state === 'halted' && 'border-destructive/50 bg-destructive/15 text-destructive',
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                state === 'current' && 'text-foreground font-medium',
                state === 'pending' && 'text-muted-foreground',
                state === 'halted' && 'text-destructive',
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground/40 mx-1">→</span>}
          </li>
        )
      })}
    </ol>
  )
}
