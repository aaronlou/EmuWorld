import { getCategoryLabel, useI18n } from '../../i18n'
import { CATEGORY_KEYS } from '../../types'
import type { TargetDraft } from './hooks'

interface CreateTargetFormProps {
  newTarget: TargetDraft
  onNewTargetChange: (target: TargetDraft) => void
  onCreateTarget: () => void
}

export function CreateTargetForm({
  newTarget,
  onNewTargetChange,
  onCreateTarget,
}: CreateTargetFormProps) {
  const { language, t } = useI18n()

  return (
    <article className="insight-panel form-panel">
      <div className="section-header">
        <span className="section-title">{t('target.createTitle')}</span>
        <span className="section-action">{t('target.createAction')}</span>
      </div>
      <div className="form">
        <input
          placeholder={t('target.questionPlaceholder')}
          value={newTarget.question}
          onChange={e => onNewTargetChange({ ...newTarget, question: e.target.value })}
        />
        <div className="form-row">
          <select
            value={newTarget.category}
            onChange={e => onNewTargetChange({ ...newTarget, category: e.target.value })}
          >
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>{getCategoryLabel(language, key)}</option>
            ))}
          </select>
          <input
            type="number"
            min="30"
            max="365"
            value={newTarget.horizon_days}
            onChange={e => onNewTargetChange({ ...newTarget, horizon_days: parseInt(e.target.value) })}
            placeholder={t('target.horizonPlaceholder')}
          />
        </div>
        <input
          placeholder={t('target.outcomesPlaceholder')}
          value={newTarget.outcomes}
          onChange={e => onNewTargetChange({ ...newTarget, outcomes: e.target.value })}
        />
        <button
          onClick={onCreateTarget}
          disabled={!newTarget.question || !newTarget.outcomes}
        >
          {t('target.createButton')}
        </button>
      </div>
    </article>
  )
}
