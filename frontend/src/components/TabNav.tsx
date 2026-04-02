import { Database, Target, TrendingUp } from 'lucide-react'

type Tab = 'datasets' | 'targets' | 'predictions'

interface TabNavProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
}

export function TabNav({ tab, onTabChange }: TabNavProps) {
  return (
    <nav className="tabs">
      <button
        className={tab === 'datasets' ? 'active' : ''}
        onClick={() => onTabChange('datasets')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Database size={14} />
          数据集
        </span>
      </button>
      <button
        className={tab === 'targets' ? 'active' : ''}
        onClick={() => onTabChange('targets')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Target size={14} />
          分析目标
        </span>
      </button>
      <button
        className={tab === 'predictions' ? 'active' : ''}
        onClick={() => onTabChange('predictions')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <TrendingUp size={14} />
          预测结果
        </span>
      </button>
    </nav>
  )
}
