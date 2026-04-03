import { motion } from 'framer-motion'
import type { Dataset, Target as TargetType } from '../types'

interface StatusPanelsProps {
  datasets: Dataset[]
  targets: TargetType[]
  selectedTarget: TargetType | null
  newTargetHorizon: number
  dataLoading: boolean
}

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  }),
}

export function StatusPanels({ datasets, targets, selectedTarget, newTargetHorizon, dataLoading }: StatusPanelsProps) {
  const datasetSources = new Set(datasets.map(d => d.source)).size
  const activeTargets = targets.reduce((total, t) => total + (t.active ? 1 : 0), 0)

  const cards = [
    {
      label: 'Data Sources',
      value: dataLoading ? '—' : datasetSources,
      hint: datasets.length > 0 ? `${datasets.length} datasets` : 'awaiting sync',
      valueClass: 'amber',
    },
    {
      label: 'Targets',
      value: dataLoading ? '—' : targets.length,
      hint: activeTargets > 0 ? `${activeTargets} active` : 'idle',
      valueClass: '',
    },
    {
      label: 'Forecast Window',
      value: dataLoading ? '—' : selectedTarget ? `${selectedTarget.horizon_days}d` : `${newTargetHorizon}d`,
      hint: selectedTarget ? 'prediction ready' : 'no prediction yet',
      valueClass: '',
    },
    {
      label: 'Engine Status',
      value: 'OK',
      hint: 'all systems nominal',
      valueClass: 'green',
    },
  ]

  return (
    <section className="status-panels">
      {cards.map((card, i) => (
        <motion.article
          key={card.label}
          className="status-card"
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <span className="status-label">{card.label}</span>
          <span className={`status-value ${card.valueClass}`}>{card.value}</span>
          <span className="status-hint">{card.hint}</span>
        </motion.article>
      ))}
    </section>
  )
}
