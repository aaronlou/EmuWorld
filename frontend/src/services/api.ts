const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

import type { Dataset, Target, Prediction, PredictionResponse, CreateTargetRequest } from '../types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || response.statusText)
  }
  return response.json()
}

export const api = {
  datasets: {
    list: () => request<Dataset[]>('/datasets'),
    getPoints: (id: number) => request<Dataset[]>(`/datasets/${id}/points`),
  },
  targets: {
    list: () => request<Target[]>('/targets'),
    create: (data: CreateTargetRequest) =>
      request<Target>('/targets', { method: 'POST', body: JSON.stringify(data) }),
    predict: (id: number) =>
      request<PredictionResponse>(`/targets/${id}/predict`, { method: 'POST' }),
    getPredictions: (id: number) => request<Prediction[]>(`/targets/${id}/predictions`),
  },
}
