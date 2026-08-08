import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowLeft, FiShare2, FiClock, FiCheck, FiTarget, FiZap, FiX } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import { buildChallengeSharePayload } from '../../utils/challengeUtils'

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MyChallenges() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get('/challenges/my')
        const uid = user?._id || user?.id
        const completed = (data || []).filter((c) => {
          const participant = c.participants?.find(
            (p) => (p.user?._id || p.user) === uid
          )
          return participant?.completed || participant?.status === 'completed'
        })
        setChallenges(completed)
      } catch {
        toast.error('No se pudieron cargar tus retos')
      } finally {
        setLoading(false)
      }
    })()
  }, [user?._id, user?.id])

  const getParticipant = (challenge) => {
    const uid = user?._id || user?.id
    return challenge.participants?.find((p) => (p.user?._id || p.user) === uid)
  }

  const shareChallenge = async (challenge) => {
    setSharing(true)
    const participant = getParticipant(challenge)
    try {
      const payload = buildChallengeSharePayload(challenge, {
        shareMode: 'completed',
        xpAwarded: challenge.reward?.xp || 100,
        accumulatedMs: participant?.accumulatedMs || 0,
        resultValue: participant?.resultValue,
        resultUnit: participant?.resultUnit
      })
      await api.post('/social', payload)
      toast.success('Compartido en Comunidad')
      setSelected(null)
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
          <h1 className="font-display text-3xl text-white sm:text-4xl">Mis retos</h1>
          <p className="text-sm text-gray-400">Historial de retos que ya completaste</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-dark-100 border-t-primary-500" />
        </div>
      ) : challenges.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="mb-3 text-5xl">🎯</p>
          <p className="text-gray-300">Aún no has completado retos</p>
          <Link to="/challenges" className="btn-primary mt-5 inline-flex px-5 py-2.5 text-sm">
            Explorar retos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c, i) => {
            const participant = getParticipant(c)
            return (
              <motion.button
                key={c._id || c.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
                onClick={() => setSelected(c)}
                className="card flex w-full items-center gap-3 p-4 text-left active:scale-[0.99] sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-500/15 text-primary-400">
                  <FiTarget size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{c.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Meta: {c.goal}
                    {c.unit ? ` ${c.unit}` : ''}
                    {' · '}
                    +{c.reward?.xp || 0} XP
                    {participant?.completedAt
                      ? ` · ${format(parseISO(participant.completedAt), 'd MMM yyyy', { locale: es })}`
                      : ''}
                  </p>
                </div>
                <FiCheck className="shrink-0 text-accent-green" />
              </motion.button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5 pb-24 sm:rounded-3xl sm:p-6 sm:pb-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--text-muted)]">
                    Reto completado
                  </p>
                  <h2 className="font-display truncate text-2xl text-[color:var(--text-primary)]">
                    {selected.title}
                  </h2>
                  {selected.description && (
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                      {selected.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl bg-[color:var(--bg-muted)] p-2 text-[color:var(--text-secondary)]"
                >
                  <FiX size={18} />
                </button>
              </div>

              {(() => {
                const p = getParticipant(selected)
                return (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      {
                        icon: FiTarget,
                        label: 'Objetivo',
                        value: `${selected.goal}${selected.unit ? ` ${selected.unit}` : ''}`
                      },
                      {
                        icon: FiZap,
                        label: 'XP',
                        value: `+${selected.reward?.xp || 0}`
                      },
                      {
                        icon: FiClock,
                        label: 'Tiempo',
                        value: formatElapsed(p?.accumulatedMs)
                      }
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl bg-[color:var(--bg-muted)] p-3 text-center"
                      >
                        <stat.icon className="mx-auto text-[color:var(--color-primary)]" size={16} />
                        <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                          {stat.value}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="mt-4 rounded-2xl bg-[color:var(--bg-muted)] p-4 text-sm text-[color:var(--text-secondary)]">
                <p>
                  <span className="text-[color:var(--text-muted)]">Tipo:</span> {selected.type}
                </p>
                {selected.createdBy?.name && (
                  <p className="mt-1">
                    <span className="text-[color:var(--text-muted)]">Creador:</span>{' '}
                    {selected.createdBy.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={sharing}
                onClick={() => shareChallenge(selected)}
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
