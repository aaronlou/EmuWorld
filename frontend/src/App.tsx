import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './components/Header'
import { TabNav } from './components/TabNav'
import { StatusPanels } from './components/StatusPanels'
import { DatasetList } from './components/DatasetList'
import { TargetList } from './components/TargetList'
import { PredictionView } from './components/PredictionView'
import { ParticleBackground } from './components/ParticleBackground'
import { api } from './services/api'
import type { Dataset, Target, Prediction, CreateTargetRequest } from './types'
import './App.css'

type Tab = 'datasets' | 'targets' | 'predictions'

interface ChartDataPoint {
  name: string
  value: number
  lower: number
  upper: number
  fill: string
}

function App() {
  const [tab, setTab] = useState<Tab>('datasets')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [predictLoading, setPredictLoading] = useState(false)
  const [newTarget, setNewTarget] = useState({
    question: '',
    category: 'macro',
    horizon_days: 90,
    outcomes: '',
  })

  const fetchData = useCallback(() => {
    setDataLoading(true)
    Promise.all([api.datasets.list(), api.targets.list()])
      .then(([d, t]) => {
        setDatasets(d)
        setTargets(t)
      })
      .catch(() => {
        setDatasets([])
        setTargets([])
      })
      .finally(() => setDataLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateTarget = useCallback(() => {
    if (!newTarget.question || !newTarget.outcomes) return
    const outcomes = newTarget.outcomes.split(',').map(s => s.trim()).filter(Boolean)
    if (outcomes.length === 0) return

    const req: CreateTargetRequest = {
      question: newTarget.question,
      category: newTarget.category,
      horizon_days: newTarget.horizon_days,
      outcomes,
    }

    api.targets.create(req)
      .then(target => {
        setTargets(prev => [target, ...prev])
        setNewTarget({ question: '', category: 'macro', horizon_days: 90, outcomes: '' })
      })
      .catch(console.error)
  }, [newTarget])

  const handlePredict = useCallback((target: Target) => {
    setPredictLoading(true)
    api.targets.predict(target.id)
      .then(response => {
        setPredictions(response.predictions)
        setSelectedTarget(response.target)
        setChartData(response.predictions.map((p) => ({
          name: p.outcome,
          value: p.probability * 100,
          lower: p.confidence_lower * 100,
          upper: p.confidence_upper * 100,
          fill: '',
        })))
      })
      .catch(console.error)
      .finally(() => setPredictLoading(false))
  }, [])

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
        counts={{ datasets: datasets.length, targets: targets.length, predictions: predictions.length }}
      />

      <motion.div
        className="main-area"
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <DatasetList datasets={datasets} empty={datasets.length === 0} />
            </motion.div>
          )}

          {tab === 'targets' && (
            <motion.div
              key="targets"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <TargetList
                targets={targets}
                newTarget={newTarget}
                loading={predictLoading}
                onNewTargetChange={setNewTarget}
                onCreateTarget={handleCreateTarget}
                onPredict={handlePredict}
              />
            </motion.div>
          )}

          {tab === 'predictions' && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <PredictionView
                selectedTarget={selectedTarget}
                predictions={predictions}
                chartData={chartData}
              />
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
    </div>
  )
}

export default App
