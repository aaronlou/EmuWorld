import { request } from '../../shared/api/client'
import type { ChatMessageRecord, ChatRequest, ChatResponse, ChatSession } from '../../types'

export const chatApi = {
  send: (payload: ChatRequest) =>
    request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createSession: (title?: string) =>
    request<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  listMessages: (sessionId: number) =>
    request<ChatMessageRecord[]>(`/chat/sessions/${sessionId}/messages`),
  sendToSession: (sessionId: number, payload: ChatRequest) =>
    request<ChatResponse>(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  stream: async (payload: ChatRequest) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(error.error || response.statusText)
    }

    return response.body
  },
}
