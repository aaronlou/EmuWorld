import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  ComposedChart, Scatter
} from 'recharts'
import './App.css'

// ==================== MOCK DATA ====================

const mockDatasets = [
  { id: 1, name: 'CPI 消费者物价指数', source: 'FRED', category: 'inflation', fred_code: 'CPIAUCSL', description: '美国消费者价格指数，衡量通胀核心指标', latest: 310.3, change: '+0.2%', unit: '指数' },
  { id: 2, name: '失业率 Unemployment Rate', source: 'BLS', category: 'employment', fred_code: 'UNRATE', description: '美国月度失业率，劳动力市场健康状况', latest: 3.7, change: '-0.1%', unit: '%' },
  { id: 3, name: '联邦基金利率', source: 'FED', category: 'interest_rate', fred_code: 'FEDFUNDS', description: '美联储联邦基金目标利率', latest: 4.33, change: '0.0%', unit: '%' },
  { id: 4, name: 'GDP 增长率', source: 'BEA', category: 'growth', fred_code: 'GDP', description: '美国季度实际 GDP 环比增长率', latest: 2.8, change: '+0.3%', unit: '%' },
  { id: 5, name: 'M2 货币供应量', source: 'FED', category: 'money_supply', fred_code: 'M2SL', description: '美国 M2 货币供应量，万亿美元', latest: 20.8, change: '+1.2%', unit: '万亿美元' },
  { id: 6, name: '中国 PMI 制造业', source: 'NBS', category: 'macro', fred_code: 'MANCPMI', description: '中国制造业采购经理指数', latest: 50.1, change: '+0.2', unit: '指数' },
  { id: 7, name: '新屋开工数', source: 'Census', category: 'real_estate', fred_code: 'HOUST', description: '美国月度新屋开工数量，年化', latest: 1420, change: '-3.2%', unit: '千套' },
  { id: 8, name: '进出口差额', source: 'BEA', category: 'trade', fred_code: 'BOPGSTB', description: '美国月度商品和服务贸易差额', latest: -782, change: '+5.1%', unit: '亿美元' },
  { id: 9, name: '标普/Case-Shiller 房价指数', source: 'S&P', category: 'real_estate', fred_code: 'CSUSHPINSA', description: '美国 20 城综合房价指数', latest: 312.5, change: '+4.8%', unit: '指数' },
  { id: 10, name: '非农就业人数', source: 'BLS', category: 'employment', fred_code: 'PAYEMS', description: '美国非农就业总人数', latest: 158200, change: '+272K', unit: '千人' },
]

function generateTimeSeries(base: number, volatility: number, trend: number, months: number, startDate: string) {
  const data: any[] = []
  let value = base - trend * months * 0.5
  for (let i = 0; i < months; i++) {
    const date = new Date(startDate)
    date.setMonth(date.getMonth() + i)
    value += trend + (Math.random() - 0.5) * volatility * 2
    data.push({
      date: date.toISOString().slice(0, 7),
      value: Math.round(value * 100) / 100,
      forecast: i > months - 7 ? Math.round((value + (Math.random() - 0.3) * volatility) * 100) / 100 : null,
      upper: i > months - 7 ? Math.round((value + volatility * 1.5) * 100) / 100 : null,
      lower: i > months - 7 ? Math.round((value - volatility * 1.5) * 100) / 100 : null,
    })
  }
  return data
}

const cpiData = generateTimeSeries(300, 2, 0.4, 24, '2024-01')
const gdpData = generateTimeSeries(2.0, 0.5, 0.05, 12, '2025-01')
const employmentData = generateTimeSeries(157000, 500, 200, 12, '2025-01')
const houseData = generateTimeSeries(300, 3, 1.2, 24, '2024-01')

const mockTargets = [
  { id: 1, question: '中国 CPI 明年是否超过 2%？', category: 'inflation', horizon_days: 180, outcomes: JSON.stringify(['是', '否']), active: true, created_at: '2026-03-15T10:00:00Z' },
  { id: 2, question: '美联储 Q3 是否降息？', category: 'interest_rate', horizon_days: 90, outcomes: JSON.stringify(['降息 25bp', '降息 50bp', '维持不变']), active: true, created_at: '2026-03-20T14:00:00Z' },
  { id: 3, question: '美国失业率年底是否突破 4.5%？', category: 'employment', horizon_days: 270, outcomes: JSON.stringify(['是', '否']), active: true, created_at: '2026-04-01T09:00:00Z' },
]

const mockPredictions = {
  1: [
    { outcome: '是', probability: 0.38, confidence_lower: 0.28, confidence_upper: 0.48 },
    { outcome: '否', probability: 0.62, confidence_lower: 0.52, confidence_upper: 0.72 },
  ],
  2: [
    { outcome: '降息 25bp', probability: 0.45, confidence_lower: 0.35, confidence_upper: 0.55 },
    { outcome: '降息 50bp', probability: 0.18, confidence_lower: 0.10, confidence_upper: 0.26 },
    { outcome: '维持不变', probability: 0.37, confidence_lower: 0.27, confidence_upper: 0.47 },
  ],
  3: [
    { outcome: '是', probability: 0.31, confidence_lower: 0.22, confidence_upper: 0.40 },
    { outcome: '否', probability: 0.69, confidence_lower: 0.60, confidence_upper: 0.78 },
  ],
}

const macroIndicators = [
  { name: 'GDP', value: 2.8, target: 3.0, unit: '%', color: '#38bdf8' },
  { name: 'CPI', value: 3.2, target: 2.0, unit: '%', color: '#fb923c' },
  { name: '失业率', value: 3.7, target: 4.0, unit: '%', color: '#34d399' },
  { name: '利率', value: 4.33, target: 3.5, unit: '%', color: '#a78bfa' },
  { name: 'PMI', value: 50.1, target: 50.0, unit: '', color: '#f472b6' },
  { name: 'M2增速', value: 5.8, target: 6.0, unit: '%', color: '#fbbf24' },
]

const sectorPerformance = [
  { name: '科技', value: 28.5, change: '+2.3%' },
  { name: '金融', value: 18.2, change: '+1.1%' },
  { name: '医疗', value: 14.8, change: '-0.5%' },
  { name: '能源', value: 12.1, change: '+3.2%' },
  { name: '消费', value: 11.4, change: '+0.8%' },
  { name: '工业', value: 8.6, change: '-1.2%' },
  { name: '其他', value: 6.4, change: '+0.3%' },
]

const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#fbbf24', '#60a5fa']

const riskGauges = [
  { name: '通胀风险', value: 72, max: 100, level: '高' },
  { name: '衰退概率', value: 35, max: 100, level: '中' },
  { name: '流动性', value: 58, max: 100, level: '中' },
  { name: '地缘风险', value: 65, max: 100, level: '高' },
]

const monthlyFlows = [
  { month: '1月', inflow: 420, outflow: 380 },
  { month: '2月', inflow: 390, outflow: 410 },
  { month: '3月', inflow: 510, outflow: 350 },
  { month: '4月', inflow: 460, outflow: 420 },
  { month: '5月', inflow: 530, outflow: 390 },
  { month: '6月', inflow: 480, outflow: 440 },
]

// ==================== COMPONENTS ====================

function StatCard({ label, value, change, unit, color }: { label: string; value: string | number; change: string; unit: string; color: string }) {
  const isPositive = change.startsWith('+')
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      <div className={`stat-change ${isPositive ? 'positive' : 'negative'}`}>
        {change}
      </div>
    </div>
  )
}

function GaugeChart({ name, value, max, level }: { name: string; value: number; max: number; level: string }) {
  const data = [{ name, value, fill: value > 60 ? '#fb923c' : value > 40 ? '#fbbf24' : '#34d399' }]
  return (
    <div className="gauge-item">
      <ResponsiveContainer width="100%" height={120}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={data} startAngle={180} endAngle={0}>
          <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'rgba(255,255,255,0.05)' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="gauge-label">{name}</div>
      <div className="gauge-value">{value}%</div>
      <div className="gauge-level" style={{ color: value > 60 ? '#fb923c' : value > 40 ? '#fbbf24' : '#34d399' }}>
        {level}
      </div>
    </div>
  )
}

function DashboardTab() {
  const time = new Date()
  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>宏观仪表盘</h2>
          <p className="dashboard-sub">实时监测全球经济核心指标</p>
        </div>
        <div className="dashboard-time">
          <span className="time-value">{time.toLocaleTimeString('zh-CN', { hour12: false })}</span>
          <span className="time-date">{time.toLocaleDateString('zh-CN')}</span>
        </div>
      </div>

      <div className="stat-grid">
        {macroIndicators.map(ind => (
          <StatCard
            key={ind.name}
            label={ind.name}
            value={ind.value}
            change={ind.value > ind.target ? '+偏离目标' : '-正常区间'}
            unit={ind.unit}
            color={ind.color}
          />
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card wide">
          <div className="chart-header">
            <h3>CPI 趋势与预测</h3>
            <span className="chart-badge">24M</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={cpiData}>
              <defs>
                <linearGradient id="cpiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#f0f6ff' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} fill="url(#cpiGrad)" dot={false} />
              <Area type="monotone" dataKey="forecast" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" fill="url(#forecastGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>GDP 增长</h3>
            <span className="chart-badge">12M</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={gdpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#f0f6ff' }}
              />
              <Bar dataKey="value" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>行业分布</h3>
            <span className="chart-badge">权重</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={sectorPerformance}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {sectorPerformance.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#f0f6ff' }}
                formatter={(value: number) => [`${value}%`, '权重']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {sectorPerformance.slice(0, 5).map((s, i) => (
              <div key={s.name} className="legend-item">
                <span className="legend-dot" style={{ background: COLORS[i] }} />
                <span>{s.name}</span>
                <span className="legend-value">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card wide">
          <div className="chart-header">
            <h3>资金流向</h3>
            <span className="chart-badge">月度</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyFlows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#f0f6ff' }}
              />
              <Bar dataKey="inflow" fill="#38bdf8" radius={[4, 4, 0, 0]} name="流入" />
              <Bar dataKey="outflow" fill="#fb923c" radius={[4, 4, 0, 0]} name="流出" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>风险仪表盘</h3>
            <span className="chart-badge">实时</span>
          </div>
          <div className="gauge-grid">
            {riskGauges.map(g => (
              <GaugeChart key={g.name} {...g} />
            ))}
          </div>
        </div>

        <div className="chart-card wide">
          <div className="chart-header">
            <h3>就业人数趋势</h3>
            <span className="chart-badge">12M</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={employmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#f0f6ff' }}
                formatter={(value: number) => [value.toLocaleString(), '千人']}
              />
              <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

function DatasetsTab() {
  return (
    <section>
      <h2>官方数据源</h2>
      <div className="grid">
        {mockDatasets.map(d => (
          <div key={d.id} className="card">
            <h3>{d.name}</h3>
            <span className="badge">{d.category}</span>
            <p>{d.description}</p>
            <div className="card-stats">
              <div className="card-stat">
                <span className="card-stat-label">最新值</span>
                <span className="card-stat-value">{d.latest.toLocaleString()}</span>
              </div>
              <div className="card-stat">
                <span className="card-stat-label">变化</span>
                <span className={`card-stat-value ${d.change.startsWith('+') ? 'positive' : d.change.startsWith('-') ? 'negative' : ''}`}>
                  {d.change}
                </span>
              </div>
            </div>
            <small>来源: {d.source} · 代码: {d.fred_code}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function TargetsTab() {
  const [targets, setTargets] = useState(mockTargets)
  const [newTarget, setNewTarget] = useState({
    question: '',
    category: 'macro',
    horizon_days: 90,
    outcomes: '',
  })

  const handleCreateTarget = () => {
    if (!newTarget.question || !newTarget.outcomes) return
    const target = {
      id: targets.length + 1,
      ...newTarget,
      outcomes: JSON.stringify(newTarget.outcomes.split(',').map(s => s.trim())),
      active: true,
      created_at: new Date().toISOString(),
    }
    setTargets(prev => [target, ...prev])
    setNewTarget({ question: '', category: 'macro', horizon_days: 90, outcomes: '' })
  }

  const categoryLabels: Record<string, string> = {
    macro: '宏观经济', real_estate: '房地产', employment: '就业',
    interest_rate: '利率', trade: '进出口', inflation: '通胀',
    growth: '增长', money_supply: '货币供应', exchange_rate: '汇率',
  }

  return (
    <section>
      <h2>创建分析目标</h2>
      <div className="form">
        <input
          placeholder="输入分析目标，如：中国 CPI 明年是否超过 2%？"
          value={newTarget.question}
          onChange={e => setNewTarget(p => ({ ...p, question: e.target.value }))}
        />
        <div className="form-row">
          <select
            value={newTarget.category}
            onChange={e => setNewTarget(p => ({ ...p, category: e.target.value }))}
          >
            {Object.entries(categoryLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
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
        <button onClick={handleCreateTarget} disabled={!newTarget.question || !newTarget.outcomes}>
          创建目标
        </button>
      </div>

      <h2>已有目标</h2>
      <div className="grid">
        {targets.map(t => (
          <div key={t.id} className="card">
            <h3>{t.question}</h3>
            <span className="badge">{categoryLabels[t.category] || t.category}</span>
            <p>预测周期: {t.horizon_days} 天</p>
            <button>生成预测</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function PredictionsTab() {
  const categoryLabels: Record<string, string> = {
    macro: '宏观经济', real_estate: '房地产', employment: '就业',
    interest_rate: '利率', trade: '进出口', inflation: '通胀',
  }

  const [selectedId, setSelectedId] = useState<number | null>(1)
  const selectedTarget = mockTargets.find(t => t.id === selectedId)
  const predictions = selectedId ? mockPredictions[selectedId as keyof typeof mockPredictions] || [] : []

  return (
    <section>
      <h2>预测结果</h2>
      <div className="prediction-selector">
        {mockTargets.map(t => (
          <button
            key={t.id}
            className={selectedId === t.id ? 'active' : ''}
            onClick={() => setSelectedId(t.id)}
          >
            {t.question}
          </button>
        ))}
      </div>

      {selectedTarget && predictions.length > 0 && (
        <div className="prediction-detail">
          <div className="prediction-header">
            <h3>{selectedTarget.question}</h3>
            <span className="badge">{categoryLabels[selectedTarget.category] || selectedTarget.category}</span>
            <span className="prediction-horizon">预测周期: {selectedTarget.horizon_days} 天</span>
          </div>

          <div className="predictions">
            {predictions.map((p, i) => (
              <div key={i} className="prediction-bar">
                <div className="prediction-info">
                  <span className="outcome">{p.outcome}</span>
                  <span className="confidence">
                    CI: {(p.confidence_lower * 100).toFixed(0)}% - {(p.confidence_upper * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bar-container">
                  <div className="bar" style={{ width: `${p.probability * 100}%` }} />
                  <span className="probability">{(p.probability * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="chart-card" style={{ marginTop: '1.5rem' }}>
            <div className="chart-header">
              <h3>概率分布</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={predictions}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="outcome" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#f0f6ff' }}
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '概率']}
                />
                <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
                  {predictions.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}

// ==================== MAIN APP ====================

function App() {
  const [tab, setTab] = useState<'dashboard' | 'datasets' | 'targets' | 'predictions'>('dashboard')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="logo">
            <span className="logo-icon">◆</span>
            <h1>EmuWorld</h1>
          </div>
          <div className="header-status">
            <span className="status-dot" />
            <span className="status-text">LIVE</span>
            <span className="status-time">{now.toLocaleTimeString('zh-CN', { hour12: false })}</span>
          </div>
        </div>
        <p className="subtitle">用数据观测世界 · 用概率预测未来</p>
      </header>

      <nav className="tabs">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
          仪表盘
        </button>
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
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'datasets' && <DatasetsTab />}
        {tab === 'targets' && <TargetsTab />}
        {tab === 'predictions' && <PredictionsTab />}
      </main>
    </div>
  )
}

export default App
