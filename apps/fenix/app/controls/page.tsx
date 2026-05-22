import Link from 'next/link'
import { relativeTime } from '@/lib/format'
import { listApprovals, listPhases, listVersions } from '@/lib/queries'
import { ControlButton } from './_components/control-button'

export const dynamic = 'force-dynamic'

export default function ControlsPage() {
  const versions = listVersions()
  const phases = listPhases()
  const approvals = listApprovals()
  const inFlight = phases.filter((p) => p.status !== 'green' && p.status !== 'halted' && p.status !== 'planned')

  return (
    <div className="space-y-8">
      <header>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Controls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Out-of-band actions on the loop. Every control writes to <code className="font-mono">.planning/fenix.db</code>{' '}
          for audit.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Stage approvals</h2>
        <p className="text-xs text-muted-foreground">
          The orchestrator halts at STOP-confirm gates after Stage 1 research, after each design iteration, and after
          Stage 3 tech research. Approve here to unblock the next subcommand.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ApprovalCard stage="research" approvals={approvals} />
          {versions.map((v) => (
            <ApprovalCard key={`design-${v.name}`} stage={`design:${v.name}`} approvals={approvals} />
          ))}
          <ApprovalCard stage="tech" approvals={approvals} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Phase actions</h2>
        {inFlight.length === 0 ? (
          <p className="text-sm text-muted-foreground">No phases in-flight.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">phase</th>
                  <th className="text-left px-3 py-2 font-medium">status</th>
                  <th className="text-left px-3 py-2 font-medium">actions</th>
                </tr>
              </thead>
              <tbody>
                {inFlight.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{p.id}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.status}</td>
                    <td className="px-3 py-2 space-x-2">
                      <ControlButton
                        label="halt"
                        intent="danger"
                        confirm="This will mark the phase as halted. Continue?"
                        payload={{
                          action: 'phase-update',
                          phaseId: p.id,
                          status: 'halted',
                        }}
                      />
                      <ControlButton label="rehydrate" intent="quiet" payload={{ action: 'rehydrate' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Database</h2>
        <div className="flex flex-wrap gap-3">
          <ControlButton label="Rehydrate fenix.db from artifacts" payload={{ action: 'rehydrate' }} />
          <ControlButton label="Initialize fenix.db" payload={{ action: 'init-db' }} intent="quiet" />
        </div>
      </section>
    </div>
  )
}

function ApprovalCard({
  stage,
  approvals,
}: {
  stage: string
  approvals: Array<{ stage: string; payload_id: string; approved_at: number; signer: string | null }>
}) {
  const existing = approvals.find((a) => a.stage === stage)
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <code className="font-mono text-sm">{stage}</code>
        {existing ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/15 text-primary">
            approved
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            pending
          </span>
        )}
      </div>
      {existing ? (
        <div className="text-xs text-muted-foreground">
          {existing.signer ?? 'unsigned'} · {relativeTime(existing.approved_at)}
        </div>
      ) : (
        <ControlButton label={`Approve ${stage}`} payload={{ action: 'approve', stage }} />
      )}
    </div>
  )
}
