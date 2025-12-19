import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiCalendar, FiClock, FiUsers, FiCheck, FiX, FiInfo } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const dayMap = {
  'Lunes': 1,
  'Martes': 2,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5,
  'Sábado': 6,
  'Domingo': 0
}

export default function Classes() {
  const { user } = useAuthStore()
  const [classes, setClasses] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('es', { weekday: 'long' }))
  const [selectedClass, setSelectedClass] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/classes')
      setClasses(data)
    } catch (error) {
      console.error('Error fetching classes:', error)
      toast.error('Error al cargar clases')
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (classItem) => {
    const isEnrolled = classItem.enrolled?.some(e => (e.user?._id || e.user) === user?._id)

    if (isEnrolled) {
      // Cancel enrollment
      if (!confirm('¿Estás seguro de que quieres cancelar tu inscripción?')) return

      try {
        const response = await api.delete(`/classes/${classItem._id}/enroll`)
        if (response.status >= 200 && response.status < 300) {
          toast.success('Inscripción cancelada')
          fetchClasses()
          if (selectedClass?._id === classItem._id) {
            fetchClassDetails(classItem._id)
          }
        }
      } catch (error) {
        if (error.response && error.response.status >= 400) {
          toast.error(error.response?.data?.message || 'Error al cancelar inscripción')
        }
      }
    } else {
      // Enroll
      setEnrolling(true)
      try {
        const response = await api.post(`/classes/${classItem._id}/enroll`)
        if (response.status >= 200 && response.status < 300) {
          toast.success(response.data?.message || '¡Inscripción exitosa!')
          fetchClasses()
          if (selectedClass?._id === classItem._id) {
            fetchClassDetails(classItem._id)
          }
        }
      } catch (error) {
        if (error.response && error.response.status >= 400) {
          toast.error(error.response?.data?.message || 'Error al inscribirse')
        }
      } finally {
        setEnrolling(false)
      }
    }
  }

  const fetchClassDetails = async (id) => {
    try {
      const { data } = await api.get(`/classes/${id}`)
      setSelectedClass(data)
    } catch (error) {
      console.error('Error fetching class details:', error)
    }
  }

  const isEnrolled = (classItem) => {
    return classItem.enrolled?.some(e => (e.user?._id || e.user) === user?._id)
  }

  const isInWaitlist = (classItem) => {
    return classItem.waitlist?.some(w => (w.user?._id || w.user) === user?._id)
  }

  const filteredClasses = classes.filter(c => {
    if (!c.schedule?.dayOfWeek) return false
    const dayNumber = dayMap[selectedDay]
    return c.schedule.dayOfWeek === dayNumber
  })

  const getAvatarDisplay = (instructor) => {
    if (instructor?.avatar) {
      if (instructor.avatar.startsWith('data:') || instructor.avatar.startsWith('http')) {
        return <img src={instructor.avatar} alt={instructor.name} className="w-full h-full object-cover rounded-full" />
      }
      return instructor.avatar
    }
    return instructor?.name?.charAt(0) || '👤'
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Clases Grupales</h1>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedDay === day
                ? 'bg-primary-500 text-white'
                : 'bg-dark-200 text-gray-400 hover:text-white'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Classes Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="card text-center py-12">
          <FiCalendar className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">No hay clases programadas para este día</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((classItem, i) => {
            const enrolled = isEnrolled(classItem)
            const inWaitlist = isInWaitlist(classItem)
            const enrolledCount = classItem.enrolled?.length || 0
            const isFull = enrolledCount >= (classItem.maxCapacity || 0)

            return (
              <motion.div
                key={classItem._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`card cursor-pointer hover:border-primary-500/50 transition-colors ${enrolled ? 'ring-2 ring-primary-500' : ''}`}
                onClick={() => fetchClassDetails(classItem._id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-display text-xl mb-1">{classItem.name}</h3>
                    <p className="text-gray-400 text-sm">{classItem.instructor?.name || 'Sin instructor'}</p>
                  </div>
                  {enrolled && (
                    <span className="px-2 py-1 bg-primary-500/20 text-primary-500 rounded-full text-xs">
                      Inscrito
                    </span>
                  )}
                  {inWaitlist && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded-full text-xs">
                      Lista de espera
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    <FiClock className="text-gray-500" size={16} />
                    {classItem.schedule?.startTime} - {classItem.duration || 60} min
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <FiUsers className="text-gray-500" size={16} />
                    {enrolledCount}/{classItem.maxCapacity || 0} personas
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-dark-300 rounded-full mb-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-primary-500'}`}
                    style={{ width: `${Math.min(100, ((enrolledCount / (classItem.maxCapacity || 1)) * 100))}%` }}
                  />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEnroll(classItem)
                  }}
                  disabled={isFull && !enrolled && !inWaitlist || enrolling}
                  className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    enrolled
                      ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                      : inWaitlist
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : isFull
                          ? 'bg-dark-300 text-gray-500 cursor-not-allowed'
                          : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {enrolled ? (
                    <>
                      <FiX size={18} /> Cancelar
                    </>
                  ) : inWaitlist ? (
                    'En lista de espera'
                  ) : isFull ? (
                    'Clase Llena'
                  ) : (
                    <>
                      <FiCheck size={18} /> Inscribirse
                    </>
                  )}
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Class Details Modal */}
      <AnimatePresence>
        {selectedClass && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl">{selectedClass.name}</h2>
                <button
                  onClick={() => setSelectedClass(null)}
                  className="p-2 hover:bg-dark-200 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-400 mb-1">Instructor</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xl overflow-hidden">
                      {getAvatarDisplay(selectedClass.instructor)}
                    </div>
                    <div>
                      <div className="font-semibold">{selectedClass.instructor?.name || 'Sin instructor'}</div>
                      <div className="text-sm text-gray-400">{selectedClass.instructor?.email}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm text-gray-400 mb-1">Horario</h3>
                    <div className="flex items-center gap-2">
                      <FiClock size={16} className="text-gray-500" />
                      <span>{selectedClass.schedule?.startTime} - {selectedClass.duration || 60} min</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400 mb-1">Capacidad</h3>
                    <div className="flex items-center gap-2">
                      <FiUsers size={16} className="text-gray-500" />
                      <span>{selectedClass.enrolled?.length || 0}/{selectedClass.maxCapacity || 0}</span>
                    </div>
                  </div>
                </div>

                {selectedClass.description && (
                  <div>
                    <h3 className="text-sm text-gray-400 mb-2">Descripción</h3>
                    <p className="text-gray-300">{selectedClass.description}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button
                    onClick={() => {
                      handleEnroll(selectedClass)
                    }}
                    disabled={enrolling}
                    className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 ${
                      isEnrolled(selectedClass)
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                        : isInWaitlist(selectedClass)
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    {enrolling ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isEnrolled(selectedClass) ? (
                      <>
                        <FiX size={18} /> Cancelar Inscripción
                      </>
                    ) : isInWaitlist(selectedClass) ? (
                      'En Lista de Espera'
                    ) : (
                      <>
                        <FiCheck size={18} /> Inscribirse
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
