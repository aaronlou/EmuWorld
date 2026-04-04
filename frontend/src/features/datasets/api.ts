import { request } from '../../shared/api/client'
import type { DataPoint, Dataset } from '../../types'

export const datasetsApi = {
  list: () => request<Dataset[]>('/datasets'),
  getPoints: (id: number) => request<DataPoint[]>(`/datasets/${id}/points`),
}
