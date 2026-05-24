import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'
import { listLessons } from '@/lib/queries'

export const dynamic = 'force-dynamic'

const STATUSES = ['proposed', 'applied', 'archived'] as const

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; scope?: string }>
}) {
  const { status, scope } = await searchParams
  const filter = (STATUSES as readonly string[]).includes(status ?? '') ? status : undefined
  const lessons = listLessons({ status: filter, scope })

  // Group by scope for the scope-summary section.
  const byScope = new Map<string, number>()
  for (const l of listLessons()) byScope.set(l.scope, (byScope.get(l.scope) ?? 0) + 1)
  const scopes = [...byScope.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-8">
      <header>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Lessons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What the loop learned. Source files in <code className="font-mono">.planning/learnings/</code>. Status flows
          <code className="font-mono mx-1">proposed</code>→<code className="font-mono mx-1">applied</code>→
          <code className="font-mono mx-1">archived</code>. Agents read applicable lessons at startup.
        </p>
      </header>

      <nav className="flex gap-2 border-b border-border">
        <FilterLink href="/lessons" active={!status} label="all" />
        {STATUSES.map((s) => (
          <FilterLink key={s} href={`/lessons?status=${s}`} active={status === s} label={s} />
        ))}
      </nav>

      {scopes.length > 0 && !scope && (
        <section>
          <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">By scope</h2>
          <div className="flex flex-wrap gap-2">
            {scopes.map(([s, n]) => (
              <Link
                key={s}
                href={`/lessons?scope=${encodeURIComponent(s)}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-ring transition-colors"
              >
                <span className="font-mono">{s}</span>
                <span className="text-muted-foreground tabular-nums">{n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {scope && (
        <div className="text-sm text-muted-foreground">
          Filtered to scope <code className="font-mono">{scope}</code>.{' '}
          <Link href="/lessons" className="hover:underline">
            clear
          </Link>
        </div>
      )}

      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons match this filter"
          body="Lessons land here as the publisher proposes them at the end of each phase. They start as `proposed`; once an agent prompt is amended to reflect a lesson, mark it `applied` with `bun run fenix lessons-apply --id <id>`."
        />
      ) : (
        <ul className="space-y-3">
          {lessons.map((l) => (
            <li key={l.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-medium">{l.title}</h3>
                <StatusBadge status={l.status} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{l.id}</span>
                <span>·</span>
                <span className="font-mono">{l.scope}</span>
                <span>·</span>
                <span className="font-mono">{l.category}</span>
                <span>·</span>
                <span>{l.severity}</span>
                {l.phase && (
                  <>
                    <span>·</span>
                    <span>
                      phase{' '}
                      <Link href={`/phases/${l.phase}`} className="font-mono hover:underline">
                        {l.phase}
                      </Link>
                    </span>
                  </>
                )}
                <span>·</span>
                <span>{relativeTime(l.ts)}</span>
              </div>
              <LessonBody bodyMdPath={l.body_md_path} />
              {l.applies_to.length > 0 && (
                <div className="text-xs text-muted-foreground">applies to: {l.applies_to.join(', ')}</div>
              )}
              {l.evidence.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    evidence ({l.evidence.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 font-mono text-muted-foreground">
                    {l.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'applied' && 'bg-primary/15 text-primary',
        status === 'archived' && 'bg-muted text-muted-foreground',
        status === 'proposed' && 'bg-accent/30 text-accent-foreground',
      )}
    >
      {status}
    </span>
  )
}

function repoRoot(): string {
  return process.env.FENIX_REPO_ROOT ?? resolve(process.cwd(), '../..')
}

function LessonBody({ bodyMdPath }: { bodyMdPath: string }) {
  const full = resolve(repoRoot(), bodyMdPath)
  if (!existsSync(full)) return null
  const raw = readFileSync(full, 'utf-8')
  const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
  if (body.length === 0) return null
  return (
    <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-mono bg-muted/30 rounded p-3 mt-2">
      {body}
    </pre>
  )
}
