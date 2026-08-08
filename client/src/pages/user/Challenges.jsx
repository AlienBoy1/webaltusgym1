import { useState, useEffect, useCallback, useRef } from 'react'
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
import TutorialHelpButton from '../../components/TutorialHelpButton'
import { TUTORIAL_IDS } from '../../tutorials/registry'
import { useAppDialog } from '../../components/AppDialog'
import ShareChallengeSheet from '../../components/ShareChallengeSheet'
import FormattedText from '../../components/FormattedText'
import {
  formatElapsed,
  formatChallengeGoal,
  getExerciseResultMeta,
  getTimeGoalMs,
  isTimeGoalChallenge,
  buildChallengeSharePayload,
  normalizeChallengeExercises,
  sumExerciseTargets,
  clampExerciseProgress
} from '../../utils/challengeUtils'

function ChallengeTimer({ participant, targetMs = 0, onTargetReached }) {
  const [elapsed, setElapsed] = useState(0)
  const reachedRef = useRef(false)

  useEffect(() => {
    reachedRef.current = false
  }, [participant?.startedAt, participant?.status, targetMs])

  useEffect(() => {
    const calc = () => {
      const acc = Number(participant.accumulatedMs) || 0
      if (participant.status === 'active' && participant.startedAt) {
        const running = Date.now() - new Date(participant.startedAt).getTime()
        return acc + running
      }
      return acc
    }

    const tick = () => {
      const value = calc()
      const display = targetMs > 0 ? Math.min(value, targetMs) : value
      setElapsed(display)

      if (
        targetMs > 0 &&
        participant.status === 'active' &&
        value >= targetMs &&
        !reachedRef.current
      ) {
        reachedRef.current = true
        onTargetReached?.(targetMs)
      }
    }

    tick()
    if (participant.status !== 'active') return
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [participant.status, participant.startedAt, participant.accumulatedMs, targetMs, onTargetReached])

  const progressPct = targetMs > 0 ? Math.min(100, (elapsed / targetMs) * 100) : null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <FiClock size={14} className="text-primary-500" />
        <span className="font-mono tabular-nums text-primary-500 font-semibold">
          {formatElapsed(elapsed)}
          {targetMs > 0 && (
            <span className="text-gray-500 font-normal"> / {formatElapsed(targetMs)}</span>
          )}
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
      {progressPct != null && (
        <div className="h-1.5 bg-dark-300 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-yellow transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function Challenges() {
  const { user, refreshUser } = useAuthStore()
  const navigate = useNavigate()
  const dialog = useAppDialog()
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
  const timeCompleteLock = useRef(false)

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'workouts',
    goal: '',
    goalMode: 'quantity',
    exercises: [],
    resultTarget: '',
    startDate: '',
    endDate: '',
    reward: { xp: 0 },
    targetUsers: []
  })

  const [completionData, setCompletionData] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [sharingChallenge, setSharingChallenge] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [resultChallenge, setResultChallenge] = useState(null)
  const [resultInput, setResultInput] = useState('')
  const [resultExerciseInputs, setResultExerciseInputs] = useState({})
  const [exerciseInputs, setExerciseInputs] = useState({})
  const [submittingResult, setSubmittingResult] = useState(false)
  const [shareChallengeTarget, setShareChallengeTarget] = useState(null)

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
        const exercises = normalizeChallengeExercises(data.exercises || data.reward?.exercises)
        const nextInputs = {}
        for (const ex of exercises) {
          const done = participant.exerciseProgress?.[ex.id]
          nextInputs[ex.id] = done != null ? String(done) : ''
        }
        setExerciseInputs(nextInputs)
      } else {
        setExerciseInputs({})
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
    const ok = await dialog.confirm('¿Estás seguro de que quieres abandonar este reto?', {
      title: 'Abandonar reto',
      confirmLabel: 'Abandonar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    })
    if (!ok) return
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

    const exercises = normalizeChallengeExercises(
      selectedChallenge.exercises || selectedChallenge.reward?.exercises
    )
    const goal = Number(selectedChallenge.goal) || 0

    let payload = {}
    if (exercises.length) {
      const rawMap = {}
      for (const ex of exercises) {
        const v = parseFloat(exerciseInputs[ex.id])
        if (exerciseInputs[ex.id] === '' || Number.isNaN(v) || v < 0) {
          toast.error(`Ingresa un valor válido para ${ex.name}`)
          return
        }
        if (v > ex.targetReps) {
          toast.error(`${ex.name}: máximo ${ex.targetReps}`)
          return
        }
        rawMap[ex.id] = v
      }
      const { map, total } = clampExerciseProgress(exercises, rawMap)
      payload = { exerciseProgress: map, progress: Math.min(goal, total) }
    } else {
      const progress = parseFloat(progressInput)
      if (isNaN(progress) || progress < 0) {
        toast.error('Por favor ingresa un valor válido')
        return
      }
      if (progress > goal) {
        toast.error(`No puedes registrar más de ${goal}`)
        return
      }
      payload = { progress: Math.min(goal, progress) }
    }

    setUpdatingProgress(true)
    try {
      const { data } = await api.put(`/challenges/${selectedChallenge._id}/progress`, payload)
      toast.success(data.message || 'Progreso actualizado')

      if (data.autoPaused || data.canComplete) {
        setChallengeTimerActive(false)
      }

      if (data.challenge && data.challenge.participants) {
        setSelectedChallenge((prev) => ({
          ...prev,
          participants: data.challenge.participants,
          goal: data.challenge.goal
        }))
      } else if (data.participant) {
        setSelectedChallenge((prev) => ({
          ...prev,
          participants:
            prev.participants?.map((p) =>
              (p.user?._id || p.user) === user?._id ? { ...p, ...data.participant } : p
            ) || [data.participant]
        }))
      }

      if (exercises.length && data.participant?.exerciseProgress) {
        const next = {}
        for (const ex of exercises) {
          next[ex.id] = String(data.participant.exerciseProgress[ex.id] ?? 0)
        }
        setExerciseInputs(next)
      } else if (payload.progress != null) {
        setProgressInput(String(payload.progress))
      }

      fetchChallengeDetails(selectedChallenge._id)
      fetchMyChallenges()
      await refreshUser()

      if (data.canComplete) {
        toast.success('Objetivo alcanzado. Completa el reto para obtener XP', { duration: 4000 })
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al actualizar progreso')
    } finally {
      setUpdatingProgress(false)
    }
  }

  const openTimeResultModal = useCallback((challenge) => {
    if (!challenge) return
    setResultChallenge(challenge)
    setResultInput('')
    const exercises = normalizeChallengeExercises(challenge.exercises || challenge.reward?.exercises)
    const init = {}
    for (const ex of exercises) init[ex.id] = ''
    setResultExerciseInputs(init)
    setShowResultModal(true)
  }, [])

  const handleTimeTargetReached = useCallback(
    async (challenge) => {
      if (!challenge || timeCompleteLock.current) return
      timeCompleteLock.current = true
      try {
        setChallengeTimerActive(false)
        try {
          await api.post(`/challenges/${challenge._id}/pause`)
        } catch {
          /* may already be paused */
        }
        await fetchChallengeDetails(challenge._id)
        await fetchMyChallenges()
        openTimeResultModal(challenge)
        toast.success('¡Tiempo objetivo alcanzado! Registra tu resultado', { duration: 4000 })
      } finally {
        setTimeout(() => {
          timeCompleteLock.current = false
        }, 2000)
      }
    },
    [openTimeResultModal]
  )

  const applyCompletionSuccess = async (challenge, data) => {
    setChallengeTimerActive(false)
    celebration()
    setCompletionData({
      challengeId: challenge._id || challenge.id,
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      challengeType: challenge.type,
      challengeGoal: challenge.goal,
      challengeUnit: challenge.unit,
      goalMode: challenge.goalMode,
      endDate: challenge.endDate,
      participantsCount: challenge.participants?.length || 0,
      createdBy: challenge.createdBy,
      xpAwarded: data.xpAwarded,
      motivationalMessage: data.motivationalMessage,
      unlockedBadges: data.unlockedBadges || [],
      challengeBadge: data.challengeBadge,
      nextBadge: data.nextBadge,
      leveledUp: data.leveledUp,
      newLevel: data.newLevel,
      challengeData: data.challengeData,
      accumulatedMs: data.participant?.accumulatedMs || data.challengeData?.accumulatedMs || 0,
      resultValue: data.participant?.resultValue ?? data.challengeData?.resultValue ?? null,
      resultUnit: data.participant?.resultUnit ?? data.challengeData?.resultUnit ?? null
    })
    setShowCompletionModal(true)
    setShowResultModal(false)
    setResultChallenge(null)

    await Promise.all([
      fetchChallengeDetails(challenge._id || challenge.id),
      fetchMyChallenges(),
      refreshUser()
    ])
  }

  const handleSubmitTimeResult = async () => {
    const challenge = resultChallenge || selectedChallenge
    if (!challenge) return
    const exercises = normalizeChallengeExercises(challenge.exercises || challenge.reward?.exercises)
    const meta = getExerciseResultMeta(challenge.type, challenge.description)

    let body = { timeReached: true }

    if (exercises.length) {
      const rawMap = {}
      for (const ex of exercises) {
        const v = parseFloat(resultExerciseInputs[ex.id])
        if (resultExerciseInputs[ex.id] === '' || Number.isNaN(v) || v < 0) {
          toast.error(`Ingresa un valor para ${ex.name}`)
          return
        }
        if (v > ex.targetReps) {
          toast.error(`${ex.name}: máximo ${ex.targetReps}`)
          return
        }
        rawMap[ex.id] = v
      }
      const { map, total } = clampExerciseProgress(exercises, rawMap)
      body.exerciseProgress = map
      body.exerciseResult = total
      body.resultUnit = 'reps'
    } else {
      const value = parseFloat(resultInput)
      if (Number.isNaN(value) || value < 0) {
        toast.error('Ingresa un resultado válido')
        return
      }
      const maxResult = Number(challenge.reward?.resultTarget)
      if (Number.isFinite(maxResult) && maxResult > 0 && value > maxResult) {
        toast.error(`No puedes registrar más de ${maxResult}`)
        return
      }
      body.exerciseResult = value
      body.resultUnit = meta.unit
    }

    setSubmittingResult(true)
    try {
      const { data } = await api.post(`/challenges/${challenge._id}/complete`, body)
      await applyCompletionSuccess(challenge, data)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar reto')
    } finally {
      setSubmittingResult(false)
    }
  }

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

    if (isTimeGoalChallenge(selectedChallenge)) {
      const elapsed =
        (Number(participant.accumulatedMs) || 0) +
        (participant.status === 'active' && participant.startedAt
          ? Date.now() - new Date(participant.startedAt).getTime()
          : 0)
      if (elapsed < getTimeGoalMs(selectedChallenge) * 0.98) {
        toast.error('Aún no has alcanzado el tiempo objetivo')
        return
      }
      openTimeResultModal(selectedChallenge)
      return
    }

    if ((participant.progress || 0) < selectedChallenge.goal) {
      toast.error('Aún no has alcanzado el objetivo del reto')
      return
    }

    try {
      const { data } = await api.post(`/challenges/${selectedChallenge._id}/complete`)
      await applyCompletionSuccess(selectedChallenge, data)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar reto')
    }
  }

  const handleShareChallenge = async () => {
    if (!completionData) return
    setSharingChallenge(true)
    try {
      const payload = buildChallengeSharePayload(
        {
          _id: completionData.challengeId,
          title: completionData.challengeTitle,
          description: completionData.challengeDescription,
          type: completionData.challengeType,
          goal: completionData.challengeGoal,
          unit: completionData.challengeUnit,
          goalMode: completionData.goalMode,
          endDate: completionData.endDate,
          participants: { length: completionData.participantsCount },
          participantsCount: completionData.participantsCount,
          createdBy: completionData.createdBy,
          reward: { xp: completionData.xpAwarded }
        },
        {
          shareMode: 'completed',
          xpAwarded: completionData.xpAwarded,
          accumulatedMs: completionData.accumulatedMs,
          resultValue: completionData.resultValue,
          resultUnit: completionData.resultUnit
        }
      )
      await api.post('/social', payload)
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

  const openShareChallenge = (challenge, e) => {
    e?.stopPropagation?.()
    if (!challenge) return
    setShareChallengeTarget(challenge)
  }

  const handleCreateChallenge = async () => {
    const exercises = normalizeChallengeExercises(createForm.exercises)
    const isTime = createForm.goalMode === 'time'
    const quantityFromExercises = !isTime && exercises.length ? sumExerciseTargets(exercises) : 0
    const goalValue = isTime
      ? parseFloat(createForm.goal)
      : exercises.length
        ? quantityFromExercises
        : parseFloat(createForm.goal)

    if (!createForm.title || !createForm.type || !createForm.startDate || !createForm.endDate) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }
    if (!Number.isFinite(goalValue) || goalValue <= 0) {
      toast.error(
        exercises.length && !isTime
          ? 'Agrega ejercicios con repeticiones válidas'
          : 'Indica un objetivo válido'
      )
      return
    }
    if (isTime && !exercises.length) {
      const rt = parseFloat(createForm.resultTarget)
      if (!Number.isFinite(rt) || rt <= 0) {
        toast.error('Indica el objetivo a registrar al terminar el tiempo, o agrega ejercicios')
        return
      }
    }

    try {
      const xp = createForm.reward.xp || getDefaultXp(createForm.type)
      const typeInfo = getTypeInfo(createForm.type)
      const reward = {
        xp,
        goalMode: isTime ? 'time' : 'quantity',
        exercises
      }
      if (isTime && !exercises.length) {
        reward.resultTarget = parseFloat(createForm.resultTarget)
      }

      const challengeData = {
        title: createForm.title,
        description: createForm.description,
        type: createForm.type,
        goal: goalValue,
        goalMode: isTime ? 'time' : 'quantity',
        exercises,
        unit: isTime ? 'min' : typeInfo?.unit || undefined,
        startDate: new Date(createForm.startDate),
        endDate: new Date(createForm.endDate),
        reward,
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
        goalMode: 'quantity',
        exercises: [],
        resultTarget: '',
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
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-3xl">Retos</h1>
          <TutorialHelpButton
            tutorialId={TUTORIAL_IDS.CHALLENGES}
            message="Esta pantalla tiene un tutorial para crear, unirte y completar retos."
          />
        </div>
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
              const isTime = isTimeGoalChallenge(challenge)
              const timeTarget = isTime ? getTimeGoalMs(challenge) : 0
              const progressPercent = isTime
                ? Math.min(
                    100,
                    ((((Number(participant?.accumulatedMs) || 0) +
                      (participant?.status === 'active' && participant?.startedAt
                        ? Date.now() - new Date(participant.startedAt).getTime()
                        : 0)) /
                      (timeTarget || 1)) *
                      100)
                  )
                : challenge.goal
                  ? Math.min(100, (progress / challenge.goal) * 100)
                  : 0
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
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {typeInfo && <span className="text-lg">{typeInfo.icon}</span>}
                        <h3 className="font-display text-xl">{challenge.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                        {isTime && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-accent-cyan bg-accent-cyan/20">
                            Por tiempo
                          </span>
                        )}
                      </div>
                      <FormattedText text={challenge.description} className="text-gray-400 text-sm" />
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <div className="text-accent-yellow font-semibold">
                        +{challenge.reward?.xp || 100} XP
                      </div>
                      {completed && (
                        <div className="text-xs text-accent-green mt-1">✓ Completado</div>
                      )}
                    </div>
                  </div>

                  {participant && !completed && (participant.status === 'active' || participant.status === 'paused') && (
                    <div className="mb-3">
                      <ChallengeTimer
                        participant={participant}
                        targetMs={timeTarget}
                        onTargetReached={
                          isTime ? () => handleTimeTargetReached(challenge) : undefined
                        }
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{isTime ? 'Tiempo' : 'Progreso'}</span>
                      <span className="text-primary-500 font-semibold">
                        {isTime
                          ? formatChallengeGoal(challenge)
                          : `${progress} / ${challenge.goal}`}
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

                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
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
                    <div className="flex items-center gap-3">
                      {!completed && (
                        <button
                          data-tour="tour-challenge-invite"
                          onClick={(e) => openShareChallenge(challenge, e)}
                          className="text-primary-500 hover:text-primary-400 text-sm inline-flex items-center gap-1"
                        >
                          <FiShare2 size={14} />
                          Invitar
                        </button>
                      )}
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
                  <FormattedText text={challenge.description} className="text-gray-400 text-sm mb-2" />
                  <div className="mb-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-dark-200 px-2.5 py-1 text-gray-300">
                      {isTimeGoalChallenge(challenge) ? '⏱ ' : '🎯 '}
                      {formatChallengeGoal(challenge) || `${challenge.goal}`}
                    </span>
                    {isTimeGoalChallenge(challenge) && (
                      <span className="rounded-full bg-accent-cyan/20 px-2.5 py-1 text-accent-cyan">
                        Por tiempo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <FiUsers size={14} /> {challenge.participants?.length || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <FiClock size={14} />
                      {formatDistanceToNow(new Date(challenge.endDate), { addSuffix: true, locale: es })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      data-tour={i === 0 ? 'tour-challenge-join' : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJoinChallenge(challenge._id)
                      }}
                      className="btn-primary flex-1"
                    >
                      Unirse al Reto
                    </button>
                    <button
                      type="button"
                      data-tour={i === 0 ? 'tour-challenge-invite' : undefined}
                      onClick={(e) => openShareChallenge(challenge, e)}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      <FiShare2 size={16} />
                      Invitar
                    </button>
                  </div>
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

              <FormattedText text={selectedChallenge.description} className="text-gray-400 mb-4" />

              {normalizeChallengeExercises(
                selectedChallenge.exercises || selectedChallenge.reward?.exercises
              ).length > 0 && (
                <div className="mb-6 rounded-xl border border-app bg-elevated p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ejercicios del reto
                  </p>
                  <ul className="space-y-1.5">
                    {normalizeChallengeExercises(
                      selectedChallenge.exercises || selectedChallenge.reward?.exercises
                    ).map((ex) => (
                      <li key={ex.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-app">{ex.name}</span>
                        <span className="shrink-0 text-primary-500 font-semibold">
                          {ex.targetReps} reps
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(() => {
                const participant = getParticipant(selectedChallenge)
                const progress = participant?.progress || 0
                const completed = participant?.completed || false
                const isTime = isTimeGoalChallenge(selectedChallenge)
                const challengeExercises = normalizeChallengeExercises(
                  selectedChallenge.exercises || selectedChallenge.reward?.exercises
                )
                const timeTarget = isTime ? getTimeGoalMs(selectedChallenge) : 0
                const progressPercent = isTime
                  ? Math.min(
                      100,
                      ((((Number(participant?.accumulatedMs) || 0) +
                        (participant?.status === 'active' && participant?.startedAt
                          ? Date.now() - new Date(participant.startedAt).getTime()
                          : 0)) /
                        (timeTarget || 1)) *
                        100)
                    )
                  : selectedChallenge.goal
                    ? Math.min(100, (progress / selectedChallenge.goal) * 100)
                    : 0
                const participantStatus = participant?.status || 'joined'
                const isActive = participantStatus === 'active'
                const isPaused = participantStatus === 'paused'
                const isJoined = participantStatus === 'joined'
                const progressChanged = challengeExercises.length
                  ? challengeExercises.some((ex) => {
                      const prev = String(participant?.exerciseProgress?.[ex.id] ?? 0)
                      const cur = exerciseInputs[ex.id] === '' ? '' : String(exerciseInputs[ex.id] ?? '')
                      return cur !== '' && cur !== prev
                    })
                  : progressInput !== (participant?.progress?.toString() || '0')
                const timeReached =
                  isTime &&
                  participant &&
                  ((Number(participant.accumulatedMs) || 0) +
                    (isActive && participant.startedAt
                      ? Date.now() - new Date(participant.startedAt).getTime()
                      : 0)) >=
                    timeTarget * 0.98
                const canFinishQuantity =
                  !isTime && progress >= selectedChallenge.goal && !completed

                return (
                  <>
                    {/* Session Timer + Status */}
                    {participant && !completed && (
                      <div className="mb-6 p-4 rounded-xl bg-dark-200">
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-300">Estado:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabel(participantStatus).color}`}>
                              {statusLabel(participantStatus).text}
                            </span>
                            {isTime && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium text-accent-cyan bg-accent-cyan/20">
                                Objetivo: {formatChallengeGoal(selectedChallenge)}
                              </span>
                            )}
                          </div>
                          {(isActive || isPaused) && (
                            <ChallengeTimer
                              participant={participant}
                              targetMs={timeTarget}
                              onTargetReached={
                                isTime
                                  ? () => handleTimeTargetReached(selectedChallenge)
                                  : undefined
                              }
                            />
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {isJoined && (
                            <button
                              data-tour="tour-challenge-start"
                              onClick={() => handleStartChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-primary flex-1 flex items-center justify-center gap-2 min-w-[140px]"
                            >
                              <FiPlay size={16} />
                              {sessionLoading ? 'Iniciando...' : 'Iniciar Reto'}
                            </button>
                          )}
                          {isActive && !isTime && (
                            <button
                              onClick={() => handlePauseChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-secondary flex-1 flex items-center justify-center gap-2 min-w-[140px]"
                            >
                              <FiPause size={16} />
                              {sessionLoading ? 'Pausando...' : 'Pausar Reto'}
                            </button>
                          )}
                          {isActive && isTime && (
                            <button
                              onClick={() => handlePauseChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-secondary flex-1 flex items-center justify-center gap-2 min-w-[140px]"
                            >
                              <FiPause size={16} />
                              {sessionLoading ? 'Pausando...' : 'Pausar'}
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => handleResumeChallenge(selectedChallenge._id)}
                              disabled={sessionLoading}
                              className="btn-primary flex-1 flex items-center justify-center gap-2 min-w-[140px]"
                            >
                              <FiPlay size={16} />
                              {sessionLoading ? 'Reanudando...' : 'Reanudar Reto'}
                            </button>
                          )}
                        </div>
                        {isTime && (
                          <p className="mt-3 text-xs text-gray-400">
                            El cronómetro cuenta hasta el tiempo objetivo. Al llegar se pausa y registrarás cada ejercicio (sin superar su objetivo).
                          </p>
                        )}
                      </div>
                    )}

                    {/* Progress Section */}
                    {participant && (
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-400">{isTime ? 'Progreso de tiempo' : 'Tu Progreso'}</span>
                          <span className="font-semibold text-primary-500">
                            {isTime
                              ? formatChallengeGoal(selectedChallenge)
                              : `${progress} / ${selectedChallenge.goal}`}
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

                        {!completed && !isTime && (
                          <div data-tour="tour-challenge-progress" className="space-y-3">
                            <label className="block text-sm font-medium text-gray-400">
                              Actualizar Progreso
                            </label>
                            {challengeExercises.length > 0 ? (
                              <div className="space-y-2">
                                {challengeExercises.map((ex) => (
                                  <div
                                    key={ex.id}
                                    className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-app truncate">{ex.name}</p>
                                      <p className="text-[11px] text-gray-500">Máx. {ex.targetReps} reps</p>
                                    </div>
                                    <input
                                      type="number"
                                      value={exerciseInputs[ex.id] ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        if (
                                          val === '' ||
                                          (parseFloat(val) >= 0 && parseFloat(val) <= ex.targetReps)
                                        ) {
                                          setExerciseInputs((prev) => ({ ...prev, [ex.id]: val }))
                                        }
                                      }}
                                      placeholder="0"
                                      className="input-field w-full sm:w-28 text-center font-semibold"
                                      min="0"
                                      max={ex.targetReps}
                                      disabled={!isActive}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={progressInput}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (
                                      val === '' ||
                                      (parseFloat(val) >= 0 &&
                                        parseFloat(val) <= selectedChallenge.goal)
                                    ) {
                                      setProgressInput(val)
                                    }
                                  }}
                                  placeholder="0"
                                  className="input-field flex-1 text-center font-semibold"
                                  min="0"
                                  max={selectedChallenge.goal}
                                  disabled={!isActive}
                                />
                              </div>
                            )}
                            <button
                              onClick={handleUpdateProgress}
                              disabled={updatingProgress || !isActive || !progressChanged}
                              className="btn-primary w-full flex items-center justify-center gap-2 px-4 disabled:opacity-40"
                            >
                              <FiEdit2 size={18} />
                              {updatingProgress ? 'Actualizando...' : 'Actualizar'}
                            </button>
                            {!isActive && !completed && (
                              <p className="text-xs text-yellow-400 flex items-center gap-1">
                                <FiPlay size={12} />
                                {canFinishQuantity
                                  ? 'Objetivo alcanzado. Completa el reto para obtener XP'
                                  : 'Inicia el reto para actualizar progreso'}
                              </p>
                            )}
                          </div>
                        )}
                        {completed && (
                          <p className="text-xs text-accent-green flex items-center gap-1">
                            <FiCheck size={14} />
                            Reto completado
                            {participant.resultValue != null && (
                              <span className="text-gray-400">
                                · Resultado: {participant.resultValue} {participant.resultUnit || ''}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                          {!completed && (
                            <button
                              type="button"
                              data-tour="tour-challenge-invite"
                              onClick={(e) => openShareChallenge(selectedChallenge, e)}
                              className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiShare2 size={18} />
                              Invitar
                            </button>
                          )}
                          {!isTime && canFinishQuantity && (
                            <button
                              data-tour="tour-challenge-complete"
                              onClick={handleComplete}
                              className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiCheck size={18} />
                              Completar y Obtener XP
                            </button>
                          )}
                          {isTime && timeReached && !completed && (
                            <button
                              data-tour="tour-challenge-complete"
                              onClick={() => openTimeResultModal(selectedChallenge)}
                              className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                              <FiCheck size={18} />
                              Registrar resultado y completar
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
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <button
                            onClick={handleJoinChallenge.bind(null, selectedChallenge._id)}
                            className="btn-primary flex-1"
                          >
                            Unirse al Reto
                          </button>
                          <button
                            type="button"
                            data-tour="tour-challenge-invite"
                            onClick={(e) => openShareChallenge(selectedChallenge, e)}
                            className="btn-secondary flex-1 flex items-center justify-center gap-2"
                          >
                            <FiShare2 size={16} />
                            Invitar
                          </button>
                        </div>
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
                                      {isTime
                                        ? formatElapsed(p.accumulatedMs || 0)
                                        : `${p.progress || 0} / ${selectedChallenge.goal}`}
                                    </div>
                                    {!isTime && (
                                      <div className="text-xs text-gray-400">
                                        {Math.round(((p.progress || 0) / selectedChallenge.goal) * 100)}%
                                      </div>
                                    )}
                                    {p.resultValue != null && (
                                      <div className="text-xs text-gray-400">
                                        {p.resultValue} {p.resultUnit || ''}
                                      </div>
                                    )}
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
                  <label className="block text-sm font-medium mb-2">Tipo de objetivo *</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, goalMode: 'quantity' })}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        createForm.goalMode === 'quantity'
                          ? 'bg-primary-500/15 border border-primary-500/50 text-white'
                          : 'bg-dark-200 border border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Cantidad
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, goalMode: 'time' })}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        createForm.goalMode === 'time'
                          ? 'bg-primary-500/15 border border-primary-500/50 text-white'
                          : 'bg-dark-200 border border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Tiempo (cronómetro)
                    </button>
                  </div>
                  {createForm.goalMode === 'time' && (
                    <>
                      <label className="block text-sm font-medium mb-2">Tiempo objetivo (minutos) *</label>
                      <input
                        type="number"
                        value={createForm.goal}
                        onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
                        className="input-field w-full"
                        placeholder="Ej: 20"
                        min="1"
                        step="1"
                      />
                    </>
                  )}
                  {createForm.goalMode === 'quantity' && createForm.exercises.length === 0 && (
                    <>
                      <label className="block text-sm font-medium mb-2">Objetivo *</label>
                      <input
                        type="number"
                        value={createForm.goal}
                        onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
                        className="input-field w-full"
                        placeholder="Ej: 30"
                        min="1"
                        step="any"
                      />
                    </>
                  )}
                  {createForm.goalMode === 'quantity' && createForm.exercises.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Objetivo total: {sumExerciseTargets(createForm.exercises)} reps (suma de ejercicios)
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium">Ejercicios</label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary-500"
                      onClick={() =>
                        setCreateForm({
                          ...createForm,
                          exercises: [
                            ...createForm.exercises,
                            { id: `ex-${Date.now()}`, name: '', targetReps: '' }
                          ]
                        })
                      }
                    >
                      + Agregar
                    </button>
                  </div>
                  {createForm.exercises.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Opcional. Si agregas ejercicios, el avance pedirá un valor por cada uno.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {createForm.exercises.map((ex, idx) => (
                        <div key={ex.id || idx} className="flex gap-2 items-start">
                          <input
                            type="text"
                            value={ex.name}
                            onChange={(e) => {
                              const next = [...createForm.exercises]
                              next[idx] = { ...next[idx], name: e.target.value }
                              setCreateForm({ ...createForm, exercises: next })
                            }}
                            className="input-field flex-1"
                            placeholder="Ejercicio"
                          />
                          <input
                            type="number"
                            value={ex.targetReps}
                            onChange={(e) => {
                              const next = [...createForm.exercises]
                              next[idx] = { ...next[idx], targetReps: e.target.value }
                              setCreateForm({ ...createForm, exercises: next })
                            }}
                            className="input-field w-24 text-center"
                            placeholder="Reps"
                            min="1"
                          />
                          <button
                            type="button"
                            className="p-2 rounded-lg hover:bg-dark-200 text-gray-400"
                            onClick={() =>
                              setCreateForm({
                                ...createForm,
                                exercises: createForm.exercises.filter((_, i) => i !== idx)
                              })
                            }
                            aria-label="Quitar ejercicio"
                          >
                            <FiX size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {createForm.goalMode === 'time' && createForm.exercises.length === 0 && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium mb-2">
                        Objetivo a registrar al terminar *
                      </label>
                      <input
                        type="number"
                        value={createForm.resultTarget}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, resultTarget: e.target.value })
                        }
                        className="input-field w-full"
                        placeholder="Ej: 50"
                        min="1"
                      />
                    </div>
                  )}
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

      {/* Time-goal: register exercise result */}
      <AnimatePresence>
        {showResultModal && resultChallenge && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-md w-full"
            >
              {(() => {
                const meta = getExerciseResultMeta(resultChallenge.type, resultChallenge.description)
                const exercises = normalizeChallengeExercises(
                  resultChallenge.exercises || resultChallenge.reward?.exercises
                )
                const maxSingle = Number(resultChallenge.reward?.resultTarget)
                return (
                  <>
                    <div className="mb-5 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/20 text-primary-500">
                        <FiClock size={28} />
                      </div>
                      <h2 className="font-display text-2xl mb-1">Registrar resultado</h2>
                      <p className="text-sm text-gray-400">
                        Completaste el tiempo de{' '}
                        <span className="text-primary-500 font-semibold">
                          {formatChallengeGoal(resultChallenge)}
                        </span>
                        . Puedes registrar menos del objetivo, nunca más.
                      </p>
                    </div>

                    {exercises.length > 0 ? (
                      <div className="space-y-3 mb-5">
                        {exercises.map((ex) => (
                          <div key={ex.id}>
                            <label className="block text-sm font-medium mb-1">
                              {ex.name}{' '}
                              <span className="text-gray-500 font-normal">(máx. {ex.targetReps})</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={ex.targetReps}
                              value={resultExerciseInputs[ex.id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                if (
                                  val === '' ||
                                  (parseFloat(val) >= 0 && parseFloat(val) <= ex.targetReps)
                                ) {
                                  setResultExerciseInputs((prev) => ({ ...prev, [ex.id]: val }))
                                }
                              }}
                              className="input-field w-full text-center text-lg font-semibold"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <label className="block text-sm font-medium mb-2">{meta.label}</label>
                        <input
                          type="number"
                          inputMode={meta.inputMode}
                          step={meta.step}
                          min="0"
                          max={Number.isFinite(maxSingle) && maxSingle > 0 ? maxSingle : undefined}
                          value={resultInput}
                          onChange={(e) => {
                            const val = e.target.value
                            if (
                              val === '' ||
                              (parseFloat(val) >= 0 &&
                                (!Number.isFinite(maxSingle) ||
                                  maxSingle <= 0 ||
                                  parseFloat(val) <= maxSingle))
                            ) {
                              setResultInput(val)
                            }
                          }}
                          placeholder={meta.placeholder}
                          className="input-field w-full text-center text-lg font-semibold mb-2"
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 mb-5">
                          Unidad: {meta.unit}
                          {Number.isFinite(maxSingle) && maxSingle > 0
                            ? ` · Máximo ${maxSingle}`
                            : ''}
                        </p>
                      </>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-2">
                      <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={() => {
                          setShowResultModal(false)
                          setResultChallenge(null)
                        }}
                      >
                        Más tarde
                      </button>
                      <button
                        type="button"
                        className="btn-primary flex-1"
                        disabled={submittingResult}
                        onClick={handleSubmitTimeResult}
                      >
                        {submittingResult ? 'Completando...' : 'Completar reto'}
                      </button>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ShareChallengeSheet
        open={Boolean(shareChallengeTarget)}
        challenge={shareChallengeTarget}
        onClose={() => setShareChallengeTarget(null)}
      />
    </div>
  )
}
