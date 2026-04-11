import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface AppShellProps {
  sidebar: ReactNode
  children: ReactNode
  className?: string
  sidebarClassName?: string
  mainClassName?: string
}

export function AppShell({ sidebar, children, className, sidebarClassName, mainClassName }: AppShellProps) {
  return (
    <div className={cn('flex min-h-screen bg-background text-foreground', className)}>
      <aside className={cn('w-64 shrink-0 border-r border-border bg-card', sidebarClassName)}>{sidebar}</aside>
      <main className={cn('flex-1 overflow-auto', mainClassName)}>{children}</main>
    </div>
  )
}
