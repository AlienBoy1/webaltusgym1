import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiInfo } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { useHistoryBackLayer } from '../../hooks/useHistoryBackLayer'
import {
  ACTIVITY_OPTIONS,
  FITNESS_OPTIONS,
  GOAL_DETAIL_OPTIONS,
  GOAL_OPTIONS,
  kgToDisplay,
  displayToKg,
  cmToDisplay,
  displayToCm
} from '../../utils/bodyMetrics'

function FieldLabel({ children, onInfo }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm text-[color:var(--text-secondary)]">{children}</span>
      {onInfo && (
        <button type="button" onClick={onInfo} className="text-primary-400" aria-label="Más info">
          <FiInfo size={14} />
        </button>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  sex: '',
  birthDate: '',
  age: '',
  height: '',
  heightCm: '',
  weight: '',
  targetWeight: '',
  bodyFatPct: '',
  waistCm: '',
  hipCm: '',
  fitnessLevel: 'beginner',
  activityLevel: 'moderate',
  goalDetail: 'maintain',
  goal: 'health'
}

function str(v) {
  return v == null ? '' : String(v)
}

function formFromSnapshot(snapshot, weightUnit, heightUnit) {
  const s = snapshot || {}
  return {
    sex: s.sex || '',
    birthDate: s.birthDate ? String(s.birthDate).slice(0, 10) : '',
    age: str(s.age ?? ''),
    height: s.heightCm != null ? str(cmToDisplay(s.heightCm, heightUnit === 'ft' ? 'cm' : 'cm')) : '',
    heightCm: str(s.heightCm ?? ''),
    weight: s.weightKg != null ? str(kgToDisplay(s.weightKg, weightUnit)) : '',
    targetWeight: s.targetWeightKg != null ? str(kgToDisplay(s.targetWeightKg, weightUnit)) : '',
    bodyFatPct: str(s.bodyFatPct ?? ''),
    waistCm: str(s.waistCm ?? ''),
    hipCm: str(s.hipCm ?? ''),
    fitnessLevel: s.fitnessLevel || 'beginner',
    activityLevel: s.activityLevel || 'moderate',
    goalDetail: s.goalDetail || 'maintain',
    goal: s.goal || 'health'
  }
}

export default function BodyProfileEditor({
  open,
  onClose,
  snapshot,
  units,
  onSaved,
  onExplain
}) {
  const weightUnit = units?.weight || 'kg'
  const heightUnit = units?.height || 'cm'

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(formFromSnapshot(snapshot, weightUnit, heightUnit))
  }, [open, snapshot, weightUnit, heightUnit])

  useHistoryBackLayer(open, onClose, 'body-profile-editor')

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const heightCm =
        heightUnit === 'ft'
          ? displayToCm(form.heightCm || form.height, 'cm')
          : displayToCm(form.heightCm || form.height, 'cm')
      const weightKg = displayToKg(form.weight, weightUnit)
      const targetWeightKg = displayToKg(form.targetWeight, weightUnit)

      const { data } = await api.put('/body/profile', {
        sex: form.sex || null,
        birthDate: form.birthDate || null,
        age: form.age === '' ? null : Number(form.age),
        heightCm: heightCm == null || heightCm === '' ? null : Number(heightCm),
        weightKg,
        targetWeightKg,
        bodyFatPct: form.bodyFatPct === '' ? null : Number(form.bodyFatPct),
        waistCm: form.waistCm === '' ? null : Number(form.waistCm),
        hipCm: form.hipCm === '' ? null : Number(form.hipCm),
        fitnessLevel: form.fitnessLevel,
        activityLevel: form.activityLevel,
        goalDetail: form.goalDetail,
        goal: form.goal,
        bodyGoals: {
          targetWeightKg,
          weeklyWorkouts: snapshot?.bodyGoals?.weeklyWorkouts ?? 3,
          targetDate: snapshot?.bodyGoals?.targetDate || null
        }
      })
      toast.success('Ficha corporal guardada')
      onSaved?.(data)
      onClose?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Cerrar" onClick={onClose} />
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            className="relative z-10 flex w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[color:var(--bg-elevated)] shadow-xl sm:rounded-2xl"
            style={{ maxHeight: 'min(92dvh, 720px)' }}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h3 className="font-display text-xl">Mi cuerpo</h3>
                <p className="text-xs text-[color:var(--text-muted)]">Privado · solo para tus cálculos</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/5" aria-label="Cerrar">
                <FiX size={20} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel onInfo={() => onExplain?.('sex')}>Sexo (fórmulas)</FieldLabel>
                  <select className="input-field" value={str(form.sex)} onChange={(e) => set('sex', e.target.value)}>
                    <option value="">—</option>
                    <option value="female">Mujer</option>
                    <option value="male">Hombre</option>
                  </select>
                </div>
                <div>
                  <FieldLabel onInfo={() => onExplain?.('age')}>Edad</FieldLabel>
                  <input
                    type="number"
                    className="input-field"
                    min={13}
                    max={100}
                    value={str(form.age)}
                    onChange={(e) => set('age', e.target.value)}
                    placeholder="años"
                  />
                </div>
              </div>

              <div>
                <FieldLabel onInfo={() => onExplain?.('age')}>Fecha de nacimiento (opcional)</FieldLabel>
                <input
                  type="date"
                  className="input-field"
                  value={str(form.birthDate)}
                  onChange={(e) => set('birthDate', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel onInfo={() => onExplain?.('heightCm')}>Altura (cm)</FieldLabel>
                  <input
                    type="number"
                    className="input-field"
                    min={100}
                    max={250}
                    value={str(form.heightCm)}
                    onChange={(e) => set('heightCm', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel onInfo={() => onExplain?.('weightKg')}>
                    Peso ({weightUnit})
                  </FieldLabel>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={str(form.weight)}
                    onChange={(e) => set('weight', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel onInfo={() => onExplain?.('targetWeightKg')}>
                    Peso objetivo ({weightUnit})
                  </FieldLabel>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={str(form.targetWeight)}
                    onChange={(e) => set('targetWeight', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel onInfo={() => onExplain?.('bodyFatPct')}>% grasa</FieldLabel>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={str(form.bodyFatPct)}
                    onChange={(e) => set('bodyFatPct', e.target.value)}
                    placeholder="opcional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel onInfo={() => onExplain?.('waistCm')}>Cintura (cm)</FieldLabel>
                  <input
                    type="number"
                    className="input-field"
                    value={str(form.waistCm)}
                    onChange={(e) => set('waistCm', e.target.value)}
                    placeholder="opcional"
                  />
                </div>
                <div>
                  <FieldLabel onInfo={() => onExplain?.('hipCm')}>Cadera (cm)</FieldLabel>
                  <input
                    type="number"
                    className="input-field"
                    value={str(form.hipCm)}
                    onChange={(e) => set('hipCm', e.target.value)}
                    placeholder="opcional"
                  />
                </div>
              </div>

              <div>
                <FieldLabel onInfo={() => onExplain?.('fitnessLevel')}>Nivel de condición</FieldLabel>
                <select
                  className="input-field"
                  value={str(form.fitnessLevel) || 'beginner'}
                  onChange={(e) => set('fitnessLevel', e.target.value)}
                >
                  {FITNESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel onInfo={() => onExplain?.('activityLevel')}>Actividad diaria</FieldLabel>
                <select
                  className="input-field"
                  value={str(form.activityLevel) || 'moderate'}
                  onChange={(e) => set('activityLevel', e.target.value)}
                >
                  {ACTIVITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel onInfo={() => onExplain?.('goalDetail')}>Detalle</FieldLabel>
                  <select
                    className="input-field"
                    value={str(form.goalDetail) || 'maintain'}
                    onChange={(e) => set('goalDetail', e.target.value)}
                  >
                    {GOAL_DETAIL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Enfoque</FieldLabel>
                  <select
                    className="input-field"
                    value={str(form.goal) || 'health'}
                    onChange={(e) => set('goal', e.target.value)}
                  >
                    {GOAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 p-4">
              <button type="button" disabled={saving} onClick={save} className="btn-primary w-full">
                {saving ? 'Guardando…' : 'Guardar ficha'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
