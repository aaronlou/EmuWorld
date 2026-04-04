import { useCallback, useEffect, useState } from 'react'
import type { DataPoint, Dataset } from '../../types'
import { datasetsApi } from './api'

export function useDatasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await datasetsApi.list()
      setDatasets(data)
    } catch (e) {
      setDatasets([])
      setError(e instanceof Error ? e.message : 'Failed to load datasets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { datasets, loading, error, refresh }
}

export function useDatasetExplorer(datasets: Dataset[]) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [selectedPoints, setSelectedPoints] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (datasets.length === 0) {
      setSelectedDatasetId(null)
      setSelectedPoints([])
      return
    }

    setSelectedDatasetId((current) =>
      current && datasets.some((dataset) => dataset.id === current) ? current : datasets[0].id,
    )
  }, [datasets])

  useEffect(() => {
    let cancelled = false

    async function loadPoints() {
      if (!selectedDatasetId) {
        setSelectedPoints([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const points = await datasetsApi.getPoints(selectedDatasetId)
        if (!cancelled) {
          setSelectedPoints(points)
        }
      } catch (e) {
        if (!cancelled) {
          setSelectedPoints([])
          setError(e instanceof Error ? e.message : 'Failed to load dataset points')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPoints()

    return () => {
      cancelled = true
    }
  }, [selectedDatasetId])

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null

  return {
    selectedDataset,
    selectedDatasetId,
    selectedPoints,
    loading,
    error,
    selectDataset: setSelectedDatasetId,
  }
}
