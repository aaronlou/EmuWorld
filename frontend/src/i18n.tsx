import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'en' | 'zh-CN'

const LANGUAGE_STORAGE_KEY = 'emuworld-language'

const translations = {
  en: {
    app: {
      loadingDatasets: 'Loading datasets...',
      loadingTargets: 'Loading targets...',
      loadingPredictions: 'Loading predictions...',
      syncing: 'syncing',
      connected: 'connected',
      datasetsCount: '{{count}} datasets',
      targetsCount: '{{count}} targets',
      predictionsCount: '{{count}} predictions',
      engineLabel: 'EMUWORLD ENGINE',
    },
    header: {
      context: 'MACRO QUANT ENGINE',
      sourcesShort: '{{count}} src',
      forecastsShort: '{{count}} fcst',
      sync: 'SYNC',
      live: 'LIVE',
      language: 'Language',
    },
    tab: {
      datasets: 'Datasets',
      targets: 'Targets',
      predictions: 'Predictions',
      knowledge: 'Knowledge',
    },
    status: {
      dataSources: 'Data Sources',
      awaitingSync: 'awaiting sync',
      targets: 'Targets',
      active: '{{count}} active',
      idle: 'idle',
      forecastWindow: 'Forecast Window',
      predictionReady: 'prediction ready',
      noPrediction: 'no prediction yet',
      engineStatus: 'Engine Status',
      allSystemsNominal: 'all systems nominal',
      expand: 'Expand',
      collapse: 'Collapse',
      statusStripLabel: 'Click to expand status panel',
      statusPanelsLabel: 'Status panels - click to collapse',
    },
    dataset: {
      emptyTitle: 'Data Sources',
      emptyAction: 'awaiting configuration',
      emptyBody: 'No datasets configured. Set FRED API key to begin sync.',
      eyebrow: 'Macro data workspace',
      heroTitle: 'Signal coverage across your live economic feed.',
      heroBody:
        'Track how much data is online, which sources dominate the surface, and what categories are ready for forecasting right now.',
      liveDatasets: 'Live datasets',
      upstreamFeeds: '{{count}} upstream feeds',
      topSource: 'Top source',
      activeSeries: '{{count}} active series',
      dominantCategory: 'Dominant category',
      datasetsMapped: '{{count}} datasets mapped',
      ingestionCadence: 'Ingestion cadence',
      latestImportTimeline: 'latest import timeline',
      sourceMix: 'Source mix',
      connectedFeeds: '{{count}} connected feeds',
      categorySpread: 'Category spread',
      deepestCoverage: 'where the coverage is deepest',
      mappedSeries: '{{count}} mapped series',
      newestArrivals: 'Newest arrivals',
      latestSyncedSeries: 'latest synced series',
      seriesPreview: 'Series preview',
      selectSeries: 'select a series',
      latest: 'latest',
      range: 'range',
      history: 'history',
      loadingHistory: 'Loading series history...',
      selectSeriesEmpty: 'Select a series to inspect its time history.',
      seriesRegistry: 'Series registry',
      rowsIndexed: '{{count}} rows indexed',
      tableSeries: 'Series',
      tableCategory: 'Category',
      tableSource: 'Source',
      tableUpdated: 'Updated',
      tableDescription: 'Description',
      searchPlaceholder: 'Search datasets...',
      resetFilters: 'Reset filters',
    },
    target: {
      eyebrow: 'Forecast target design',
      heroTitle: 'Define decision questions before the engine prices them.',
      heroBody: 'Draft the question, set the horizon, then launch runs from the target registry.',
      createTitle: 'Create target',
      createAction: 'question / horizon / outcomes',
      questionPlaceholder: 'Question, e.g. Will China CPI exceed 2% next year?',
      horizonPlaceholder: 'Horizon (days)',
      outcomesPlaceholder: 'Outcomes, comma separated, e.g. yes,no,uncertain',
      createButton: 'Create Target',
      registryTitle: 'Target registry',
      total: '{{count}} total',
      empty: 'No targets yet.',
      tableQuestion: 'Question',
      tableCategory: 'Category',
      tableHorizon: 'Horizon',
      tableStatus: 'Status',
      neverRun: 'never run',
      noRunsYet: 'no runs yet',
      retry: 'retry',
      running: 'running...',
      predict: 'predict',
    },
    prediction: {
      empty: 'No predictions yet. Create a target and run a forecast.',
      eyebrow: 'Forecast output',
      horizonLine: '{{days}} day horizon, live run playback and probability distribution.',
      selectedRun: 'Selected run',
      awaitingExecution: 'awaiting execution',
      model: 'Model',
      runAgain: 'run again',
      retryFailedRun: 'retry failed run',
      outcomeProfile: 'Outcome profile',
      probabilityByScenario: 'probability by scenario',
      prob: 'prob',
      runHealth: 'Run health',
      executionNotes: 'execution notes',
      runFailed: 'Run failed: {{message}}',
      status: 'Status',
      statusHint: 'Current execution state for the selected forecast run.',
      runTimestamp: 'Run timestamp',
      runTimestampHint: 'Last activity recorded for this forecast.',
      idle: 'idle',
      confidenceEnvelope: 'Confidence envelope',
      bounds: 'lower / midpoint / upper bounds',
      probabilityLadder: 'Probability ladder',
      modeledOutcomes: '{{count}} modeled outcomes',
      pending: 'pending',
    },
    chat: {
      fab: 'AI Copilot',
      eyebrow: 'Contextual assistant',
      you: 'You',
      assistantDatasets: 'Dataset copilot',
      assistantTargets: 'Target copilot',
      assistantPredictions: 'Forecast copilot',
      welcome:
        'Open a dataset, target, or forecast run and ask for interpretation. I will use the current page context in every reply.',
      promptSummary: 'Summarize the current workspace for me.',
      promptNext: 'What should I look at next?',
      promptSignal: 'Explain the most important signal on screen.',
      placeholder: 'Ask about the current dataset, target, or prediction run...',
      send: 'Send',
      error: 'I could not answer that yet: {{message}}',
      errorGeneric: 'I could not answer that yet.',
    },
    category: {
      macro: 'Macro',
      real_estate: 'Real Estate',
      employment: 'Employment',
      interest_rate: 'Interest Rates',
      trade: 'Trade',
      growth: 'Growth',
      inflation: 'Inflation',
      money_supply: 'Money Supply',
      equity: 'Equity',
      forex: 'Forex',
      commodity: 'Commodity',
      bond: 'Bond',
      crypto: 'Crypto',
      volatility: 'Volatility',
      retail: 'Retail',
      ecommerce: 'E-Commerce',
      demographics: 'Demographics',
    },
    runStatus: {
      completed: 'completed',
      failed: 'failed',
      pending: 'pending',
      running: 'running',
      processing: 'processing',
    },
    page: {
      datasets: 'datasets',
      targets: 'targets',
      predictions: 'predictions',
    },
    unit: {
      daysShort: '{{count}}d',
    },
    misc: {
      na: 'n/a',
    },
  },
  'zh-CN': {
    app: {
      loadingDatasets: '正在加载数据集...',
      loadingTargets: '正在加载目标...',
      loadingPredictions: '正在加载预测...',
      syncing: '同步中',
      connected: '已连接',
      datasetsCount: '{{count}} 个数据集',
      targetsCount: '{{count}} 个目标',
      predictionsCount: '{{count}} 个预测',
      engineLabel: 'EMUWORLD 引擎',
    },
    header: {
      context: '宏观量化引擎',
      sourcesShort: '{{count}} 源',
      forecastsShort: '{{count}} 预测',
      sync: '同步中',
      live: '在线',
      language: '语言',
    },
    tab: {
      datasets: '数据集',
      targets: '目标',
      predictions: '预测',
      knowledge: '知识',
    },
    status: {
      dataSources: '数据源',
      awaitingSync: '等待同步',
      targets: '目标数',
      active: '{{count}} 个活跃',
      idle: '空闲',
      forecastWindow: '预测窗口',
      predictionReady: '可发起预测',
      noPrediction: '尚未预测',
      engineStatus: '引擎状态',
      allSystemsNominal: '系统运行正常',
      expand: '展开',
      collapse: '收起',
      statusStripLabel: '点击展开状态面板',
      statusPanelsLabel: '状态面板 - 点击收起',
    },
    dataset: {
      emptyTitle: '数据源',
      emptyAction: '等待配置',
      emptyBody: '当前没有可用数据集。先配置 FRED API Key 再开始同步。',
      eyebrow: '宏观数据工作台',
      heroTitle: '实时经济数据流的信号覆盖情况。',
      heroBody: '查看当前在线数据量、主导来源，以及哪些类别已经具备预测条件。',
      liveDatasets: '在线数据集',
      upstreamFeeds: '{{count}} 个上游源',
      topSource: '主要来源',
      activeSeries: '{{count}} 条活跃序列',
      dominantCategory: '主导类别',
      datasetsMapped: '{{count}} 个已映射数据集',
      ingestionCadence: '采集节奏',
      latestImportTimeline: '最近导入时间线',
      sourceMix: '来源分布',
      connectedFeeds: '{{count}} 个已连接来源',
      categorySpread: '类别分布',
      deepestCoverage: '覆盖最深的领域',
      mappedSeries: '{{count}} 条已映射序列',
      newestArrivals: '最新入库',
      latestSyncedSeries: '最近同步的序列',
      seriesPreview: '序列预览',
      selectSeries: '选择一个序列',
      latest: '最新值',
      range: '范围',
      history: '历史区间',
      loadingHistory: '正在加载序列历史...',
      selectSeriesEmpty: '选择一个序列以查看它的历史走势。',
      seriesRegistry: '序列目录',
      rowsIndexed: '已索引 {{count}} 行',
      tableSeries: '序列',
      tableCategory: '类别',
      tableSource: '来源',
      tableUpdated: '更新于',
      tableDescription: '描述',
      searchPlaceholder: '搜索数据集...',
      resetFilters: '重置筛选',
    },
    target: {
      eyebrow: '预测目标设计',
      heroTitle: '先定义决策问题，再让引擎给它定价。',
      heroBody: '写下问题、设置期限，然后从目标列表发起预测运行。',
      createTitle: '创建目标',
      createAction: '问题 / 周期 / 结果',
      questionPlaceholder: '输入问题，例如：中国 CPI 明年是否会超过 2%？',
      horizonPlaceholder: '周期（天）',
      outcomesPlaceholder: '结果，逗号分隔，例如：是,否,不确定',
      createButton: '创建目标',
      registryTitle: '目标列表',
      total: '共 {{count}} 个',
      empty: '还没有目标。',
      tableQuestion: '问题',
      tableCategory: '类别',
      tableHorizon: '周期',
      tableStatus: '状态',
      neverRun: '未运行',
      noRunsYet: '暂无运行记录',
      retry: '重试',
      running: '运行中...',
      predict: '开始预测',
    },
    prediction: {
      empty: '还没有预测结果。请先创建目标并运行一次预测。',
      eyebrow: '预测输出',
      horizonLine: '{{days}} 天预测窗口，支持实时运行回放与概率分布查看。',
      selectedRun: '当前运行',
      awaitingExecution: '等待执行',
      model: '模型',
      runAgain: '再次运行',
      retryFailedRun: '重试失败运行',
      outcomeProfile: '结果分布',
      probabilityByScenario: '按情景展示概率',
      prob: '概率',
      runHealth: '运行健康度',
      executionNotes: '执行说明',
      runFailed: '运行失败：{{message}}',
      status: '状态',
      statusHint: '当前所选预测运行的执行状态。',
      runTimestamp: '运行时间',
      runTimestampHint: '该预测最近一次活动时间。',
      idle: '空闲',
      confidenceEnvelope: '置信区间',
      bounds: '下界 / 中位 / 上界',
      probabilityLadder: '概率阶梯',
      modeledOutcomes: '{{count}} 个建模结果',
      pending: '等待中',
    },
    chat: {
      fab: 'AI 助手',
      eyebrow: '上下文助手',
      you: '你',
      assistantDatasets: '数据集助手',
      assistantTargets: '目标助手',
      assistantPredictions: '预测助手',
      welcome: '打开任意数据集、目标或预测运行后提问，我会结合当前页面上下文回答。',
      promptSummary: '帮我概括当前工作台。',
      promptNext: '接下来我应该看什么？',
      promptSignal: '解释一下当前页面最重要的信号。',
      placeholder: '询问当前数据集、目标或预测运行...',
      send: '发送',
      error: '暂时无法回答：{{message}}',
      errorGeneric: '暂时无法回答。',
    },
    category: {
      macro: '宏观经济',
      real_estate: '房地产',
      employment: '就业',
      interest_rate: '利率',
      trade: '进出口',
      growth: '增长',
      inflation: '通胀',
      money_supply: '货币供应',
      equity: '股票',
      forex: '外汇',
      commodity: '大宗商品',
      bond: '债券',
      crypto: '加密货币',
      volatility: '波动率',
      retail: '零售',
      ecommerce: '电子商务',
      demographics: '人口统计',
    },
    runStatus: {
      completed: '已完成',
      failed: '失败',
      pending: '等待中',
      running: '运行中',
      processing: '处理中',
    },
    page: {
      datasets: '数据集',
      targets: '目标',
      predictions: '预测',
    },
    unit: {
      daysShort: '{{count}} 天',
    },
    misc: {
      na: '暂无',
    },
  },
} as const

interface I18nContextValue {
  language: Language
  locale: string
  setLanguage: (language: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function lookupTranslation(language: Language, key: string) {
  const segments = key.split('.')

  let current: unknown = translations[language]
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      current = undefined
      break
    }

    current = (current as Record<string, unknown>)[segment]
  }

  if (typeof current === 'string') {
    return current
  }

  current = translations.en
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return key
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' ? current : key
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return stored === 'zh-CN' || stored === 'en' ? stored : 'en'
  })

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const locale = language

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale,
    setLanguage,
    t: (key, vars) => interpolate(lookupTranslation(language, key), vars),
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    formatDate: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    formatTime: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    formatDateTime: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
  }), [language, locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within LanguageProvider')
  }

  return context
}

export function getCategoryLabel(language: Language, category: string) {
  const key = category.startsWith('category.') ? category : `category.${category}`
  return lookupTranslation(language, key)
}

export function getRunStatusLabel(language: Language, status: string | null) {
  if (!status) {
    return lookupTranslation(language, 'prediction.pending')
  }

  return lookupTranslation(language, `runStatus.${status}`)
}
