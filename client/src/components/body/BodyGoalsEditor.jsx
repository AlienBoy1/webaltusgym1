import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FiTarget, FiSave } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { displayToKg, kgToDisplay } from '../../utils/bodyMetrics'

export default function BodyGoalsEditor({ summary, userStats, units, onSaved, forceEditSignal }) {
  const weightUnit = units?.weight || 'kg'
  const s = summary?.snapshot || {}
  const bg = s.bodyGoals || {}

  const [editing, setEditing] = useState(false)
  const [targetWeight, setTargetWeight] = useState('')
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(3)
  const [targetDate, setTargetDate] = useState('')
  const [calorieOverride, setCalorieOverride] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (forceEditSignal) setEditing(true)
  }, [forceEditSignal])

  useEffect(() => {
    setTargetWeight(s.targetWeightKg != null ? kgToDisplay(s.targetWeightKg, weightUnit) : '')
    setWeeklyWorkouts(bg.weeklyWorkouts ?? 3)
    setTargetDate(bg.targetDate ? String(bg.targetDate).slice(0, 10) : '')
    setCalorieOverride(bg.calorieTargetOverride ?? '')
  }, [s.targetWeightKg, bg.weeklyWorkouts, bg.targetDate, bg.calorieTargetOverride, weightUnit])

  const workoutsDone = userStats?.totalWorkouts || 0
  // Approximate "this month" isn't tracked — use weekly target vs streak as soft goals
  const weeklyTarget = Number(weeklyWorkouts) || 3
  const streak = userStats?.currentStreak || 0
  const weightNow = s.weightKg
  const weightGoal = s.targetWeightKg

  let weightProgress = 0
  if (weightNow != null && weightGoal != null && weightNow !== weightGoal) {
    // progress toward goal from an implied start = current if no history; show proximity
    const diff = Math.abs(weightNow - weightGoal)
    weightProgress = Math.max(0, Math.min(100, 100 - diff * 8))
  } else if (weightNow != null && weightGoal != null && weightNow === weightGoal) {
    weightProgress = 100
  }

  const streakProgress = Math.min(100, (streak / Math.max(weeklyTarget, 1)) * 100)
  const xpTotal = userStats?.xp || 0
  const xpInto = xpTotal % 100

  const goals = [
    {
      name: 'Peso objetivo',
      current:
        weightNow != null ? Number(kgToDisplay(weightNow, weightUnit)) : '—',
      target:
        weightGoal != null ? Number(kgToDisplay(weightGoal, weightUnit)) : '—',
      unit: weightUnit,
      progress: weightProgress
    },
    {
      name: 'Racha vs meta semanal',
      current: streak,
      target: weeklyTarget,
      unit: 'días',
      progress: streakProgress
    },
    {
      name: 'XP hacia siguiente nivel',
      current: xpInto,
      target: 100,
      unit: 'XP',
      progress: Math.min(100, xpInto)
    }
  ]

  const save = async () => {
    setSaving(true)
    try {
      const targetWeightKg = displayToKg(targetWeight, weightUnit)
      const { data } = await api.put('/body/profile', {
        targetWeightKg,
        bodyGoals: {
          targetWeightKg,
          weeklyWorkouts: Number(weeklyWorkouts) || 3,
          targetDate: targetDate || null,
          calorieTargetOverride:
            calorieOverride === '' || calorieOverride == null ? null : Number(calorieOverride)
        }
      })
      toast.success('Objetivos actualizados')
      onSaved?.(data)
      setEditing(false)
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      data-tour="tour-progress-goals"
      className="card"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl flex items-center gap-2">
          <FiTarget className="text-primary-500" /> Mis objetivos
        </h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-sm text-primary-400 hover:text-primary-300"
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">
              Peso meta ({weightUnit})
            </label>
            <input
              type="number"
              step="0.1"
              className="input-field"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">
              Entrenamientos objetivo / semana
            </label>
            <input
              type="number"
              min={0}
              max={14}
              className="input-field"
              value={weeklyWorkouts}
              onChange={(e) => setWeeklyWorkouts(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">Fecha meta</label>
            <input
              type="date"
              className="input-field"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">
              Calorías fijas (opcional)
            </label>
            <input
              type="number"
              className="input-field"
              value={calorieOverride}
              onChange={(e) => setCalorieOverride(e.target.value)}
              placeholder="Dejar vacío = sugerido"
            />
          </div>
          <button type="button" disabled={saving} onClick={save} className="btn-primary flex w-full items-center justify-center gap-2">
            <FiSave size={16} /> {saving ? 'Guardando…' : 'Guardar objetivos'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.name}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[color:var(--text-secondary)]">{goal.name}</span>
                <span className="text-sm">
                  <span className="font-semibold text-primary-500">{goal.current}</span>
                  <span className="text-[color:var(--text-muted)]">
                    {' '}
                    / {goal.target} {goal.unit}
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-dark-300">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goal.progress}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400"
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-[color:var(--text-muted)]">
            Sesiones totales registradas: {workoutsDone}
            {bg.targetDate ? ` · Meta para ${String(bg.targetDate).slice(0, 10)}` : ''}
          </p>
        </div>
      )}
    </motion.div>
  )
}
