import { motion } from 'framer-motion'
import { Plus, Target, Sparkles, Play, Activity } from 'lucide-react'
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
    <>
      <h2>
        <Plus size={14} />
        创建分析目标
      </h2>
      <div className="form">
        <input
          placeholder="分析目标，如：中国 CPI 明年是否超过 2%？"
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
            placeholder="预测天数"
          />
        </div>
        <input
          placeholder="可能结果，用逗号分隔，如：是,否,不确定"
          value={newTarget.outcomes}
          onChange={e => onNewTargetChange({ ...newTarget, outcomes: e.target.value })}
        />
        <button
          onClick={onCreateTarget}
          disabled={!newTarget.question || !newTarget.outcomes}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} />
            创建目标
          </span>
        </button>
      </div>

      <h2>
        <Target size={14} />
        已有目标
      </h2>
      {targets.length === 0 ? (
        <div className="empty">
          <Target size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>暂无分析目标</p>
        </div>
      ) : (
        <div className="grid">
          {targets.map(t => {
            const Icon = Target
            return (
              <motion.div
                key={t.id}
                className="card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} style={{ color: 'var(--neon-cyan)' }} />
                  <h3>{t.question}</h3>
                </div>
                <span className="badge">{t.category}</span>
                <p>预测周期: {t.horizon_days} 天</p>
                <button onClick={() => onPredict(t)} disabled={loading}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loading ? <Activity size={16} className="spin" /> : <Play size={16} />}
                    {loading ? '生成中...' : '生成预测'}
                  </span>
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </>
  )
}
