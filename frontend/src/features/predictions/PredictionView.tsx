import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { getRunStatusLabel, useI18n } from '../../i18n'
import type { Target, Prediction, PredictionRun } from '../../types'
import type { ChartDataPoint } from './hooks'

interface PredictionViewProps {
  selectedTarget: Target | null
  selectedRun: PredictionRun | null
  runs: PredictionRun[]
  predictions: Prediction[]
  chartData: ChartDataPoint[]
  loading?: boolean
  onRetry: () => void | Promise<void>
  onSelectRun: (runId: number) => void | Promise<void>
}

const AMBER_COLORS = ['#00f5d4', '#f72585', '#4361ee', '#7209b7', '#06d6a0', '#ffd60a']

export function PredictionView({
  selectedTarget,
  selectedRun,
  runs,
  predictions,
  chartData,
  loading = false,
  onRetry,
  onSelectRun,
}: PredictionViewProps) {
  const { language, t, formatDateTime } = useI18n()

  function formatRunTimestamp(value: string | null) {
    if (!value) return t('prediction.pending')
    return formatDateTime(value, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  if (!selectedTarget) {
    return (
      <div className="empty">{t('prediction.empty')}</div>
    )
  }

  const coloredData = chartData.map((d, i) => ({
    ...d,
    fill: AMBER_COLORS[i % AMBER_COLORS.length],
  }))

  return (
    <section className="workspace">
      <div className="workspace-hero workspace-hero-compact">
        <div className="workspace-copy workspace-copy-inline">
          <span className="eyebrow">{t('prediction.eyebrow')}</span>
          <h1 className="hero-title-compact">{selectedTarget.question}</h1>
          <div className="hero-metrics hero-metrics-inline">
            <div className="hero-metric hero-metric-pill">
              <span className="hero-metric-label">{t('prediction.selectedRun')}</span>
              <strong>#{selectedRun?.id ?? '—'}</strong>
            </div>
            <div className="hero-metric hero-metric-pill">
              <span className="hero-metric-label">{t('prediction.model')}</span>
              <strong>{selectedRun?.model_version ?? t('misc.na')}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="prediction-toolbar">
        <div className="run-chip-row">
        {runs.length > 0 && (
          <>
          {runs.map((run) => {
            const active = selectedRun?.id === run.id
            return (
              <button
                key={run.id}
                className={`run-chip ${active ? 'active' : ''}`}
                disabled={loading}
                onClick={() => { void onSelectRun(run.id) }}
              >
                #{run.id} {getRunStatusLabel(language, run.status)}
              </button>
            )
          })}
          </>
        )}
        </div>
        <button
          onClick={() => { void onRetry() }}
          disabled={loading}
        >
          {selectedRun?.status === 'failed' ? t('prediction.retryFailedRun') : t('prediction.runAgain')}
        </button>
      </div>

      <div className="analytics-grid analytics-grid-predictions">
      <article className="insight-panel insight-panel-wide">
        <div className="section-header">
          <span className="section-title">{t('prediction.outcomeProfile')}</span>
          <span className="section-action">{t('prediction.probabilityByScenario')}</span>
        </div>
        <div className="chart-stage chart-stage-large">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={coloredData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="name"
              stroke="rgba(255,255,255,0.15)"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.15)"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(18, 18, 22, 0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 3,
                color: '#e8e8ec',
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
              formatter={(value: number | string | ReadonlyArray<number | string> | undefined) => [`${Number(value || 0).toFixed(1)}%`, t('prediction.prob')]}
              labelStyle={{ color: '#e8a838', fontWeight: 600 }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} animationDuration={600}>
              {coloredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </article>

      <article className="insight-panel">
        <div className="section-header">
          <span className="section-title">{t('prediction.runHealth')}</span>
          <span className="section-action">{t('prediction.executionNotes')}</span>
        </div>
        {selectedRun?.error_message ? (
          <div className="empty prediction-error">
            {t('prediction.runFailed', { message: selectedRun.error_message })}
          </div>
        ) : (
          <div className="signal-list compact">
            <div className="signal-item">
              <div>
                <strong>{t('prediction.status')}</strong>
                <span>{t('prediction.statusHint')}</span>
              </div>
              <div className="signal-meta">
                <span className="badge">{selectedRun ? getRunStatusLabel(language, selectedRun.status) : t('prediction.idle')}</span>
              </div>
            </div>
            <div className="signal-item">
              <div>
                <strong>{t('prediction.runTimestamp')}</strong>
                <span>{t('prediction.runTimestampHint')}</span>
              </div>
              <div className="signal-meta">
                <span className="signal-stamp">{formatRunTimestamp(selectedRun?.finished_at || selectedRun?.started_at || selectedRun?.created_at || null)}</span>
              </div>
            </div>
          </div>
        )}
      </article>
      </div>

      <article className="insight-panel">
        <div className="section-header">
          <span className="section-title">{t('prediction.confidenceEnvelope')}</span>
          <span className="section-action">{t('prediction.bounds')}</span>
        </div>
        <div className="chart-stage chart-stage-large">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={coloredData} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="predictionUpper" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#28c7fa" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#28c7fa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="predictionValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64f7d2" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#64f7d2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(18, 18, 22, 0.96)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  color: '#e8e8ec',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                }}
              />
              <Area type="monotone" dataKey="upper" stroke="#28c7fa" fill="url(#predictionUpper)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="value" stroke="#64f7d2" fill="url(#predictionValue)" strokeWidth={2} />
              <Line type="monotone" dataKey="lower" stroke="#ff7b72" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="insight-panel">
        <div className="section-header">
          <span className="section-title">{t('prediction.probabilityLadder')}</span>
          <span className="section-action">{t('prediction.modeledOutcomes', { count: predictions.length })}</span>
        </div>
      <div className="predictions predictions-premium">
        {predictions.map((p, i) => (
          <div key={i} className="prediction-bar">
            <span className="outcome">{p.outcome}</span>
            <div className="bar-container">
              <div className="bar">
                <div
                  className="bar-fill"
                  style={{ width: `${p.probability * 100}%`, background: AMBER_COLORS[i % AMBER_COLORS.length] }}
                />
              </div>
              <span className="probability" style={{ color: AMBER_COLORS[i % AMBER_COLORS.length] }}>
                {(p.probability * 100).toFixed(1)}%
              </span>
            </div>
            <span className="confidence">
              CI {(p.confidence_lower * 100).toFixed(0)}% — {(p.confidence_upper * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      </article>
    </section>
  )
}
