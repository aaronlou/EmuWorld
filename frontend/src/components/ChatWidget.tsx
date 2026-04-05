import { useState } from 'react'
import { MessageSquare, SendHorizontal, Sparkles, X } from 'lucide-react'

import { useI18n } from '../i18n'
import type { ChatContext } from '../types'
import { useChatAssistant } from '../features/chat/hooks'

interface ChatWidgetProps {
  context: ChatContext
}

export function ChatWidget({ context }: ChatWidgetProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const {
    isOpen,
    loading,
    messages,
    suggestedPrompts,
    activeProvider,
    activeModel,
    streamingMessageId,
    headerLabel,
    toggle,
    close,
    sendMessage,
  } = useChatAssistant(context)
  const showSuggestions = messages.length <= 2

  async function handleSubmit() {
    const next = draft.trim()
    if (!next) return
    setDraft('')
    await sendMessage(next)
  }

  return (
    <>
      <button className={`chat-fab ${isOpen ? 'is-open' : ''}`} onClick={toggle}>
        <MessageSquare size={18} />
        <span>{t('chat.fab')}</span>
      </button>

      {isOpen && (
        <aside className="chat-panel">
          <div className="chat-panel-header">
            <div className="chat-panel-title">
              <span className="eyebrow">{t('chat.eyebrow')}</span>
              <strong>{headerLabel}</strong>
            </div>
            <button className="ghost chat-close" onClick={close}>
              <X size={16} />
            </button>
          </div>

          <div className="chat-context-strip">
            <span>{t(`page.${context.page}`)}</span>
            <span>{t('app.datasetsCount', { count: context.datasets_count })}</span>
            <span>{t('app.targetsCount', { count: context.targets_count })}</span>
            <span className="chat-provider-pill">{activeProvider}:{activeModel}</span>
          </div>

          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <span className="chat-role">
                  {message.role === 'assistant' ? 'AI' : t('chat.you')}
                  {message.role === 'assistant' && message.provider ? ` · ${message.provider}/${message.model}` : ''}
                </span>
                <p>
                  {message.content}
                  {streamingMessageId === message.id && <span className="chat-caret" />}
                </p>
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <span className="chat-role">AI</span>
                <p className="chat-thinking">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            )}
          </div>

          {showSuggestions && (
            <div className="chat-suggestions">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="ghost chat-suggestion"
                  disabled={loading}
                  onClick={() => {
                    void sendMessage(prompt)
                  }}
                >
                  <Sparkles size={12} />
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <textarea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('chat.placeholder')}
            />
            <button onClick={() => void handleSubmit()} disabled={loading || draft.trim().length === 0}>
              <SendHorizontal size={14} />
              {t('chat.send')}
            </button>
          </div>
        </aside>
      )}
    </>
  )
}
