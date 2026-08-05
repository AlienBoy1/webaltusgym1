import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiEdit2, FiCamera, FiBell, FiShield, FiHelpCircle, FiLogOut, FiChevronRight, FiSettings, FiMessageCircle, FiCalendar, FiTarget, FiAward, FiZap, FiDollarSign, FiClock, FiCheck, FiX, FiGift, FiActivity } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import AvatarPicker from '../../components/AvatarPicker'
import BadgesModal from '../../components/BadgesModal'
import StoryHighlights from '../../components/StoryHighlights'
import ProfileAvatar from '../../components/ProfileAvatar'
import { Avatar } from '../../utils/avatarUtils'
import { useStoryViewer } from '../../components/StoryViewerContext'

const menuItems = [
  { icon: FiActivity, label: 'Mis entrenamientos', to: '/my-workouts' },
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
    if (user?._id) {
      fetchMemberships()
    }
  }, [user?._id, user?.membership?.plan])

  const fetchMemberships = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/users/memberships')
      setMemberships(data || [])
      
      // Find current membership
      const current = data?.find(m => m.plan === user?.membership?.plan)
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
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-[color:var(--border-subtle)] border-t-primary-500 rounded-full animate-spin mx-auto" />
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl flex items-center gap-2">
            <FiAward className="text-accent-cyan" />
            Mi Membresía
          </h2>
          <button
            onClick={() => setShowAllMemberships(true)}
            className="text-primary-500 hover:text-primary-400 text-sm"
          >
            Ver otras
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-[color:var(--bg-muted)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="font-semibold text-lg">
                {currentMembership?.name || `Plan ${user?.membership?.plan?.toUpperCase() || 'Básico'}`}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                user?.membership?.status === 'active' ? 'bg-accent-green/20 text-accent-green' :
                user?.membership?.status === 'expiring' ? 'bg-yellow-500/20 text-yellow-500' :
                'bg-red-500/20 text-red-500'
              }`}>
                {user?.membership?.status === 'active' ? 'Activa' :
                 user?.membership?.status === 'expiring' ? 'Por vencer' : 'Vencida'}
              </span>
            </div>

            {currentMembership && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {currentMembership.price > 0 && (
                    <div className="flex items-center gap-1">
                      <FiDollarSign size={14} />
                      ${currentMembership.price}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <FiClock size={14} />
                    {currentMembership.duration} días
                  </div>
                </div>

                {currentMembership.description && (
                  <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{currentMembership.description}</p>
                )}

                {currentMembership.benefits && currentMembership.benefits.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Beneficios:</div>
                    <div className="space-y-1">
                      {currentMembership.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <FiCheck size={14} className="text-accent-green flex-shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-4 border-t border-[color:var(--border-subtle)] pt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              {user?.membership?.endDate ? (
                <>
                  Vence: {new Date(user.membership.endDate).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </>
              ) : (
                'Sin fecha de vencimiento'
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* All Memberships Modal */}
      <AnimatePresence>
        {showAllMemberships && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl">Membresías Disponibles</h2>
                <button
                  onClick={() => setShowAllMemberships(false)}
                  className="rounded-lg p-2 transition-colors hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {memberships.map((membership) => {
                  const isCurrent = membership.plan === user?.membership?.plan
                  return (
                    <div
                      key={membership._id || membership.plan}
                      className={`rounded-xl border-2 p-4 ${
                        isCurrent
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{membership.name}</h3>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-primary-500/20 text-primary-500 text-xs rounded-full">
                                Actual
                              </span>
                            )}
                          </div>
                          {membership.description && (
                            <p className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{membership.description}</p>
                          )}
                        </div>
                        {membership.price > 0 && (
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary-500">
                              ${membership.price}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              / {membership.duration} días
                            </div>
                          </div>
                        )}
                      </div>

                      {membership.benefits && membership.benefits.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            <FiGift size={12} />
                            Beneficios:
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {membership.benefits.map((benefit, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <FiCheck size={12} className="text-accent-green flex-shrink-0" />
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {membership.features && (
                        <div className="border-t border-[color:var(--border-subtle)] pt-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(membership.features).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                {value ? (
                                  <FiCheck size={12} className="text-accent-green" />
                                ) : (
                                  <FiX size={12} style={{ color: 'var(--text-muted)' }} />
                                )}
                                <span style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                  {key === 'accessToClasses' && 'Clases'}
                                  {key === 'accessToChallenges' && 'Retos'}
                                  {key === 'accessToSocial' && 'Social'}
                                  {key === 'accessToChat' && 'Chat'}
                                  {key === 'accessToReports' && 'Reportes'}
                                  {key === 'personalTrainer' && 'Entrenador Personal'}
                                  {key === 'nutritionPlan' && 'Plan Nutricional'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 border-t border-[color:var(--border-subtle)] pt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                <p>Los pagos se realizan en persona con el administrador del gimnasio</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default function Profile() {
  const { user, logout, updateUser, refreshUser } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { openUserStory } = useStoryViewer()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showBadges, setShowBadges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasStories, setHasStories] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user?.avatar) {
      // Force re-render when avatar changes
      setLoading(false)
    }
  }, [user?.avatar])

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

  const handleAvatarSave = async (avatar) => {
    await refreshUser()
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
        <div
          className="px-4 pt-6 pb-5 text-center sm:px-6"
          style={{ background: 'linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.1) 0%, transparent 72%)' }}
        >
          <div className="relative mx-auto mb-4 inline-block">
            <ProfileAvatar
              avatar={user?.avatar}
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

          {editing ? (
            <div className="mb-4">
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
            <>
              <h1 className="font-display mb-1 text-2xl sm:text-3xl">{user?.name || 'Usuario'}</h1>
              <p className="mb-3 break-all text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                {user?.email}
              </p>
              {user?._id && (
                <Link
                  to={`/user/${user._id}`}
                  className="mb-4 inline-block text-sm text-primary-500 hover:text-primary-400"
                >
                  Ver perfil público y solicitudes
                </Link>
              )}
            </>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
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
            <button
              onClick={() => setEditing(true)}
              className="btn-secondary mx-auto flex items-center gap-2"
            >
              <FiEdit2 size={16} /> Editar Perfil
            </button>
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

      {/* Badges Modal */}
      <BadgesModal
        isOpen={showBadges}
        onClose={() => setShowBadges(false)}
        userId={user?._id}
      />
    </div>
  )
}
