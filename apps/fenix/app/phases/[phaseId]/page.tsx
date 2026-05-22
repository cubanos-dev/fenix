import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cn } from '@/lib/cn'
import { relativeTime, shortSha } from '@/lib/format'
import { getPhase, listEvents, listGatesForPhase } from '@/lib/queries'
import { EventTail } from './_components/event-tail'
import { Pipeline } from './_components/pipeline'

export const dynamic = 'force-dynamic'

export default async function PhasePage({ params }: { params: Promise<{ phaseId: string }> }) {
  const { phaseId } = await params
  const phase = getPhase(phaseId)
  if (!phase) notFound()

  const gates = listGatesForPhase(phaseId)
  const seedEvents = listEvents({ phase: phaseId, limit: 30 })

  return (
    <div className="space-y-8">
      <header>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2 font-mono">{phase.id}</h1>
        <div className="text-sm text-muted-foreground mt-1">
          v={phase.version} · status={phase.status} · feature={phase.feature ?? '—'}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <ShaChip label="contract" sha={phase.contract_sha} />
          <ShaChip label="checks" sha={phase.checks_sha} />
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pipeline</h2>
        <Pipeline status={phase.status} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Gates</h2>
        {gates.length === 0 ? (
          <div className="text-sm text-muted-foreground">No gate runs yet.</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">gate</th>
                  <th className="text-left px-3 py-2 font-medium">status</th>
                  <th className="text-left px-3 py-2 font-medium">ran</th>
                  <th className="text-left px-3 py-2 font-medium">artifact</th>
                </tr>
              </thead>
              <tbody>
                {gates.map((g) => (
                  <tr key={`${g.gate_name}-${g.ran_at}`} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{g.gate_name}</td>
                    <td className="px-3 py-2">
                      <GateStatusBadge status={g.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{relativeTime(g.ran_at)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{g.json_path ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Event tail</h2>
        <EventTail phaseId={phaseId} initial={seedEvents} />
      </section>
    </div>
  )
}

function ShaChip({ label, sha }: { label: string; sha: string | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs font-mono',
        sha ? 'bg-muted/40' : 'bg-muted/10 text-muted-foreground',
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{shortSha(sha)}</span>
    </span>
  )
}

function GateStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        status === 'pass' && 'bg-primary/15 text-primary',
        status === 'fail' && 'bg-destructive/15 text-destructive',
        status === 'soft-warn' && 'bg-accent/30 text-accent-foreground',
        status === 'skipped' && 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  )
}
