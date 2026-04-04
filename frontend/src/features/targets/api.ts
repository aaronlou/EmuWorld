import { request } from '../../shared/api/client'
import type { CreateTargetRequest, Target } from '../../types'

export const targetsApi = {
  list: () => request<Target[]>('/targets'),
  create: (data: CreateTargetRequest) =>
    request<Target>('/targets', { method: 'POST', body: JSON.stringify(data) }),
}
