import { motion } from 'framer-motion'
import { FiEdit2, FiInfo, FiPlus } from 'react-icons/fi'
import { kgToDisplay } from '../../utils/bodyMetrics'
import {
  ACTIVITY_OPTIONS,
  FITNESS_OPTIONS,
  GOAL_DETAIL_OPTIONS,
  GOAL_OPTIONS
} from '../../utils/bodyMetrics'

function MetricTile({ label, value, unit, onInfo, accent }) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left transition hover:border-primary-500/40"
    >
      <div className="mb-1 flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
        {label}
        <FiInfo size={12} className="text-primary-400" />
      </div>
      <div className={`font-display text-xl ${accent || 'text-[color:var(--text-primary)]'}`}>
        {value != null && value !== '' ? value : '—'}
        {value != null && value !== '' && unit ? (
          <span className="ml-1 text-sm font-sans text-[color:var(--text-muted)]">{unit}</span>
        ) : null}
      </div>
    </button>
  )
}

export default function BodyProfileCard({
  summary,
  units,
  onEdit,
  onCheckIn,
  onExplain
}) {
  const s = summary?.snapshot || {}
  const m = summary?.metrics || {}
  const weightUnit = units?.weight || 'kg'
  const complete = summary?.profileComplete

  const fitnessLabel = FITNESS_OPTIONS.find((o) => o.value === s.fitnessLevel)?.label
  const activityLabel = ACTIVITY_OPTIONS.find((o) => o.value === s.activityLevel)?.label
  const goalDetailLabel = GOAL_DETAIL_OPTIONS.find((o) => o.value === s.goalDetail)?.label
  const goalLabel = GOAL_OPTIONS.find((o) => o.value === s.goal)?.label

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      data-tour="tour-progress-body"
      className="card space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg sm:text-xl">Mi cuerpo</h2>
          <p className="text-xs text-[color:var(--text-muted)] sm:text-sm">
            {complete ? 'Ficha lista · métricas educativas' : 'Completa tu ficha para desbloquear IMC, TMB y tips'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button
            type="button"
            onClick={onCheckIn}
            className="btn-secondary flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm"
          >
            <FiPlus size={16} /> <span className="truncate">Registrar</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm"
          >
            <FiEdit2 size={14} /> <span className="truncate">Editar</span>
          </button>
        </div>
      </div>

      {!complete && (
        <button
          type="button"
          onClick={onEdit}
          className="w-full rounded-xl border border-dashed border-primary-500/40 bg-primary-500/5 px-4 py-6 text-center"
        >
          <p className="font-medium text-primary-300">Completa tu ficha corporal</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
            Altura, peso, sexo y edad para cálculos personalizados
          </p>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          label="Peso"
          value={s.weightKg != null ? kgToDisplay(s.weightKg, weightUnit) : null}
          unit={weightUnit}
          onInfo={() => onExplain?.('weightKg')}
        />
        <MetricTile
          label="Altura"
          value={s.heightCm}
          unit="cm"
          onInfo={() => onExplain?.('heightCm')}
        />
        <MetricTile
          label="IMC"
          value={m.bmi}
          onInfo={() => onExplain?.('bmi')}
          accent="text-primary-400"
        />
        <MetricTile
          label="Categoría"
          value={m.bmiCategory?.label}
          onInfo={() => onExplain?.('bmi')}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="TMB" value={m.bmr} unit="kcal" onInfo={() => onExplain?.('bmr')} />
        <MetricTile label="TDEE" value={m.tdee} unit="kcal" onInfo={() => onExplain?.('tdee')} />
        <MetricTile
          label="Calorías"
          value={
            m.calories
              ? m.calories.min === m.calories.max
                ? m.calories.min
                : `${m.calories.min}–${m.calories.max}`
              : null
          }
          unit="kcal"
          onInfo={() => onExplain?.('calories')}
          accent="text-accent-cyan"
        />
        <MetricTile
          label="% grasa"
          value={s.bodyFatPct}
          unit="%"
          onInfo={() => onExplain?.('bodyFatPct')}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[color:var(--text-secondary)]">
        {fitnessLabel && (
          <span className="rounded-full bg-white/5 px-2.5 py-1">{fitnessLabel}</span>
        )}
        {activityLabel && (
          <span className="rounded-full bg-white/5 px-2.5 py-1">{activityLabel}</span>
        )}
        {goalDetailLabel && (
          <span className="rounded-full bg-primary-500/15 px-2.5 py-1 text-primary-300">{goalDetailLabel}</span>
        )}
        {goalLabel && (
          <span className="rounded-full bg-white/5 px-2.5 py-1">Enfoque: {goalLabel}</span>
        )}
        {s.targetWeightKg != null && (
          <span className="rounded-full bg-white/5 px-2.5 py-1">
            Meta: {kgToDisplay(s.targetWeightKg, weightUnit)} {weightUnit}
          </span>
        )}
      </div>
    </motion.div>
  )
}
