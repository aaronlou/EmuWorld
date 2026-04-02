import { motion } from 'framer-motion'
import { Database, Target, Clock } from 'lucide-react'
import type { Dataset, Target as TargetType } from '../types'

interface StatusPanelsProps {
  datasets: Dataset[]
  targets: TargetType[]
  selectedTarget: TargetType | null
  newTargetHorizon: number
  dataLoading: boolean
}

export function StatusPanels({ datasets, targets, selectedTarget, newTargetHorizon, dataLoading }: StatusPanelsProps) {
  const datasetSources = new Set(datasets.map(d => d.source)).size
  const activeTargets = targets.reduce((total, t) => total + (t.active ? 1 : 0), 0)

  return (
    <motion.section
      className="status-panels"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <article className="status-card">
        <p className="status-label">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Database size={12} />
            数据源
          </span>
        </p>
        <p className="status-value">{dataLoading ? '—' : datasetSources}</p>
        <p className="status-hint">
          {datasets.length ? `${datasets.length} 个数据集` : '等待 FRED 同步'}
        </p>
      </article>

      <article className="status-card">
        <p className="status-label">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Target size={12} />
            分析目标
          </span>
        </p>
        <p className="status-value">{dataLoading ? '—' : targets.length}</p>
        <p className="status-hint">
          {activeTargets ? `${activeTargets} 个活跃` : '创建后自动更新'}
        </p>
      </article>

      <article className="status-card">
        <p className="status-label">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={12} />
            预测窗口
          </span>
        </p>
        <p className="status-value">
          {dataLoading ? '—' : selectedTarget ? `${selectedTarget.horizon_days}d` : `${newTargetHorizon}d`}
        </p>
        <p className="status-hint">
          {selectedTarget ? '最新预测已生成' : '生成预测以查看结果'}
        </p>
      </article>
    </motion.section>
  )
}
