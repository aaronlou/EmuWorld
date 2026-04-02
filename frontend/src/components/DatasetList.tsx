import { motion } from 'framer-motion'
import { Globe, Database, AlertCircle } from 'lucide-react'
import type { Dataset } from '../types'

interface DatasetListProps {
  datasets: Dataset[]
  empty: boolean
}

export function DatasetList({ datasets, empty }: DatasetListProps) {
  return (
    <>
      <h2>
        <Globe size={14} />
        官方数据源
      </h2>
      {empty || datasets.length === 0 ? (
        <div className="empty">
          <AlertCircle size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>暂无数据集，请先配置 FRED API Key 同步数据</p>
        </div>
      ) : (
        <div className="grid">
          {datasets.map(d => {
            const Icon = Database
            
            return (
              <motion.div
                key={d.id}
                className="card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} style={{ color: 'var(--neon-cyan)' }} />
                  <h3>{d.name}</h3>
                </div>
                <span className="badge">{d.category}</span>
                <p>{d.description}</p>
                <small>来源: {d.source}</small>
              </motion.div>
            )
          })}
        </div>
      )}
    </>
  )
}
