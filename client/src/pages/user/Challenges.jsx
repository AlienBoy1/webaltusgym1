import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiTarget, FiAward, FiUsers, FiClock, FiTrendingUp, FiPlus, FiX, FiCheck, FiEdit2 } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Avatar } from '../../utils/avatarUtils'

export default function Challenges() {
  const { user, refreshUser } = useAuthStore()
  const [challenges, setChallenges] = useState([])
  const [myChallenges, setMyChallenges] = useState([])
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [updatingProgress, setUpdatingProgress] = useState(false)
  const [progressInput, setProgressInput] = useState('')
  const [following, setFollowing] = useState([])

  // Create challenge form
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'workouts',
    goal: '',
    startDate: '',
    endDate: '',
    reward: { xp: 100 },
    targetUsers: []
  })

  useEffect(() => {
    fetchChallenges()
    fetchMyChallenges()
    fetchFollowing()
  }, [])

  const fetchChallenges = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/challenges?active=true')
      setChallenges(data)
    } catch (error) {
      console.error('Error fetching challenges:', error)
      toast.error('Error al cargar retos')
    } finally {
      setLoading(false)
    }
  }

  const fetchMyChallenges = async () => {
    try {
      const { data } = await api.get('/challenges/my')
      setMyChallenges(data)
    } catch (error) {
      console.error('Error fetching my challenges:', error)
    }
  }

  const fetchFollowing = async () => {
    try {
      const { data } = await api.get('/social/following')
      setFollowing(data || [])
    } catch (error) {
      console.error('Error fetching following:', error)
    }
  }

  const fetchChallengeDetails = async (id) => {
    try {
      const { data } = await api.get(`/challenges/${id}`)
      setSelectedChallenge(data)
      const participant = data.participants?.find(p => p.user?._id === user?._id || p.user === user?._id)
      if (participant) {
        setProgressInput(participant.progress?.toString() || '0')
      }
    } catch (error) {
      console.error('Error fetching challenge details:', error)
      toast.error('Error al cargar detalles del reto')
    }
  }

  const handleJoinChallenge = async (challengeId) => {
    try {
      await api.post(`/challenges/${challengeId}/join`)
      toast.success('¡Te has unido al reto!')
      fetchChallenges()
      fetchMyChallenges()
      if (selectedChallenge?._id === challengeId) {
        fetchChallengeDetails(challengeId)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al unirse al reto')
    }
  }

  const handleLeaveChallenge = async (challengeId) => {
    if (!confirm('¿Estás seguro de que quieres abandonar este reto?')) return

    try {
      await api.delete(`/challenges/${challengeId}/leave`)
      toast.success('Has abandonado el reto')
      fetchChallenges()
      fetchMyChallenges()
      if (selectedChallenge?._id === challengeId) {
        setSelectedChallenge(null)
      }
    } catch (error) {
      toast.error('Error al abandonar reto')
    }
  }

  const handleUpdateProgress = async () => {
    if (!selectedChallenge) return

    const progress = parseFloat(progressInput)
    if (isNaN(progress) || progress < 0) {
      toast.error('Por favor ingresa un valor válido')
      return
    }

    setUpdatingProgress(true)
    try {
      const { data } = await api.put(`/challenges/${selectedChallenge._id}/progress`, { progress })
      toast.success('Progreso actualizado')
      
      // Update local state immediately with populated participants
      if (data.challenge && data.challenge.participants) {
        setSelectedChallenge(prev => ({
          ...prev,
          participants: data.challenge.participants,
          goal: data.challenge.goal
        }))
      } else if (data.participant) {
        setSelectedChallenge(prev => ({
          ...prev,
          participants: prev.participants?.map(p => 
            (p.user?._id || p.user) === user?._id 
              ? { ...p, ...data.participant }
              : p
          ) || [data.participant]
        }))
      }
      
      // Update progress input
      setProgressInput(progress.toString())
      
      // Refresh data
      fetchChallengeDetails(selectedChallenge._id)
      fetchMyChallenges()
      await refreshUser()
      
      // Show message if can complete
      if (data.canComplete) {
        toast.success('¡Has alcanzado el objetivo! Puedes completar el reto para obtener XP', { duration: 4000 })
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al actualizar progreso')
    } finally {
      setUpdatingProgress(false)
    }
  }

  const [completionData, setCompletionData] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  const handleComplete = async () => {
    if (!selectedChallenge) return

    const participant = getParticipant(selectedChallenge)
    if (!participant) {
      toast.error('No participas en este reto')
      return
    }

    if (participant.completed) {
      toast.error('Ya completaste este reto')
      return
    }

    if ((participant.progress || 0) < selectedChallenge.goal) {
      toast.error('Aún no has alcanzado el objetivo del reto')
      return
    }

    try {
      const { data } = await api.post(`/challenges/${selectedChallenge._id}/complete`)
      
      // Show completion modal with all data
      setCompletionData({
        challengeTitle: selectedChallenge.title,
        xpAwarded: data.xpAwarded,
        motivationalMessage: data.motivationalMessage,
        unlockedBadges: data.unlockedBadges || [],
        challengeBadge: data.challengeBadge,
        nextBadge: data.nextBadge,
        leveledUp: data.leveledUp,
        newLevel: data.newLevel
      })
      setShowCompletionModal(true)
      
      // Refresh all data to show updated XP and completion status
      await Promise.all([
        fetchChallengeDetails(selectedChallenge._id),
        fetchMyChallenges(),
        refreshUser()
      ])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar reto')
    }
  }

  const handleCreateChallenge = async () => {
    if (!createForm.title || !createForm.type || !createForm.goal || !createForm.startDate || !createForm.endDate) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    try {
      const challengeData = {
        ...createForm,
        goal: parseFloat(createForm.goal),
        startDate: new Date(createForm.startDate),
        endDate: new Date(createForm.endDate),
        targetUsers: createForm.targetUsers.length > 0 ? createForm.targetUsers : undefined
      }

      await api.post('/challenges', challengeData)
      toast.success('Reto creado exitosamente')
      setShowCreateModal(false)
      setCreateForm({
        title: '',
        description: '',
        type: 'workouts',
        goal: '',
        startDate: '',
        endDate: '',
        reward: { xp: 100 },
        targetUsers: []
      })
      fetchChallenges()
      fetchMyChallenges()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear reto')
    }
  }

  const isParticipating = (challenge) => {
    return challenge.participants?.some(p => 
      (p.user?._id || p.user) === user?._id
    )
  }

  const getParticipant = (challenge) => {
    return challenge.participants?.find(p => 
      (p.user?._id || p.user) === user?._id
    )
  }

  const activeChallenges = myChallenges.filter(c => new Date(c.endDate) > new Date())
  const availableChallenges = challenges.filter(c => !isParticipating(c))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Retos</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-accent-yellow">
            <FiAward />
            <span className="font-semibold">{user?.stats?.xp || 0} XP</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus size={20} />
            Crear Reto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'active' ? 'bg-primary-500 text-white' : 'bg-dark-200 text-gray-400'
          }`}
        >
          Mis Retos ({activeChallenges.length})
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'available' ? 'bg-primary-500 text-white' : 'bg-dark-200 text-gray-400'
          }`}
        >
          Disponibles ({availableChallenges.length})
        </button>
      </div>

      {/* Active Challenges */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : activeChallenges.length === 0 ? (
            <div className="card text-center py-12">
              <FiTarget className="mx-auto text-gray-500 mb-4" size={48} />
              <p className="text-gray-400">No estás participando en ningún reto</p>
              <button
                onClick={() => setActiveTab('available')}
                className="btn-primary mt-4"
              >
                Ver Retos Disponibles
              </button>
            </div>
          ) : (
            activeChallenges.map((challenge, i) => {
              const participant = getParticipant(challenge)
              const progress = participant?.progress || 0
              const completed = participant?.completed || false
              const progressPercent = challenge.goal ? Math.min(100, (progress / challenge.goal) * 100) : 0

              return (
                <motion.div
                  key={challenge._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="card cursor-pointer hover:border-primary-500/50 transition-colors"
                  onClick={() => fetchChallengeDetails(challenge._id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-display text-xl mb-1">{challenge.title}</h3>
                      <p className="text-gray-400 text-sm">{challenge.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-accent-yellow font-semibold">
                        +{challenge.reward?.xp || 100} XP
                      </div>
                      {completed && (
                        <div className="text-xs text-accent-green mt-1">✓ Completado</div>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Progreso</span>
                      <span className="text-primary-500 font-semibold">
                        {progress} / {challenge.goal}
                      </span>
                    </div>
                    <div className="h-3 bg-dark-300 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full rounded-full ${
                          completed ? 'bg-accent-green' : 'bg-gradient-to-r from-primary-500 to-primary-400'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <FiUsers size={14} />
                        {challenge.participants?.length || 0} participantes
                      </div>
                      <div className="flex items-center gap-1">
                        <FiClock size={14} />
                        {formatDistanceToNow(new Date(challenge.endDate), { addSuffix: true, locale: es })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLeaveChallenge(challenge._id)
                      }}
                      className="text-red-500 hover:text-red-400 text-sm"
                    >
                      Abandonar
                    </button>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}

      {/* Available Challenges */}
      {activeTab === 'available' && (
        <div className="grid md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : availableChallenges.length === 0 ? (
            <div className="col-span-full card text-center py-12">
              <FiTarget className="mx-auto text-gray-500 mb-4" size={48} />
              <p className="text-gray-400">No hay retos disponibles</p>
            </div>
          ) : (
            availableChallenges.map((challenge, i) => (
              <motion.div
                key={challenge._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card cursor-pointer hover:border-primary-500/50 transition-colors"
                onClick={() => fetchChallengeDetails(challenge._id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
                    <FiTarget className="text-primary-500" size={24} />
                  </div>
                  <span className="px-3 py-1 bg-accent-yellow/20 text-accent-yellow rounded-full text-sm">
                    +{challenge.reward?.xp || 100} XP
                  </span>
                </div>

                <h3 className="font-display text-lg mb-2">{challenge.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{challenge.description}</p>

                <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-1">
                    <FiUsers size={14} /> {challenge.participants?.length || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <FiClock size={14} />
                    {formatDistanceToNow(new Date(challenge.endDate), { addSuffix: true, locale: es })}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleJoinChallenge(challenge._id)
                  }}
                  className="btn-primary w-full"
                >
                  Unirse al Reto
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Challenge Details Modal */}
      <AnimatePresence>
        {selectedChallenge && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl">{selectedChallenge.title}</h2>
                <button
                  onClick={() => setSelectedChallenge(null)}
                  className="p-2 hover:bg-dark-200 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>

              <p className="text-gray-400 mb-6">{selectedChallenge.description}</p>

              {(() => {
                const participant = getParticipant(selectedChallenge)
                const progress = participant?.progress || 0
                const completed = participant?.completed || false
                const progressPercent = selectedChallenge.goal ? Math.min(100, (progress / selectedChallenge.goal) * 100) : 0

                return (
                  <>
                    {/* Progress Section */}
                    {participant && (
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-400">Tu Progreso</span>
                          <span className="font-semibold text-primary-500">
                            {progress} / {selectedChallenge.goal}
                          </span>
                        </div>
                        <div className="h-4 bg-dark-300 rounded-full overflow-hidden mb-4">
                          <div
                            className={`h-full rounded-full transition-all ${
                              completed ? 'bg-accent-green' : 'bg-gradient-to-r from-primary-500 to-primary-400'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        {/* Update Progress */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-400">
                            Actualizar Progreso
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={progressInput}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= selectedChallenge.goal)) {
                                  setProgressInput(val)
                                }
                              }}
                              placeholder="0"
                              className="input-field flex-1 text-center font-semibold"
                              min="0"
                              max={selectedChallenge.goal}
                              disabled={completed}
                            />
                            <button
                              onClick={handleUpdateProgress}
                              disabled={updatingProgress || completed}
                              className="btn-primary flex items-center gap-2 px-4"
                            >
                              <FiEdit2 size={18} />
                              {updatingProgress ? 'Actualizando...' : 'Actualizar'}
                            </button>
                          </div>
                          {completed && (
                            <p className="text-xs text-accent-green flex items-center gap-1">
                              <FiCheck size={14} />
                              Reto completado
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mb-6">
                      {participant && (
                        <>
                          {!completed && (
                            <button
                              onClick={handleLeaveChallenge.bind(null, selectedChallenge._id)}
                              className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiX size={18} />
                              Abandonar Reto
                            </button>
                          )}
                          {progress >= selectedChallenge.goal && !completed && (
                            <button
                              onClick={handleComplete}
                              className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiCheck size={18} />
                              Completar y Obtener XP
                            </button>
                          )}
                          {completed && (
                            <div className="flex-1 p-3 bg-accent-green/20 text-accent-green rounded-lg text-center">
                              <FiCheck size={18} className="mx-auto mb-1" />
                              <div className="text-sm font-semibold">Reto Completado</div>
                              <div className="text-xs opacity-75">
                                Ganaste {selectedChallenge.reward?.xp || 100} XP
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {!participant && (
                        <button
                          onClick={handleJoinChallenge.bind(null, selectedChallenge._id)}
                          className="btn-primary w-full"
                        >
                          Unirse al Reto
                        </button>
                      )}
                    </div>

                    {/* Leaderboard */}
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <FiTrendingUp />
                        Clasificación
                      </h3>
                      {selectedChallenge.participants && selectedChallenge.participants.length > 0 ? (
                        <div className="space-y-2">
                          {selectedChallenge.participants
                            ?.filter(p => p.user) // Filter out participants without user data
                            ?.sort((a, b) => (b.progress || 0) - (a.progress || 0))
                            .slice(0, 10)
                            .map((p, index) => {
                              const participantUser = typeof p.user === 'object' ? p.user : null
                              const userId = participantUser?._id || p.user
                              const isCurrentUser = userId === user?._id
                              
                              return (
                                <div
                                  key={userId || index}
                                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                    isCurrentUser
                                      ? 'bg-primary-500/10 ring-1 ring-primary-500'
                                      : 'bg-dark-200 hover:bg-dark-300'
                                  }`}
                                >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                    index === 0 ? 'bg-yellow-500 text-black' :
                                    index === 1 ? 'bg-gray-400 text-black' :
                                    index === 2 ? 'bg-amber-700 text-white' :
                                    'bg-dark-300 text-gray-400'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <div className="flex-shrink-0">
                                    <Avatar 
                                      avatar={participantUser?.avatar} 
                                      name={participantUser?.name || 'Usuario'} 
                                      size="sm"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                      {participantUser?.name || 'Usuario'}
                                    </div>
                                    {participantUser?.stats?.level && (
                                      <div className="text-xs text-gray-400">
                                        Nivel {participantUser.stats.level}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <div className="font-semibold text-primary-500">
                                      {p.progress || 0} / {selectedChallenge.goal}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {Math.round(((p.progress || 0) / selectedChallenge.goal) * 100)}%
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <FiUsers size={32} className="mx-auto mb-2 opacity-50" />
                          <p>No hay participantes aún</p>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Challenge Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl">Crear Reto</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-dark-200 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Título *</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="input-field w-full"
                    placeholder="Ej: Reto 30 Días"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Descripción</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="input-field w-full"
                    rows={3}
                    placeholder="Describe el reto..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo *</label>
                    <select
                      value={createForm.type}
                      onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                      className="input-field w-full"
                    >
                      <option value="workouts">Entrenamientos</option>
                      <option value="streak">Racha</option>
                      <option value="calories">Calorías</option>
                      <option value="distance">Distancia</option>
                      <option value="weight_lifted">Peso Levantado</option>
                      <option value="social">Social</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Objetivo *</label>
                    <input
                      type="number"
                      value={createForm.goal}
                      onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
                      className="input-field w-full"
                      placeholder="Ej: 30"
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha Inicio *</label>
                    <input
                      type="datetime-local"
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                      className="input-field w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha Fin *</label>
                    <input
                      type="datetime-local"
                      value={createForm.endDate}
                      onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                      className="input-field w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">XP de Recompensa</label>
                  <input
                    type="number"
                    value={createForm.reward.xp}
                    onChange={(e) => setCreateForm({
                      ...createForm,
                      reward: { ...createForm.reward, xp: parseInt(e.target.value) || 100 }
                    })}
                    className="input-field w-full"
                    min="1"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateChallenge}
                    className="btn-primary flex-1"
                  >
                    Crear Reto
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && completionData && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-md w-full text-center"
            >
              <div className="mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-accent-yellow to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiAward size={40} className="text-white" />
                </div>
                <h2 className="font-display text-2xl mb-2">¡Felicidades! 🎉</h2>
                <p className="text-gray-300 mb-1">{completionData.motivationalMessage}</p>
                <p className="text-primary-500 font-semibold">
                  Completaste: {completionData.challengeTitle}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {/* XP Awarded */}
                <div className="p-4 bg-dark-200 rounded-xl">
                  <div className="text-3xl font-bold text-accent-yellow mb-1">
                    +{completionData.xpAwarded} XP
                  </div>
                  <div className="text-sm text-gray-400">
                    {completionData.leveledUp ? (
                      <>¡Subiste al nivel {completionData.newLevel}! 🚀</>
                    ) : (
                      <>XP agregado a tu cuenta</>
                    )}
                  </div>
                </div>

                {/* Unlocked Badges */}
                {completionData.unlockedBadges.length > 0 && (
                  <div className="p-4 bg-dark-200 rounded-xl">
                    <div className="text-sm text-gray-400 mb-3">Insignias Desbloqueadas</div>
                    <div className="flex justify-center gap-3">
                      {completionData.unlockedBadges.map((badge, idx) => (
                        <div key={badge.id || idx} className="text-center">
                          <div className="text-4xl mb-1">{badge.icon}</div>
                          <div className="text-xs text-gray-300">{badge.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Challenge Badge */}
                {completionData.challengeBadge && (
                  <div className="p-4 bg-gradient-to-br from-primary-500/20 to-primary-700/20 rounded-xl border border-primary-500/30">
                    <div className="text-sm text-primary-500 mb-2">Insignia del Reto</div>
                    <div className="text-4xl mb-1">{completionData.challengeBadge.icon}</div>
                    <div className="font-semibold">{completionData.challengeBadge.name}</div>
                  </div>
                )}

                {/* Next Badge */}
                {completionData.nextBadge && (
                  <div className="p-4 bg-dark-200 rounded-xl">
                    <div className="text-sm text-gray-400 mb-2">Próxima Insignia</div>
                    <div className="text-3xl mb-2 opacity-50">{completionData.nextBadge.icon}</div>
                    <div className="font-semibold text-gray-300 mb-2">{completionData.nextBadge.name}</div>
                    <div className="text-xs text-gray-400">
                      Necesitas {completionData.nextBadge.xpNeeded} XP más
                    </div>
                    <div className="mt-2 h-2 bg-dark-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{
                          width: `${((completionData.nextBadge.currentXP / completionData.nextBadge.xpRequired) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowCompletionModal(false)
                  setCompletionData(null)
                }}
                className="btn-primary w-full"
              >
                ¡Genial!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
