import { motion } from 'framer-motion'
import { TrendingUp, BarChart3 } from 'lucide-react'
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

export function PredictionView({ selectedTarget, predictions, chartData }: PredictionViewProps) {
  if (!selectedTarget) {
    return (
      <div className="empty">
        <BarChart3 size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <p>暂无预测结果，请先创建分析目标并生成预测</p>
      </div>
    )
  }

  return (
    <>
      <h2>
        <TrendingUp size={14} />
        {selectedTarget.question}
      </h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="name"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Fira Code' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Fira Code' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(12, 12, 25, 0.95)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: '8px',
                color: '#e8e8f0',
                fontFamily: 'Fira Code',
                fontSize: '13px',
              }}
              formatter={(value: number | string | ReadonlyArray<number | string> | undefined) => [`${Number(value || 0).toFixed(1)}%`, '概率']}
              labelStyle={{ color: '#00f0ff', fontWeight: 600 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="predictions" style={{ marginTop: '1.5rem' }}>
        {predictions.map((p, i) => (
          <motion.div
            key={i}
            className="prediction-bar"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <span className="outcome">{p.outcome}</span>
            <div className="bar-container">
              <div className="bar">
                <div
                  className="bar-fill"
                  style={{ width: `${p.probability * 100}%` }}
                />
              </div>
              <span className="probability">{(p.probability * 100).toFixed(1)}%</span>
            </div>
            <span className="confidence">
              CI: {(p.confidence_lower * 100).toFixed(0)}% - {(p.confidence_upper * 100).toFixed(0)}%
            </span>
          </motion.div>
        ))}
      </div>
    </>
  )
}
