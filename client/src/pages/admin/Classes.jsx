import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiX, FiCalendar, FiClock, FiUsers, FiTrash2 } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { useAppDialog } from '../../components/AppDialog'

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
]

const TYPES = ['strength', 'cardio', 'yoga', 'hiit', 'other']

const emptyForm = {
  name: '',
  description: '',
  type: 'strength',
  duration: 60,
  maxCapacity: 20,
  location: '',
  dayOfWeek: 1,
  startTime: '09:00',
  difficulty: 'intermediate'
}

export default function AdminClasses() {
  const dialog = useAppDialog()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/classes')
      setClasses(data || [])
    } catch {
      toast.error('No se pudieron cargar las clases')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createClass = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Nombre requerido')
      return
    }
    setSaving(true)
    try {
      await api.post('/classes', {
        name: form.name.trim(),
        description: form.description,
        type: form.type,
        duration: Number(form.duration) || 60,
        maxCapacity: Number(form.maxCapacity) || 20,
        location: form.location,
        difficulty: form.difficulty,
        schedule: {
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime
        }
      })
      toast.success('Clase creada')
      setShowCreate(false)
      setForm(emptyForm)
      load()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear clase')
    } finally {
      setSaving(false)
    }
  }

  const cancelClass = async (cls) => {
    const ok = await dialog.confirm(`¿Cancelar la clase "${cls.name}"?`, {
      title: 'Cancelar clase',
      confirmLabel: 'Sí, cancelar',
      tone: 'danger'
    })
    if (!ok) return
    try {
      await api.post(`/classes/${cls._id || cls.id}/cancel`)
      toast.success('Clase cancelada')
      load()
    } catch {
      toast.error('No se pudo cancelar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Clases</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Crea y administra las clases del gimnasio
          </p>
        </div>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <FiPlus /> Crear clase
        </button>
      </div>

      {loading ? (
        <div className="card text-center" style={{ color: 'var(--text-muted)' }}>
          Cargando clases…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <motion.div
              key={cls._id || cls.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="card flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl tracking-wide">{cls.name}</h3>
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                    {cls.type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cancelClass(cls)}
                  className="rounded-lg p-2 transition hover:bg-[color:var(--bg-muted)]"
                  style={{ color: 'var(--text-muted)' }}
                  title="Cancelar clase"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
              {cls.description && (
                <p className="line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {cls.description}
                </p>
              )}
              <div className="mt-auto grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="inline-flex items-center gap-1">
                  <FiCalendar size={12} /> Día {cls.schedule?.dayOfWeek ?? '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FiClock size={12} /> {cls.schedule?.startTime || '—'} · {cls.duration || 60}m
                </span>
                <span className="inline-flex items-center gap-1">
                  <FiUsers size={12} /> {cls.enrolled?.length || 0}/{cls.maxCapacity || cls.capacity || '—'}
                </span>
              </div>
            </motion.div>
          ))}
          {!classes.length && (
            <div className="card md:col-span-2 xl:col-span-3 text-center" style={{ color: 'var(--text-muted)' }}>
              Aún no hay clases. Crea la primera.
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="app-overlay-sheet fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.form
              onSubmit={createClass}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="app-modal-panel relative w-full max-w-lg space-y-4 rounded-t-3xl border p-5 sm:rounded-2xl"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl tracking-wide">Nueva clase</h2>
                <button type="button" onClick={() => setShowCreate(false)} className="p-2">
                  <FiX size={20} />
                </button>
              </div>

              <input
                className="input-field"
                placeholder="Nombre de la clase"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <textarea
                className="input-field min-h-[80px]"
                placeholder="Descripción"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="input-field"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  className="input-field"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className="input-field"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
                <input
                  type="number"
                  className="input-field"
                  min={15}
                  max={180}
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="Duración (min)"
                />
                <input
                  type="number"
                  className="input-field"
                  min={1}
                  max={200}
                  value={form.maxCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))}
                  placeholder="Cupo"
                />
                <input
                  className="input-field"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Ubicación"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Creando…' : 'Crear clase'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
