import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import '@fenix/ui/styles/globals.css'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: 'Fenix — autonomous loop',
  description: 'Local observation dashboard for the Fenix idea-to-running-app loop. Reads .planning/fenix.db.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={cn(
          GeistSans.variable,
          GeistMono.variable,
          'font-sans antialiased bg-background text-foreground min-h-screen',
        )}
      >
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-8 py-6">{children}</main>
        </div>
      </body>
    </html>
  )
}

function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground p-4">
      <div className="mb-8 px-2">
        <div className="text-sm font-mono text-muted-foreground">fenix</div>
        <div className="text-xs text-muted-foreground/70">loop observer</div>
      </div>
      <nav className="space-y-1 text-sm">
        <SidebarLink href="/" label="Overview" />
        <SidebarLink href="/research" label="Research" />
        <SidebarLink href="/controls" label="Controls" />
      </nav>
      <div className="mt-8 px-2 text-xs text-muted-foreground/60">
        Source of truth lives in .planning/. This dashboard is a read model rebuilt by{' '}
        <code className="font-mono">bun run fenix:rehydrate</code>.
      </div>
    </aside>
  )
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block rounded px-2 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
    >
      {label}
    </a>
  )
}
