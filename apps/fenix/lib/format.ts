/**
 * Pure formatters for the dashboard.
 */

export function relativeTime(ts: number | null | undefined, now: number = Date.now()): string {
  if (ts == null) return '—'
  const diff = now - ts
  if (diff < 0) return 'now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function shortSha(sha: string | null | undefined): string {
  if (!sha) return '—'
  return sha.slice(0, 8)
}

export function statusTone(status: string): 'ok' | 'in-flight' | 'halted' | 'idle' | 'planned' {
  if (status === 'green') return 'ok'
  if (status === 'halted') return 'halted'
  if (status === 'planned') return 'planned'
  if (status === 'idle') return 'idle'
  return 'in-flight'
}
