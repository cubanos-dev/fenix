import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/app/_components/empty-state'
import { relativeTime } from '@/lib/format'
import { listPenExports } from '@/lib/project'
import { listPendingFeedback, listPhases, listVersions } from '@/lib/queries'
import { ApprovalControls } from './_components/approval-controls'

export const dynamic = 'force-dynamic'

export default async function VersionPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params
  const all = listVersions()
  const v = all.find((row) => row.name === version) ?? null
  if (!v) notFound()

  const phases = listPhases(version)
  const pendingFeedback = listPendingFeedback(version)
  const penExports = listPenExports(version)

  return (
    <div className="space-y-8">
      <header>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          Version <span className="font-mono">{v.name}</span>
        </h1>
        <div className="text-sm text-muted-foreground mt-1">
          {v.status}
          {v.approved_at && ` · approved ${relativeTime(v.approved_at)}`}
          {v.pen_path && ` · pen: ${v.pen_path}`}
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pen exports</h2>
        {penExports.length === 0 ? (
          <EmptyState
            title="No exports yet"
            body={`Once the design-runner authors pens/${version}.pen and exports PNGs to pens/exports/${version}/, they appear here.`}
            small
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {penExports.map((file) => (
              <figure key={file} className="rounded-lg border border-border bg-card overflow-hidden">
                {/* biome-ignore lint/performance/noImgElement: pens render fine without next/image transforms */}
                <img src={`/api/pens/${version}/${file}`} alt={file} className="w-full h-auto block" />
                <figcaption className="px-3 py-2 text-xs font-mono text-muted-foreground border-t border-border">
                  {file}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Phases</h2>
        {phases.length === 0 ? (
          <EmptyState
            title="No phases yet"
            body={`Run \`/fenix-auto phases ${version}\` to slice the version into phases.`}
            small
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">id</th>
                  <th className="text-left px-3 py-2 font-medium">feature</th>
                  <th className="text-left px-3 py-2 font-medium">status</th>
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
                    <td className="px-3 py-2">{p.feature ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pending feedback</h2>
        {pendingFeedback.length === 0 ? (
          <EmptyState title="No pending feedback" body="Approvals + feedback go here." small />
        ) : (
          <ul className="space-y-3">
            {pendingFeedback.map((f) => (
              <li key={f.id} className="rounded-lg border border-border bg-card p-4 text-sm space-y-1">
                <div className="font-medium">{f.change}</div>
                {f.why && <div className="text-muted-foreground text-xs">{f.why}</div>}
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {f.frame ?? '—'} · {f.feature ?? '—'} · {relativeTime(f.ts)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ApprovalControls version={version} />
    </div>
  )
}
