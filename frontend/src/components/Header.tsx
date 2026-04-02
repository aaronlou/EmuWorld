import { motion } from 'framer-motion'
import { Plus, Database, Globe, BarChart3 } from 'lucide-react'
import type { Dataset, Prediction } from '../types'

interface HeaderProps {
  datasets: Dataset[]
  predictions: Prediction[]
  dataLoading: boolean
  onNavigate: (tab: 'datasets' | 'targets' | 'predictions') => void
}

export function Header({ datasets, predictions, dataLoading, onNavigate }: HeaderProps) {
  return (
    <motion.header
      className="hero"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="eyebrow">MACRO QUANT STUDIO · 实时预测引擎</p>
      <h1>
        EmuWorld{' '}
        <span className="gradient-text">Probability Engine</span>
      </h1>
      <p className="subtitle">
        连接 FRED、World Bank 等官方数据流，通过语言智能和概率推断链路，实时生成宏观事件的可信区间。
      </p>
      <div className="hero-tags">
        <span className="chip">AI Forecast</span>
        <span className="chip">Scenario Lab</span>
        <span className="chip">Confidence Tube</span>
      </div>
      <div className="hero-cta">
        <button onClick={() => onNavigate('targets')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} />
            创建分析目标
          </span>
        </button>
        <button className="ghost" onClick={() => onNavigate('datasets')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={16} />
            查看数据源
          </span>
        </button>
      </div>

      <div className="hero-preview">
        <div className="preview-card">
          <p className="preview-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={12} />
              热门数据源
            </span>
          </p>
          {dataLoading ? (
            <>
              <div className="skeleton" style={{ width: '80%' }} />
              <div className="skeleton" style={{ width: '60%' }} />
              <div className="skeleton" style={{ width: '40%' }} />
            </>
          ) : datasets.length ? (
            <ul>
              {datasets.slice(0, 3).map(d => (
                <li key={d.id}>
                  <span>{d.name}</span>
                  <small>{d.category}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty" style={{ padding: '2rem 0' }}>等待同步官方宏观数据</p>
          )}
        </div>

        <div className="preview-card">
          <p className="preview-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={12} />
              概率扇区
            </span>
          </p>
          {dataLoading ? (
            <>
              <div className="skeleton" style={{ width: '70%' }} />
              <div className="skeleton" style={{ width: '50%' }} />
              <div className="skeleton" style={{ width: '30%' }} />
            </>
          ) : predictions.length ? (
            <ul>
              {predictions.slice(0, 3).map((p, idx) => (
                <li key={idx}>
                  <span>{p.outcome}</span>
                  <small>{(p.probability * 100).toFixed(1)}%</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty" style={{ padding: '2rem 0' }}>生成预测以查看概率分布</p>
          )}
        </div>
      </div>
    </motion.header>
  )
}
