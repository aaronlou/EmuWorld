import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'
import type { Dataset, Prediction } from '../types'

interface HeaderProps {
  datasets: Dataset[]
  predictions: Prediction[]
  dataLoading: boolean
}

export function Header({ datasets, predictions, dataLoading }: HeaderProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour12: false })
  const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
        <span className="topbar-context">MACRO QUANT ENGINE</span>
        <span className="topbar-sep">│</span>
        <span className="topbar-context">
          {datasets.length} src
          {predictions.length > 0 && ` · ${predictions.length} fcst`}
        </span>
      </div>
      <div className="topbar-right">
        <div className="topbar-status">
          <span className="status-dot live" />
          <span>{dataLoading ? 'SYNC' : 'LIVE'}</span>
        </div>
        <span className="topbar-time">{dateStr} {timeDisplay}</span>
      </div>
    </header>
  )
}
