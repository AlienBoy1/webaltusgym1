import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiClock, FiActivity, FiChevronRight } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getWorkoutSession, formatTime, getCurrentExercise } from '../utils/workoutSession'

export default function WorkoutFloatingPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [session, setSession] = useState(getWorkoutSession())
  const isWorkoutsRoute = location.pathname === '/workouts'

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSession(getWorkoutSession())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const currentExercise = useMemo(() => getCurrentExercise(session), [session])
  const progress = useMemo(() => {
    if (!session?.activeWorkout?.exercises?.length) return 0
    return Math.round((session.completedExercises.length / session.activeWorkout.exercises.length) * 100)
  }, [session])

  if (!isAuthenticated || !session?.activeWorkout || isWorkoutsRoute) return null

  return (
    <AnimatePresence>
      <motion.button
        key="workout-floating-panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3 }}
        onClick={() => navigate(`/workouts?focus=${currentExercise?.id || ''}`)}
        className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-3 rounded-[2rem] border border-white/10 bg-[#070a14]/95 p-4 shadow-[0_35px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl text-left focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 to-accent-cyan text-black">
              <FiActivity size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-gray-400">Entrenamiento activo</p>
              <p className="mt-1 text-sm font-semibold text-white">{session.activeWorkout.name}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white/5 px-3 py-2 text-xs font-semibold text-primary-300">{progress}%</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.35em] text-gray-500">Tiempo total</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatTime(session.workoutTime)}</p>
          </div>
          <div className="rounded-3xl bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.35em] text-gray-500">Siguiente ejercicio</p>
            <p className="mt-2 text-lg font-semibold text-white truncate">{currentExercise?.name || 'Ya casi terminas'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-gray-300">
          <span className="flex items-center gap-2"><FiClock size={16} /> {session.completedExercises.length}/{session.activeWorkout.exercises.length} completados</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/80">
            Abrir <FiChevronRight size={14} />
          </span>
        </div>
      </motion.button>
    </AnimatePresence>
  )
}
