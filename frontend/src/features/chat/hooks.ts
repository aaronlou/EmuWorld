import { useCallback, useEffect, useMemo, useState } from 'react'

import { chatApi } from './api'
import { useI18n } from '../../i18n'
import type { ChatContext, ChatMessageRecord } from '../../types'

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  provider?: string
  model?: string
  usedFallback?: boolean
}

export function useChatAssistant(context: ChatContext) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content: t('chat.welcome'),
    },
  ])
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    t('chat.promptSummary'),
    t('chat.promptNext'),
    t('chat.promptSignal'),
  ])
  const [activeProvider, setActiveProvider] = useState<string>('fallback')
  const [activeModel, setActiveModel] = useState<string>('rules')
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const storageKey = 'emuworld-chat-v2'

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as {
        sessionId?: number | null
        activeProvider?: string
        activeModel?: string
      }

      if (parsed.sessionId) {
        setSessionId(parsed.sessionId)
      }
      if (parsed.activeProvider) {
        setActiveProvider(parsed.activeProvider)
      }
      if (parsed.activeModel) {
        setActiveModel(parsed.activeModel)
      }
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        sessionId,
        activeProvider,
        activeModel,
      }),
    )
  }, [activeModel, activeProvider, sessionId])

  useEffect(() => {
    let cancelled = false

    async function hydrateSession() {
      if (!sessionId) return

      try {
        const records = await chatApi.listMessages(sessionId)
        if (cancelled || records.length === 0) return

        const hydratedMessages: ChatMessage[] = records.map((record: ChatMessageRecord) => ({
          id: `record-${record.id}`,
          role: record.role === 'assistant' ? 'assistant' : 'user',
          content: record.content,
          provider: record.provider ?? undefined,
          model: record.model ?? undefined,
          usedFallback: record.used_fallback,
        }))

        setMessages(hydratedMessages)

        const lastAssistant = [...records].reverse().find((record) => record.role === 'assistant')
        if (lastAssistant?.provider) {
          setActiveProvider(lastAssistant.provider)
        }
        if (lastAssistant?.model) {
          setActiveModel(lastAssistant.model)
        }
      } catch {
        setSessionId(null)
      }
    }

    void hydrateSession()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const headerLabel = useMemo(() => {
    if (context.page === 'datasets') return t('chat.assistantDatasets')
    if (context.page === 'targets') return t('chat.assistantTargets')
    return t('chat.assistantPredictions')
  }, [context.page, t])

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0) {
        return prev
      }

      const [first, ...rest] = prev
      if (first.id !== 'assistant-welcome') {
        return prev
      }

      return [
        {
          ...first,
          content: t('chat.welcome'),
        },
        ...rest,
      ]
    })

    setSuggestedPrompts([
      t('chat.promptSummary'),
      t('chat.promptNext'),
      t('chat.promptSignal'),
    ])
  }, [t])

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim()
      if (!trimmed) return

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      }

      setMessages((prev) => [...prev, userMessage])
      setLoading(true)

      try {
        const resolvedSessionId =
          sessionId ?? (await chatApi.createSession(trimmed.slice(0, 48))).id
        if (!sessionId) {
          setSessionId(resolvedSessionId)
        }

        const assistantId = `assistant-${Date.now()}`
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            provider: 'pending',
            model: 'pending',
            usedFallback: false,
          },
        ])
        setStreamingMessageId(assistantId)

        const response = await chatApi.sendToSession(resolvedSessionId, {
          session_id: resolvedSessionId,
          message: trimmed,
          context,
        })

        setActiveProvider(response.provider)
        setActiveModel(response.model)
        setSuggestedPrompts(response.suggested_prompts)
        if (response.session_id) {
          setSessionId(response.session_id)
        }

        let index = 0
        const content = response.answer
        const reveal = window.setInterval(() => {
          index += Math.max(2, Math.ceil(content.length / 80))
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: content.slice(0, index),
                    provider: response.provider,
                    model: response.model,
                    usedFallback: response.used_fallback,
                  }
                : message,
            ),
          )
          if (index >= content.length) {
            window.clearInterval(reveal)
            setStreamingMessageId(null)
          }
        }, 18)
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content:
              error instanceof Error
                ? t('chat.error', { message: error.message })
                : t('chat.errorGeneric'),
            provider: 'fallback',
            model: 'error',
            usedFallback: true,
          },
        ])
        setActiveProvider('fallback')
        setActiveModel('error')
        setStreamingMessageId(null)
      } finally {
        setLoading(false)
      }
    },
    [context, sessionId, t],
  )

  return {
    isOpen,
    loading,
    messages,
    suggestedPrompts,
    activeProvider,
    activeModel,
    streamingMessageId,
    headerLabel,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
    sendMessage,
  }
}
