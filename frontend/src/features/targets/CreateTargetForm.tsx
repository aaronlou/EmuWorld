import { CATEGORY_LABELS } from '../../types'
import type { TargetDraft } from './hooks'

interface CreateTargetFormProps {
  newTarget: TargetDraft
  onNewTargetChange: (target: TargetDraft) => void
  onCreateTarget: () => void
}

export function CreateTargetForm({
  newTarget,
  onNewTargetChange,
  onCreateTarget,
}: CreateTargetFormProps) {
  return (
    <article className="insight-panel form-panel">
      <div className="section-header">
        <span className="section-title">Create target</span>
        <span className="section-action">question / horizon / outcomes</span>
      </div>
      <div className="form">
        <input
          placeholder="Question, e.g. Will China CPI exceed 2% next year?"
          value={newTarget.question}
          onChange={e => onNewTargetChange({ ...newTarget, question: e.target.value })}
        />
        <div className="form-row">
          <select
            value={newTarget.category}
            onChange={e => onNewTargetChange({ ...newTarget, category: e.target.value })}
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            type="number"
            min="30"
            max="365"
            value={newTarget.horizon_days}
            onChange={e => onNewTargetChange({ ...newTarget, horizon_days: parseInt(e.target.value) })}
            placeholder="Horizon (days)"
          />
        </div>
        <input
          placeholder="Outcomes, comma separated, e.g. yes,no,uncertain"
          value={newTarget.outcomes}
          onChange={e => onNewTargetChange({ ...newTarget, outcomes: e.target.value })}
        />
        <button
          onClick={onCreateTarget}
          disabled={!newTarget.question || !newTarget.outcomes}
        >
          Create Target
        </button>
      </div>
    </article>
  )
}
