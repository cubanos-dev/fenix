'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'

type Intent = 'primary' | 'quiet' | 'danger'

interface ControlButtonProps {
  label: string
  payload: Record<string, unknown>
  confirm?: string
  intent?: Intent
}

export function ControlButton({ label, payload, confirm, intent = 'primary' }: ControlButtonProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  const run = () => {
    if (confirm && !window.confirm(confirm)) return
    setResult(null)
    startTransition(async () => {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string }
      setResult(res.ok ? (json.status ?? 'ok') : `error: ${json.error ?? res.statusText}`)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
          intent === 'primary' && 'bg-primary text-primary-foreground hover:opacity-90',
          intent === 'quiet' && 'bg-muted text-foreground hover:bg-muted/80',
          intent === 'danger' && 'bg-destructive text-destructive-foreground hover:opacity-90',
        )}
      >
        {label}
      </button>
      {result && <span className="text-xs font-mono text-muted-foreground">{result}</span>}
    </span>
  )
}
