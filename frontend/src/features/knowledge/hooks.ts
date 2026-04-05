import { useState, useEffect, useCallback } from 'react'
import type { Event, Hypothesis, CreateEventRequest, CreateHypothesisRequest, UpdateHypothesisRequest } from '../../types'
import * as api from './api'

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listEvents()
      setEvents(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createEvent = useCallback(async (req: CreateEventRequest) => {
    const event = await api.createEvent(req)
    setEvents(prev => [event, ...prev])
    return event
  }, [])

  const deleteEvent = useCallback(async (id: number) => {
    await api.deleteEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }, [])

  return { events, loading, error, createEvent, deleteEvent, refetch: fetchEvents }
}

export function useHypotheses() {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHypotheses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listHypotheses()
      setHypotheses(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch hypotheses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHypotheses()
  }, [fetchHypotheses])

  const createHypothesis = useCallback(async (req: CreateHypothesisRequest) => {
    const hypothesis = await api.createHypothesis(req)
    setHypotheses(prev => [hypothesis, ...prev])
    return hypothesis
  }, [])

  const updateHypothesis = useCallback(async (id: number, req: UpdateHypothesisRequest) => {
    const hypothesis = await api.updateHypothesis(id, req)
    setHypotheses(prev => prev.map(h => h.id === id ? hypothesis : h))
    return hypothesis
  }, [])

  const deleteHypothesis = useCallback(async (id: number) => {
    await api.deleteHypothesis(id)
    setHypotheses(prev => prev.filter(h => h.id !== id))
  }, [])

  return { hypotheses, loading, error, createHypothesis, updateHypothesis, deleteHypothesis, refetch: fetchHypotheses }
}