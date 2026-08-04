import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileCollapsed, setMobileCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const collapseTimeout = useRef(null)
  const constraintsRef = useRef(null)
  const isWorkoutsRoute = location.pathname === '/workouts'

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSession(getWorkoutSession())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const workoutId = session?.activeWorkout?.id

    if (!isMobile || !workoutId) {
      setMobileCollapsed(false)
      if (collapseTimeout.current) {
        window.clearTimeout(collapseTimeout.current)
        collapseTimeout.current = null
      }
      return
    }

    if (!mobileCollapsed && !collapseTimeout.current) {
      collapseTimeout.current = window.setTimeout(() => {
        setMobileCollapsed(true)
        collapseTimeout.current = null
      }, 3200)
    }

    return () => {
      if (collapseTimeout.current) {
        window.clearTimeout(collapseTimeout.current)
        collapseTimeout.current = null
      }
    }
  }, [isMobile, session?.activeWorkout?.id, mobileCollapsed])

  const currentExercise = useMemo(() => getCurrentExercise(session), [session])
  const progress = useMemo(() => {
    if (!session?.activeWorkout?.exercises?.length) return 0
    return Math.round((session.completedExercises.length / session.activeWorkout.exercises.length) * 100)
  }, [session])

  if (!isAuthenticated || !session?.activeWorkout || isWorkoutsRoute) return null

  const panelContent = (
    <div ref={constraintsRef} className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      <AnimatePresence>
        <motion.button
          key="workout-floating-panel"
          drag={isMobile && mobileCollapsed}
          dragConstraints={constraintsRef}
          dragElastic={0.08}
          dragMomentum={false}
          dragPropagation={false}
          whileDrag={{ scale: 0.99 }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          initial={isMobile ? { opacity: 0, y: 120, scale: 0.97 } : { opacity: 0, y: 24 }}
          animate={isMobile ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0 }}
          exit={isMobile ? { opacity: 0, y: 120, scale: 0.97 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          onClick={() => {
            if (isDragging) return
            if (isMobile && mobileCollapsed) {
              setMobileCollapsed(false)
            } else {
              navigate(`/workouts?focus=${currentExercise?.id || ''}`)
            }
          }}
          className={`absolute z-[60] rounded-[2rem] border border-white/10 bg-[#070a14]/95 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.40)] backdrop-blur-2xl text-left transition-all duration-300 ease-out pointer-events-auto sm:max-w-sm ${isMobile && mobileCollapsed ? 'right-4 bottom-5 h-[96px] w-[96px] max-w-[96px] min-h-[96px] overflow-hidden rounded-full px-0 py-0' : 'left-1/2 bottom-16 w-full max-w-[92%] -translate-x-1/2'}`}
          style={{ touchAction: 'none' }}
        >
          {isMobile && mobileCollapsed ? (
            <motion.div
              layout
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative flex h-[96px] w-[96px] items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-cyan text-white shadow-[0_24px_64px_rgba(0,0,0,0.28)] ring-1 ring-white/10"
            >
              <div className="flex flex-col items-center justify-center text-center text-[11px] font-semibold uppercase tracking-[0.28em]">
                <span className="text-[10px] tracking-[0.35em] text-white/80">Entrena</span>
                <span className="mt-1 text-base font-bold tracking-tight">{formatTime(session.workoutTime)}</span>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 to-accent-cyan text-black shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                    <FiActivity size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Entrenamiento activo</p>
                    <p className="mt-1 text-sm font-semibold text-white">{session.activeWorkout.name}</p>
                  </div>
                </div>
                <div className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-primary-300 shadow-inner shadow-black/10">{progress}%</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.75rem] bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Tiempo total</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatTime(session.workoutTime)}</p>
                </div>
                <div className="rounded-[1.75rem] bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">Siguiente ejercicio</p>
                  <p className="mt-2 text-lg font-semibold text-white truncate">{currentExercise?.name || 'Ya casi terminas'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-300">
                <span className="flex items-center gap-2">
                  <FiClock size={16} /> {session.completedExercises.length}/{session.activeWorkout.exercises.length} completados
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                  Abrir <FiChevronRight size={14} />
                </span>
              </div>

              <div className="mt-3 rounded-3xl bg-white/5 px-3 py-2 text-center text-[11px] uppercase tracking-[0.32em] text-gray-400">
                Mantén pulsado y arrastra para mover
              </div>
            </>
          )}
        </motion.button>
      </AnimatePresence>
    </div>
  )

  return panelContent
}
