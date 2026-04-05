import { useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../../i18n'
import { useEvents, useHypotheses } from './hooks'
import type { Event, Hypothesis } from '../../types'

const EVENT_CATEGORIES = ['market_crisis', 'policy_change', 'economic_indicator', 'geopolitical', 'black_swan'] as const
const HYPOTHESIS_STATUSES = ['active', 'validated', 'falsified'] as const

function EventCard({ event, onDelete }: { event: Event; onDelete: (id: number) => void }) {
  const { formatDate } = useI18n()
  const impactColor = event.impact_score
    ? event.impact_score > 0
      ? 'var(--accent-positive)'
      : 'var(--accent-negative)'
    : 'var(--text-muted)'

  return (
    <motion.div
      className="knowledge-card event-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      layout
    >
      <div className="card-header">
        <span className="card-date">{formatDate(event.date)}</span>
        <span className="card-category">{event.category}</span>
        {event.impact_score !== null && (
          <span className="impact-badge" style={{ background: impactColor }}>
            {event.impact_score > 0 ? '+' : ''}{(event.impact_score * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <h4 className="card-title">{event.title}</h4>
      {event.description && <p className="card-description">{event.description}</p>}
      {event.tags && event.tags !== '[]' && (
        <div className="card-tags">
          {JSON.parse(event.tags).map((tag: string) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}
      <button className="card-delete" onClick={() => onDelete(event.id)}>×</button>
    </motion.div>
  )
}

function HypothesisCard({ hypothesis, onUpdate, onDelete }: {
  hypothesis: Hypothesis
  onUpdate: (id: number, status: string) => void
  onDelete: (id: number) => void
}) {
  const statusColor = {
    active: 'var(--accent-warning)',
    validated: 'var(--accent-positive)',
    falsified: 'var(--accent-negative)',
  }[hypothesis.status] || 'var(--text-muted)'

  return (
    <motion.div
      className="knowledge-card hypothesis-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      layout
    >
      <div className="card-header">
        <span className="status-badge" style={{ background: statusColor }}>
          {hypothesis.status}
        </span>
        {hypothesis.confidence !== null && (
          <span className="confidence">
            {(hypothesis.confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>
      <h4 className="card-title">{hypothesis.content}</h4>
      {hypothesis.resolution_note && (
        <p className="card-resolution">{hypothesis.resolution_note}</p>
      )}
      <div className="card-actions">
        <select
          value={hypothesis.status}
          onChange={(e) => onUpdate(hypothesis.id, e.target.value)}
        >
          {HYPOTHESIS_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="card-delete" onClick={() => onDelete(hypothesis.id)}>×</button>
      </div>
    </motion.div>
  )
}

function CreateEventForm({ onSubmit, onCancel }: {
  onSubmit: (data: { title: string; date: string; category: string; description?: string; impact_score?: number }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState<string>(EVENT_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [impactScore, setImpactScore] = useState(0)

  return (
    <div className="create-form">
      <input
        type="text"
        placeholder="Event title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
      />
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {EVENT_CATEGORIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <div className="impact-input">
        <label>Impact:</label>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.1"
          value={impactScore}
          onChange={e => setImpactScore(parseFloat(e.target.value))}
        />
        <span>{(impactScore * 100).toFixed(0)}%</span>
      </div>
      <div className="form-actions">
        <button onClick={() => onSubmit({ title, date, category, description: description || undefined, impact_score: impactScore || undefined })}>
          Add Event
        </button>
        <button onClick={onCancel} className="cancel">Cancel</button>
      </div>
    </div>
  )
}

function CreateHypothesisForm({ onSubmit, onCancel }: {
  onSubmit: (data: { content: string; confidence?: number }) => void
  onCancel: () => void
}) {
  const [content, setContent] = useState('')
  const [confidence, setConfidence] = useState(0.5)

  return (
    <div className="create-form">
      <textarea
        placeholder="Your hypothesis or analysis..."
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      <div className="confidence-input">
        <label>Confidence:</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={confidence}
          onChange={e => setConfidence(parseFloat(e.target.value))}
        />
        <span>{(confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="form-actions">
        <button onClick={() => onSubmit({ content, confidence })}>Add Hypothesis</button>
        <button onClick={onCancel} className="cancel">Cancel</button>
      </div>
    </div>
  )
}

export function KnowledgeView() {
  const { events, loading: eventsLoading, createEvent, deleteEvent } = useEvents()
  const { hypotheses, loading: hypothesesLoading, createHypothesis, updateHypothesis, deleteHypothesis } = useHypotheses()
  const [view, setView] = useState<'timeline' | 'hypotheses'>('timeline')
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showCreateHypothesis, setShowCreateHypothesis] = useState(false)

  const handleCreateEvent = async (data: { title: string; date: string; category: string; description?: string; impact_score?: number }) => {
    await createEvent(data)
    setShowCreateEvent(false)
  }

  const handleCreateHypothesis = async (data: { content: string; confidence?: number }) => {
    await createHypothesis(data)
    setShowCreateHypothesis(false)
  }

  const handleUpdateHypothesis = async (id: number, status: string) => {
    await updateHypothesis(id, { status })
  }

  if (eventsLoading || hypothesesLoading) {
    return <div className="empty">Loading...</div>
  }

  return (
    <div className="knowledge-view">
      <div className="knowledge-header">
        <div className="view-toggle">
          <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>
            Timeline
          </button>
          <button className={view === 'hypotheses' ? 'active' : ''} onClick={() => setView('hypotheses')}>
            Hypotheses
          </button>
        </div>
        <button className="create-btn" onClick={() => view === 'timeline' ? setShowCreateEvent(true) : setShowCreateHypothesis(true)}>
          + Add {view === 'timeline' ? 'Event' : 'Hypothesis'}
        </button>
      </div>

      {showCreateEvent && (
        <CreateEventForm onSubmit={handleCreateEvent} onCancel={() => setShowCreateEvent(false)} />
      )}

      {showCreateHypothesis && (
        <CreateHypothesisForm onSubmit={handleCreateHypothesis} onCancel={() => setShowCreateHypothesis(false)} />
      )}

      {view === 'timeline' ? (
        <div className="knowledge-grid">
          {events.length === 0 ? (
            <div className="empty-state">No events yet. Add your first event to build your timeline.</div>
          ) : (
            events.map(event => (
              <EventCard key={event.id} event={event} onDelete={deleteEvent} />
            ))
          )}
        </div>
      ) : (
        <div className="knowledge-grid">
          {hypotheses.length === 0 ? (
            <div className="empty-state">No hypotheses yet. Add your first analysis to track your thinking.</div>
          ) : (
            hypotheses.map(hypothesis => (
              <HypothesisCard
                key={hypothesis.id}
                hypothesis={hypothesis}
                onUpdate={handleUpdateHypothesis}
                onDelete={deleteHypothesis}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}