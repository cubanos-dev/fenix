import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { MetricStrip } from '@/components/metric-strip'
import { cn } from '@/lib/cn'
import { relativeTime, statusTone } from '@/lib/format'
import { getProjectIdentity } from '@/lib/project'
import { getOverview, listPhases, listVersions } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default function OverviewPage() {
  const project = getProjectIdentity()
  const overview = getOverview()
  const versions = listVersions()
  const phases = listPhases()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        {project.problem && <p className="text-sm text-muted-foreground mt-1">{project.problem}</p>}
        <div className="text-xs text-muted-foreground/70 mt-2 font-mono">
          latest event:{' '}
          {overview.latestEvent ? (
            <>
              <code>
                {overview.latestEvent.stage}/{overview.latestEvent.kind}
              </code>{' '}
              · {relativeTime(overview.latestEvent.ts)}
            </>
          ) : (
            <span>(none — loop has not run)</span>
          )}
        </div>
      </header>

      {!project.initialized && (
        <EmptyState
          title="Project not initialized"
          body="Run `/fenix-init` from Claude Code to scaffold this project. After that, this dashboard fills in automatically."
        />
      )}

      <MetricStrip overview={overview} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Versions</h2>
        {versions.length === 0 ? (
          <EmptyState
            title="No versions yet"
            body="Versions appear after /fenix-auto design mvp. The pen file is the source; this row is rehydrated from .planning/."
            small
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {versions.map((v) => (
              <Link
                key={v.name}
                href={`/versions/${v.name}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-ring transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{v.name}</span>
                  <StatusPill status={v.status} />
                </div>
                {v.approved_at && (
                  <div className="text-xs text-muted-foreground mt-2">approved {relativeTime(v.approved_at)}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Phases</h2>
        {phases.length === 0 ? (
          <EmptyState
            title="No phases yet"
            body="Phases appear after /fenix-auto phases <version>. Each phase is one feature; gates run via /fenix-auto build."
            small
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">id</th>
                  <th className="text-left px-3 py-2 font-medium">version</th>
                  <th className="text-left px-3 py-2 font-medium">feature</th>
                  <th className="text-left px-3 py-2 font-medium">status</th>
                  <th className="text-left px-3 py-2 font-medium">elapsed</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">
                      <Link href={`/phases/${p.id}`} className="hover:underline">
                        {p.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.version}</td>
                    <td className="px-3 py-2">{p.feature ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.started_at ? relativeTime(p.started_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'ok' && 'bg-primary/15 text-primary',
        tone === 'halted' && 'bg-destructive/15 text-destructive',
        tone === 'planned' && 'bg-muted text-muted-foreground',
        tone === 'in-flight' && 'bg-accent/30 text-accent-foreground',
        tone === 'idle' && 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  )
}
