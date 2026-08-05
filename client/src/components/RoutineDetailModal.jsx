import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiX, FiUsers, FiInfo, FiPlus } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'
import toast from 'react-hot-toast'

/**
 * Modal to inspect a shared/public routine, with GymRat explain + adopt action.
 */
export default function RoutineDetailModal({
  open,
  onClose,
  routine,
  author,
  onAdopt,
  adopting = false
}) {
  const [showGymRatInfo, setShowGymRatInfo] = useState(false)

  if (!open || !routine) return null

  const exercises = routine.exercises || []
  const creator = author || routine.user || routine.author

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--color-primary)]">
                  Rutina compartida
                </p>
                <h2 className="mt-1 font-display text-3xl tracking-wide truncate">{routine.name}</h2>
                {creator && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                    <Avatar avatar={creator.avatar} name={creator.name} size="sm" />
                    <span>Creada por <strong className="text-[color:var(--text-primary)]">{creator.name}</strong></span>
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]">
                <FiX size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--text-muted)]">
                {exercises.length} ejercicios
              </p>
              <ul className="space-y-2">
                {exercises.map((ex, i) => (
                  <li
                    key={ex.id || i}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/50 px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-sm font-bold text-[color:var(--color-primary)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ex.name}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {ex.sets ?? ex.setsCompleted ?? '—'} series · {ex.reps ?? '—'} reps
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 border-t border-[color:var(--border-subtle)] p-4">
              <button
                type="button"
                onClick={() => setShowGymRatInfo(true)}
                className="btn-secondary flex w-full items-center justify-center gap-2 py-3"
              >
                <FiUsers /> Rutina GymRat
              </button>
              {onAdopt && (
                <button
                  type="button"
                  disabled={adopting}
                  onClick={onAdopt}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3"
                >
                  <FiPlus /> {adopting ? 'Guardando…' : 'Adoptar rutina'}
                </button>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {showGymRatInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
                onClick={() => setShowGymRatInfo(false)}
              >
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-6 sm:rounded-3xl"
                >
                  <div className="mb-3 flex items-center gap-2 text-[color:var(--color-primary)]">
                    <FiInfo size={20} />
                    <h3 className="font-display text-2xl tracking-wide">¿Qué es GymRat?</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
                    GymRat es la función de QyntraGym que permite a los usuarios compartir rutinas entre sí.
                    El ejercicio colaborativo no solo socializa: también ayuda a quienes todavía no están
                    tan familiarizados con armar rutinas eficaces.
                  </p>
                  <button
                    type="button"
                    className="btn-primary mt-5 w-full"
                    onClick={() => {
                      setShowGymRatInfo(false)
                      toast.success('¡Ahora ya sabes qué es GymRat!')
                    }}
                  >
                    Entendido
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function canStartRoutine(routine) {
  return Boolean(routine?.exercises?.length)
}

export function toStartableTemplate(routine) {
  return {
    id: `adopted-${Date.now()}`,
    name: routine.name,
    color: routine.color || 'primary',
    exercises: (routine.exercises || []).map((ex, i) => ({
      id: ex.id || `ex-${i}-${Date.now()}`,
      name: ex.name,
      sets: Number(ex.sets ?? ex.setsCompleted) || 3,
      reps: ex.reps ?? 10
    })),
    isPublic: false
  }
}
