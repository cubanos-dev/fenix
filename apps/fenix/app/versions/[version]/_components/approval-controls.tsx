'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/cn'

export function ApprovalControls({ version }: { version: string }) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState('')
  const [why, setWhy] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const submitApprove = () => {
    setResult(null)
    startTransition(async () => {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'approve', stage: `design:${version}` }),
      })
      const json = (await res.json()) as { status: string; error?: string }
      setResult(res.ok ? `approved design:${version}` : `error: ${json.error ?? res.statusText}`)
    })
  }

  const submitFeedback = () => {
    if (feedback.trim().length === 0) {
      setResult('change is required')
      return
    }
    setResult(null)
    startTransition(async () => {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          version,
          change: feedback.trim(),
          why: why.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { status: string; error?: string }
      if (res.ok) {
        setFeedback('')
        setWhy('')
        setResult(`feedback recorded — run /fenix-auto design ${version} to iterate`)
      } else {
        setResult(`error: ${json.error ?? res.statusText}`)
      }
    })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Approve or request changes</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <button
          type="button"
          disabled={pending}
          onClick={submitApprove}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50',
          )}
        >
          Approve <code className="font-mono">design:{version}</code>
        </button>
        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-sm font-medium">Request changes</div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What should change? (one-line directive — e.g. 'tighten hero spacing')"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
            disabled={pending}
          />
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Why? (optional — gives the iteration agent context)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
            disabled={pending}
          />
          <button
            type="button"
            disabled={pending || feedback.trim().length === 0}
            onClick={submitFeedback}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50',
            )}
          >
            Record feedback
          </button>
        </div>
        {result && <div className="text-xs text-muted-foreground font-mono pt-2 border-t border-border">{result}</div>}
      </div>
    </section>
  )
}
