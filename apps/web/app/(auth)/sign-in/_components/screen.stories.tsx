import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import SignInScreen from './screen'

const meta = {
  title: 'Screens/SignIn',
  component: SignInScreen,
  args: {
    labels: {
      title: 'Welcome back',
      description: 'Sign in to your account to continue',
      google: 'Continue with Google',
      github: 'Continue with GitHub',
    },
    onGoogleSignIn: fn(),
    onGithubSignIn: fn(),
    onEmailSignIn: fn(async () => ({})),
  },
} satisfies Meta<typeof SignInScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    showDevAuth: false,
  },
}

export const WithDevAuth: Story = {
  args: {
    showDevAuth: true,
  },
}
