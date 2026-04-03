import type { Dataset, Target as TargetType } from '../types'

interface StatusPanelsProps {
  datasets: Dataset[]
  targets: TargetType[]
  selectedTarget: TargetType | null
  newTargetHorizon: number
  dataLoading: boolean
}

export function StatusPanels({ datasets, targets, selectedTarget, newTargetHorizon, dataLoading }: StatusPanelsProps) {
  const datasetSources = new Set(datasets.map(d => d.source)).size
  const activeTargets = targets.reduce((total, t) => total + (t.active ? 1 : 0), 0)

  return (
    <section className="status-panels">
      <article className="status-card">
        <span className="status-label">Data Sources</span>
        <span className="status-value">{dataLoading ? '—' : datasetSources}</span>
        <span className="status-hint">{datasets.length > 0 ? `${datasets.length} datasets` : 'awaiting sync'}</span>
      </article>

      <article className="status-card">
        <span className="status-label">Targets</span>
        <span className="status-value">{dataLoading ? '—' : targets.length}</span>
        <span className="status-hint">{activeTargets > 0 ? `${activeTargets} active` : 'idle'}</span>
      </article>

      <article className="status-card">
        <span className="status-label">Forecast Window</span>
        <span className="status-value">{dataLoading ? '—' : selectedTarget ? `${selectedTarget.horizon_days}d` : `${newTargetHorizon}d`}</span>
        <span className="status-hint">{selectedTarget ? 'prediction ready' : 'no prediction yet'}</span>
      </article>

      <article className="status-card">
        <span className="status-label">Engine Status</span>
        <span className="status-value green">OK</span>
        <span className="status-hint">all systems nominal</span>
      </article>
    </section>
  )
}
