import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './components/Header'
import { StatusPanels } from './components/StatusPanels'
import { TabNav } from './components/TabNav'
import { DatasetList } from './components/DatasetList'
import { TargetList } from './components/TargetList'
import { PredictionView } from './components/PredictionView'
import { useDatasets, useTargets } from './hooks/useDatasets'
import { api } from './services/api'
import { CHART_COLORS } from './types'
import type { Target, Prediction } from './types'
import './App.css'

type Tab = 'datasets' | 'targets' | 'predictions'

function App() {
  const { data: datasets, loading: dataLoading } = useDatasets()
  const { data: targets, refresh: refreshTargets } = useTargets()
  const [tab, setTab] = useState<Tab>('datasets')
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [newTarget, setNewTarget] = useState({ question: '', category: 'macro', horizon_days: 90, outcomes: '' })

  const handleCreateTarget = async () => {
    if (!newTarget.question || !newTarget.outcomes) return
    await api.targets.create({
      ...newTarget,
      outcomes: newTarget.outcomes.split(',').map(s => s.trim()),
    })
    refreshTargets()
    setNewTarget({ question: '', category: 'macro', horizon_days: 90, outcomes: '' })
  }

  const handlePredict = async (target: Target) => {
    setLoading(true)
    try {
      const data = await api.targets.predict(target.id)
      setSelectedTarget(data.target)
      setPredictions(data.predictions)
      setTab('predictions')
    } catch (e) {
      console.error('Prediction failed:', e)
    }
    setLoading(false)
  }

  const chartData = predictions.map((p, i) => ({
    name: p.outcome,
    value: p.probability * 100,
    lower: p.confidence_lower * 100,
    upper: p.confidence_upper * 100,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <div className="app">
      <Header datasets={datasets} predictions={predictions} dataLoading={dataLoading} onNavigate={setTab} />
      <StatusPanels datasets={datasets} targets={targets} selectedTarget={selectedTarget} newTargetHorizon={newTarget.horizon_days} dataLoading={dataLoading} />
      <TabNav tab={tab} onTabChange={setTab} />
      <main className="main">
        <AnimatePresence mode="wait">
          {tab === 'datasets' && <motion.section key="datasets" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}><DatasetList datasets={datasets} empty={dataLoading} /></motion.section>}
          {tab === 'targets' && <motion.section key="targets" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}><TargetList targets={targets} newTarget={newTarget} loading={loading} onNewTargetChange={setNewTarget} onCreateTarget={handleCreateTarget} onPredict={handlePredict} /></motion.section>}
          {tab === 'predictions' && <motion.section key="predictions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}><PredictionView selectedTarget={selectedTarget} predictions={predictions} chartData={chartData} /></motion.section>}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
