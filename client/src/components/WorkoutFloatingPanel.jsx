import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useMotionValue } from 'framer-motion'
import { FiActivity, FiChevronRight, FiX } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import {
  getWorkoutSession,
  subscribeWorkoutSession,
  getElapsedSeconds,
  getRestRemaining,
  getCurrentExercise,
  formatTime,
  getBubblePosition,
  setBubblePosition
} from '../utils/workoutSession'

const BUBBLE = 92
const EXPANDED_W = Math.min(300, typeof window !== 'undefined' ? window.innerWidth - 24 : 300)
const EXPANDED_H = 168
const EDGE = 12

function defaultPos() {
  if (typeof window === 'undefined') return { x: EDGE, y: EDGE }
  const bottomNav = window.innerWidth < 768 ? 88 : 24
  return {
    x: Math.max(EDGE, window.innerWidth - BUBBLE - 16),
    y: Math.max(EDGE, window.innerHeight - BUBBLE - bottomNav - 16)
  }
}

function clampPos(x, y, w, h) {
  const maxX = Math.max(EDGE, window.innerWidth - w - EDGE)
  const maxY = Math.max(EDGE, window.innerHeight - h - EDGE)
  return {
    x: Math.min(maxX, Math.max(EDGE, x)),
    y: Math.min(maxY, Math.max(EDGE, y))
  }
}

export default function WorkoutFloatingPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const constraintsRef = useRef(null)
  const [session, setSession] = useState(() => getWorkoutSession())
  const [now, setNow] = useState(() => Date.now())
  const [expanded, setExpanded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragStarted = useRef(false)
  const size = expanded ? { w: EXPANDED_W, h: EXPANDED_H } : { w: BUBBLE, h: BUBBLE }

  const initial = clampPos(
    getBubblePosition(defaultPos()).x,
    getBubblePosition(defaultPos()).y,
    BUBBLE,
    BUBBLE
  )
  const x = useMotionValue(initial.x)
  const y = useMotionValue(initial.y)

  useEffect(() => {
    setSession(getWorkoutSession())
    return subscribeWorkoutSession(setSession)
  }, [])

  useEffect(() => {
    if (!session?.activeWorkout) return undefined
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [session?.activeWorkout?.id])

  useEffect(() => {
    const onResize = () => {
      const next = clampPos(x.get(), y.get(), size.w, size.h)
      x.set(next.x)
      y.set(next.y)
      setBubblePosition(next)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [size.w, size.h, x, y])

  // Keep within viewport when expanding / collapsing
  useEffect(() => {
    const next = clampPos(x.get(), y.get(), size.w, size.h)
    x.set(next.x)
    y.set(next.y)
  }, [expanded, size.w, size.h, x, y])

  const elapsed = useMemo(() => getElapsedSeconds(session, now), [session, now])
  const restLeft = useMemo(() => getRestRemaining(session, now), [session, now])
  const currentExercise = useMemo(() => getCurrentExercise(session), [session])
  const progress = useMemo(() => {
    if (!session?.activeWorkout?.exercises?.length) return 0
    return Math.round((session.completedExercises.length / session.activeWorkout.exercises.length) * 100)
  }, [session])

  const isWorkoutsRoute = location.pathname === '/workouts'
  if (!isAuthenticated || !session?.activeWorkout || isWorkoutsRoute) return null

  const persistPos = () => {
    const next = clampPos(x.get(), y.get(), size.w, size.h)
    x.set(next.x)
    y.set(next.y)
    setBubblePosition(next)
  }

  return (
    <div ref={constraintsRef} className="pointer-events-none fixed inset-0 z-[60]">
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        dragElastic={0.06}
        style={{ x, y, width: size.w, height: size.h }}
        onDragStart={() => {
          dragStarted.current = true
          setDragging(true)
        }}
        onDragEnd={() => {
          persistPos()
          window.setTimeout(() => {
            setDragging(false)
            dragStarted.current = false
          }, 40)
        }}
        className="pointer-events-auto absolute left-0 top-0"
      >
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.currentTarget.click()
            }
          }}
          onClick={() => {
            if (dragging || dragStarted.current) return
            if (!expanded) {
              setExpanded(true)
              return
            }
            navigate(`/workouts?focus=${currentExercise?.id || ''}`)
          }}
          className={`relative h-full w-full cursor-pointer overflow-hidden border border-white/15 bg-[#070a14]/96 text-left shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${
            expanded ? 'rounded-[1.75rem]' : 'rounded-full'
          }`}
          aria-label="Entrenamiento en curso"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/25 via-transparent to-accent-cyan/20" />

          {!expanded ? (
            <div className="relative flex h-full w-full flex-col items-center justify-center">
              <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-white/70">Live</span>
              <span className="mt-0.5 font-mono text-base font-bold tabular-nums tracking-tight text-white">
                {formatTime(elapsed)}
              </span>
              {restLeft > 0 && (
                <span className="mt-0.5 text-[10px] font-medium tabular-nums text-accent-cyan">
                  ·{formatTime(restLeft)}
                </span>
              )}
              <svg className="pointer-events-none absolute inset-1 -rotate-90" viewBox="0 0 90 90" aria-hidden>
                <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle
                  cx="45"
                  cy="45"
                  r="38"
                  fill="none"
                  stroke="url(#bubbleGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * (1 - progress / 100)}`}
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="bubbleGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF6B35" />
                    <stop offset="100%" stopColor="#00F5FF" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          ) : (
            <div className="relative flex h-full flex-col justify-between p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-cyan text-black">
                  <FiActivity size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{session.activeWorkout.name}</p>
                  <p className="truncate text-xs text-gray-400">{currentExercise?.name || 'Casi terminas'}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(false)
                  }}
                >
                  <FiX size={12} />
                </button>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="font-mono text-2xl font-bold tabular-nums text-white">{formatTime(elapsed)}</p>
                  <p className="text-[11px] text-gray-400">
                    {session.completedExercises.length}/{session.activeWorkout.exercises.length}
                    {restLeft > 0 ? ` · descanso ${formatTime(restLeft)}` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white">
                  Abrir <FiChevronRight size={12} />
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
