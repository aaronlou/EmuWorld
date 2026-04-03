import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { Target, Prediction } from '../types'

interface ChartDataPoint {
  name: string
  value: number
  lower: number
  upper: number
  fill: string
}

interface PredictionViewProps {
  selectedTarget: Target | null
  predictions: Prediction[]
  chartData: ChartDataPoint[]
}

const AMBER_COLORS = ['#00f5d4', '#f72585', '#4361ee', '#7209b7', '#06d6a0', '#ffd60a']

export function PredictionView({ selectedTarget, predictions, chartData }: PredictionViewProps) {
  if (!selectedTarget) {
    return (
      <div className="empty">No predictions yet. Create a target and run a forecast.</div>
    )
  }

  const coloredData = chartData.map((d, i) => ({
    ...d,
    fill: AMBER_COLORS[i % AMBER_COLORS.length],
  }))

  return (
    <div>
      <div className="section-header">
        <span className="section-title">{selectedTarget.question}</span>
        <span className="section-action">{selectedTarget.horizon_days}d horizon</span>
      </div>

      <div className="chart-container" style={{ marginBottom: 12 }}>
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
              formatter={(value: number | string | ReadonlyArray<number | string> | undefined) => [`${Number(value || 0).toFixed(1)}%`, 'prob']}
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

      <div className="predictions">
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
    </div>
  )
}
