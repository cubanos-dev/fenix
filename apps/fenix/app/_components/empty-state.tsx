import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title: string
  body: string
  small?: boolean
}

export function EmptyState({ title, body, small }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border bg-muted/20 text-muted-foreground',
        small ? 'px-4 py-6' : 'px-6 py-10',
      )}
    >
      <div className={cn('font-medium text-foreground', small ? 'text-sm' : 'text-base')}>{title}</div>
      <p className={cn('mt-1 max-w-prose', small ? 'text-xs' : 'text-sm')}>{body}</p>
    </div>
  )
}
