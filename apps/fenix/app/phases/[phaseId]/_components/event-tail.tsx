'use client'

import { useEffect, useState } from 'react'
import type { FenixEvent } from '@/lib/queries'

export function EventTail({ phaseId, initial }: { phaseId: string; initial: FenixEvent[] }) {
  // Initial sinceId is captured once at mount from the server-rendered seed.
  // We deliberately do not re-subscribe when `events` changes — the SSE
  // stream pushes everything newer than the original seed id.
  const initialSinceId = initial.length > 0 ? initial[0].id : 0
  const [events, setEvents] = useState<FenixEvent[]>(initial)
  const [connected, setConnected] = useState<'connecting' | 'live' | 'closed'>('connecting')

  useEffect(() => {
    const url = `/api/events/stream?phase=${encodeURIComponent(phaseId)}&sinceId=${initialSinceId}`
    const source = new EventSource(url)
    source.onopen = () => setConnected('live')
    source.onerror = () => setConnected('closed')
    source.addEventListener('event', (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as FenixEvent
        setEvents((prev) => [payload, ...prev].slice(0, 100))
      } catch {
        /* ignore malformed frame */
      }
    })
    return () => source.close()
  }, [phaseId, initialSinceId])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 text-xs">
        <span className="font-mono text-muted-foreground">events</span>
        <span className="font-mono text-muted-foreground">{connected}</span>
      </div>
      <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">no events yet</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="px-3 py-2 text-xs font-mono">
              <span className="text-muted-foreground">{new Date(e.ts).toISOString().slice(11, 19)}</span>
              <span className="ml-3 text-foreground">
                <code>{e.stage}</code>/<code>{e.kind}</code>
              </span>
              {e.payload_json && <div className="ml-12 text-muted-foreground/80 truncate">{e.payload_json}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
