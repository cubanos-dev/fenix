import { requireSession } from '@fenix/auth/server'

export default async function DashboardPage() {
  const session = await requireSession()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {session.user.name}</p>
      </div>
    </div>
  )
}
