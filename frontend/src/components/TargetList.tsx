import { motion } from 'framer-motion'
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
      <motion.div
        className="form"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
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
        <motion.button
          onClick={onCreateTarget}
          disabled={!newTarget.question || !newTarget.outcomes}
          whileTap={{ scale: 0.97 }}
          animate={
            newTarget.question && newTarget.outcomes
              ? { boxShadow: ['0 0 12px rgba(0,245,212,0.15)', '0 0 20px rgba(0,245,212,0.3)', '0 0 12px rgba(0,245,212,0.15)'] }
              : {}
          }
          transition={{ duration: 2, repeat: Infinity }}
        >
          Create Target
        </motion.button>
      </motion.div>

      <div style={{ marginTop: 16 }}>
        <div className="section-header">
          <span className="section-title">Targets</span>
          <span className="section-action">{targets.length} total</span>
        </div>
        {targets.length === 0 ? (
          <motion.div
            className="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            No targets yet.
          </motion.div>
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
              {targets.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <td style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.question}</td>
                  <td><span className="badge secondary">{t.category}</span></td>
                  <td>{t.horizon_days}d</td>
                  <td>
                    <span className="badge" style={t.active ? { background: 'var(--green-dim)', borderColor: 'rgba(52,211,153,0.15)', color: 'var(--green)' } : {}}>
                      {t.active ? 'active' : 'idle'}
                    </span>
                  </td>
                  <td>
                    <motion.button
                      onClick={() => onPredict(t)}
                      disabled={loading}
                      style={{ padding: '4px 10px', fontSize: 10 }}
                      whileTap={{ scale: 0.95 }}
                      animate={loading ? {
                        opacity: [0.6, 1, 0.6],
                      } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {loading ? 'running...' : 'predict'}
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
