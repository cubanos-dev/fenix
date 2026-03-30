export interface DashboardScreenProps {
  userName: string
}

export default function DashboardScreen({ userName }: DashboardScreenProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {userName}</p>
      </div>
    </div>
  )
}
