import { Database, Target, TrendingUp, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n'

type Tab = 'datasets' | 'targets' | 'predictions' | 'knowledge'

interface TabNavProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
  counts?: { datasets: number; targets: number; predictions: number; knowledge: number }
}

const TABS: { key: Tab; labelKey: string; icon: typeof Database }[] = [
  { key: 'datasets', labelKey: 'tab.datasets', icon: Database },
  { key: 'targets', labelKey: 'tab.targets', icon: Target },
  { key: 'predictions', labelKey: 'tab.predictions', icon: TrendingUp },
  { key: 'knowledge', labelKey: 'tab.knowledge', icon: Lightbulb },
]

export function TabNav({ tab, onTabChange, counts }: TabNavProps) {
  const { t } = useI18n()

  return (
    <nav className="tab-bar">
      {TABS.map(({ key, labelKey, icon: Icon }) => (
        <button
          key={key}
          className={tab === key ? 'active' : ''}
          onClick={() => onTabChange(key)}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <Icon size={12} />
          {t(labelKey)}
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
