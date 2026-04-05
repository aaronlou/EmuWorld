import { getCategoryLabel, getRunStatusLabel, useI18n } from '../../i18n'
import type { PredictionRun, Target } from '../../types'

interface TargetTableProps {
  targets: Target[]
  loading: boolean
  latestRunsByTarget: Record<number, PredictionRun | null>
  onPredict: (target: Target) => void
}

export function TargetTable({ targets, loading, latestRunsByTarget, onPredict }: TargetTableProps) {
  const { language, t, formatDateTime } = useI18n()

  return (
    <article className="insight-panel target-panel">
      <div className="section-header">
        <span className="section-title">{t('target.registryTitle')}</span>
        <span className="section-action">{t('target.total', { count: targets.length })}</span>
      </div>
      {targets.length === 0 ? (
        <div className="empty">{t('target.empty')}</div>
      ) : (
        <div className="table-shell">
        <table className="data-table data-table-premium">
          <thead>
            <tr>
              <th>{t('target.tableQuestion')}</th>
              <th>{t('target.tableCategory')}</th>
              <th>{t('target.tableHorizon')}</th>
              <th>{t('target.tableStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.id}>
                {(() => {
                  const latestRun = latestRunsByTarget[target.id] ?? null
                  const isFailed = latestRun?.status === 'failed'
                  const actionLabel = isFailed ? t('target.retry') : loading ? t('target.running') : t('target.predict')

                  return (
                    <>
                <td className="table-primary table-ellipsis">{target.question}</td>
                <td><span className="badge secondary">{getCategoryLabel(language, target.category)}</span></td>
                <td className="table-muted">{t('unit.daysShort', { count: target.horizon_days })}</td>
                <td>
                  <span className="badge" style={
                    latestRun?.status === 'failed'
                      ? { background: 'rgba(244,63,94,0.12)', borderColor: 'rgba(244,63,94,0.18)', color: '#fb7185' }
                      : latestRun?.status === 'completed'
                        ? { background: 'var(--green-dim)', borderColor: 'rgba(52,211,153,0.15)', color: 'var(--green)' }
                        : target.active
                          ? { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }
                          : {}
                  }>
                    {latestRun ? getRunStatusLabel(language, latestRun.status) : t('target.neverRun')}
                  </span>
                  {latestRun?.finished_at && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 4 }}>
                      {formatDateTime(latestRun.finished_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </div>
                  )}
                  {!latestRun && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 4 }}>
                      {t('target.noRunsYet')}
                    </div>
                  )}
                </td>
                <td>
                  <button onClick={() => onPredict(target)} disabled={loading}>
                    {actionLabel}
                  </button>
                </td>
                    </>
                  )
                })()}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </article>
  )
}
