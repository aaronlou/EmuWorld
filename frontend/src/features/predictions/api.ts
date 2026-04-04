import { request } from '../../shared/api/client'
import type { Prediction, PredictionResponse, PredictionRun, PredictionRunDetail } from '../../types'

export const predictionsApi = {
  predict: (targetId: number) =>
    request<PredictionResponse>(`/targets/${targetId}/predict`, { method: 'POST' }),
  getPredictions: (targetId: number) => request<Prediction[]>(`/targets/${targetId}/predictions`),
  listLatestRuns: () => request<PredictionRun[]>('/prediction-runs/latest'),
  listRuns: (targetId: number) => request<PredictionRun[]>(`/targets/${targetId}/runs`),
  getRun: (runId: number) => request<PredictionRunDetail>(`/prediction-runs/${runId}`),
}
