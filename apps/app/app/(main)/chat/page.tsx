'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ChatScreen from './_components/screen'

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  return (
    <ChatScreen
      messages={messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: m.parts,
      }))}
      isLoading={isLoading}
      onSendMessage={(text) => sendMessage({ text })}
    />
  )
}
