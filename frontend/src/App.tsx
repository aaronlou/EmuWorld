import { useState, useEffect } from 'react'
import './App.css'

const API = 'http://localhost:8080'

interface Dataset {
  id: number
  name: string
  source: string
  category: string
  description: string
}

interface Target {
  id: number
  question: string
  category: string
  horizon_days: number
  outcomes: string
  active: boolean
  created_at: string
}

interface Prediction {
  outcome: string
  probability: number
  confidence_lower: number
  confidence_upper: number
}

function App() {
  const [tab, setTab] = useState<'datasets' | 'targets' | 'predictions'>('datasets')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)

  const [newTarget, setNewTarget] = useState({
    question: '',
    category: 'macro',
    horizon_days: 90,
    outcomes: '',
  })

  useEffect(() => {
    fetch(`${API}/datasets`)
      .then(r => r.json())
      .then(setDatasets)
      .catch(() => setDatasets([]))
    fetch(`${API}/targets`)
      .then(r => r.json())
      .then(setTargets)
      .catch(() => setTargets([]))
  }, [])

  const handleCreateTarget = async () => {
    if (!newTarget.question || !newTarget.outcomes) return
    const res = await fetch(`${API}/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTarget,
        outcomes: newTarget.outcomes.split(',').map(s => s.trim()),
      }),
    })
    const target = await res.json()
    setTargets(prev => [target, ...prev])
    setNewTarget({ question: '', category: 'macro', horizon_days: 90, outcomes: '' })
  }

  const handlePredict = async (target: Target) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/targets/${target.id}/predict`, { method: 'POST' })
      const data = await res.json()
      setSelectedTarget(data.target)
      setPredictions(data.predictions)
      setTab('predictions')
    } catch (e) {
      console.error('Prediction failed:', e)
    }
    setLoading(false)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>EmuWorld</h1>
        <p className="subtitle">用数据观测世界，用概率预测未来</p>
      </header>

      <nav className="tabs">
        <button className={tab === 'datasets' ? 'active' : ''} onClick={() => setTab('datasets')}>
          数据集
        </button>
        <button className={tab === 'targets' ? 'active' : ''} onClick={() => setTab('targets')}>
          分析目标
        </button>
        <button className={tab === 'predictions' ? 'active' : ''} onClick={() => setTab('predictions')}>
          预测结果
        </button>
      </nav>

      <main className="main">
        {tab === 'datasets' && (
          <section>
            <h2>官方数据源</h2>
            {datasets.length === 0 ? (
              <p className="empty">暂无数据集，请先配置 FRED API Key 同步数据</p>
            ) : (
              <div className="grid">
                {datasets.map(d => (
                  <div key={d.id} className="card">
                    <h3>{d.name}</h3>
                    <span className="badge">{d.category}</span>
                    <p>{d.description}</p>
                    <small>来源: {d.source}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'targets' && (
          <section>
            <h2>创建分析目标</h2>
            <div className="form">
              <input
                placeholder="分析目标，如：中国 CPI 明年是否超过 2%？"
                value={newTarget.question}
                onChange={e => setNewTarget(p => ({ ...p, question: e.target.value }))}
              />
              <div className="form-row">
                <select
                  value={newTarget.category}
                  onChange={e => setNewTarget(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="macro">宏观经济</option>
                  <option value="real_estate">房地产</option>
                  <option value="employment">就业</option>
                  <option value="interest_rate">利率</option>
                  <option value="trade">进出口</option>
                </select>
                <input
                  type="number"
                  min="30"
                  max="365"
                  value={newTarget.horizon_days}
                  onChange={e => setNewTarget(p => ({ ...p, horizon_days: parseInt(e.target.value) }))}
                  placeholder="预测天数"
                />
              </div>
              <input
                placeholder="可能结果，用逗号分隔，如：是,否,不确定"
                value={newTarget.outcomes}
                onChange={e => setNewTarget(p => ({ ...p, outcomes: e.target.value }))}
              />
              <button onClick={handleCreateTarget} disabled={!newTarget.question || !newTarget.outcomes}>
                创建目标
              </button>
            </div>

            <h2>已有目标</h2>
            {targets.length === 0 ? (
              <p className="empty">暂无分析目标</p>
            ) : (
              <div className="grid">
                {targets.map(t => (
                  <div key={t.id} className="card">
                    <h3>{t.question}</h3>
                    <span className="badge">{t.category}</span>
                    <p>预测周期: {t.horizon_days} 天</p>
                    <button onClick={() => handlePredict(t)} disabled={loading}>
                      {loading ? '生成中...' : '生成预测'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'predictions' && (
          <section>
            {selectedTarget ? (
              <>
                <h2>{selectedTarget.question}</h2>
                <div className="predictions">
                  {predictions.map((p, i) => (
                    <div key={i} className="prediction-bar">
                      <span className="outcome">{p.outcome}</span>
                      <div className="bar-container">
                        <div
                          className="bar"
                          style={{ width: `${p.probability * 100}%` }}
                        />
                        <span className="probability">{(p.probability * 100).toFixed(1)}%</span>
                      </div>
                      <span className="confidence">
                        CI: {(p.confidence_lower * 100).toFixed(0)}% - {(p.confidence_upper * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty">暂无预测结果，请先创建分析目标并生成预测</p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
