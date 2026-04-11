import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface SidebarProps {
  className?: string
  children: ReactNode
}

export function Sidebar({ className, children }: SidebarProps) {
  return <div className={cn('flex h-full flex-col gap-2', className)}>{children}</div>
}

export function SidebarHeader({ className, children }: SidebarProps) {
  return <div className={cn('flex items-center gap-2 px-4 py-4 border-b border-border', className)}>{children}</div>
}

export function SidebarContent({ className, children }: SidebarProps) {
  return <div className={cn('flex-1 overflow-y-auto px-2 py-2', className)}>{children}</div>
}

export function SidebarFooter({ className, children }: SidebarProps) {
  return <div className={cn('px-4 py-4 border-t border-border', className)}>{children}</div>
}

export function SidebarNav({ className, children }: SidebarProps) {
  return (
    <nav className={cn('flex flex-col gap-1', className)} aria-label="Sidebar navigation">
      {children}
    </nav>
  )
}

export interface SidebarNavItemProps {
  href?: string
  active?: boolean
  className?: string
  children: ReactNode
}

export function SidebarNavItem({ href, active, className, children }: SidebarNavItemProps) {
  const classes = cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    className,
  )
  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    )
  }
  return <div className={classes}>{children}</div>
}
