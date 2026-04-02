export interface Dataset {
  id: number
  name: string
  source: string
  category: string
  description: string
}

export interface Target {
  id: number
  question: string
  category: string
  horizon_days: number
  outcomes: string
  active: boolean
  created_at: string
}

export interface Prediction {
  outcome: string
  probability: number
  confidence_lower: number
  confidence_upper: number
}

export interface PredictionResponse {
  target: Target
  predictions: Prediction[]
  generated_at: string
}

export interface CreateTargetRequest {
  question: string
  category: string
  horizon_days: number
  outcomes: string[]
}

export const CATEGORY_ICONS: Record<string, string> = {
  macro: 'Globe',
  real_estate: 'Database',
  employment: 'Target',
  interest_rate: 'TrendingUp',
  trade: 'Activity',
}

export const CATEGORY_LABELS: Record<string, string> = {
  macro: '宏观经济',
  real_estate: '房地产',
  employment: '就业',
  interest_rate: '利率',
  trade: '进出口',
}

export const CHART_COLORS = ['#00f0ff', '#ff006e', '#00ff88', '#8b5cf6', '#2563eb', '#f59e0b']
