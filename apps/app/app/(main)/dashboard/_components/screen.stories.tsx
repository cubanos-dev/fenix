import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import DashboardScreen from './screen'

const meta = {
  title: 'Screens/Dashboard',
  component: DashboardScreen,
} satisfies Meta<typeof DashboardScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    userName: 'Dev User',
  },
}
