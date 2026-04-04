import type { PredictionRun, Target } from '../../types'

interface TargetTableProps {
  targets: Target[]
  loading: boolean
  latestRunsByTarget: Record<number, PredictionRun | null>
  onPredict: (target: Target) => void
}

function formatRunStatus(run: PredictionRun | null) {
  if (!run) return 'never run'
  return run.status
}

export function TargetTable({ targets, loading, latestRunsByTarget, onPredict }: TargetTableProps) {
  return (
    <article className="insight-panel target-panel">
      <div className="section-header">
        <span className="section-title">Target registry</span>
        <span className="section-action">{targets.length} total</span>
      </div>
      {targets.length === 0 ? (
        <div className="empty">No targets yet.</div>
      ) : (
        <div className="table-shell">
        <table className="data-table data-table-premium">
          <thead>
            <tr>
              <th>Question</th>
              <th>Category</th>
              <th>Horizon</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {targets.map(t => (
              <tr key={t.id}>
                {(() => {
                  const latestRun = latestRunsByTarget[t.id] ?? null
                  const isFailed = latestRun?.status === 'failed'
                  const actionLabel = isFailed ? 'retry' : loading ? 'running...' : 'predict'

                  return (
                    <>
                <td className="table-primary table-ellipsis">{t.question}</td>
                <td><span className="badge secondary">{t.category}</span></td>
                <td className="table-muted">{t.horizon_days}d</td>
                <td>
                  <span className="badge" style={
                    latestRun?.status === 'failed'
                      ? { background: 'rgba(244,63,94,0.12)', borderColor: 'rgba(244,63,94,0.18)', color: '#fb7185' }
                      : latestRun?.status === 'completed'
                        ? { background: 'var(--green-dim)', borderColor: 'rgba(52,211,153,0.15)', color: 'var(--green)' }
                        : t.active
                          ? { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }
                          : {}
                  }>
                    {formatRunStatus(latestRun)}
                  </span>
                  {latestRun?.finished_at && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 4 }}>
                      {new Date(latestRun.finished_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </div>
                  )}
                  {!latestRun && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 4 }}>
                      no runs yet
                    </div>
                  )}
                </td>
                <td>
                  <button onClick={() => onPredict(t)} disabled={loading}>
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
