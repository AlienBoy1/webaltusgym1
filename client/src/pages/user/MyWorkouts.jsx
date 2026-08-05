import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiArrowLeft,
  FiShare2,
  FiClock,
  FiCheck,
  FiActivity,
  FiZap,
  FiX
} from 'react-icons/fi'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function formatDuration(minutes, secondsFallback) {
  const totalSec =
    typeof secondsFallback === 'number'
      ? secondsFallback
      : Math.max(0, Math.round((minutes || 0) * 60))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h ${rm}m`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function parseReps(reps) {
  if (typeof reps === 'number') return reps
  const n = parseInt(String(reps || '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function buildChartData(workout) {
  const exercises = workout.exercises || []
  return exercises
    .filter((e) => e.completed !== false)
    .map((e) => {
      const sets = Number(e.setsCompleted ?? e.sets) || 0
      const reps = parseReps(e.reps)
      const volume = sets * (reps || 1)
      return {
        name: (e.name || 'Ej.').slice(0, 10),
        fullName: e.name,
        series: sets,
        volumen: volume,
        reps
      }
    })
}

export default function MyWorkouts() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get('/workouts/history')
        setWorkouts(data || [])
      } catch {
        toast.error('No se pudo cargar el historial')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const report = useMemo(() => {
    if (!selected) return null
    const metrics = selected.metrics || {}
    const exercises = selected.exercises || []
    const completed = exercises.filter((e) => e.completed !== false)
    const totalSets = completed.reduce(
      (sum, e) => sum + (Number(e.setsCompleted ?? e.sets) || 0),
      0
    )
    const durationSeconds =
      metrics.durationSeconds ??
      (typeof selected.duration === 'number' ? selected.duration * 60 : 0)
    const bestRest =
      metrics.bestRestSeconds ??
      (metrics.restHistory?.length
        ? Math.min(...metrics.restHistory.map((r) => r.seconds).filter((n) => n > 0))
        : null)
    const avgRest =
      metrics.avgRestSeconds ??
      (metrics.restHistory?.length
        ? Math.round(
            metrics.restHistory.reduce((s, r) => s + (r.seconds || 0), 0) /
              metrics.restHistory.length
          )
        : null)

    return {
      completedCount: completed.length,
      totalExercises: exercises.length,
      totalSets,
      durationSeconds,
      bestRest,
      avgRest,
      chart: buildChartData(selected),
      restHistory: metrics.restHistory || []
    }
  }, [selected])

  const shareWorkout = async (workout) => {
    setSharing(true)
    try {
      const metrics = workout.metrics || {}
      const completed = (workout.exercises || []).filter((e) => e.completed !== false)
      const durationSeconds =
        metrics.durationSeconds ??
        (typeof workout.duration === 'number' ? workout.duration * 60 : 0)
      await api.post('/social', {
        content: `Acabo de completar: ${workout.name}`,
        postType: 'workout',
        workoutData: {
          workoutId: workout._id || workout.id,
          name: workout.name,
          completedExercises: completed.length,
          totalExercises: (workout.exercises || []).length,
          totalSets: completed.reduce(
            (s, e) => s + (Number(e.setsCompleted ?? e.sets) || 0),
            0
          ),
          durationSeconds,
          bestRestSeconds: metrics.bestRestSeconds || null,
          exercises: completed.map((e) => ({
            name: e.name,
            sets: e.setsCompleted ?? e.sets,
            reps: e.reps
          }))
        }
      })
      toast.success('Compartido en Comunidad')
      navigate('/social')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo compartir')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 sm:pb-8">
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-gray-300 hover:bg-white/10"
        >
          <FiArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-white sm:text-4xl">Mis entrenamientos</h1>
          <p className="text-sm text-gray-400">Historial y reportes de cada sesión</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-dark-100 border-t-primary-500" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-5xl mb-3">🏋️</p>
          <p className="text-gray-300">Aún no hay sesiones registradas</p>
          <Link to="/workouts" className="btn-primary mt-5 inline-flex px-5 py-2.5 text-sm">
            Ir a entrenar
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w, i) => {
            const completed = (w.exercises || []).filter((e) => e.completed !== false).length
            const dur =
              w.metrics?.durationSeconds ??
              (typeof w.duration === 'number' ? w.duration * 60 : 0)
            return (
              <motion.button
                key={w._id || w.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                onClick={() => setSelected(w)}
                className="card flex w-full items-center gap-3 p-4 text-left active:scale-[0.99] sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-500/15 text-primary-400">
                  <FiActivity size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{w.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {w.completedAt
                      ? format(parseISO(w.completedAt), "d MMM yyyy · HH:mm", { locale: es })
                      : 'Sin fecha'}
                    {' · '}
                    {completed} ejercicios · {formatDuration(w.duration, dur)}
                  </p>
                </div>
                <FiCheck className="shrink-0 text-accent-green" />
              </motion.button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && report && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5 sm:rounded-3xl sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--text-muted)]">Reporte</p>
                  <h2 className="font-display text-2xl text-[color:var(--text-primary)] truncate">{selected.name}</h2>
                  {selected.completedAt && (
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      {format(parseISO(selected.completedAt), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl bg-[color:var(--bg-muted)] p-2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    icon: FiCheck,
                    label: 'Ejercicios',
                    value: `${report.completedCount}/${report.totalExercises}`
                  },
                  { icon: FiActivity, label: 'Series', value: report.totalSets },
                  {
                    icon: FiClock,
                    label: 'Tiempo',
                    value: formatDuration(null, report.durationSeconds)
                  },
                  {
                    icon: FiZap,
                    label: 'Mejor descanso',
                    value:
                      report.bestRest != null ? `${report.bestRest}s` : '—'
                  }
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-[color:var(--bg-muted)] p-3 text-center">
                    <stat.icon className="mx-auto text-[color:var(--color-primary)]" size={16} />
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>

              {report.avgRest != null && (
                <p className="mt-3 text-center text-xs text-[color:var(--text-muted)]">
                  Descanso promedio entre ejercicios: {report.avgRest}s
                </p>
              )}

              <div className="mt-5">
                <p className="mb-1 text-sm font-semibold text-[color:var(--text-primary)]">Rendimiento por ejercicio</p>
                <p className="mb-3 text-xs text-[color:var(--text-muted)]">
                  Volumen ≈ series × reps. Mide el trabajo hecho en cada movimiento.
                </p>
                {report.chart.length > 0 ? (
                  <div className="h-52 w-full rounded-2xl bg-[color:var(--bg-muted)] p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 12,
                            color: 'var(--text-primary)'
                          }}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                          formatter={(value, key) => [
                            value,
                            key === 'volumen' ? 'Volumen (series×reps)' : 'Series'
                          ]}
                        />
                        <Bar dataKey="volumen" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="series" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--text-muted)]">Sin datos suficientes para la gráfica.</p>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Detalle de series</p>
                {(selected.exercises || []).map((ex, idx) => (
                  <div
                    key={ex.id || idx}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                      ex.completed === false
                        ? 'bg-[color:var(--bg-muted)] text-[color:var(--text-muted)]'
                        : 'bg-accent-green/10 text-[color:var(--text-primary)]'
                    }`}
                  >
                    <span className="truncate pr-2">{ex.name}</span>
                    <span className="shrink-0 tabular-nums text-[color:var(--text-secondary)]">
                      {ex.setsCompleted ?? ex.sets}×{ex.reps}
                      {ex.completed === false ? '' : ' ✓'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={sharing}
                onClick={() => shareWorkout(selected)}
                className="btn-primary mt-6 flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60"
              >
                <FiShare2 size={16} />
                {sharing ? 'Compartiendo…' : 'Compartir en Comunidad'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
