import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowLeft, FiCompass, FiUsers } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { Avatar } from '../../utils/avatarUtils'
import RoutineDetailModal, { toStartableTemplate } from '../../components/RoutineDetailModal'

const WORKOUT_TEMPLATES_KEY = 'qyntra:workout_templates'

export default function ExploreRoutines() {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [adopting, setAdopting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/workouts/routines/explore')
      setRoutines(data || [])
    } catch (error) {
      console.error(error)
      setRoutines([])
      toast.error('No se pudieron cargar las rutinas públicas')
    } finally {
      setLoading(false)
    }
  }

  const adopt = async () => {
    if (!selected) return
    setAdopting(true)
    try {
      const { data } = await api.post(`/workouts/routines/${selected.id || selected._id}/adopt`)
      const local = toStartableTemplate({
        ...data,
        exercises: data.exercises || selected.exercises
      })
      local.serverId = data.id || data._id
      local.isPublic = false

      try {
        const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
        localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify([...stored, local]))
      } catch {
        /* ignore */
      }

      toast.success('Rutina adoptada en tus entrenamientos')
      setSelected(null)
    } catch (error) {
      // Offline / table missing fallback: save locally from payload
      if (selected?.exercises?.length) {
        const local = toStartableTemplate(selected)
        try {
          const stored = JSON.parse(localStorage.getItem(WORKOUT_TEMPLATES_KEY) || '[]')
          localStorage.setItem(WORKOUT_TEMPLATES_KEY, JSON.stringify([...stored, local]))
          toast.success('Rutina guardada localmente')
          setSelected(null)
          return
        } catch {
          /* ignore */
        }
      }
      toast.error(error.response?.data?.message || 'No se pudo adoptar la rutina')
    } finally {
      setAdopting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 sm:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/workouts" className="mb-3 inline-flex items-center gap-2 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
            <FiArrowLeft /> Volver a entrenos
          </Link>
          <h1 className="font-display text-3xl sm:text-5xl tracking-wide flex items-center gap-3">
            <FiCompass className="text-[color:var(--color-primary)]" /> Explorar rutinas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--text-secondary)]">
            Rutinas públicas de tu comunidad (seguidores y seguidos). Si alguien tiene el perfil público, también puedes ver las suyas.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--color-primary)]" />
        </div>
      ) : routines.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-dashed border-[color:var(--border-subtle)] px-6 py-16 text-center"
        >
          <FiUsers size={36} className="mx-auto mb-4 text-[color:var(--color-primary)]" />
          <h2 className="font-display text-2xl mb-2">Aún no hay rutinas públicas</h2>
          <p className="mx-auto max-w-md text-sm text-[color:var(--text-secondary)] mb-6">
            Sé el primero en compartir una rutina pública con tu comunidad. Márcala como pública al crear o editarla en Entrenos.
          </p>
          <Link to="/workouts" className="btn-primary inline-flex">
            Crear mi rutina
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {routines.map((routine, i) => (
            <motion.button
              key={routine.id || routine._id}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(routine)}
              className="rounded-[1.5rem] border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5 text-left transition hover:-translate-y-0.5 hover:border-[rgba(var(--color-primary-rgb),0.45)]"
            >
              <div className="flex items-center gap-3 mb-3">
                <Avatar avatar={routine.user?.avatar} name={routine.user?.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{routine.user?.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">GymRat</p>
                </div>
              </div>
              <h2 className="font-display text-2xl tracking-wide">{routine.name}</h2>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                {(routine.exercises || []).length} ejercicios
              </p>
              <ul className="mt-3 space-y-1">
                {(routine.exercises || []).slice(0, 3).map((ex, idx) => (
                  <li key={idx} className="truncate text-xs text-[color:var(--text-muted)]">
                    {ex.name} · {ex.sets}×{ex.reps}
                  </li>
                ))}
              </ul>
            </motion.button>
          ))}
        </div>
      )}

      <RoutineDetailModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        routine={selected}
        author={selected?.user}
        onAdopt={adopt}
        adopting={adopting}
      />
    </div>
  )
}
