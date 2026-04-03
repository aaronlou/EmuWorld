import type { Dataset } from '../types'

interface DatasetListProps {
  datasets: Dataset[]
  empty: boolean
}

export function DatasetList({ datasets, empty }: DatasetListProps) {
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

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Data Sources</span>
        <span className="section-action">{datasets.length} sources</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Source</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map(d => (
            <tr key={d.id}>
              <td style={{ fontWeight: 500 }}>{d.name}</td>
              <td><span className="badge">{d.category}</span></td>
              <td style={{ color: 'var(--text-secondary)' }}>{d.source}</td>
              <td style={{ color: 'var(--text-tertiary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
