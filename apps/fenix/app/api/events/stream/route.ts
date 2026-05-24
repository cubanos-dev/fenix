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

import { listEvents } from '@/lib/queries'

// We rely on the default Next runtime — under `bun --bun next dev` this is
// Bun, which can resolve `bun:sqlite`. Pinning to 'nodejs' would break the
// query layer.

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const phase = url.searchParams.get('phase') ?? undefined
  let sinceId = Number(url.searchParams.get('sinceId') ?? '0') || 0

  const POLL_MS = 1000
  const MAX_IDLE_MS = 5 * 60_000
  // listEvents caps internally at 500; raising this past the burst budget
  // (one full gate run emits ~16 rows; pick a comfortable margin) prevents
  // truncation. The next-tick safety remains because we order ASC.
  const BURST_LIMIT = 500

  const encoder = new TextEncoder()
  let lastEventTs = Date.now()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false
        try {
          controller.enqueue(chunk)
          return true
        } catch {
          closed = true
          return false
        }
      }
      const emit = (event: string, data: string) => safeEnqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      emit('hello', JSON.stringify({ phase, sinceId, ts: Date.now() }))

      const tick = async () => {
        if (closed) return
        try {
          const rows = listEvents({ phase, limit: BURST_LIMIT, sinceId })
          if (rows.length > 0) {
            for (const r of rows) {
              if (!emit('event', JSON.stringify(r))) return
              // listEvents is ASC; track the highest emitted id only.
              if (r.id > sinceId) sinceId = r.id
            }
            lastEventTs = Date.now()
          } else if (Date.now() - lastEventTs > MAX_IDLE_MS) {
            emit('bye', JSON.stringify({ reason: 'idle-timeout' }))
            closed = true
            try {
              controller.close()
            } catch {
              /* already closed */
            }
            return
          } else {
            // Heartbeat so intermediaries don't kill the connection.
            safeEnqueue(encoder.encode(`: ping\n\n`))
          }
        } catch (err) {
          emit('error', JSON.stringify({ message: (err as Error).message }))
        }
      }

      const interval = setInterval(tick, POLL_MS)
      // Run one tick immediately so freshly-mounted clients see data quickly.
      void tick()

      req.signal.addEventListener('abort', () => {
        closed = true
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
