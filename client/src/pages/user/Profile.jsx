import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiEdit2, FiCamera, FiBell, FiShield, FiHelpCircle, FiLogOut, FiChevronRight, FiSettings, FiMessageCircle, FiCalendar, FiTarget, FiAward, FiZap, FiDollarSign, FiClock, FiCheck, FiX, FiGift } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import AvatarPicker from '../../components/AvatarPicker'
import BadgesModal from '../../components/BadgesModal'
import { Avatar } from '../../utils/avatarUtils'

const menuItems = [
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
          <div className="w-6 h-6 border-2 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
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
          <div className="p-4 bg-dark-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
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
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
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
                  <p className="text-gray-300 text-sm mb-3">{currentMembership.description}</p>
                )}

                {currentMembership.benefits && currentMembership.benefits.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 font-medium">Beneficios:</div>
                    <div className="space-y-1">
                      {currentMembership.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                          <FiCheck size={14} className="text-accent-green flex-shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-400">
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
                  className="p-2 hover:bg-dark-200 rounded-lg"
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
                      className={`p-4 rounded-xl border-2 ${
                        isCurrent
                          ? 'bg-primary-500/10 border-primary-500'
                          : 'bg-dark-200 border-white/10'
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
                            <p className="text-gray-400 text-sm mb-2">{membership.description}</p>
                          )}
                        </div>
                        {membership.price > 0 && (
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary-500">
                              ${membership.price}
                            </div>
                            <div className="text-xs text-gray-400">
                              / {membership.duration} días
                            </div>
                          </div>
                        )}
                      </div>

                      {membership.benefits && membership.benefits.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <FiGift size={12} />
                            Beneficios:
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {membership.benefits.map((benefit, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                                <FiCheck size={12} className="text-accent-green flex-shrink-0" />
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {membership.features && (
                        <div className="pt-3 border-t border-white/5">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(membership.features).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                {value ? (
                                  <FiCheck size={12} className="text-accent-green" />
                                ) : (
                                  <FiX size={12} className="text-gray-600" />
                                )}
                                <span className={value ? 'text-gray-300' : 'text-gray-600'}>
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

              <div className="mt-6 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
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
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showBadges, setShowBadges] = useState(false)
  const [loading, setLoading] = useState(true)

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


  const getPlanColor = (plan) => {
    switch (plan) {
      case 'elite': return 'text-accent-purple'
      case 'premium': return 'text-primary-500'
      case 'annual': return 'text-accent-cyan'
      default: return 'text-gray-400'
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
        <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card text-center"
      >
        <div className="relative inline-block mb-4">
          <Avatar avatar={user?.avatar} name={user?.name} size="xl" />
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 w-8 h-8 bg-dark-100 rounded-full flex items-center justify-center border border-white/10 hover:border-primary-500 transition-colors"
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
              className="input-field text-center mb-2"
            />
            <div className="flex gap-2 justify-center">
              <button onClick={() => setEditing(false)} className="btn-secondary py-2 px-4 text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-4 text-sm">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl mb-1">{user?.name || 'Usuario'}</h1>
            <p className="text-gray-400 mb-4">{user?.email}</p>
          </>
        )}

        <div className="flex items-center justify-center gap-2 mb-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(user?.membership?.status)}`}>
            {user?.membership?.status === 'active' ? 'Activo' :
              user?.membership?.status === 'expiring' ? 'Por vencer' : 'Vencido'}
          </span>
          <span className={`px-3 py-1 bg-dark-100 rounded-full text-sm ${getPlanColor(user?.membership?.plan)}`}>
            {user?.membership?.plan?.toUpperCase() || 'BÁSICO'}
          </span>
          {user?.role === 'admin' && (
            <span className="px-3 py-1 bg-accent-purple/20 text-accent-purple rounded-full text-sm">
              Admin
            </span>
          )}
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary flex items-center gap-2 mx-auto"
          >
            <FiEdit2 size={16} /> Editar Perfil
          </button>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          { label: 'Entrenamientos', value: user?.stats?.totalWorkouts || 0 },
          { label: 'Días Activo', value: user?.stats?.longestStreak || 0 },
          { label: 'Nivel', value: user?.stats?.level || 1 },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <div className="font-display text-2xl text-primary-500">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* XP Total */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FiZap className="text-accent-yellow" size={20} />
            <span className="text-gray-400">XP Total</span>
          </div>
          <span className="font-bold text-accent-yellow">{user?.stats?.xp || 0} XP</span>
        </div>
        <div className="h-3 bg-dark-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-yellow to-orange-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, ((user?.stats?.xp || 0) % 100))}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {100 - ((user?.stats?.xp || 0) % 100)} XP hasta el siguiente nivel
        </div>
      </motion.div>

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
          <div className="grid grid-cols-4 gap-3">
            {user.badges.slice(0, 8).map((badge, index) => (
              <div
                key={badge.id || badge._id || index}
                className="text-center p-3 bg-dark-200 rounded-xl hover:bg-dark-100 transition-colors cursor-pointer"
                onClick={() => setShowBadges(true)}
              >
                <div className="text-3xl mb-1">{badge.icon}</div>
                <div className="text-xs text-gray-400 truncate">{badge.name}</div>
              </div>
            ))}
            {user.badges.length > 8 && (
              <div
                className="text-center p-3 bg-dark-200 rounded-xl hover:bg-dark-100 transition-colors cursor-pointer flex items-center justify-center"
                onClick={() => setShowBadges(true)}
              >
                <div className="text-gray-400 text-sm">+{user.badges.length - 8}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
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
              <div className="text-gray-400 text-sm">Gestiona usuarios, membresías y más</div>
            </div>
            <FiChevronRight className="text-gray-400" />
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
            className={`w-full flex items-center gap-4 p-4 hover:bg-dark-100 transition-colors ${
              i !== menuItems.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <div className="w-10 h-10 bg-dark-300 rounded-xl flex items-center justify-center">
              <item.icon size={20} className="text-gray-400" />
            </div>
            <span className="flex-1 text-left">{item.label}</span>
            <FiChevronRight className="text-gray-500" />
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
      <div className="text-center text-gray-500 text-sm py-4">
        <p>ALTUS GYM v1.0.0</p>
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
