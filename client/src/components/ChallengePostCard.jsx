import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiTarget, FiUsers, FiClock, FiAward, FiX, FiTrendingUp, FiCheck } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Avatar } from '../utils/avatarUtils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  formatChallengeGoal,
  formatElapsed,
  isTimeGoalChallenge
} from '../utils/challengeUtils'
import { useAuthStore } from '../store/authStore'

/**
 * Community feed card for shared challenges (invite or completed).
 * Mirrors challenge structure + "Ver participantes".
 */
export default function ChallengePostCard({ data, className = '' }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [showParticipants, setShowParticipants] = useState(false)
  const [participants, setParticipants] = useState([])
  const [challengeDetail, setChallengeDetail] = useState(null)
  const [loadingParts, setLoadingParts] = useState(false)
  const [joining, setJoining] = useState(false)

  if (!data) return null

  const isInvite = data.shareMode !== 'completed'
  const isTime = isTimeGoalChallenge(data)
  const goalLabel = formatChallengeGoal(data)
  const endDate = data.challengeEndDate || data.endDate
  const expired = endDate ? new Date(endDate) < new Date() : false

  const openParticipants = async (e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    if (!data.challengeId) {
      toast.error('No se pueden cargar los participantes de este reto')
      return
    }
    setShowParticipants(true)
    setLoadingParts(true)
    try {
      const { data: detail } = await api.get(`/challenges/${data.challengeId}`)
      setChallengeDetail(detail)
      setParticipants(detail.participants || [])
    } catch {
      toast.error('Error al cargar participantes')
      setShowParticipants(false)
    } finally {
      setLoadingParts(false)
    }
  }

  const handleJoin = async (e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    if (!data.challengeId || expired) return
    setJoining(true)
    try {
      await api.post(`/challenges/${data.challengeId}/join`)
      toast.success('¡Te has unido al reto!')
      navigate('/challenges')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo unir al reto')
    } finally {
      setJoining(false)
    }
  }

  const goToChallenge = (e) => {
    e?.stopPropagation?.()
    navigate('/challenges')
  }

  const statusLabel = (status) => {
    switch (status) {
      case 'joined':
        return { text: 'Unido', color: 'text-gray-400 bg-gray-500/20' }
      case 'active':
        return { text: 'Activo', color: 'text-accent-green bg-accent-green/20' }
      case 'paused':
        return { text: 'Pausado', color: 'text-yellow-400 bg-yellow-500/20' }
      case 'completed':
        return { text: 'Completado', color: 'text-accent-green bg-accent-green/20' }
      default:
        return { text: status || '—', color: 'text-gray-400 bg-gray-500/20' }
    }
  }

  return (
    <>
      <div
        data-no-post-open
        className={`overflow-hidden rounded-2xl border border-accent-yellow/30 bg-gradient-to-br from-accent-yellow/10 to-orange-500/10 p-4 ${className}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-accent-yellow">
            <FiTarget size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              {isInvite ? 'Reto · Comunidad' : 'Reto completado'}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-accent-yellow/20 px-2.5 py-0.5 text-xs font-semibold text-accent-yellow">
            +{data.rewardXp || data.xpAwarded || 100} XP
          </span>
        </div>

        <h4 className="font-display text-xl text-app leading-tight">
          {data.challengeTitle || data.name || 'Reto'}
        </h4>

        {data.challengeDescription ? (
          <p className="mt-1.5 text-sm text-app-secondary line-clamp-3">
            {data.challengeDescription}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-app bg-elevated p-2.5 text-center">
            <p className="text-sm font-semibold text-app truncate">{goalLabel || '—'}</p>
            <p className="text-[10px] text-app-secondary">
              {isTime ? 'Tiempo objetivo' : 'Objetivo'}
            </p>
          </div>
          <div className="rounded-xl border border-app bg-elevated p-2.5 text-center">
            <p className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-app">
              <FiUsers size={12} className="text-primary-500" />
              {data.participantsCount ?? '—'}
            </p>
            <p className="text-[10px] text-app-secondary">Participantes</p>
          </div>
          {endDate && (
            <div className="col-span-2 rounded-xl border border-app bg-elevated p-2.5 text-center sm:col-span-1">
              <p className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-app">
                <FiClock size={12} className="text-primary-500" />
                {expired
                  ? 'Caducado'
                  : formatDistanceToNow(new Date(endDate), { addSuffix: true, locale: es })}
              </p>
              <p className="text-[10px] text-app-secondary">Vence</p>
            </div>
          )}
        </div>

        {!isInvite && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-app-secondary">
            {data.accumulatedMs > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-elevated border border-app px-2 py-1">
                <FiClock size={12} /> {formatElapsed(data.accumulatedMs)}
              </span>
            )}
            {data.resultValue != null && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-elevated border border-app px-2 py-1">
                <FiCheck size={12} className="text-accent-green" />
                {data.resultValue} {data.resultUnit || ''}
              </span>
            )}
            {data.xpAwarded != null && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-elevated border border-app px-2 py-1 text-accent-yellow">
                <FiAward size={12} /> +{data.xpAwarded} XP
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={openParticipants}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
          >
            <FiUsers size={15} />
            Ver participantes
          </button>
          {isInvite && !expired && data.challengeId && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
            >
              {joining ? 'Uniéndote...' : 'Unirse al reto'}
            </button>
          )}
          {!isInvite && (
            <button
              type="button"
              onClick={goToChallenge}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
            >
              <FiTarget size={15} />
              Ver retos
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showParticipants && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={() => setShowParticipants(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-app bg-elevated sm:rounded-2xl"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between border-b border-app px-4 py-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl flex items-center gap-2 truncate">
                    <FiTrendingUp className="text-primary-500 shrink-0" />
                    Participantes
                  </h3>
                  <p className="text-xs text-app-secondary truncate">
                    {data.challengeTitle || challengeDetail?.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParticipants(false)}
                  className="p-2 rounded-lg hover:bg-dark-200"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingParts ? (
                  <div className="flex justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-dark-100 border-t-primary-500" />
                  </div>
                ) : participants.length === 0 ? (
                  <div className="py-10 text-center text-app-secondary">
                    <FiUsers size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No hay participantes aún</p>
                  </div>
                ) : (
                  [...participants]
                    .filter((p) => p.user)
                    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
                    .map((p, index) => {
                      const participantUser = typeof p.user === 'object' ? p.user : null
                      const userId = participantUser?._id || participantUser?.id || p.user
                      const isCurrentUser = String(userId) === String(user?._id || user?.id)
                      const st = statusLabel(p.status)
                      const goal = challengeDetail?.goal ?? data.challengeGoal

                      return (
                        <div
                          key={userId || index}
                          className={`flex items-center gap-3 rounded-xl p-3 ${
                            isCurrentUser
                              ? 'bg-primary-500/10 ring-1 ring-primary-500'
                              : 'bg-dark-200'
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              index === 0
                                ? 'bg-yellow-500 text-black'
                                : index === 1
                                  ? 'bg-gray-400 text-black'
                                  : index === 2
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-dark-300 text-gray-400'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <Avatar
                            avatar={participantUser?.avatar}
                            name={participantUser?.name || 'Usuario'}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {participantUser?.name || 'Usuario'}
                            </div>
                            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.color}`}>
                              {st.text}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold text-primary-500 text-sm">
                              {p.progress || 0}
                              {goal != null ? ` / ${goal}` : ''}
                            </div>
                            {p.resultValue != null && (
                              <div className="text-[10px] text-app-secondary">
                                {p.resultValue} {p.resultUnit || ''}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
