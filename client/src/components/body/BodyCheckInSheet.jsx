import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { useHistoryBackLayer } from '../../hooks/useHistoryBackLayer'
import { displayToKg, kgToDisplay } from '../../utils/bodyMetrics'

export default function BodyCheckInSheet({ open, onClose, units, defaultWeightKg, onSaved }) {
  const weightUnit = units?.weight || 'kg'
  const [weight, setWeight] = useState('')
  const [bodyFatPct, setBodyFatPct] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setWeight(defaultWeightKg != null ? kgToDisplay(defaultWeightKg, weightUnit) : '')
    setBodyFatPct('')
    setWaistCm('')
    setNote('')
  }, [open, defaultWeightKg, weightUnit])

  useHistoryBackLayer(open, onClose, 'body-checkin')

  const submit = async () => {
    const weightKg = displayToKg(weight, weightUnit)
    setSaving(true)
    try {
      const { data } = await api.post('/body/checkins', {
        weightKg,
        bodyFatPct: bodyFatPct === '' ? null : Number(bodyFatPct),
        waistCm: waistCm === '' ? null : Number(waistCm),
        note: note.trim() || null
      })
      toast.success('Check-in registrado')
      onSaved?.(data)
      onClose?.()
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo registrar')
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
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-white/10 bg-[color:var(--bg-elevated)] p-5 sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl">Registrar peso</h3>
              <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/5" aria-label="Cerrar">
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">Peso ({weightUnit})</label>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">% grasa</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={bodyFatPct}
                    onChange={(e) => setBodyFatPct(e.target.value)}
                    placeholder="opc."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">Cintura cm</label>
                  <input
                    type="number"
                    className="input-field"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                    placeholder="opc."
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[color:var(--text-secondary)]">Nota</label>
                <input
                  className="input-field"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="Opcional"
                />
              </div>
              <button type="button" disabled={saving} onClick={submit} className="btn-primary w-full">
                {saving ? 'Guardando…' : 'Guardar check-in'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
