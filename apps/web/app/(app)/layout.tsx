import { requireSession } from '@fenix/auth/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-sidebar p-4 md:block">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Fenix</span>
          </div>
          <nav className="flex flex-col gap-1">
            <a href="/dashboard" className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
              Dashboard
            </a>
            <a href="/chat" className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
              AI Chat
            </a>
          </nav>
          <div className="mt-auto pt-4 text-xs text-muted-foreground">{session.user.name}</div>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
