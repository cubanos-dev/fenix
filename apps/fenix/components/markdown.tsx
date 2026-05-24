import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'

interface MarkdownProps {
  body: string
  className?: string
}

export function Markdown({ body, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-invert prose-sm max-w-none',
        // Headings: tighter than default prose so research docs read like a doc, not a blog post.
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-2xl prose-h1:mt-0 prose-h1:mb-4',
        'prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3',
        'prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2',
        // Body + links pick up theme colors instead of prose defaults.
        'prose-p:text-foreground prose-li:text-foreground',
        'prose-strong:text-foreground prose-em:text-foreground',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // Inline code + code blocks: monospace, muted background, no quotes around content.
        'prose-code:font-mono prose-code:text-foreground prose-code:bg-muted/40',
        'prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em]',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border',
        // Blockquotes: borrow the project's left-rule + muted treatment.
        'prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground',
        'prose-blockquote:not-italic prose-blockquote:font-normal',
        // Tables: match the rest of the dashboard.
        'prose-table:text-sm prose-th:font-semibold prose-th:text-foreground',
        'prose-th:border-border prose-td:border-border',
        // Horizontal rules: subtle.
        'prose-hr:border-border',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  )
}
