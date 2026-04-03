import { Database, Target, TrendingUp } from 'lucide-react'

type Tab = 'datasets' | 'targets' | 'predictions'

interface TabNavProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
  counts?: { datasets: number; targets: number; predictions: number }
}

export function TabNav({ tab, onTabChange, counts }: TabNavProps) {
  return (
    <nav className="tab-bar">
      <button
        className={tab === 'datasets' ? 'active' : ''}
        onClick={() => onTabChange('datasets')}
      >
        <Database size={12} />
        Datasets
        {counts && <span className="tab-count">{counts.datasets}</span>}
      </button>
      <button
        className={tab === 'targets' ? 'active' : ''}
        onClick={() => onTabChange('targets')}
      >
        <Target size={12} />
        Targets
        {counts && <span className="tab-count">{counts.targets}</span>}
      </button>
      <button
        className={tab === 'predictions' ? 'active' : ''}
        onClick={() => onTabChange('predictions')}
      >
        <TrendingUp size={12} />
        Predictions
        {counts && <span className="tab-count">{counts.predictions}</span>}
      </button>
    </nav>
  )
}
