import { requireSession } from '@fenix/auth/server'
import DashboardScreen from './_components/screen'

export default async function DashboardPage() {
  const session = await requireSession()

  return <DashboardScreen userName={session.user.name} />
}
