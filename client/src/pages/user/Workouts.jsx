import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiPlay, FiCheck, FiClock, FiZap, FiChevronDown, FiSave, FiX, FiTrash2 } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import Timer from '../../components/Timer'
import { useConfetti } from '../../components/Confetti'

const defaultTemplates = [
  { id: 1, name: 'Pecho y Tríceps', color: 'primary', exercises: [
    { name: 'Press Banca', sets: 4, reps: 10 },
    { name: 'Press Inclinado', sets: 3, reps: 12 },
    { name: 'Aperturas', sets: 3, reps: 15 },
    { name: 'Fondos', sets: 3, reps: 12 },
    { name: 'Extensiones Tríceps', sets: 3, reps: 15 },
  ]},
  { id: 2, name: 'Espalda y Bíceps', color: 'cyan', exercises: [
    { name: 'Dominadas', sets: 4, reps: 8 },
    { name: 'Remo con Barra', sets: 4, reps: 10 },
    { name: 'Jalón al Pecho', sets: 3, reps: 12 },
    { name: 'Curl con Barra', sets: 3, reps: 12 },
    { name: 'Curl Martillo', sets: 3, reps: 12 },
  ]},
  { id: 3, name: 'Piernas', color: 'purple', exercises: [
    { name: 'Sentadillas', sets: 4, reps: 10 },
    { name: 'Prensa', sets: 4, reps: 12 },
    { name: 'Peso Muerto Rumano', sets: 3, reps: 10 },
    { name: 'Extensiones', sets: 3, reps: 15 },
    { name: 'Curl Femoral', sets: 3, reps: 12 },
  ]},
  { id: 4, name: 'Hombros y Core', color: 'green', exercises: [
    { name: 'Press Militar', sets: 4, reps: 10 },
    { name: 'Elevaciones Laterales', sets: 3, reps: 15 },
    { name: 'Pájaros', sets: 3, reps: 15 },
    { name: 'Plancha', sets: 3, reps: '60s' },
    { name: 'Crunch', sets: 3, reps: 20 },
  ]}
]

export default function Workouts() {
  const [templates, setTemplates] = useState(defaultTemplates)
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [expandedWorkout, setExpandedWorkout] = useState(null)
  const [completedExercises, setCompletedExercises] = useState([])
  const [showTimer, setShowTimer] = useState(false)
  const [workoutTime, setWorkoutTime] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoutine, setNewRoutine] = useState({ name: '', exercises: [{ name: '', sets: 3, reps: 10 }] })
  const { celebration } = useConfetti()
  
  useEffect(() => {
    let interval
    if (activeWorkout) {
      interval = setInterval(() => setWorkoutTime(prev => prev + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [activeWorkout])
  
  const toggleExercise = (exerciseName) => {
    const wasCompleted = completedExercises.includes(exerciseName)
    setCompletedExercises(prev => 
      wasCompleted ? prev.filter(e => e !== exerciseName) : [...prev, exerciseName]
    )
    if (!wasCompleted) setShowTimer(true)
  }
  
  const startWorkout = (workout) => {
    setActiveWorkout(workout)
    setCompletedExercises([])
    setWorkoutTime(0)
  }
  
  const finishWorkout = async () => {
    if (completedExercises.length === 0) { setActiveWorkout(null); return }
    setSaving(true)
    try {
      await api.post('/workouts', {
        name: activeWorkout.name,
        exercises: activeWorkout.exercises.map(e => ({ ...e, completed: completedExercises.includes(e.name) })),
        duration: Math.floor(workoutTime / 60),
        completedAt: new Date()
      })
      celebration()
      toast.success('¡Entrenamiento guardado! 💪')
    } catch (error) {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
      setActiveWorkout(null)
      setCompletedExercises([])
    }
  }
  
  const addExerciseField = () => {
    setNewRoutine({ ...newRoutine, exercises: [...newRoutine.exercises, { name: '', sets: 3, reps: 10 }] })
  }
  
  const updateExercise = (index, field, value) => {
    const updated = [...newRoutine.exercises]
    updated[index][field] = value
    setNewRoutine({ ...newRoutine, exercises: updated })
  }
  
  const removeExercise = (index) => {
    setNewRoutine({ ...newRoutine, exercises: newRoutine.exercises.filter((_, i) => i !== index) })
  }
  
  const saveNewRoutine = () => {
    if (!newRoutine.name || newRoutine.exercises.some(e => !e.name)) {
      toast.error('Completa todos los campos')
      return
    }
    const colors = ['primary', 'cyan', 'purple', 'green']
    setTemplates([...templates, { ...newRoutine, id: Date.now(), color: colors[templates.length % 4] }])
    setShowCreateModal(false)
    setNewRoutine({ name: '', exercises: [{ name: '', sets: 3, reps: 10 }] })
    toast.success('¡Rutina creada!')
  }
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Entrenamientos</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
          <FiPlus size={18} /> Crear Rutina
        </button>
      </div>
      
      {/* Active Workout */}
      <AnimatePresence>
        {activeWorkout && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="card bg-gradient-to-br from-primary-600/20 to-primary-800/20 border-primary-500/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-primary-400">En progreso</div>
                <h2 className="font-display text-2xl">{activeWorkout.name}</h2>
              </div>
              <div className="flex items-center gap-2 text-primary-400">
                <FiClock />
                <span className="font-mono">{formatTime(workoutTime)}</span>
              </div>
            </div>
            {showTimer && (
              <div className="mb-4 p-4 bg-dark-400/50 rounded-xl">
                <Timer initialTime={60} autoStart={true} size="sm" onComplete={() => setShowTimer(false)} />
              </div>
            )}
            <div className="space-y-2 mb-4">
              {activeWorkout.exercises.map((exercise) => (
                <button key={exercise.name} onClick={() => toggleExercise(exercise.name)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    completedExercises.includes(exercise.name) ? 'bg-accent-green/20 text-accent-green' : 'bg-dark-300/50 text-white hover:bg-dark-200'
                  }`}>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    completedExercises.includes(exercise.name) ? 'border-accent-green bg-accent-green' : 'border-gray-500'
                  }`}>
                    {completedExercises.includes(exercise.name) && <FiCheck size={14} />}
                  </div>
                  <span className="flex-1 text-left">{exercise.name}</span>
                  <span className="text-sm text-gray-400">{exercise.sets}x{exercise.reps}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActiveWorkout(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={finishWorkout} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FiSave /> Finalizar ({completedExercises.length}/{activeWorkout.exercises.length})</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Workout Templates */}
      {!activeWorkout && (
        <div>
          <h2 className="font-display text-xl mb-4">Mis Rutinas</h2>
          <div className="space-y-3">
            {templates.map((workout) => (
              <motion.div key={workout.id || workout.name} className="card overflow-hidden">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    workout.color === 'primary' ? 'bg-primary-500/20 text-primary-500' :
                    workout.color === 'cyan' ? 'bg-accent-cyan/20 text-accent-cyan' :
                    workout.color === 'purple' ? 'bg-accent-purple/20 text-accent-purple' : 'bg-accent-green/20 text-accent-green'
                  }`}>
                    <FiZap size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{workout.name}</div>
                    <div className="text-gray-400 text-sm">{workout.exercises?.length || 0} ejercicios</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); startWorkout(workout); }} className="p-2 bg-primary-500 rounded-full text-white hover:bg-primary-600 transition-colors">
                    <FiPlay size={16} />
                  </button>
                  <FiChevronDown className={`text-gray-400 transition-transform ${expandedWorkout === workout.id ? 'rotate-180' : ''}`} />
                </div>
                <AnimatePresence>
                  {expandedWorkout === workout.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                        {workout.exercises?.map((exercise, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-2">
                            <span className="text-gray-300">{exercise.name}</span>
                            <span className="text-gray-500">{exercise.sets} x {exercise.reps}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      
      {/* Create Routine Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="card max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">Crear Nueva Rutina</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><FiX size={24} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Nombre de la rutina</label>
                  <input type="text" value={newRoutine.name} onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })} placeholder="Ej: Día de pecho" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Ejercicios</label>
                  <div className="space-y-3">
                    {newRoutine.exercises.map((ex, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="text" value={ex.name} onChange={(e) => updateExercise(i, 'name', e.target.value)} placeholder="Nombre" className="input-field flex-1" />
                        <input type="number" value={ex.sets} onChange={(e) => updateExercise(i, 'sets', parseInt(e.target.value))} className="input-field w-16" min="1" />
                        <span className="text-gray-400">x</span>
                        <input type="number" value={ex.reps} onChange={(e) => updateExercise(i, 'reps', parseInt(e.target.value))} className="input-field w-16" min="1" />
                        {newRoutine.exercises.length > 1 && (
                          <button onClick={() => removeExercise(i)} className="text-red-500 hover:text-red-400"><FiTrash2 /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={addExerciseField} className="mt-3 text-primary-500 text-sm flex items-center gap-1 hover:text-primary-400">
                    <FiPlus /> Agregar ejercicio
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={saveNewRoutine} className="btn-primary flex-1">Guardar Rutina</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
