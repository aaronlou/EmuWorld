import { request } from '../../shared/api/client'
import type { Event, Hypothesis, CreateEventRequest, CreateHypothesisRequest, UpdateHypothesisRequest } from '../../types'

export async function listEvents(): Promise<Event[]> {
  return request('/events')
}

export async function getEvent(id: number): Promise<Event> {
  return request(`/events/${id}`)
}

export async function createEvent(req: CreateEventRequest): Promise<Event> {
  return request('/events', { method: 'POST', body: JSON.stringify(req) })
}

export async function deleteEvent(id: number): Promise<void> {
  return request(`/events/${id}`, { method: 'DELETE' })
}

export async function listHypotheses(): Promise<Hypothesis[]> {
  return request('/hypotheses')
}

export async function getHypothesis(id: number): Promise<Hypothesis> {
  return request(`/hypotheses/${id}`)
}

export async function createHypothesis(req: CreateHypothesisRequest): Promise<Hypothesis> {
  return request('/hypotheses', { method: 'POST', body: JSON.stringify(req) })
}

export async function updateHypothesis(id: number, req: UpdateHypothesisRequest): Promise<Hypothesis> {
  return request(`/hypotheses/${id}`, { method: 'PUT', body: JSON.stringify(req) })
}

export async function deleteHypothesis(id: number): Promise<void> {
  return request(`/hypotheses/${id}`, { method: 'DELETE' })
}