import { useState } from 'react'
import { MessageSquare, SendHorizontal, Sparkles, X } from 'lucide-react'

import type { ChatContext } from '../types'
import { useChatAssistant } from '../features/chat/hooks'

interface ChatWidgetProps {
  context: ChatContext
}

export function ChatWidget({ context }: ChatWidgetProps) {
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
        <span>AI Copilot</span>
      </button>

      {isOpen && (
        <aside className="chat-panel">
          <div className="chat-panel-header">
            <div className="chat-panel-title">
              <span className="eyebrow">Contextual assistant</span>
              <strong>{headerLabel}</strong>
            </div>
            <button className="ghost chat-close" onClick={close}>
              <X size={16} />
            </button>
          </div>

          <div className="chat-context-strip">
            <span>{context.page}</span>
            <span>{context.datasets_count} datasets</span>
            <span>{context.targets_count} targets</span>
            <span className="chat-provider-pill">{activeProvider}:{activeModel}</span>
          </div>

          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <span className="chat-role">
                  {message.role === 'assistant' ? 'AI' : 'You'}
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
              placeholder="Ask about the current dataset, target, or prediction run..."
            />
            <button onClick={() => void handleSubmit()} disabled={loading || draft.trim().length === 0}>
              <SendHorizontal size={14} />
              Send
            </button>
          </div>
        </aside>
      )}
    </>
  )
}
