import { motion } from 'framer-motion'
import type { Dataset } from '../types'

interface DatasetListProps {
  datasets: Dataset[]
  empty: boolean
}

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  }),
}

export function DatasetList({ datasets, empty }: DatasetListProps) {
  if (empty || datasets.length === 0) {
    return (
      <div>
        <div className="section-header">
          <span className="section-title">Data Sources</span>
          <span className="section-action">awaiting configuration</span>
        </div>
        <motion.div
          className="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 60,
              height: 1,
              background: 'linear-gradient(90deg, transparent, var(--cyan), transparent)',
              margin: '0 auto 16px',
            }}
          />
          No datasets configured. Set FRED API key to begin sync.
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Data Sources</span>
        <span className="section-action">{datasets.length} sources</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Source</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((d, i) => (
            <motion.tr
              key={d.id}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={rowVariants}
            >
              <td style={{ fontWeight: 500 }}>{d.name}</td>
              <td><span className="badge">{d.category}</span></td>
              <td style={{ color: 'var(--text-secondary)' }}>{d.source}</td>
              <td style={{ color: 'var(--text-tertiary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
