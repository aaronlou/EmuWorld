import { CATEGORY_LABELS } from '../types'
import type { Target as TargetType } from '../types'

interface TargetListProps {
  targets: TargetType[]
  newTarget: {
    question: string
    category: string
    horizon_days: number
    outcomes: string
  }
  loading: boolean
  onNewTargetChange: (target: { question: string; category: string; horizon_days: number; outcomes: string }) => void
  onCreateTarget: () => void
  onPredict: (target: TargetType) => void
}

export function TargetList({
  targets,
  newTarget,
  loading,
  onNewTargetChange,
  onCreateTarget,
  onPredict,
}: TargetListProps) {
  return (
    <div>
      <div className="section-header">
        <span className="section-title">New Target</span>
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

      <div style={{ marginTop: 16 }}>
        <div className="section-header">
          <span className="section-title">Targets</span>
          <span className="section-action">{targets.length} total</span>
        </div>
        {targets.length === 0 ? (
          <div className="empty">No targets yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Category</th>
                <th>Horizon</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.question}</td>
                  <td><span className="badge secondary">{t.category}</span></td>
                  <td>{t.horizon_days}d</td>
                  <td>
                    <span className="badge" style={t.active ? { background: 'var(--green-dim)', borderColor: 'rgba(52,211,153,0.15)', color: 'var(--green)' } : {}}>
                      {t.active ? 'active' : 'idle'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => onPredict(t)} disabled={loading} style={{ padding: '4px 10px', fontSize: 10 }}>
                      {loading ? 'running...' : 'predict'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
