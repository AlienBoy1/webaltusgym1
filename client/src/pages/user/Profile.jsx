import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiEdit2, FiCamera, FiBell, FiShield, FiHelpCircle, FiLogOut, FiChevronRight, FiSettings, FiMessageCircle, FiCalendar, FiTarget, FiAward, FiZap, FiDollarSign, FiClock, FiCheck, FiX, FiGift, FiActivity, FiShare2, FiEye, FiTrash2 } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import AvatarPicker from '../../components/AvatarPicker'
import CoverPicker from '../../components/CoverPicker'
import BadgesModal from '../../components/BadgesModal'
import StoryHighlights from '../../components/StoryHighlights'
import ProfileAvatar from '../../components/ProfileAvatar'
import ShareProfileSheet from '../../components/ShareProfileSheet'
import { Avatar } from '../../utils/avatarUtils'
import { useStoryViewer } from '../../components/StoryViewerContext'
import ProtectedMedia from '../../components/ProtectedMedia'
import { openTutorialHub } from '../../components/AppTutorial'
import {
  FEATURE_LABELS,
  FREE_ERA_END_ISO,
  displayFeatures,
  formatMembershipDate,
  freeEraEndLabel,
  membershipStatusLabel,
  paidEraStartLabel
} from '../../utils/membershipLifecycle'

const menuItems = [
  { icon: FiActivity, label: 'Mis entrenamientos', to: '/my-workouts' },
  { icon: FiTarget, label: 'Mis retos', to: '/my-challenges' },
  { icon: FiSettings, label: 'Configuración', to: '/settings' },
  { icon: FiBell, label: 'Notificaciones', to: '/notifications', badge: true },
  { icon: FiMessageCircle, label: 'Mensajes', to: '/chat' },
  { icon: FiCalendar, label: 'Clases', to: '/classes' },
  { icon: FiTarget, label: 'Retos', to: '/challenges' },
  { icon: FiShield, label: 'Seguridad', to: '/settings' },
  { icon: FiHelpCircle, label: 'Ayuda y Soporte', to: '#' },
]

function MembershipSection({ user }) {
  const [memberships, setMemberships] = useState([])
  const [currentMembership, setCurrentMembership] = useState(null)
  const [showAllMemberships, setShowAllMemberships] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?._id || user?.id) {
      fetchMemberships()
    }
  }, [user?._id, user?.id, user?.membership?.plan])

  const fetchMemberships = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/users/memberships')
      setMemberships(data || [])
      const current = data?.find((m) => m.plan === user?.membership?.plan)
      setCurrentMembership(current)
    } catch (error) {
      console.error('Error fetching memberships:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card"
      >
        <div className="py-4 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-primary-500" />
        </div>
      </motion.div>
    )
  }

  const status = user?.membership?.status || 'active'
  const endLabel = formatMembershipDate(user?.membership?.endDate || FREE_ERA_END_ISO)
  const isLegacy = user?.membership?.era !== 'paid' && user?.membership?.__paidEra !== true

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card overflow-hidden"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl flex items-center gap-2">
            <FiAward className="text-accent-cyan" />
            Mi Membresía
          </h2>
          <button
            type="button"
            onClick={() => setShowAllMemberships(true)}
            className="text-sm font-medium text-primary-500 hover:text-primary-400"
          >
            Ver planes
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/70 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-lg">
                {currentMembership?.name || `Plan ${user?.membership?.plan?.toUpperCase() || 'Básico'}`}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  status === 'active'
                    ? 'bg-accent-green/20 text-accent-green'
                    : status === 'expiring'
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : 'bg-red-500/20 text-red-500'
                }`}
              >
                {membershipStatusLabel(status)}
              </span>
            </div>

            {isLegacy && (
              <p className="mb-3 rounded-xl border border-[rgba(var(--color-primary-rgb),0.25)] bg-[rgba(var(--color-primary-rgb),0.08)] px-3 py-2 text-xs leading-relaxed text-[color:var(--text-secondary)]">
                Membresía gratuita de transición. Vence el <strong className="text-[color:var(--text-primary)]">{freeEraEndLabel()}</strong>.
                Los planes de pago se habilitan el {paidEraStartLabel()}.
              </p>
            )}

            {currentMembership && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Number(currentMembership.price) > 0 ? (
                    <div className="flex items-center gap-1">
                      <FiDollarSign size={14} />
                      ${currentMembership.price}
                    </div>
                  ) : (
                    <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-xs font-semibold text-accent-green">
                      Periodo gratuito
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <FiClock size={14} />
                    {currentMembership.duration} días
                  </div>
                </div>

                {currentMembership.description && (
                  <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {currentMembership.description}
                  </p>
                )}

                {currentMembership.benefits?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Beneficios
                    </div>
                    <div className="space-y-1">
                      {currentMembership.benefits.map((benefit, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <FiCheck size={14} className="flex-shrink-0 text-accent-green" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div
              className="mt-4 border-t border-[color:var(--border-subtle)] pt-4 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              {endLabel ? `Vence: ${endLabel}` : 'Sin fecha de vencimiento'}
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAllMemberships && (
          <div className="app-overlay-sheet fixed inset-0 z-[120] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="app-bottom-sheet-panel max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] p-5 sm:rounded-3xl"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl tracking-wide">Planes Qyntra</h2>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Gratuitos hasta {freeEraEndLabel()} · Pago desde {paidEraStartLabel()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllMemberships(false)}
                  className="rounded-lg p-2 transition-colors hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={22} />
                </button>
              </div>

              <div className="space-y-3">
                {memberships.map((membership) => {
                  const isCurrent = membership.plan === user?.membership?.plan
                  const features = displayFeatures(membership.features)
                  return (
                    <div
                      key={membership._id || membership.plan}
                      className={`rounded-2xl border-2 p-4 ${
                        isCurrent
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/50'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-lg">{membership.name}</h3>
                            {isCurrent && (
                              <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-xs text-primary-500">
                                Actual
                              </span>
                            )}
                            {membership.comingSoon && (
                              <span className="rounded-full bg-accent-cyan/15 px-2 py-0.5 text-xs font-semibold text-accent-cyan">
                                Desde 1 ene 2027
                              </span>
                            )}
                            {membership.isLegacyFree && (
                              <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-500">
                                Transición gratuita
                              </span>
                            )}
                          </div>
                          {membership.description && (
                            <p className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {membership.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {Number(membership.price) > 0 ? (
                            <>
                              <div className="text-2xl font-bold text-primary-500">${membership.price}</div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                / {membership.duration} días
                              </div>
                            </>
                          ) : (
                            <div className="text-sm font-semibold text-accent-green">Gratis</div>
                          )}
                        </div>
                      </div>

                      {membership.benefits?.length > 0 && (
                        <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {membership.benefits.map((benefit, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <FiCheck size={12} className="flex-shrink-0 text-accent-green" />
                              <span>{benefit}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {Object.keys(features).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--border-subtle)] pt-3 text-xs">
                          {Object.entries(features).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              {value ? (
                                <FiCheck size={12} className="text-accent-green" />
                              ) : (
                                <FiX size={12} style={{ color: 'var(--text-muted)' }} />
                              )}
                              <span style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                {FEATURE_LABELS[key] || key}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div
                className="mt-6 border-t border-[color:var(--border-subtle)] pt-5 text-center text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <p>Los pagos se gestionarán en la app a partir de 2027. Mientras tanto, tu acceso gratuito sigue activo hasta la fecha indicada.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function formatChallengeTime(ms) {
  const totalSec = Math.floor((ms || 0) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function MyChallengesSection() {
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [sharing, setSharing] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get('/challenges/my')
        const completed = (data || []).filter(c => {
          const participant = c.participants?.find(p =>
            (p.user?._id || p.user) === user?._id
          )
          return participant?.completed
        })
        setChallenges(completed)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    })()
  }, [user?._id])

  const shareChallenge = async (challenge) => {
    setSharing(true)
    const participant = challenge.participants?.find(p =>
      (p.user?._id || p.user) === user?._id
    )
    try {
      await api.post('/social', {
        content: `¡Completé el reto "${challenge.title}"! 🏆`,
        postType: 'challenge',
        workoutData: {
          shareKind: 'challenge',
          challengeTitle: challenge.title,
          challengeType: challenge.type,
          challengeGoal: challenge.goal,
          challengeUnit: challenge.unit,
          xpAwarded: challenge.reward?.xp || 100,
          accumulatedMs: participant?.accumulatedMs || 0
        }
      })
      toast.success('Compartido en Comunidad')
      setSelected(null)
      navigate('/social')
    } catch {
      toast.error('No se pudo compartir')
    } finally {
      setSharing(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="card"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl flex items-center gap-2">
          <FiTarget className="text-primary-500" />
          Mis Retos
        </h2>
        <Link
          to="/my-challenges"
          className="text-primary-500 hover:text-primary-400 text-sm"
        >
          Ver todos
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-[color:var(--border-subtle)] border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : challenges.length === 0 ? (
        <div className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
          <FiTarget size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aún no has completado retos</p>
          <Link to="/challenges" className="btn-primary mt-3 inline-flex px-4 py-2 text-sm">
            Ver Retos
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {challenges.slice(0, 5).map((challenge, i) => {
            const participant = challenge.participants?.find(p =>
              (p.user?._id || p.user) === user?._id
            )
            return (
              <motion.button
                key={challenge._id || challenge.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelected(challenge)}
                className="flex w-full items-center gap-3 rounded-xl bg-[color:var(--bg-muted)] p-3 text-left transition-colors hover:bg-[color:var(--bg-elevated)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green">
                  <FiCheck size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{challenge.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {challenge.goal} {challenge.unit || 'meta'} · +{challenge.reward?.xp || 100} XP
                    {participant?.accumulatedMs > 0 && ` · ${formatChallengeTime(participant.accumulatedMs)}`}
                  </p>
                </div>
                <FiChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </motion.button>
            )
          })}
          {challenges.length > 5 && (
            <Link
              to="/challenges"
              className="block text-center text-sm text-primary-500 hover:text-primary-400 pt-2"
            >
              Ver {challenges.length - 5} más
            </Link>
          )}
        </div>
      )}

      {/* Challenge Detail Modal */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5 sm:rounded-3xl sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--text-muted)]">Reto completado</p>
                  <h2 className="font-display text-2xl text-[color:var(--text-primary)] truncate">{selected.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl bg-[color:var(--bg-muted)] p-2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                >
                  <FiX size={18} />
                </button>
              </div>

              {selected.description && (
                <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { icon: FiTarget, label: 'Objetivo', value: `${selected.goal} ${selected.unit || ''}` },
                  { icon: FiAward, label: 'XP Ganados', value: `+${selected.reward?.xp || 100}` },
                  {
                    icon: FiClock,
                    label: 'Tiempo',
                    value: (() => {
                      const p = selected.participants?.find(p => (p.user?._id || p.user) === user?._id)
                      return p?.accumulatedMs > 0 ? formatChallengeTime(p.accumulatedMs) : '—'
                    })()
                  }
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-[color:var(--bg-muted)] p-3 text-center">
                    <stat.icon className="mx-auto text-[color:var(--color-primary)]" size={16} />
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-accent-green/10 rounded-xl text-center">
                <FiCheck className="mx-auto text-accent-green mb-1" size={20} />
                <p className="text-sm font-semibold text-accent-green">Reto Completado</p>
              </div>

              <button
                type="button"
                disabled={sharing}
                onClick={() => shareChallenge(selected)}
                className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3 disabled:opacity-60"
              >
                <FiShare2 size={16} />
                {sharing ? 'Compartiendo…' : 'Compartir en Comunidad'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Profile() {
  const { user, logout, updateUser } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { openUserStory } = useStoryViewer()
  const [editing, setEditing] = useState(false)
  const [shareProfileOpen, setShareProfileOpen] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showBadges, setShowBadges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasStories, setHasStories] = useState(false)
  const [coverMenuOpen, setCoverMenuOpen] = useState(false)
  const [viewCoverOpen, setViewCoverOpen] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  // Local media (auth store strips huge base64 — same pattern as UserProfile)
  const [displayAvatar, setDisplayAvatar] = useState(user?.avatar || null)
  const [displayCover, setDisplayCover] = useState(user?.profile?.coverUrl || null)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setLoading(false)
    }
  }, [user])

  // Load avatar/cover like "perfil público" (dedicated page state, not slim auth)
  useEffect(() => {
    const id = user?.id || user?._id
    if (!id) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get(`/users/${id}`, { timeout: 90000 })
        if (cancelled || !data) return
        const nextAvatar = data.avatar || null
        const nextCover = data.profile?.coverUrl || null
        setDisplayAvatar(nextAvatar)
        setDisplayCover(nextCover)
        updateUser({
          ...(nextAvatar ? { avatar: nextAvatar } : {}),
          profile: { ...(data.profile || {}), coverUrl: nextCover }
        })
      } catch (err) {
        console.warn('Profile media hydrate failed:', err?.message || err)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?._id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/stories/feed')
        if (cancelled) return
        const groups = data?.groups || []
        const mine = groups.find((g) => (g.user?._id || g.user) === user?._id)
        setHasStories(Boolean(mine?.stories?.length))
      } catch {
        if (!cancelled) setHasStories(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?._id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.put('/users/profile', { name })
      updateUser(data.user)
      toast.success('Perfil actualizado')
      setEditing(false)
    } catch (error) {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarSave = (avatarValue) => {
    if (avatarValue) {
      setDisplayAvatar(avatarValue)
      updateUser({ avatar: avatarValue })
    }
  }

  const handleCoverSave = (coverUrl) => {
    if (coverUrl) {
      setDisplayCover(coverUrl)
      updateUser({
        profile: { ...(user?.profile || {}), coverUrl }
      })
    }
  }

  const handleRemoveCover = async () => {
    try {
      const { data } = await api.put('/users/profile', {
        profile: { ...(user?.profile || {}), coverUrl: null }
      })
      setDisplayCover(null)
      updateUser({
        ...(data?.user || {}),
        profile: { ...(data?.user?.profile || user?.profile || {}), coverUrl: null }
      })
      toast.success('Portada eliminada')
      setCoverMenuOpen(false)
      setViewCoverOpen(false)
    } catch {
      toast.error('No se pudo eliminar la portada')
    }
  }

  const openCoverPicker = () => {
    setCoverMenuOpen(false)
    setShowCoverPicker(true)
  }

  const onCoverPencilClick = () => {
    if (displayCover) {
      setCoverMenuOpen(true)
    } else {
      setShowCoverPicker(true)
    }
  }

  const xpTotal = user?.stats?.xp || 0
  const xpIntoLevel = xpTotal % 100
  const xpToNextLevel = 100 - xpIntoLevel
  const levelProgress = Math.min(100, (xpIntoLevel / 100) * 100)
  const currentLevel = user?.stats?.level || 1

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'elite': return 'text-accent-purple'
      case 'premium': return 'text-primary-500'
      case 'annual': return 'text-accent-cyan'
      default: return 'text-[color:var(--text-secondary)]'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-accent-green/20 text-accent-green'
      case 'expiring': return 'bg-yellow-500/20 text-yellow-500'
      default: return 'bg-red-500/20 text-red-500'
    }
  }

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--border-subtle)] border-t-primary-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile hero: header, stats & level progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden p-0"
      >
        <div data-tour="tour-profile-cover" data-protected-media="1" className="relative h-[168px] sm:h-[236px] overflow-hidden">
          {displayCover ? (
            <ProtectedMedia
              src={displayCover}
              alt=""
              className="h-full w-full scale-[1.02] object-cover object-center"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.42), rgba(var(--color-accent-rgb),0.16) 55%, rgba(var(--color-primary-rgb),0.22))'
              }}
            />
          )}
          {/* Soft top vignette */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0.08) 45%, transparent)'
            }}
          />
          {/* Side vignette for depth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 85% at 50% 20%, transparent 40%, rgba(0,0,0,0.18) 100%)'
            }}
          />
          {/* Premium bottom blend into card */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] sm:h-[68%]"
            style={{
              background: `
                linear-gradient(
                  to top,
                  var(--bg-card) 0%,
                  color-mix(in srgb, var(--bg-card) 92%, transparent) 18%,
                  color-mix(in srgb, var(--bg-card) 55%, transparent) 42%,
                  color-mix(in srgb, var(--bg-card) 18%, transparent) 68%,
                  transparent 100%
                )
              `
            }}
          />
          {/* Warm brand accent wash near the seam */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
            style={{
              background:
                'linear-gradient(to top, rgba(var(--color-primary-rgb),0.12), rgba(var(--color-primary-rgb),0.04) 45%, transparent)'
            }}
          />
          <button
            type="button"
            onClick={onCoverPencilClick}
            className="absolute bottom-4 right-3 z-30 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/45 text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-md hover:bg-black/65 transition-colors"
            aria-label="Opciones de portada"
            title="Opciones de portada"
          >
            <FiEdit2 size={15} />
          </button>
        </div>
        <div className="pointer-events-none relative z-10 -mt-16 px-4 pb-5 text-center sm:-mt-[4.5rem] sm:px-6">
          <div data-tour="tour-profile-avatar" className="pointer-events-auto relative mx-auto mb-4 inline-block">
            <div className="absolute -inset-1 rounded-full bg-[color:var(--bg-card)]/80 blur-[1px]" aria-hidden />
            <div className="relative">
            <ProfileAvatar
              avatar={displayAvatar}
              name={user?.name}
              size="xl"
              hasStories={hasStories}
              onViewStory={() => openUserStory(user?._id)}
            />
            <button
              type="button"
              onClick={() => setShowAvatarPicker(true)}
              className="absolute bottom-1 right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] transition-colors hover:border-primary-500"
            >
              <FiCamera size={16} />
            </button>
            </div>
          </div>

          {editing ? (
            <div className="pointer-events-auto mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field mb-2 text-center"
              />
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto">
              <h1 className="font-display mb-1 text-2xl sm:text-3xl">{user?.name || 'Usuario'}</h1>
              <p className="mb-3 break-all text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                {user?.username ? `@${user.username}` : 'Sin username'}
              </p>
              {user?._id && (
                <Link
                  to={`/user/${user._id}`}
                  className="mb-4 inline-block text-sm text-primary-500 hover:text-primary-400"
                >
                  Ver perfil público y solicitudes
                </Link>
              )}
            </div>
          )}

          <div className="pointer-events-auto mb-4 flex flex-wrap items-center justify-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium sm:text-sm ${getStatusColor(user?.membership?.status)}`}>
              {user?.membership?.status === 'active' ? 'Activo' :
                user?.membership?.status === 'expiring' ? 'Por vencer' : 'Vencido'}
            </span>
            <span className={`rounded-full bg-[color:var(--bg-muted)] px-3 py-1 text-xs sm:text-sm ${getPlanColor(user?.membership?.plan)}`}>
              {user?.membership?.plan?.toUpperCase() || 'BÁSICO'}
            </span>
            {user?.role === 'admin' && (
              <span className="rounded-full bg-accent-purple/20 px-3 py-1 text-xs text-accent-purple sm:text-sm">
                Admin
              </span>
            )}
          </div>

          {!editing && (
            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                data-tour="tour-profile-edit"
                onClick={() => setEditing(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <FiEdit2 size={16} /> Editar Perfil
              </button>
              <button
                type="button"
                data-tour="tour-profile-share"
                onClick={() => setShareProfileOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <FiShare2 size={16} /> Compartir perfil
              </button>
              <button
                type="button"
                data-tour="tour-profile-tutorials"
                onClick={() => openTutorialHub()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] text-[color:var(--color-primary)] hover:bg-[rgba(var(--color-primary-rgb),0.12)]"
                aria-label="Tutoriales"
                title="Tutoriales"
              >
                <FiHelpCircle size={18} />
              </button>
            </div>
          )}
        </div>

        <div
          className="grid grid-cols-3 border-t border-[color:var(--border-subtle)]"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {[
            { label: 'Entrenamientos', value: user?.stats?.totalWorkouts || 0 },
            { label: 'Días Activo', value: user?.stats?.longestStreak || 0 },
            { label: 'Nivel', value: currentLevel },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={`min-w-0 px-2 py-3 text-center sm:px-3 sm:py-4 ${
                index > 0 ? 'border-l border-[color:var(--border-subtle)]' : ''
              }`}
            >
              <div className="font-display text-xl text-primary-500 sm:text-2xl">{stat.value}</div>
              <div className="truncate text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--border-subtle)] px-4 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FiZap className="text-accent-yellow" size={18} />
              <span className="text-sm font-medium">Nivel {currentLevel}</span>
            </div>
            <span className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
              {xpTotal.toLocaleString('es-ES')} XP total
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--bg-muted)] sm:h-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-yellow to-orange-500 transition-all"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{xpIntoLevel} / 100 XP en este nivel</span>
            <span>{xpToNextLevel} XP al nivel {currentLevel + 1}</span>
          </div>
        </div>
      </motion.div>

      {/* Story favorites / highlights */}
      {user?._id && <StoryHighlights userId={user._id} />}

      {/* Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        data-tour="tour-profile-badges"
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl flex items-center gap-2">
            <FiAward className="text-accent-yellow" />
            Insignias
          </h2>
          <button
            onClick={() => setShowBadges(true)}
            className="text-primary-500 hover:text-primary-400 text-sm"
          >
            Ver todas
          </button>
        </div>

        {user?.badges && user.badges.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {user.badges.slice(0, 8).map((badge, index) => (
              <div
                key={badge.id || badge._id || index}
                className="cursor-pointer rounded-xl bg-[color:var(--bg-muted)] p-2 text-center transition-colors hover:bg-[color:var(--bg-elevated)] sm:p-3"
                onClick={() => setShowBadges(true)}
              >
                <div className="mb-1 text-2xl sm:text-3xl">{badge.icon}</div>
                <div className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{badge.name}</div>
              </div>
            ))}
            {user.badges.length > 8 && (
              <div
                className="flex cursor-pointer items-center justify-center rounded-xl bg-[color:var(--bg-muted)] p-3 transition-colors hover:bg-[color:var(--bg-elevated)]"
                onClick={() => setShowBadges(true)}
              >
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>+{user.badges.length - 8}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            <FiAward size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aún no tienes insignias</p>
          </div>
        )}
      </motion.div>

      {/* My Challenges */}
      <MyChallengesSection />

      {/* Membership */}
      <MembershipSection user={user} />

      {/* Admin Link */}
      {user?.role === 'admin' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            to="/admin"
            className="card flex items-center gap-4 hover:border-accent-purple/50 border-accent-purple/20"
          >
            <div className="w-10 h-10 bg-accent-purple/20 rounded-xl flex items-center justify-center">
              <FiShield className="text-accent-purple" size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Panel de Administración</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Gestiona usuarios, membresías y más</div>
            </div>
            <FiChevronRight style={{ color: 'var(--text-muted)' }} />
          </Link>
        </motion.div>
      )}

      {/* Menu */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card p-0 overflow-hidden"
      >
        {menuItems.map((item, i) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex w-full items-center gap-4 p-4 transition-colors hover:bg-[color:var(--bg-muted)] ${
              i !== menuItems.length - 1 ? 'border-b border-[color:var(--border-subtle)]' : ''
            }`}
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-muted)]">
              <item.icon size={20} style={{ color: 'var(--text-secondary)' }} />
              {item.badge && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-4 px-1 bg-primary-500 rounded-full text-[10px] flex items-center justify-center text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="flex-1 text-left">{item.label}</span>
            <FiChevronRight style={{ color: 'var(--text-muted)' }} />
          </Link>
        ))}
      </motion.div>

      {/* Logout */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={logout}
        className="w-full card flex items-center justify-center gap-3 text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <FiLogOut size={20} />
        <span className="font-semibold">Cerrar Sesión</span>
      </motion.button>

      {/* App Info */}
      <div className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        <p>QYNTRA GYM v1.0.0</p>
        <p className="mt-1">Hecho con 💪 para atletas</p>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onSave={handleAvatarSave}
      />

      <CoverPicker
        isOpen={showCoverPicker}
        onClose={() => setShowCoverPicker(false)}
        onSave={handleCoverSave}
        currentCover={displayCover || null}
      />

      <AnimatePresence>
        {coverMenuOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Cerrar"
              onClick={() => setCoverMenuOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="px-4 py-3 border-b border-[color:var(--border-subtle)]">
                <h3 className="font-display text-lg">Foto de portada</h3>
              </div>
              <div className="p-2 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setCoverMenuOpen(false)
                    setViewCoverOpen(true)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm hover:bg-[color:var(--bg-muted)] transition"
                >
                  <FiEye size={18} className="text-primary-500" />
                  Ver portada
                </button>
                <button
                  type="button"
                  onClick={openCoverPicker}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm hover:bg-[color:var(--bg-muted)] transition"
                >
                  <FiEdit2 size={18} className="text-accent-cyan" />
                  Editar portada
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition"
                >
                  <FiTrash2 size={18} />
                  Eliminar portada
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewCoverOpen && displayCover && (
          <motion.div
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewCoverOpen(false)}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
              aria-label="Cerrar"
              onClick={() => setViewCoverOpen(false)}
            >
              <FiX size={22} />
            </button>
            <div data-protected-media="1" onClick={(e) => e.stopPropagation()}>
              <ProtectedMedia
                src={displayCover}
                alt="Portada"
                className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badges Modal */}
      <BadgesModal
        isOpen={showBadges}
        onClose={() => setShowBadges(false)}
        userId={user?._id}
      />
      <ShareProfileSheet
        open={shareProfileOpen}
        onClose={() => setShareProfileOpen(false)}
        user={user}
      />
    </div>
  )
}
