import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiTarget, FiAward, FiUsers, FiClock, FiTrendingUp, FiPlus, FiX, FiCheck, FiEdit2, FiPlay, FiPause, FiShare2 } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Avatar } from '../../utils/avatarUtils'
import { useConfetti } from '../../components/Confetti'
import { setChallengeTimerActive } from '../../utils/presence'

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${m}:${String(s).padStart(2, '0')}`
}

function ChallengeTimer({ participant }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const calc = () => {
      const acc = Number(participant.accumulatedMs) || 0
      if (participant.status === 'active' && participant.startedAt) {
        const running = Date.now() - new Date(participant.startedAt).getTime()
        return acc + running
      }
      return acc
    }
    setElapsed(calc())

    if (participant.status !== 'active') return
    const id = setInterval(() => setElapsed(calc()), 1000)
    return () => clearInterval(id)
  }, [participant.status, participant.startedAt, participant.accumulatedMs])

  return (
    <div className="flex items-center gap-2 text-sm">
      <FiClock size={14} className="text-primary-500" />
      <span className="font-mono tabular-nums text-primary-500 font-semibold">
        {formatElapsed(elapsed)}
      </span>
      {participant.status === 'active' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
        </span>
      )}
      {participant.status === 'paused' && (
        <span className="text-xs text-yellow-400">(pausado)</span>
      )}
    </div>
  )
}

export default function Challenges() {
  const { user, refreshUser } = useAuthStore()
  const navigate = useNavigate()
  const { celebration } = useConfetti()
  const [challenges, setChallenges] = useState([])
  const [myChallenges, setMyChallenges] = useState([])
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [updatingProgress, setUpdatingProgress] = useState(false)
  const [progressInput, setProgressInput] = useState('')
  const [following, setFollowing] = useState([])
  const [challengeTypes, setChallengeTypes] = useState([])
  const [sessionLoading, setSessionLoading] = useState(false)

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'workouts',
    goal: '',
    startDate: '',
    endDate: '',
    reward: { xp: 0 },
    targetUsers: []
  })

  useEffect(() => {
    fetchChallenges()
    fetchMyChallenges()
    fetchFollowing()
    fetchChallengeTypes()
  }, [])

  const fetchChallengeTypes = async () => {
    try {
      const { data } = await api.get('/challenges/types')
      setChallengeTypes(data || [])
    } catch (error) {
      console.error('Error fetching challenge types:', error)
    }
  }

  const getTypeInfo = useCallback((typeId) => {
    return challengeTypes.find(t => t.id === typeId) || null
  }, [challengeTypes])

  const getDefaultXp = useCallback((typeId) => {
    const t = getTypeInfo(typeId)
    return t?.default_xp || 50
  }, [getTypeInfo])

  useEffect(() => {
    if (challengeTypes.length > 0 && createForm.reward.xp === 0) {
      setCreateForm(prev => ({
        ...prev,
        reward: { ...prev.reward, xp: getDefaultXp(prev.type) }
      }))
    }
  }, [challengeTypes, getDefaultXp, createForm.reward.xp])

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
      setChallengeTimerActive(false)
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

  const handleStartChallenge = async (challengeId) => {
    setSessionLoading(true)
    try {
      await api.post(`/challenges/${challengeId}/start`)
      setChallengeTimerActive(true)
      toast.success('¡Reto iniciado!')
      fetchChallengeDetails(challengeId)
      fetchMyChallenges()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al iniciar reto')
    } finally {
      setSessionLoading(false)
    }
  }

  const handlePauseChallenge = async (challengeId) => {
    setSessionLoading(true)
    try {
      await api.post(`/challenges/${challengeId}/pause`)
      setChallengeTimerActive(false)
      toast.success('Reto pausado')
      fetchChallengeDetails(challengeId)
      fetchMyChallenges()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al pausar reto')
    } finally {
      setSessionLoading(false)
    }
  }

  const handleResumeChallenge = async (challengeId) => {
    setSessionLoading(true)
    try {
      await api.post(`/challenges/${challengeId}/resume`)
      setChallengeTimerActive(true)
      toast.success('Reto reanudado')
      fetchChallengeDetails(challengeId)
      fetchMyChallenges()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al reanudar reto')
    } finally {
      setSessionLoading(false)
    }
  }

  const handleUpdateProgress = async () => {
    if (!selectedChallenge) return
    const participant = getParticipant(selectedChallenge)
    if (!participant || participant.status !== 'active') {
      toast.error('Debes tener el reto activo para actualizar progreso')
      return
    }

    const progress = parseFloat(progressInput)
    if (isNaN(progress) || progress < 0) {
      toast.error('Por favor ingresa un valor válido')
      return
    }

    setUpdatingProgress(true)
    try {
      const { data } = await api.put(`/challenges/${selectedChallenge._id}/progress`, { progress })
      toast.success('Progreso actualizado')

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

      setProgressInput(progress.toString())
      fetchChallengeDetails(selectedChallenge._id)
      fetchMyChallenges()
      await refreshUser()

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
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [sharingChallenge, setSharingChallenge] = useState(false)

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

      setChallengeTimerActive(false)
      celebration()

      setCompletionData({
        challengeTitle: selectedChallenge.title,
        challengeType: selectedChallenge.type,
        challengeGoal: selectedChallenge.goal,
        challengeUnit: selectedChallenge.unit,
        xpAwarded: data.xpAwarded,
        motivationalMessage: data.motivationalMessage,
        unlockedBadges: data.unlockedBadges || [],
        challengeBadge: data.challengeBadge,
        nextBadge: data.nextBadge,
        leveledUp: data.leveledUp,
        newLevel: data.newLevel,
        challengeData: data.challengeData,
        accumulatedMs: data.participant?.accumulatedMs || data.challengeData?.accumulatedMs || 0
      })
      setShowCompletionModal(true)

      await Promise.all([
        fetchChallengeDetails(selectedChallenge._id),
        fetchMyChallenges(),
        refreshUser()
      ])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar reto')
    }
  }

  const handleShareChallenge = async () => {
    if (!completionData) return
    setSharingChallenge(true)
    try {
      await api.post('/social', {
        content: `¡Completé el reto "${completionData.challengeTitle}"! 🏆`,
        postType: 'challenge',
        workoutData: {
          shareKind: 'challenge',
          challengeTitle: completionData.challengeTitle,
          challengeType: completionData.challengeType,
          challengeGoal: completionData.challengeGoal,
          challengeUnit: completionData.challengeUnit,
          xpAwarded: completionData.xpAwarded,
          accumulatedMs: completionData.accumulatedMs
        }
      })
      toast.success('Compartido en Comunidad')
      setShowCompletionModal(false)
      setCompletionData(null)
      navigate('/social')
    } catch (error) {
      toast.error('No se pudo compartir')
    } finally {
      setSharingChallenge(false)
    }
  }

  const handleCreateChallenge = async () => {
    if (!createForm.title || !createForm.type || !createForm.goal || !createForm.startDate || !createForm.endDate) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    try {
      const xp = createForm.reward.xp || getDefaultXp(createForm.type)
      const challengeData = {
        ...createForm,
        goal: parseFloat(createForm.goal),
        startDate: new Date(createForm.startDate),
        endDate: new Date(createForm.endDate),
        reward: { xp },
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
        reward: { xp: getDefaultXp('workouts') },
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

  const statusLabel = (status) => {
    switch (status) {
      case 'joined': return { text: 'Unido', color: 'text-gray-400 bg-gray-500/20' }
      case 'active': return { text: 'Activo', color: 'text-accent-green bg-accent-green/20' }
      case 'paused': return { text: 'Pausado', color: 'text-yellow-400 bg-yellow-500/20' }
      case 'completed': return { text: 'Completado', color: 'text-accent-green bg-accent-green/20' }
      default: return { text: status, color: 'text-gray-400 bg-gray-500/20' }
    }
  }

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
            data-tour="tour-challenges-create"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus size={20} />
            Crear Reto
          </button>
        </div>
      </div>

      <div data-tour="tour-challenges-list" className="space-y-4">

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
              const status = statusLabel(participant?.status)
              const typeInfo = getTypeInfo(challenge.type)

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
                      <div className="flex items-center gap-2 mb-1">
                        {typeInfo && <span className="text-lg">{typeInfo.icon}</span>}
                        <h3 className="font-display text-xl">{challenge.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                      </div>
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

                  {/* Timer */}
                  {participant && !completed && (participant.status === 'active' || participant.status === 'paused') && (
                    <div className="mb-3">
                      <ChallengeTimer participant={participant} />
                    </div>
                  )}

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
                    {!completed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLeaveChallenge(challenge._id)
                        }}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Abandonar
                      </button>
                    )}
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
            availableChallenges.map((challenge, i) => {
              const typeInfo = getTypeInfo(challenge.type)
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
                    <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center text-2xl">
                      {typeInfo?.icon || <FiTarget className="text-primary-500" size={24} />}
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
              )
            })
          )}
        </div>
      )}
      </div>

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
                <div>
                  <h2 className="font-display text-2xl">{selectedChallenge.title}</h2>
                  {(() => {
                    const typeInfo = getTypeInfo(selectedChallenge.type)
                    return typeInfo ? (
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.name}</span>
                      </div>
                    ) : null
                  })()}
                </div>
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
                const participantStatus = participant?.status || 'joined'
                const isActive = participantStatus === 'active'
                const isPaused = participantStatus === 'paused'
                const isJoined = participantStatus === 'joined'
                const progressChanged = progressInput !== (participant?.progress?.toString() || '0')

                return (
                  <>
                    {/* Session Timer + Status */}
                    {participant && !completed && (
                      <div className="mb-6 p-4 rounded-xl bg-dark-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-300">Estado:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabel(participantStatus).color}`}>
                              {statusLabel(participantStatus).text}
                            </span>
                          </div>
                          {(isActive || isPaused) && (
                            <ChallengeTimer participant={participant} />
                          )}
                        </div>

                        <div className="flex gap-2">
                          {isJoined && (
                            <button
                              onClick={() => handleStartChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiPlay size={16} />
                              {sessionLoading ? 'Iniciando...' : 'Iniciar Reto'}
                            </button>
                          )}
                          {isActive && (
                            <button
                              onClick={() => handlePauseChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiPause size={16} />
                              {sessionLoading ? 'Pausando...' : 'Pausar Reto'}
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => handleResumeChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiPlay size={16} />
                              {sessionLoading ? 'Reanudando...' : 'Reanudar Reto'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

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
                        {!completed && (
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
                                disabled={!isActive}
                              />
                              <button
                                onClick={handleUpdateProgress}
                                disabled={updatingProgress || !isActive || !progressChanged}
                                className="btn-primary flex items-center gap-2 px-4 disabled:opacity-40"
                              >
                                <FiEdit2 size={18} />
                                {updatingProgress ? 'Actualizando...' : 'Actualizar'}
                              </button>
                            </div>
                            {!isActive && !completed && (
                              <p className="text-xs text-yellow-400 flex items-center gap-1">
                                <FiPlay size={12} />
                                Inicia el reto para actualizar progreso
                              </p>
                            )}
                          </div>
                        )}
                        {completed && (
                          <p className="text-xs text-accent-green flex items-center gap-1">
                            <FiCheck size={14} />
                            Reto completado
                          </p>
                        )}
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
                              Abandonar
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
                            ?.filter(p => p.user)
                            ?.sort((a, b) => (b.progress || 0) - (a.progress || 0))
                            .slice(0, 10)
                            .map((p, index) => {
                              const participantUser = typeof p.user === 'object' ? p.user : null
                              const userId = participantUser?._id || p.user
                              const isCurrentUser = userId === user?._id
                              const pStatus = statusLabel(p.status)

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
                                    <div className="flex items-center gap-2">
                                      {participantUser?.stats?.level && (
                                        <span className="text-xs text-gray-400">
                                          Nivel {participantUser.stats.level}
                                        </span>
                                      )}
                                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${pStatus.color}`}>
                                        {pStatus.text}
                                      </span>
                                    </div>
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

                <div>
                  <label className="block text-sm font-medium mb-2">Tipo *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {challengeTypes.length > 0 ? (
                      challengeTypes.map(ct => (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => {
                            setCreateForm({
                              ...createForm,
                              type: ct.id,
                              reward: { ...createForm.reward, xp: ct.default_xp }
                            })
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all text-sm ${
                            createForm.type === ct.id
                              ? 'bg-primary-500/15 border border-primary-500/50 text-white'
                              : 'bg-dark-200 border border-transparent text-gray-400 hover:text-white hover:bg-dark-300'
                          }`}
                        >
                          <span className="text-lg">{ct.icon}</span>
                          <span className="flex-1 font-medium">{ct.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-accent-yellow/20 text-accent-yellow text-xs font-semibold whitespace-nowrap">
                            {ct.default_xp} XP
                          </span>
                        </button>
                      ))
                    ) : (
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
                    )}
                  </div>
                  {challengeTypes.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      El XP se asigna automáticamente según el tipo ({getDefaultXp(createForm.type)} XP).
                    </p>
                  )}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Completion Modal with Confetti + Share */}
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
                {completionData.accumulatedMs > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Tiempo total: {formatElapsed(completionData.accumulatedMs)}
                  </p>
                )}
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

              <div className="space-y-2">
                <button
                  onClick={handleShareChallenge}
                  disabled={sharingChallenge}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <FiShare2 size={16} />
                  {sharingChallenge ? 'Compartiendo...' : 'Compartir en Comunidad'}
                </button>
                <button
                  onClick={() => {
                    setShowCompletionModal(false)
                    setCompletionData(null)
                  }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Ahora no
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
