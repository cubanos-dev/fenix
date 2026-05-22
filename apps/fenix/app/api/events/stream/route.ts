/**
 * /api/events/stream — Server-Sent Events tail of `events` table.
 *
 * Query params:
 *   ?phase=<id>    — filter to one phase (optional)
 *   ?sinceId=<n>   — only emit events with id > sinceId
 *
 * Closes the connection after 5 minutes of idle time so clients can re-
 * subscribe and the server doesn't leak read handles.
 */

import { type FenixEvent, listEvents } from '@/lib/queries'

// We rely on the default Next runtime — under `bun --bun next dev` this is
// Bun, which can resolve `bun:sqlite`. Pinning to 'nodejs' would break the
// query layer.

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const phase = url.searchParams.get('phase') ?? undefined
  let sinceId = Number(url.searchParams.get('sinceId') ?? '0') || 0

  const POLL_MS = 1000
  const MAX_IDLE_MS = 5 * 60_000

  const encoder = new TextEncoder()
  let lastEventTs = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      }
      enqueue('hello', JSON.stringify({ phase, sinceId, ts: Date.now() }))

      const tick = async () => {
        try {
          const rows = listEvents({ phase, limit: 50, sinceId })
            // listEvents returns descending; SSE consumers want ascending.
            .sort((a: FenixEvent, b: FenixEvent) => a.id - b.id)
          if (rows.length > 0) {
            for (const r of rows) {
              enqueue('event', JSON.stringify(r))
              sinceId = Math.max(sinceId, r.id)
            }
            lastEventTs = Date.now()
          } else if (Date.now() - lastEventTs > MAX_IDLE_MS) {
            enqueue('bye', JSON.stringify({ reason: 'idle-timeout' }))
            controller.close()
            return
          } else {
            // Heartbeat so intermediaries don't kill the connection.
            controller.enqueue(encoder.encode(`: ping\n\n`))
          }
        } catch (err) {
          enqueue('error', JSON.stringify({ message: (err as Error).message }))
        }
      }

      const interval = setInterval(tick, POLL_MS)
      // Run one tick immediately so freshly-mounted clients see data quickly.
      void tick()

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
