import { motion } from 'framer-motion'
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

const NEON_COLORS = ['#00f5d4', '#f72585', '#4361ee', '#7209b7', '#06d6a0', '#ffd60a']

const GRADIENT_IDS = ['gradCyan', 'gradMagenta', 'gradBlue', 'gradPurple', 'gradGreen', 'gradAmber']

const GRADIENT_CONFIGS = [
  { id: 'gradCyan', from: '#33f9e0', to: '#00f5d4' },
  { id: 'gradMagenta', from: '#f9559e', to: '#f72585' },
  { id: 'gradBlue', from: '#6b83f5', to: '#4361ee' },
  { id: 'gradPurple', from: '#9333ea', to: '#7209b7' },
  { id: 'gradGreen', from: '#33e0b4', to: '#06d6a0' },
  { id: 'gradAmber', from: '#ffe04d', to: '#ffd60a' },
]

export function PredictionView({ selectedTarget, predictions, chartData }: PredictionViewProps) {
  if (!selectedTarget) {
    return (
      <motion.div
        className="empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        No predictions yet. Create a target and run a forecast.
      </motion.div>
    )
  }

  const coloredData = chartData.map((d, i) => ({
    ...d,
    fill: NEON_COLORS[i % NEON_COLORS.length],
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="section-header">
        <span className="section-title">{selectedTarget.question}</span>
        <span className="section-action">{selectedTarget.horizon_days}d horizon</span>
      </div>

      <motion.div
        className="chart-container"
        style={{ marginBottom: 12 }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={coloredData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
            <Defs>
              {GRADIENT_CONFIGS.map(({ id, from, to }) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={from} stopOpacity={1} />
                  <stop offset="100%" stopColor={to} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </Defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="rgba(255,255,255,0.1)"
              tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
              dy={8}
            />
            <YAxis
              stroke="rgba(255,255,255,0.1)"
              tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0, 245, 212, 0.04)' }}
              contentStyle={{
                background: 'rgba(8, 8, 24, 0.97)',
                border: '1px solid rgba(0, 245, 212, 0.2)',
                borderRadius: 6,
                color: '#e8e8ec',
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,245,212,0.1)',
                backdropFilter: 'blur(12px)',
              }}
              formatter={(value: number | string | ReadonlyArray<number | string> | undefined) => [`${Number(value || 0).toFixed(1)}%`, 'Probability']}
              labelStyle={{ color: '#00f5d4', fontWeight: 600, marginBottom: 4 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={900} maxBarSize={64}>
              {coloredData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#${GRADIENT_IDS[index % GRADIENT_IDS.length]})`}
                  style={{
                    filter: `drop-shadow(0 0 8px ${NEON_COLORS[index % NEON_COLORS.length]}40)`,
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        className="predictions"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {predictions.map((p, i) => (
          <motion.div
            key={i}
            className="prediction-bar"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="outcome">{p.outcome}</span>
            <div className="bar-container">
              <div className="bar">
                <motion.div
                  className="bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${p.probability * 100}%` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: `linear-gradient(90deg, ${NEON_COLORS[i % NEON_COLORS.length]}, ${NEON_COLORS[i % NEON_COLORS.length]}cc)`,
                    color: NEON_COLORS[i % NEON_COLORS.length],
                    boxShadow: `0 0 12px ${NEON_COLORS[i % NEON_COLORS.length]}40, 0 0 24px ${NEON_COLORS[i % NEON_COLORS.length]}20`,
                  }}
                />
              </div>
              <span className="probability" style={{ color: NEON_COLORS[i % NEON_COLORS.length] }}>
                {(p.probability * 100).toFixed(1)}%
              </span>
            </div>
            <span className="confidence">
              CI {(p.confidence_lower * 100).toFixed(0)}% — {(p.confidence_upper * 100).toFixed(0)}%
            </span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
