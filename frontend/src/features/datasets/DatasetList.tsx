import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect } from 'react'
import type { Dataset } from '../../types'
import { useDatasetExplorer } from './hooks'

interface DatasetListProps {
  datasets: Dataset[]
  empty: boolean
  onSelectionChange?: (dataset: Dataset | null) => void
}

export function DatasetList({ datasets, empty, onSelectionChange }: DatasetListProps) {
  if (empty || datasets.length === 0) {
    return (
      <div>
        <div className="section-header">
          <span className="section-title">Data Sources</span>
          <span className="section-action">awaiting configuration</span>
        </div>
        <div className="empty">No datasets configured. Set FRED API key to begin sync.</div>
      </div>
    )
  }

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
    const label = `${stamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${stamp.toLocaleTimeString('en-US', {
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

  const newestDatasets = [...datasets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const sourceLeader = sourceStats[0]
  const categoryLeader = categoryStats[0]
  const sourcePalette = ['#64f7d2', '#28c7fa', '#ff7b72', '#f7b955', '#b68cff']
  const {
    selectedDataset,
    selectedDatasetId,
    selectedPoints,
    loading: pointsLoading,
    error: pointsError,
    selectDataset,
  } = useDatasetExplorer(datasets)

  const previewPoints = selectedPoints.map((point) => ({
    label: new Date(point.date).toLocaleDateString('en-US', { year: '2-digit', month: 'short' }),
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
    <section className="workspace">
      <div className="workspace-hero">
        <div className="workspace-copy">
          <span className="eyebrow">Macro data workspace</span>
          <h1>Signal coverage across your live economic feed.</h1>
          <p>
            Track how much data is online, which sources dominate the surface,
            and what categories are ready for forecasting right now.
          </p>
        </div>

        <div className="hero-metrics">
          <div className="hero-metric">
            <span className="hero-metric-label">Live datasets</span>
            <strong>{datasets.length}</strong>
            <span>{sourceStats.length} upstream feeds</span>
          </div>
          <div className="hero-metric">
            <span className="hero-metric-label">Top source</span>
            <strong>{sourceLeader?.name ?? 'n/a'}</strong>
            <span>{sourceLeader?.value ?? 0} active series</span>
          </div>
          <div className="hero-metric">
            <span className="hero-metric-label">Dominant category</span>
            <strong>{categoryLeader?.name ?? 'n/a'}</strong>
            <span>{categoryLeader?.value ?? 0} datasets mapped</span>
          </div>
        </div>
      </div>

      <div className="analytics-grid analytics-grid-datasets">
        <article className="insight-panel insight-panel-wide">
          <div className="section-header">
            <span className="section-title">Ingestion cadence</span>
            <span className="section-action">latest import timeline</span>
          </div>
          <div className="chart-stage chart-stage-large">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={intakeTimeline} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="datasetTimeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64f7d2" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#64f7d2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgba(185, 196, 221, 0.32)"
                  tick={{ fill: 'rgba(185, 196, 221, 0.48)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(185, 196, 221, 0.32)"
                  tick={{ fill: 'rgba(185, 196, 221, 0.48)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(9, 13, 22, 0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 18,
                    color: '#eff5ff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ingested"
                  stroke="#64f7d2"
                  strokeWidth={2}
                  fill="url(#datasetTimeline)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="insight-panel">
          <div className="section-header">
            <span className="section-title">Source mix</span>
            <span className="section-action">{sourceStats.length} connected feeds</span>
          </div>
          <div className="chart-stage">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sourceStats} layout="vertical" margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={84}
                  tick={{ fill: 'rgba(208, 219, 244, 0.65)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: 'rgba(9, 13, 22, 0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 18,
                    color: '#eff5ff',
                  }}
                />
                <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                  {sourceStats.map((entry, index) => (
                    <Cell key={entry.name} fill={sourcePalette[index % sourcePalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="insight-panel">
          <div className="section-header">
            <span className="section-title">Category spread</span>
            <span className="section-action">where the coverage is deepest</span>
          </div>
          <div className="stack-list">
            {categoryStats.map((item, index) => (
              <div key={item.name} className="stack-row">
                <div>
                  <span className="stack-label">{item.name}</span>
                  <span className="stack-subtle">{item.value} mapped series</span>
                </div>
                <div className="stack-bar-track">
                  <div
                    className="stack-bar-fill"
                    style={{
                      width: `${(item.value / Math.max(categoryStats[0]?.value ?? 1, 1)) * 100}%`,
                      background: sourcePalette[index % sourcePalette.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="analytics-grid analytics-grid-bottom">
        <article className="insight-panel">
          <div className="section-header">
            <span className="section-title">Newest arrivals</span>
            <span className="section-action">latest synced series</span>
          </div>
          <div className="signal-list">
            {newestDatasets.map((dataset) => (
              <div key={dataset.id} className="signal-item">
                <div>
                  <strong>{dataset.name}</strong>
                  <span>{dataset.description}</span>
                </div>
                <div className="signal-meta">
                  <span className="badge">{dataset.category}</span>
                  <span className="signal-stamp">{new Date(dataset.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="insight-panel">
          <div className="section-header">
            <span className="section-title">Series preview</span>
            <span className="section-action">{selectedDataset ? selectedDataset.source : 'select a series'}</span>
          </div>

          {selectedDataset ? (
            <div className="preview-panel">
              <div className="preview-header">
                <div>
                  <strong>{selectedDataset.name}</strong>
                  <span>{selectedDataset.description}</span>
                </div>
                <span className="badge">{selectedDataset.category}</span>
              </div>

              <div className="preview-stats">
                <div className="preview-stat">
                  <span>latest</span>
                  <strong>{latestPoint ? latestPoint.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</strong>
                </div>
                <div className="preview-stat">
                  <span>range</span>
                  <strong>
                    {minPoint !== null && maxPoint !== null
                      ? `${minPoint.toLocaleString('en-US', { maximumFractionDigits: 1 })} - ${maxPoint.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
                      : '—'}
                  </strong>
                </div>
                <div className="preview-stat">
                  <span>history</span>
                  <strong>{earliestPoint && latestPoint ? `${new Date(earliestPoint.date).getFullYear()} - ${new Date(latestPoint.date).getFullYear()}` : '—'}</strong>
                </div>
              </div>

              <div className="chart-stage">
                {pointsError ? (
                  <div className="empty prediction-error">{pointsError}</div>
                ) : pointsLoading ? (
                  <div className="empty">Loading series history...</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={previewPoints} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="rgba(185, 196, 221, 0.32)"
                        tick={{ fill: 'rgba(185, 196, 221, 0.48)', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(185, 196, 221, 0.32)"
                        tick={{ fill: 'rgba(185, 196, 221, 0.48)', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(9, 13, 22, 0.96)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 18,
                          color: '#eff5ff',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#64f7d2"
                        strokeWidth={2.25}
                        dot={false}
                        activeDot={{ r: 4, fill: '#64f7d2', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          ) : (
            <div className="empty">Select a series to inspect its time history.</div>
          )}
        </article>

        <article className="insight-panel insight-panel-wide">
          <div className="section-header">
            <span className="section-title">Series registry</span>
            <span className="section-action">{datasets.length} rows indexed</span>
          </div>
          <div className="table-shell">
            <table className="data-table data-table-premium">
              <thead>
                <tr>
                  <th>Series</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Updated</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(d => (
                  <tr
                    key={d.id}
                    className={selectedDatasetId === d.id ? 'is-selected' : ''}
                    onClick={() => selectDataset(d.id)}
                  >
                    <td className="table-primary">{d.name}</td>
                    <td><span className="badge">{d.category}</span></td>
                    <td className="table-muted">{d.source}</td>
                    <td className="table-muted">
                      {new Date(d.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="table-fade">{d.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  )
}
