import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { getCategoryLabel, useI18n } from '../../i18n'
import type { Dataset, DataPoint } from '../../types'
import { useDatasetExplorer } from './hooks'

interface DatasetListProps {
  datasets: Dataset[]
  empty: boolean
  onSelectionChange?: (dataset: Dataset | null) => void
}

/** Key signals a decision-maker cares about */
const KEY_SIGNALS = [
  { extId: '^GSPC', label: 'S&P 500', category: 'equity', invert: false },
  { extId: '^VIX', label: 'VIX', category: 'volatility', invert: true },
  { extId: '^TNX', label: '10Y Yield', category: 'bond', invert: false },
  { extId: 'GC=F', label: 'Gold', category: 'commodity', invert: false },
  { extId: 'CL=F', label: 'Crude Oil', category: 'commodity', invert: false },
  { extId: 'BTC-USD', label: 'Bitcoin', category: 'crypto', invert: false },
  { extId: 'EURUSD=X', label: 'EUR/USD', category: 'forex', invert: false },
  { extId: 'USDCNY=X', label: 'USD/CNY', category: 'forex', invert: false },
]

export function DatasetList({ datasets, empty, onSelectionChange }: DatasetListProps) {
  const { language, t, formatDate, formatTime, formatDateTime, formatNumber } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [signalData, setSignalData] = useState<Record<string, { value: number; change: number; changePct: number; trend: number[] }>>({})
  const [anomalies, setAnomalies] = useState<Array<{ dataset: Dataset; zScore: number; direction: 'up' | 'down' }>>([])
  const {
    selectedDataset,
    selectedDatasetId,
    selectedPoints,
    loading: pointsLoading,
    error: pointsError,
    selectDataset,
    fetchPoints,
  } = useDatasetExplorer(datasets)

  // Fetch key signal data on mount
  useEffect(() => {
    const fetchSignals = async () => {
      const result: Record<string, { value: number; change: number; changePct: number; trend: number[] }> = {}
      for (const sig of KEY_SIGNALS) {
        const ds = datasets.find(d => d.external_id === sig.extId)
        if (!ds) continue
        try {
          const points = await fetchPoints(ds.id)
          if (points.length < 2) continue
          const recent = points.slice(-30)
          const latest = recent[recent.length - 1].value
          const prev = recent[recent.length - 2].value
          const change = latest - prev
          const changePct = prev !== 0 ? (change / prev) * 100 : 0
          const trend = recent.slice(-10).map((p: DataPoint) => p.value)
          result[sig.extId] = { value: latest, change, changePct, trend }
        } catch {
          // skip
        }
      }
      setSignalData(result)
    }
    if (datasets.length > 0) fetchSignals()
  }, [datasets, fetchPoints])

  // Detect anomalies across all datasets
  useEffect(() => {
    const detect = async () => {
      const found: Array<{ dataset: Dataset; zScore: number; direction: 'up' | 'down' }> = []
      for (const ds of datasets) {
        try {
          const points = await fetchPoints(ds.id)
          if (points.length < 10) continue
          const values = points.slice(-20).map((p: DataPoint) => p.value)
          const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length
          const std = Math.sqrt(values.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / values.length)
          if (std === 0) continue
          const latest = values[values.length - 1]
          const zScore = (latest - mean) / std
          if (Math.abs(zScore) > 1.5) {
            found.push({ dataset: ds, zScore, direction: zScore > 0 ? 'up' : 'down' })
          }
        } catch {
          // skip
        }
      }
      found.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      setAnomalies(found.slice(0, 5))
    }
    if (datasets.length > 0) detect()
  }, [datasets, fetchPoints])

  if (empty || datasets.length === 0) {
    return (
      <div>
        <div className="section-header">
          <span className="section-title">{t('dataset.emptyTitle')}</span>
          <span className="section-action">{t('dataset.emptyAction')}</span>
        </div>
        <div className="empty">{t('dataset.emptyBody')}</div>
      </div>
    )
  }

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      if (sourceFilter !== 'all' && d.source !== sourceFilter) return false
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.source.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [datasets, searchQuery, sourceFilter, categoryFilter])

  const uniqueSources = useMemo(() => [...new Set(datasets.map(d => d.source))].sort(), [datasets])
  const uniqueCategories = useMemo(() => [...new Set(datasets.map(d => d.category))].sort(), [datasets])

  const sourceStats = Object.entries(
    datasets.reduce<Record<string, number>>((acc, dataset) => {
      acc[dataset.source] = (acc[dataset.source] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([name, value]) => ({ name: name.replace('_', ' '), value }))
    .sort((a, b) => b.value - a.value)

  const categoryStats = Object.entries(
    datasets.reduce<Record<string, number>>((acc, dataset) => {
      acc[dataset.category] = (acc[dataset.category] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const timelineMap = datasets.reduce<Record<string, number>>((acc, dataset) => {
    const stamp = new Date(dataset.created_at)
    const label = `${formatDate(stamp, { month: 'short', day: 'numeric' })} ${formatTime(stamp, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})

  const intakeTimeline = Object.entries(timelineMap)
    .map(([label, ingested]) => ({ label, ingested }))
    .slice(-8)

  const sourcePalette = ['#64f7d2', '#28c7fa', '#ff7b72', '#f7b955', '#b68cff']

  const previewPoints = selectedPoints.map((point) => ({
    label: formatDate(point.date, { year: '2-digit', month: 'short' }),
    value: point.value,
  }))

  const latestPoint = selectedPoints.at(-1) ?? null
  const earliestPoint = selectedPoints[0] ?? null
  const pointValues = selectedPoints.map((point) => point.value)
  const maxPoint = pointValues.length > 0 ? Math.max(...pointValues) : null
  const minPoint = pointValues.length > 0 ? Math.min(...pointValues) : null

  useEffect(() => {
    onSelectionChange?.(selectedDataset)
  }, [onSelectionChange, selectedDataset])

  return (
    <section className="workspace workspace-data-dense">
      {/* Status bar */}
      <div className="status-bar">
        <span className="status-bar-title">Signal Dashboard</span>
        <span className="status-bar-stats">
          <span className="stat-value">{datasets.length}</span> signals<span className="stat-sep">·</span><span className="stat-value">{uniqueSources.length}</span> sources<span className="stat-sep">·</span><span className="stat-value">{uniqueCategories.length}</span> categories
        </span>
        <span className="status-bar-sync">
          {datasets.length > 0 && (() => {
            const latest = [...datasets].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
            return formatDateTime(latest.updated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
          })()}
        </span>
      </div>

      {/* KEY SIGNALS — what matters now */}
      <div className="key-signals-grid">
        {KEY_SIGNALS.map(sig => {
          const data = signalData[sig.extId]
          if (!data) return (
            <div key={sig.extId} className="signal-card signal-card-loading">
              <span className="signal-card-label">{sig.label}</span>
              <span className="signal-card-value">—</span>
            </div>
          )
          const isPositive = sig.invert ? data.change < 0 : data.change > 0
          const trendMini = data.trend.map((v, i) => ({
            label: i.toString(),
            value: v,
          }))
          return (
            <div key={sig.extId} className="signal-card">
              <div className="signal-card-header">
                <span className="signal-card-label">{sig.label}</span>
                <span className={`signal-card-badge ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '▲' : '▼'} {Math.abs(data.changePct).toFixed(2)}%
                </span>
              </div>
              <div className="signal-card-value">{formatNumber(data.value, { maximumFractionDigits: 2 })}</div>
              <div className="signal-card-trend">
                <ResponsiveContainer width="100%" height={28}>
                  <LineChart data={trendMini} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={isPositive ? '#64f7d2' : '#ff7b72'}
                      strokeWidth={1.2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
      </div>

      {/* ANOMALIES — what's unusual */}
      {anomalies.length > 0 && (
        <div className="anomaly-panel">
          <span className="anomaly-panel-label">⚡ Anomalies Detected</span>
          <div className="anomaly-list">
            {anomalies.map((a) => (
              <div
                key={a.dataset.id}
                className={`anomaly-item anomaly-${a.direction}`}
                onClick={() => selectDataset(a.dataset.id)}
              >
                <span className="anomaly-zscore">{a.zScore > 0 ? '+' : ''}{a.zScore.toFixed(2)}σ</span>
                <span className="anomaly-name">{a.dataset.name}</span>
                <span className="anomaly-source">{a.dataset.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DATA TABLE — deep dive */}
      <div className="master-detail-grid">
        <div className="master-panel">
          <div className="filter-bar filter-bar-compact">
            <div className="filter-search">
              <span className="filter-search-icon">⌕</span>
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="filter-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
            <span className="filter-sep" />
            <select
              className="filter-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">All Sources</option>
              {uniqueSources.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{getCategoryLabel(language, c)}</option>
              ))}
            </select>
            {(sourceFilter !== 'all' || categoryFilter !== 'all' || searchQuery) && (
              <button className="filter-clear-btn" onClick={() => { setSourceFilter('all'); setCategoryFilter('all'); setSearchQuery('') }}>
                Reset
              </button>
            )}
          </div>

          {filteredDatasets.length === 0 ? (
            <div className="empty">{t('dataset.filterNoResults') ?? 'No datasets match your filters.'}</div>
          ) : (
          <div className="table-scroll">
            <table className="data-table data-table-premium data-table-compact">
              <thead>
                <tr>
                  <th>{t('dataset.tableSeries')}</th>
                  <th>{t('dataset.tableCategory')}</th>
                  <th>{t('dataset.tableSource')}</th>
                  <th>{t('dataset.tableUpdated')}</th>
                  <th>{t('dataset.tableDescription')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.map(d => (
                  <tr
                    key={d.id}
                    className={selectedDatasetId === d.id ? 'is-selected' : ''}
                    onClick={() => selectDataset(d.id)}
                  >
                    <td className="table-primary">{d.name}</td>
                    <td><span className="badge badge-sm">{getCategoryLabel(language, d.category)}</span></td>
                    <td className="table-muted">{d.source}</td>
                    <td className="table-muted">
                      {formatDateTime(d.updated_at, { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="table-fade">{d.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="detail-panel">
          {selectedDataset ? (
            <div className="preview-panel preview-panel-compact">
              <div className="preview-header">
                <div>
                  <strong>{selectedDataset.name}</strong>
                  <span className="preview-source">{selectedDataset.source} · {getCategoryLabel(language, selectedDataset.category)}</span>
                </div>
              </div>

              <div className="preview-stats preview-stats-compact">
                <div className="preview-stat">
                  <span>{t('dataset.latest')}</span>
                  <strong>{latestPoint ? formatNumber(latestPoint.value, { maximumFractionDigits: 2 }) : '—'}</strong>
                </div>
                <div className="preview-stat">
                  <span>{t('dataset.range')}</span>
                  <strong>
                    {minPoint !== null && maxPoint !== null
                      ? `${formatNumber(minPoint, { maximumFractionDigits: 1 })} – ${formatNumber(maxPoint, { maximumFractionDigits: 1 })}`
                      : '—'}
                  </strong>
                </div>
                <div className="preview-stat">
                  <span>{t('dataset.history')}</span>
                  <strong>{earliestPoint && latestPoint ? `${new Date(earliestPoint.date).getFullYear()} – ${new Date(latestPoint.date).getFullYear()}` : '—'}</strong>
                </div>
              </div>

              <div className="chart-stage chart-stage-sm">
                {pointsError ? (
                  <div className="empty prediction-error">{pointsError}</div>
                ) : pointsLoading ? (
                  <div className="empty">{t('dataset.loadingHistory')}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={previewPoints} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="rgba(185, 196, 221, 0.25)"
                        tick={{ fill: 'rgba(185, 196, 221, 0.4)', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(185, 196, 221, 0.25)"
                        tick={{ fill: 'rgba(185, 196, 221, 0.4)', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(9, 13, 22, 0.96)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          color: '#eff5ff',
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#64f7d2"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: '#64f7d2', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          ) : (
            <div className="preview-empty">
              <span className="preview-empty-icon">⊞</span>
              <span>{t('dataset.selectSeriesEmpty') ?? 'Select a signal to inspect'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: analytics */}
      <div className="analytics-compact">
        <div className="analytics-compact-item">
          <span className="analytics-compact-label">{t('dataset.sourceMix')}</span>
          <div className="source-bar-mini">
            {sourceStats.map((s, i) => (
              <div key={s.name} className="source-bar-segment" style={{ width: `${(s.value / sourceStats[0].value) * 100}%`, background: sourcePalette[i % sourcePalette.length] }}>
                <span className="source-bar-name">{s.name}</span>
                <span className="source-bar-count">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-compact-item">
          <span className="analytics-compact-label">{t('dataset.categorySpread')}</span>
          <div className="category-bar-mini">
            {categoryStats.map((c, i) => (
              <div key={c.name} className="category-bar-item">
                <span className="category-bar-name">{getCategoryLabel(language, c.name)}</span>
                <div className="category-bar-track">
                  <div className="category-bar-fill" style={{ width: `${(c.value / Math.max(categoryStats[0]?.value ?? 1, 1)) * 100}%`, background: sourcePalette[i % sourcePalette.length] }} />
                </div>
                <span className="category-bar-count">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-compact-item analytics-compact-chart">
          <span className="analytics-compact-label">{t('dataset.ingestionCadence')}</span>
          <div className="chart-stage chart-stage-xs">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={intakeTimeline} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="datasetTimeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64f7d2" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#64f7d2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgba(185, 196, 221, 0.2)"
                  tick={{ fill: 'rgba(185, 196, 221, 0.35)', fontSize: 8 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(185, 196, 221, 0.2)"
                  tick={{ fill: 'rgba(185, 196, 221, 0.35)', fontSize: 8 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Area
                  type="monotone"
                  dataKey="ingested"
                  stroke="#64f7d2"
                  strokeWidth={1.5}
                  fill="url(#datasetTimeline)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
