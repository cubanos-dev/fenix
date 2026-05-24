import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/cn'
import { readFeaturesDoc, readResearchDoc } from '@/lib/project'

export const dynamic = 'force-dynamic'

const DOCS = ['MARKET', 'COMPETITORS', 'BRAND', 'TECH'] as const

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc } = await searchParams
  const selected = (DOCS as readonly string[]).includes(doc ?? '') ? (doc as (typeof DOCS)[number]) : 'MARKET'
  const text = readResearchDoc(selected)
  const features = readFeaturesDoc()

  return (
    <div className="space-y-6">
      <header>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← overview
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Source files in <code className="font-mono">.planning/research/</code>. Citation-rich viewer renders the
          canonical markdown.
        </p>
      </header>

      <nav className="flex gap-2 border-b border-border">
        {DOCS.map((d) => (
          <Link
            key={d}
            href={`/research?doc=${d}`}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              d === selected
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {d}
          </Link>
        ))}
        <Link
          href="/research?doc=FEATURES"
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            doc === 'FEATURES'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          FEATURES
        </Link>
      </nav>

      {doc === 'FEATURES' ? (
        <DocBody title="FEATURES.md" body={features} hint=".planning/FEATURES.md" />
      ) : (
        <DocBody title={`${selected}.md`} body={text} hint={`.planning/research/${selected}.md`} />
      )}
    </div>
  )
}

function DocBody({ title, body, hint }: { title: string; body: string | null; hint: string }) {
  if (body == null) {
    return (
      <EmptyState
        title={`${title} not found`}
        body={`Run \`/fenix-auto research\` to author this document. Expected at \`${hint}\`.`}
      />
    )
  }
  return (
    <article className="rounded-lg border border-border bg-card p-6">
      <div className="text-xs text-muted-foreground font-mono mb-4">{hint}</div>
      <Markdown body={body} />
    </article>
  )
}
