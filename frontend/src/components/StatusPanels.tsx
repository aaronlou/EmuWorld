import { motion } from 'framer-motion'
import { useState } from 'react'
import { useI18n } from '../i18n'
import type { Dataset, Target as TargetType } from '../types'

const panelEase = [0.16, 1, 0.3, 1] as const

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
    transition: { delay: i * 0.08, duration: 0.4, ease: panelEase },
  }),
}

export function StatusPanels({ datasets, targets, selectedTarget, newTargetHorizon, dataLoading }: StatusPanelsProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(true)
  const datasetSources = new Set(datasets.map(d => d.source)).size
  const activeTargets = targets.reduce((total, t) => total + (t.active ? 1 : 0), 0)

  const cards = [
    {
      label: t('status.dataSources'),
      value: dataLoading ? '—' : datasetSources,
      hint: datasets.length > 0 ? t('app.datasetsCount', { count: datasets.length }) : t('status.awaitingSync'),
      valueClass: 'amber',
    },
    {
      label: t('status.targets'),
      value: dataLoading ? '—' : targets.length,
      hint: activeTargets > 0 ? t('status.active', { count: activeTargets }) : t('status.idle'),
      valueClass: '',
    },
    {
      label: t('status.forecastWindow'),
      value: dataLoading ? '—' : selectedTarget ? t('unit.daysShort', { count: selectedTarget.horizon_days }) : t('unit.daysShort', { count: newTargetHorizon }),
      hint: selectedTarget ? t('status.predictionReady') : t('status.noPrediction'),
      valueClass: '',
    },
    {
      label: t('status.engineStatus'),
      value: 'OK',
      hint: t('status.allSystemsNominal'),
      valueClass: 'green',
    },
  ]

  if (collapsed) {
    return (
      <section className="status-strip" onClick={() => setCollapsed(false)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(false) }}>
        {cards.map((card) => (
          <span key={card.label} className="status-strip-item">
            <span className="status-strip-label">{card.label}</span>
            <span className={`status-strip-value ${card.valueClass}`}>{card.value}</span>
          </span>
        ))}
        <span className="status-strip-expand">▾</span>
      </section>
    )
  }

  return (
    <section className="status-panels" onClick={() => setCollapsed(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed(true) }}>
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
