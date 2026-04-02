import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  Target,
  TrendingUp,
  Plus,
  Play,
  BarChart3,
  Activity,
  Globe,
  Zap,
  ArrowRight,
  Sparkles,
  Clock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
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

const CATEGORY_ICONS: Record<string, typeof Database> = {
  macro: Globe,
  real_estate: Database,
  employment: Target,
  interest_rate: TrendingUp,
  trade: Activity,
}

const CATEGORY_LABELS: Record<string, string> = {
  macro: '宏观经济',
  real_estate: '房地产',
  employment: '就业',
  interest_rate: '利率',
  trade: '进出口',
}

const CHART_COLORS = ['#00f0ff', '#ff006e', '#00ff88', '#8b5cf6', '#2563eb', '#f59e0b']

function App() {
  const [tab, setTab] = useState<'datasets' | 'targets' | 'predictions'>('datasets')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  const [newTarget, setNewTarget] = useState({
    question: '',
    category: 'macro',
    horizon_days: 90,
    outcomes: '',
  })

  const datasetSources = new Set(datasets.map(d => d.source)).size
  const activeTargets = targets.reduce((total, t) => total + (t.active ? 1 : 0), 0)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/datasets`).then(r => r.json()).catch(() => []),
      fetch(`${API}/targets`).then(r => r.json()).catch(() => []),
    ]).then(([d, t]) => {
      setDatasets(d)
      setTargets(t)
      setDataLoading(false)
    })
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

  const chartData = predictions.map((p, i) => ({
    name: p.outcome,
    value: p.probability * 100,
    lower: p.confidence_lower * 100,
    upper: p.confidence_upper * 100,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <div className="app">
      {/* Hero Section */}
      <motion.header
        className="hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="eyebrow">MACRO QUANT STUDIO · 实时预测引擎</p>
        <h1>
          EmuWorld{' '}
          <span className="gradient-text">Probability Engine</span>
        </h1>
        <p className="subtitle">
          连接 FRED、World Bank 等官方数据流，通过语言智能和概率推断链路，实时生成宏观事件的可信区间。
        </p>
        <div className="hero-tags">
          <span className="chip">AI Forecast</span>
          <span className="chip">Scenario Lab</span>
          <span className="chip">Confidence Tube</span>
        </div>
        <div className="hero-cta">
          <button onClick={() => setTab('targets')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} />
              创建分析目标
            </span>
          </button>
          <button className="ghost" onClick={() => setTab('datasets')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} />
              查看数据源
            </span>
          </button>
        </div>

        <div className="hero-preview">
          <div className="preview-card">
            <p className="preview-label">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={12} />
                热门数据源
              </span>
            </p>
            {dataLoading ? (
              <>
                <div className="skeleton" style={{ width: '80%' }} />
                <div className="skeleton" style={{ width: '60%' }} />
                <div className="skeleton" style={{ width: '40%' }} />
              </>
            ) : datasets.length ? (
              <ul>
                {datasets.slice(0, 3).map(d => (
                  <li key={d.id}>
                    <span>{d.name}</span>
                    <small>{d.category}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty" style={{ padding: '2rem 0' }}>等待同步官方宏观数据</p>
            )}
          </div>

          <div className="preview-card">
            <p className="preview-label">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={12} />
                概率扇区
              </span>
            </p>
            {dataLoading ? (
              <>
                <div className="skeleton" style={{ width: '70%' }} />
                <div className="skeleton" style={{ width: '50%' }} />
                <div className="skeleton" style={{ width: '30%' }} />
              </>
            ) : predictions.length ? (
              <ul>
                {predictions.slice(0, 3).map((p, idx) => (
                  <li key={idx}>
                    <span>{p.outcome}</span>
                    <small>{(p.probability * 100).toFixed(1)}%</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty" style={{ padding: '2rem 0' }}>生成预测以查看概率分布</p>
            )}
          </div>
        </div>
      </motion.header>

      {/* Status Panels */}
      <motion.section
        className="status-panels"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <article className="status-card">
          <p className="status-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={12} />
              数据源
            </span>
          </p>
          <p className="status-value">{dataLoading ? '—' : datasetSources}</p>
          <p className="status-hint">
            {datasets.length ? `${datasets.length} 个数据集` : '等待 FRED 同步'}
          </p>
        </article>

        <article className="status-card">
          <p className="status-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Target size={12} />
              分析目标
            </span>
          </p>
          <p className="status-value">{dataLoading ? '—' : targets.length}</p>
          <p className="status-hint">
            {activeTargets ? `${activeTargets} 个活跃` : '创建后自动更新'}
          </p>
        </article>

        <article className="status-card">
          <p className="status-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={12} />
              预测窗口
            </span>
          </p>
          <p className="status-value">
            {dataLoading ? '—' : selectedTarget ? `${selectedTarget.horizon_days}d` : `${newTarget.horizon_days}d`}
          </p>
          <p className="status-hint">
            {predictions.length ? '最新预测已生成' : '生成预测以查看结果'}
          </p>
        </article>
      </motion.section>

      {/* Tab Navigation */}
      <nav className="tabs">
        <button
          className={tab === 'datasets' ? 'active' : ''}
          onClick={() => setTab('datasets')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Database size={14} />
            数据集
          </span>
        </button>
        <button
          className={tab === 'targets' ? 'active' : ''}
          onClick={() => setTab('targets')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Target size={14} />
            分析目标
          </span>
        </button>
        <button
          className={tab === 'predictions' ? 'active' : ''}
          onClick={() => setTab('predictions')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <TrendingUp size={14} />
            预测结果
          </span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="main">
        <AnimatePresence mode="wait">
          {tab === 'datasets' && (
            <motion.section
              key="datasets"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2>
                <Globe size={14} />
                官方数据源
              </h2>
              {datasets.length === 0 ? (
                <div className="empty">
                  <AlertCircle size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p>暂无数据集，请先配置 FRED API Key 同步数据</p>
                </div>
              ) : (
                <div className="grid">
                  {datasets.map(d => {
                    const Icon = CATEGORY_ICONS[d.category] || Database
                    return (
                      <motion.div
                        key={d.id}
                        className="card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Icon size={18} style={{ color: 'var(--neon-cyan)' }} />
                          <h3>{d.name}</h3>
                        </div>
                        <span className="badge">{d.category}</span>
                        <p>{d.description}</p>
                        <small>来源: {d.source}</small>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.section>
          )}

          {tab === 'targets' && (
            <motion.section
              key="targets"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h2>
                <Plus size={14} />
                创建分析目标
              </h2>
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
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
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
                <button
                  onClick={handleCreateTarget}
                  disabled={!newTarget.question || !newTarget.outcomes}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} />
                    创建目标
                  </span>
                </button>
              </div>

              <h2>
                <Target size={14} />
                已有目标
              </h2>
              {targets.length === 0 ? (
                <div className="empty">
                  <Target size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p>暂无分析目标</p>
                </div>
              ) : (
                <div className="grid">
                  {targets.map(t => {
                    const Icon = CATEGORY_ICONS[t.category] || Target
                    return (
                      <motion.div
                        key={t.id}
                        className="card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Icon size={18} style={{ color: 'var(--neon-cyan)' }} />
                          <h3>{t.question}</h3>
                        </div>
                        <span className="badge">{t.category}</span>
                        <p>预测周期: {t.horizon_days} 天</p>
                        <button onClick={() => handlePredict(t)} disabled={loading}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            {loading ? <Activity size={16} className="spin" /> : <Play size={16} />}
                            {loading ? '生成中...' : '生成预测'}
                          </span>
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.section>
          )}

          {tab === 'predictions' && (
            <motion.section
              key="predictions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {selectedTarget ? (
                <>
                  <h2>
                    <TrendingUp size={14} />
                    {selectedTarget.question}
                  </h2>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="name"
                          stroke="rgba(255,255,255,0.3)"
                          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Fira Code' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        />
                        <YAxis
                          stroke="rgba(255,255,255,0.3)"
                          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Fira Code' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(12, 12, 25, 0.95)',
                            border: '1px solid rgba(0, 240, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#e8e8f0',
                            fontFamily: 'Fira Code',
                            fontSize: '13px',
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, '概率']}
                          labelStyle={{ color: '#00f0ff', fontWeight: 600 }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="predictions" style={{ marginTop: '1.5rem' }}>
                    {predictions.map((p, i) => (
                      <motion.div
                        key={i}
                        className="prediction-bar"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                      >
                        <span className="outcome">{p.outcome}</span>
                        <div className="bar-container">
                          <div className="bar">
                            <div
                              className="bar-fill"
                              style={{ width: `${p.probability * 100}%` }}
                            />
                          </div>
                          <span className="probability">{(p.probability * 100).toFixed(1)}%</span>
                        </div>
                        <span className="confidence">
                          CI: {(p.confidence_lower * 100).toFixed(0)}% - {(p.confidence_upper * 100).toFixed(0)}%
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty">
                  <BarChart3 size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p>暂无预测结果，请先创建分析目标并生成预测</p>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
