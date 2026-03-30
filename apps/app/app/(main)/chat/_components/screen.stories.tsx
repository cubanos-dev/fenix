import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import ChatScreen from './screen'

const meta = {
  title: 'Screens/Chat',
  component: ChatScreen,
  args: {
    messages: [],
    isLoading: false,
    onSendMessage: fn(),
  },
} satisfies Meta<typeof ChatScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithMessages: Story = {
  args: {
    messages: [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello, how are you?' }] },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'I am doing well! How can I help you today?' }] },
      { id: '3', role: 'user', parts: [{ type: 'text', text: 'Tell me about Fenix' }] },
    ],
  },
}

export const Loading: Story = {
  args: {
    messages: [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'What is the meaning of life?' }] },
    ],
    isLoading: true,
  },
}
