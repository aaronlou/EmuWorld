import { useCallback, useEffect, useState } from 'react'
import type { CreateTargetRequest, Target } from '../../types'
import { targetsApi } from './api'

export interface TargetDraft {
  question: string
  category: string
  horizon_days: number
  outcomes: string
}

const EMPTY_TARGET_DRAFT: TargetDraft = {
  question: '',
  category: 'macro',
  horizon_days: 90,
  outcomes: '',
}

export function useTargets() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await targetsApi.list()
      setTargets(data)
    } catch (e) {
      setTargets([])
      setError(e instanceof Error ? e.message : 'Failed to load targets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createTarget = useCallback(async (draft: TargetDraft) => {
    if (!draft.question || !draft.outcomes) {
      return null
    }

    const outcomes = draft.outcomes
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    if (outcomes.length === 0) {
      return null
    }

    const req: CreateTargetRequest = {
      question: draft.question,
      category: draft.category,
      horizon_days: draft.horizon_days,
      outcomes,
    }

    const target = await targetsApi.create(req)
    setTargets((prev) => [target, ...prev])
    return target
  }, [])

  return {
    targets,
    loading,
    error,
    refresh,
    createTarget,
    emptyDraft: EMPTY_TARGET_DRAFT,
  }
}
