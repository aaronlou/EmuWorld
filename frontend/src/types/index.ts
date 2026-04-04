export interface Dataset {
  id: number
  name: string
  source: string
  category: string
  description: string
  created_at: string
  updated_at: string
}

export interface DataPoint {
  id: number
  dataset_id: number
  date: string
  value: number
  created_at: string
}

export interface ChatDatasetContext {
  id: number
  name: string
  source: string
  category: string
  description: string
}

export interface ChatTargetContext {
  id: number
  question: string
  category: string
  horizon_days: number
}

export interface ChatPredictionContext {
  run_id?: number | null
  status?: string | null
  model_version?: string | null
  top_outcome?: string | null
  top_probability?: number | null
}

export interface ChatContext {
  page: 'datasets' | 'targets' | 'predictions'
  datasets_count: number
  targets_count: number
  predictions_count: number
  dataset_catalog: string[]
  target_catalog: string[]
  prediction_catalog: string[]
  dataset_series_summary?: string[]
  target_outcomes?: string[]
  prediction_distribution?: string[]
  dataset?: ChatDatasetContext | null
  target?: ChatTargetContext | null
  prediction?: ChatPredictionContext | null
}

export interface ChatRequest {
  session_id?: number | null
  message: string
  context: ChatContext
}

export interface ChatResponse {
  session_id?: number | null
  answer: string
  suggested_prompts: string[]
  provider: string
  model: string
  used_fallback: boolean
}

export interface ChatSession {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessageRecord {
  id: number
  session_id: number
  role: string
  content: string
  provider?: string | null
  model?: string | null
  used_fallback: boolean
  created_at: string
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
  id?: number
  target_id?: number
  run_id?: number | null
  outcome: string
  probability: number
  confidence_lower: number
  confidence_upper: number
  model_version?: string
  created_at?: string
}

export interface PredictionRun {
  id: number
  target_id: number
  status: string
  model_version: string
  input_snapshot: string
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface PredictionRunDetail {
  run: PredictionRun
  predictions: Prediction[]
}

export interface PredictionResponse {
  target: Target
  run: PredictionRun
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

export const CHART_COLORS = ['#00f5d4', '#f72585', '#4361ee', '#7209b7', '#06d6a0', '#ffd60a']
