import { Suspense, lazy, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ChatWidget } from './components/ChatWidget'
import { Header } from './components/Header'
import { TabNav } from './components/TabNav'
import { StatusPanels } from './components/StatusPanels'
import { ParticleBackground } from './components/ParticleBackground'
import { useDatasets } from './features/datasets/hooks'
import { useTargets } from './features/targets/hooks'
import { usePredictionRunner, useTargetRunSummaries } from './features/predictions/hooks'
import type { ChatContext, Dataset } from './types'
import './App.css'

type Tab = 'datasets' | 'targets' | 'predictions'
const pageEase = [0.16, 1, 0.3, 1] as const

const DatasetList = lazy(async () =>
  import('./features/datasets/DatasetList').then((module) => ({ default: module.DatasetList })),
)
const TargetList = lazy(async () =>
  import('./features/targets/TargetList').then((module) => ({ default: module.TargetList })),
)
const PredictionView = lazy(async () =>
  import('./features/predictions/PredictionView').then((module) => ({ default: module.PredictionView })),
)

function App() {
  const [tab, setTab] = useState<Tab>('datasets')
  const { datasets, loading: datasetsLoading } = useDatasets()
  const { targets, createTarget, emptyDraft } = useTargets()
  const {
    selectedTarget,
    selectedRun,
    runs,
    predictions,
    chartData,
    loading: predictLoading,
    selectRun,
    runPrediction,
  } = usePredictionRunner()
  const { latestRunsByTarget, setLatestRun } = useTargetRunSummaries(targets)
  const [newTarget, setNewTarget] = useState(emptyDraft)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const dataLoading = datasetsLoading

  async function handleCreateTarget() {
    try {
      const created = await createTarget(newTarget)
      if (created) {
        setNewTarget(emptyDraft)
        setLatestRun(created.id, null)
      }
    } catch (error) {
      console.error(error)
    }
  }

  async function handlePredict(target: Parameters<typeof runPrediction>[0]) {
    try {
      const response = await runPrediction(target)
      setLatestRun(target.id, response.run)
    } catch (error) {
      console.error(error)
    }
  }

  const topPrediction = predictions[0] ?? null
  const chatContext: ChatContext = {
    page: tab,
    datasets_count: datasets.length,
    targets_count: targets.length,
    predictions_count: predictions.length,
    dataset_catalog: datasets
      .slice(0, 10)
      .map((dataset) => `${dataset.name} (${dataset.source}, ${dataset.category})`),
    target_catalog: targets
      .slice(0, 6)
      .map((target) => `${target.question} [${target.horizon_days}d]`),
    prediction_catalog: predictions
      .slice(0, 6)
      .map((prediction) => `${prediction.outcome}: ${(prediction.probability * 100).toFixed(1)}%`),
    dataset_series_summary: [],
    target_outcomes: [],
    prediction_distribution: [],
    dataset: selectedDataset
      ? {
          id: selectedDataset.id,
          name: selectedDataset.name,
          source: selectedDataset.source,
          category: selectedDataset.category,
          description: selectedDataset.description,
        }
      : null,
    target: selectedTarget
      ? {
          id: selectedTarget.id,
          question: selectedTarget.question,
          category: selectedTarget.category,
          horizon_days: selectedTarget.horizon_days,
        }
      : null,
    prediction: selectedRun
      ? {
          run_id: selectedRun.id,
          status: selectedRun.status,
          model_version: selectedRun.model_version,
          top_outcome: topPrediction?.outcome ?? null,
          top_probability: topPrediction ? topPrediction.probability * 100 : null,
        }
      : null,
  }

  return (
    <div className="app scanlines grid-overlay">
      <ParticleBackground />
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />

      <Header datasets={datasets} predictions={predictions} dataLoading={dataLoading} />

      <TabNav
        tab={tab}
        onTabChange={setTab}
        counts={{
          datasets: datasets.length,
          targets: targets.length,
          predictions: predictions.length,
        }}
      />

      <motion.div
        className="main-area"
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: pageEase }}
      >
        <StatusPanels
          datasets={datasets}
          targets={targets}
          selectedTarget={selectedTarget}
          newTargetHorizon={newTarget.horizon_days}
          dataLoading={dataLoading}
        />

        <AnimatePresence mode="wait">
          {tab === 'datasets' && (
            <motion.div
              key="datasets"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: pageEase }}
            >
              <Suspense fallback={<div className="empty">Loading datasets...</div>}>
                <DatasetList
                  datasets={datasets}
                  empty={datasets.length === 0}
                  onSelectionChange={setSelectedDataset}
                />
              </Suspense>
            </motion.div>
          )}

          {tab === 'targets' && (
            <motion.div
              key="targets"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: pageEase }}
            >
              <Suspense fallback={<div className="empty">Loading targets...</div>}>
                <TargetList
                  targets={targets}
                  newTarget={newTarget}
                  loading={predictLoading}
                  latestRunsByTarget={latestRunsByTarget}
                  onNewTargetChange={setNewTarget}
                  onCreateTarget={handleCreateTarget}
                  onPredict={handlePredict}
                />
              </Suspense>
            </motion.div>
          )}

          {tab === 'predictions' && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: pageEase }}
            >
              <Suspense fallback={<div className="empty">Loading predictions...</div>}>
                <PredictionView
                  selectedTarget={selectedTarget}
                  selectedRun={selectedRun}
                  runs={runs}
                  predictions={predictions}
                  chartData={chartData}
                  loading={predictLoading}
                  onRetry={() => (selectedTarget ? handlePredict(selectedTarget) : Promise.resolve())}
                  onSelectRun={selectRun}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <footer className="statusbar">
        <div className="statusbar-left">
          <span className="statusbar-item">
            <span className="statusbar-dot green" />
            {dataLoading ? 'syncing' : 'connected'}
          </span>
          <span className="statusbar-item">{datasets.length} datasets</span>
          <span className="statusbar-item">{targets.length} targets</span>
        </div>
        <div className="statusbar-right">
          <span className="statusbar-item">v0.1.0</span>
          <span className="statusbar-item">EMUWORLD ENGINE</span>
        </div>
      </footer>

      <ChatWidget context={chatContext} />
    </div>
  )
}

export default App
