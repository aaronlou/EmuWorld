import type { PredictionRun, Target as TargetType } from '../../types'
import { useI18n } from '../../i18n'
import type { TargetDraft } from './hooks'
import { CreateTargetForm } from './CreateTargetForm'
import { TargetTable } from './TargetTable'

interface TargetListProps {
  targets: TargetType[]
  newTarget: TargetDraft
  loading: boolean
  latestRunsByTarget: Record<number, PredictionRun | null>
  onNewTargetChange: (target: TargetDraft) => void
  onCreateTarget: () => void
  onPredict: (target: TargetType) => void
}

export function TargetList({
  targets,
  newTarget,
  loading,
  latestRunsByTarget,
  onNewTargetChange,
  onCreateTarget,
  onPredict,
}: TargetListProps) {
  const { t } = useI18n()

  return (
    <section className="workspace">
      <div className="workspace-hero workspace-hero-compact">
        <div className="workspace-copy workspace-copy-inline">
          <span className="eyebrow">{t('target.eyebrow')}</span>
          <h1 className="hero-title-compact">{t('target.heroTitle')}</h1>
        </div>
      </div>

      <div className="analytics-grid analytics-grid-targets">
      <CreateTargetForm
        newTarget={newTarget}
        onNewTargetChange={onNewTargetChange}
        onCreateTarget={onCreateTarget}
      />
      <TargetTable
        targets={targets}
        loading={loading}
        latestRunsByTarget={latestRunsByTarget}
        onPredict={onPredict}
      />
      </div>
    </section>
  )
}
