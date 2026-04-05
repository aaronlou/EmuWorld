import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Dataset, Prediction } from '../types'

interface HeaderProps {
  datasets: Dataset[]
  predictions: Prediction[]
  dataLoading: boolean
}

export function Header({ datasets, predictions, dataLoading }: HeaderProps) {
  const { language, setLanguage, t, formatDate, formatTime } = useI18n()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = formatTime(time, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = formatDate(time, { month: 'short', day: 'numeric' })

  const [blink, setBlink] = useState(true)
  useEffect(() => {
    const interval = setInterval(() => setBlink(b => !b), 1000)
    return () => clearInterval(interval)
  }, [])

  const timeParts = timeStr.split(':')
  const timeDisplay = timeParts.length >= 3
    ? `${timeParts[0]}${blink ? ':' : ' '}${timeParts[1]}${blink ? ':' : ' '}${timeParts[2]}`
    : timeStr

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-brand">
          <Activity size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, opacity: 0.8 }} />
          EMUWORLD
        </span>
        <span className="topbar-sep">│</span>
        <span className="topbar-context">{t('header.context')}</span>
        <span className="topbar-sep">│</span>
        <span className="topbar-context">
          {t('header.sourcesShort', { count: datasets.length })}
          {predictions.length > 0 && ` · ${t('header.forecastsShort', { count: predictions.length })}`}
        </span>
      </div>
      <div className="topbar-right">
        <div className="language-switch" role="group" aria-label={t('header.language')}>
          <button
            className={language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
            type="button"
          >
            EN
          </button>
          <button
            className={language === 'zh-CN' ? 'active' : ''}
            onClick={() => setLanguage('zh-CN')}
            type="button"
          >
            中文
          </button>
        </div>
        <div className="topbar-status">
          <span className="status-dot live" />
          <span>{dataLoading ? t('header.sync') : t('header.live')}</span>
        </div>
        <span className="topbar-time">{dateStr} {timeDisplay}</span>
      </div>
    </header>
  )
}
