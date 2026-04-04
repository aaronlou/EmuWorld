import { Database, Target, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Tab = 'datasets' | 'targets' | 'predictions'

interface TabNavProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
  counts?: { datasets: number; targets: number; predictions: number }
}

const TABS: { key: Tab; label: string; icon: typeof Database }[] = [
  { key: 'datasets', label: 'Datasets', icon: Database },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'predictions', label: 'Predictions', icon: TrendingUp },
]

export function TabNav({ tab, onTabChange, counts }: TabNavProps) {
  return (
    <nav className="tab-bar">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          className={tab === key ? 'active' : ''}
          onClick={() => onTabChange(key)}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <Icon size={12} />
          {label}
          {counts && <span className="tab-count">{counts[key]}</span>}
          <AnimatePresence>
            {tab === key && (
              <motion.div
                layoutId="tab-glow"
                className="tab-active-glow"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(ellipse at center, rgba(0,245,212,0.06), transparent 70%)',
                  pointerEvents: 'none',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </AnimatePresence>
        </button>
      ))}
    </nav>
  )
}
