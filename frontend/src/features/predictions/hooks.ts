import { useCallback, useEffect, useState } from 'react'
import type { Prediction, PredictionRun, Target } from '../../types'
import { predictionsApi } from './api'

export interface ChartDataPoint {
  name: string
  value: number
  lower: number
  upper: number
  fill: string
}

function toChartData(predictions: Prediction[]): ChartDataPoint[] {
  return predictions.map((prediction) => ({
    name: prediction.outcome,
    value: prediction.probability * 100,
    lower: prediction.confidence_lower * 100,
    upper: prediction.confidence_upper * 100,
    fill: '',
  }))
}

export function usePredictionRunner() {
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [selectedRun, setSelectedRun] = useState<PredictionRun | null>(null)
  const [runs, setRuns] = useState<PredictionRun[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = useCallback(async (targetId: number) => {
    const nextRuns = await predictionsApi.listRuns(targetId)
    setRuns(nextRuns)
    return nextRuns
  }, [])

  const selectRun = useCallback(async (runId: number) => {
    setLoading(true)
    setError(null)

    try {
      const detail = await predictionsApi.getRun(runId)
      setSelectedRun(detail.run)
      setPredictions(detail.predictions)
      setChartData(toChartData(detail.predictions))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prediction run')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const runPrediction = useCallback(async (target: Target) => {
    setLoading(true)
    setError(null)

    try {
      const response = await predictionsApi.predict(target.id)
      setSelectedTarget(response.target)
      setSelectedRun(response.run)
      setPredictions(response.predictions)
      setChartData(toChartData(response.predictions))
      await loadRuns(target.id)
      return response
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed')
      throw e
    } finally {
      setLoading(false)
    }
  }, [loadRuns])

  return {
    selectedTarget,
    selectedRun,
    runs,
    predictions,
    chartData,
    loading,
    error,
    loadRuns,
    selectRun,
    runPrediction,
  }
}

export function useTargetRunSummaries(targets: Target[]) {
  const [latestRunsByTarget, setLatestRunsByTarget] = useState<Record<number, PredictionRun | null>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadLatestRuns() {
      if (targets.length === 0) {
        setLatestRunsByTarget({})
        return
      }

      setLoading(true)

      try {
        const latestRuns = await predictionsApi.listLatestRuns()
        const latestRunMap = Object.fromEntries(latestRuns.map((run) => [run.target_id, run] as const))
        const entries = targets.map((target) => [target.id, latestRunMap[target.id] ?? null] as const)

        if (!cancelled) {
          setLatestRunsByTarget(Object.fromEntries(entries))
        }
      } catch {
        if (!cancelled) {
          setLatestRunsByTarget(Object.fromEntries(targets.map((target) => [target.id, null] as const)))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadLatestRuns()

    return () => {
      cancelled = true
    }
  }, [targets])

  const setLatestRun = useCallback((targetId: number, run: PredictionRun | null) => {
    setLatestRunsByTarget((prev) => ({
      ...prev,
      [targetId]: run,
    }))
  }, [])

  return {
    latestRunsByTarget,
    loading,
    setLatestRun,
  }
}
