import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiAward, FiLock, FiUnlock, FiShare2, FiInfo, FiCalendar } from 'react-icons/fi'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthStore } from '../store/authStore'

export default function BadgesModal({ isOpen, onClose, userId }) {
  const { user: currentUser } = useAuthStore()
  const [userBadges, setUserBadges] = useState([])
  const [allBadges, setAllBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (isOpen && userId) {
      fetchBadges()
    }
  }, [isOpen, userId])

  const fetchBadges = async () => {
    try {
      setLoading(true)
      
      // Fetch user badges and all badge definitions in parallel
      const [userData, badgeDefinitions] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get('/users/badges/definitions')
      ])
      
      setUserBadges(userData.data.badges || [])
      setAllBadges(badgeDefinitions.data || [])
    } catch (error) {
      console.error('Error fetching badges:', error)
      setUserBadges([])
      setAllBadges([])
    } finally {
      setLoading(false)
    }
  }

  const getUserBadgeIds = () => {
    return userBadges.map(b => b.id || b._id)
  }

  const isBadgeUnlocked = (badgeId) => {
    return getUserBadgeIds().includes(badgeId)
  }

  const getBadgeProgress = (badge) => {
    // This would need user stats to calculate progress
    // For now, return null if not unlocked
    if (isBadgeUnlocked(badge.id)) {
      return { unlocked: true, progress: 100 }
    }
    return { unlocked: false, progress: 0 }
  }

  const handleShareBadge = async (badge) => {
    if (!isBadgeUnlocked(badge.id)) {
      toast.error('Solo puedes compartir insignias desbloqueadas')
      return
    }

    const userBadge = userBadges.find(b => (b.id || b._id) === badge.id)
    if (!userBadge) {
      toast.error('No se encontró la insignia')
      return
    }

    setSharing(true)
    try {
      const shareText = `¡Acabo de desbloquear la insignia ${badge.icon} ${badge.name}! ${badge.type === 'xp' ? `Conseguí ${badge.xpRequired || badge.threshold} XP` : badge.type === 'workout' ? `Completé ${badge.threshold} entrenamientos` : badge.type === 'streak' ? `Mantuve una racha de ${badge.threshold} días` : badge.type === 'challenge' ? `Completé ${badge.threshold} retos` : badge.type === 'level' ? `Alcanzé el nivel ${badge.threshold}` : '¡Increíble logro!'} 🎉`
      
      const earnedAtDate = typeof userBadge.earnedAt === 'string' 
        ? new Date(userBadge.earnedAt) 
        : userBadge.earnedAt
      
      await api.post('/social', {
        content: shareText,
        postType: 'badge',
        badgeData: {
          badgeId: badge.id,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          earnedAt: earnedAtDate
        }
      })
      
      toast.success('¡Insignia compartida en la comunidad! 🎉')
      setSelectedBadge(null)
    } catch (error) {
      console.error('Error sharing badge:', error)
      toast.error(error.response?.data?.message || 'Error al compartir insignia')
    } finally {
      setSharing(false)
    }
  }

  const canShare = () => {
    return userId === currentUser?._id && selectedBadge && isBadgeUnlocked(selectedBadge.id)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl flex items-center gap-2">
              <FiAward className="text-accent-yellow" />
              Insignias
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : allBadges.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiAward size={48} className="mx-auto mb-4 opacity-50" />
              <p>No hay insignias disponibles</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-primary-500">{allBadges.length}</div>
                  <div className="text-sm text-gray-400">Total</div>
                </div>
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-accent-green">{userBadges.length}</div>
                  <div className="text-sm text-gray-400">Desbloqueadas</div>
                </div>
                <div className="card text-center p-4">
                  <div className="text-2xl font-bold text-gray-500">{allBadges.length - userBadges.length}</div>
                  <div className="text-sm text-gray-400">Bloqueadas</div>
                </div>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allBadges.map((badge, index) => {
                  const unlocked = isBadgeUnlocked(badge.id)
                  const userBadge = userBadges.find(b => (b.id || b._id) === badge.id)
                  
                  return (
                    <motion.div
                      key={badge.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedBadge(badge)}
                      className={`card text-center p-4 relative transition-all cursor-pointer ${
                        unlocked 
                          ? 'border-accent-green/50 bg-accent-green/5 hover:border-accent-green hover:scale-105' 
                          : 'opacity-50 border-gray-600 hover:border-gray-500 hover:scale-105'
                      }`}
                    >
                      {unlocked && (
                        <div className="absolute top-2 right-2">
                          <FiUnlock className="text-accent-green" size={16} />
                        </div>
                      )}
                      {!unlocked && (
                        <div className="absolute top-2 right-2">
                          <FiLock className="text-gray-500" size={16} />
                        </div>
                      )}
                      
                      <div className={`text-5xl mb-3 ${unlocked ? '' : 'grayscale'}`}>
                        {badge.icon}
                      </div>
                      <div className={`font-semibold mb-1 ${unlocked ? 'text-white' : 'text-gray-500'}`}>
                        {badge.name}
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        {badge.type === 'xp' && `${badge.xpRequired || badge.threshold} XP`}
                        {badge.type === 'workout' && `${badge.threshold} entrenamientos`}
                        {badge.type === 'streak' && `${badge.threshold} días`}
                        {badge.type === 'level' && `Nivel ${badge.threshold}`}
                        {badge.type === 'challenge' && `${badge.threshold} retos`}
                        {badge.type === 'class' && `${badge.threshold} clases`}
                        {badge.type === 'social' && `${badge.threshold} interacciones`}
                      </div>
                      {badge.difficulty && (
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                          badge.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                          badge.difficulty === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                          badge.difficulty === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                          badge.difficulty === 'legendary' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {badge.difficulty === 'easy' ? 'Fácil' :
                           badge.difficulty === 'normal' ? 'Normal' :
                           badge.difficulty === 'epic' ? 'Épico' :
                           badge.difficulty === 'legendary' ? 'Legendario' :
                           'Leyenda del Training'}
                        </div>
                      )}
                      {userBadge?.earnedAt && (
                        <div className="text-xs text-accent-green flex items-center justify-center gap-1">
                          <FiCalendar size={12} />
                          {(() => {
                            try {
                              const date = typeof userBadge.earnedAt === 'string' 
                                ? parseISO(userBadge.earnedAt) 
                                : new Date(userBadge.earnedAt)
                              return format(date, 'dd MMM yyyy', { locale: es })
                            } catch {
                              return new Date(userBadge.earnedAt).toLocaleDateString('es-ES')
                            }
                          })()}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Badge Details Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="card max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl">Detalles de Insignia</h3>
                <button
                  onClick={() => setSelectedBadge(null)}
                  className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              {(() => {
                const unlocked = isBadgeUnlocked(selectedBadge.id)
                const userBadge = userBadges.find(b => (b.id || b._id) === selectedBadge.id)
                
                return (
                  <div className="text-center space-y-4">
                    <div className={`text-7xl mb-4 ${unlocked ? '' : 'grayscale opacity-50'}`}>
                      {selectedBadge.icon}
                    </div>
                    
                    <div>
                      <h4 className={`text-2xl font-bold mb-2 ${unlocked ? 'text-white' : 'text-gray-500'}`}>
                        {selectedBadge.name}
                      </h4>
                      <div className="text-gray-400 mb-4">
                        {selectedBadge.type === 'xp' && `Obtén ${selectedBadge.xpRequired || selectedBadge.threshold} XP para desbloquear esta insignia`}
                        {selectedBadge.type === 'workout' && `Completa ${selectedBadge.threshold} entrenamientos para desbloquear esta insignia`}
                        {selectedBadge.type === 'streak' && `Mantén una racha de ${selectedBadge.threshold} días para desbloquear esta insignia`}
                        {selectedBadge.type === 'level' && `Alcanza el nivel ${selectedBadge.threshold} para desbloquear esta insignia`}
                        {selectedBadge.type === 'challenge' && `Completa ${selectedBadge.threshold} retos para desbloquear esta insignia`}
                        {selectedBadge.type === 'class' && `Completa ${selectedBadge.threshold} clases para desbloquear esta insignia`}
                        {selectedBadge.type === 'social' && `Realiza ${selectedBadge.threshold} interacciones sociales para desbloquear esta insignia`}
                      </div>
                      {selectedBadge.difficulty && (
                        <div className={`text-sm px-3 py-1 rounded-full inline-block mb-4 ${
                          selectedBadge.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                          selectedBadge.difficulty === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                          selectedBadge.difficulty === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                          selectedBadge.difficulty === 'legendary' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {selectedBadge.difficulty === 'easy' ? 'Fácil' :
                           selectedBadge.difficulty === 'normal' ? 'Normal' :
                           selectedBadge.difficulty === 'epic' ? 'Épico' :
                           selectedBadge.difficulty === 'legendary' ? 'Legendario' :
                           'Leyenda del Training'}
                        </div>
                      )}
                    </div>

                    {unlocked && userBadge?.earnedAt && (
                      <div className="p-4 bg-accent-green/10 rounded-xl border border-accent-green/30">
                        <div className="flex items-center justify-center gap-2 text-accent-green mb-2">
                          <FiCalendar size={18} />
                          <span className="font-semibold">Desbloqueada</span>
                        </div>
                        <div className="text-sm text-gray-300">
                          {(() => {
                            try {
                              const date = typeof userBadge.earnedAt === 'string' 
                                ? parseISO(userBadge.earnedAt) 
                                : new Date(userBadge.earnedAt)
                              return format(date, "EEEE, d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
                            } catch {
                              return new Date(userBadge.earnedAt).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            }
                          })()}
                        </div>
                      </div>
                    )}

                    {!unlocked && (
                      <div className="p-4 bg-gray-500/10 rounded-xl border border-gray-600">
                        <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
                          <FiLock size={18} />
                          <span className="font-semibold">Bloqueada</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Esta insignia aún no ha sido desbloqueada
                        </div>
                      </div>
                    )}

                    {canShare() && (
                      <button
                        onClick={() => handleShareBadge(selectedBadge)}
                        disabled={sharing}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {sharing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Compartiendo...
                          </>
                        ) : (
                          <>
                            <FiShare2 size={18} />
                            Compartir con la Comunidad
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedBadge(null)}
                      className="btn-secondary w-full"
                    >
                      Cerrar
                    </button>
                  </div>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}
