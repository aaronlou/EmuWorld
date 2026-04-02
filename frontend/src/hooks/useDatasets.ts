import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import type { Dataset, Target } from '../types'

export function useDatasets() {
  const [data, setData] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDatasets = useCallback(() => {
    return api.datasets.list()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void fetchDatasets()
  }, [fetchDatasets])

  const refresh = useCallback(() => {
    setLoading(true)
    void fetchDatasets()
  }, [fetchDatasets])

  return { data, loading, error, refresh }
}

export function useTargets() {
  const [data, setData] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTargets = useCallback(() => {
    return api.targets.list()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void fetchTargets()
  }, [fetchTargets])

  const refresh = useCallback(() => {
    setLoading(true)
    void fetchTargets()
  }, [fetchTargets])

  return { data, loading, error, refresh }
}
