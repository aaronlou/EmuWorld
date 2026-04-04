import type { PredictionRun, Target as TargetType } from '../../types'
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
  return (
    <section className="workspace">
      <div className="workspace-hero workspace-hero-compact">
        <div className="workspace-copy">
          <span className="eyebrow">Forecast target design</span>
          <h1>Define decision questions before the engine prices them.</h1>
          <p>
            Draft the question, set the horizon, then launch runs from the target registry.
          </p>
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
