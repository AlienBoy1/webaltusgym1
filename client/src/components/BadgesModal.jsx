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
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/70"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border border-[color:var(--border-subtle)] overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            maxHeight: 'min(92svh, 720px)',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))'
          }}
        >
          <div
            className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <h2 className="font-display text-xl flex items-center gap-2">
              <FiAward className="text-accent-yellow" />
              Insignias
            </h2>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--bg-muted)]"
            >
              <FiX size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-[color:var(--border-subtle)] border-t-primary-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : allBadges.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                <FiAward size={48} className="mx-auto mb-4 opacity-50" />
                <p>No hay insignias disponibles</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-muted)' }}>
                    <div className="text-xl font-bold text-primary-500">{allBadges.length}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Total</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-muted)' }}>
                    <div className="text-xl font-bold text-accent-green">{userBadges.length}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Desbloqueadas</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-muted)' }}>
                    <div className="text-xl font-bold" style={{ color: 'var(--text-muted)' }}>{allBadges.length - userBadges.length}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Bloqueadas</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allBadges.map((badge, index) => {
                    const unlocked = isBadgeUnlocked(badge.id)
                    const userBadge = userBadges.find(b => (b.id || b._id) === badge.id)

                    return (
                      <motion.button
                        type="button"
                        key={badge.id || index}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.5) }}
                        onClick={() => setSelectedBadge(badge)}
                        className={`relative min-h-[140px] rounded-2xl border p-4 text-center transition-all active:scale-[0.97] ${
                          unlocked
                            ? 'border-accent-green/40 hover:border-accent-green'
                            : 'opacity-60 hover:opacity-80'
                        }`}
                        style={{
                          background: unlocked
                            ? 'rgba(34,197,94,0.06)'
                            : 'var(--bg-muted)',
                          borderColor: unlocked ? undefined : 'var(--border-subtle)'
                        }}
                      >
                        <div className="absolute top-2.5 right-2.5">
                          {unlocked
                            ? <FiUnlock className="text-accent-green" size={14} />
                            : <FiLock size={14} style={{ color: 'var(--text-muted)' }} />}
                        </div>

                        <div className={`text-4xl sm:text-5xl mb-2 ${unlocked ? '' : 'grayscale'}`}>
                          {badge.icon}
                        </div>
                        <div className="font-semibold text-sm mb-1" style={{ color: unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {badge.name}
                        </div>
                        <div className="text-[11px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                          {badge.type === 'xp' && `${badge.xpRequired || badge.threshold} XP`}
                          {badge.type === 'workout' && `${badge.threshold} entrenamientos`}
                          {badge.type === 'streak' && `${badge.threshold} días`}
                          {badge.type === 'level' && `Nivel ${badge.threshold}`}
                          {badge.type === 'challenge' && `${badge.threshold} retos`}
                          {badge.type === 'class' && `${badge.threshold} clases`}
                          {badge.type === 'social' && `${badge.threshold} interacciones`}
                        </div>
                        {badge.difficulty && (
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${
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
                             'Leyenda'}
                          </span>
                        )}
                        {userBadge?.earnedAt && (
                          <div className="mt-1.5 text-[10px] text-accent-green flex items-center justify-center gap-1">
                            <FiCalendar size={10} />
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
                      </motion.button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedBadge && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center bg-black/80 p-0 sm:p-4"
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[color:var(--border-subtle)] p-5 sm:p-6"
              style={{
                background: 'var(--bg-card)',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))'
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-xl">Detalles de Insignia</h3>
                <button
                  onClick={() => setSelectedBadge(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--bg-muted)]"
                >
                  <FiX size={22} />
                </button>
              </div>

              {(() => {
                const unlocked = isBadgeUnlocked(selectedBadge.id)
                const userBadge = userBadges.find(b => (b.id || b._id) === selectedBadge.id)

                return (
                  <div className="text-center space-y-4">
                    <div className={`text-7xl mb-2 ${unlocked ? '' : 'grayscale opacity-50'}`}>
                      {selectedBadge.icon}
                    </div>

                    <div>
                      <h4 className="text-2xl font-bold mb-2" style={{ color: unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {selectedBadge.name}
                      </h4>
                      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {selectedBadge.type === 'xp' && `Obtén ${selectedBadge.xpRequired || selectedBadge.threshold} XP para desbloquear esta insignia`}
                        {selectedBadge.type === 'workout' && `Completa ${selectedBadge.threshold} entrenamientos para desbloquear esta insignia`}
                        {selectedBadge.type === 'streak' && `Mantén una racha de ${selectedBadge.threshold} días para desbloquear esta insignia`}
                        {selectedBadge.type === 'level' && `Alcanza el nivel ${selectedBadge.threshold} para desbloquear esta insignia`}
                        {selectedBadge.type === 'challenge' && `Completa ${selectedBadge.threshold} retos para desbloquear esta insignia`}
                        {selectedBadge.type === 'class' && `Completa ${selectedBadge.threshold} clases para desbloquear esta insignia`}
                        {selectedBadge.type === 'social' && `Realiza ${selectedBadge.threshold} interacciones sociales para desbloquear esta insignia`}
                      </p>
                      {selectedBadge.difficulty && (
                        <span className={`inline-block text-xs px-3 py-1 rounded-full mb-4 ${
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
                        </span>
                      )}
                    </div>

                    {unlocked && userBadge?.earnedAt && (
                      <div className="p-4 rounded-xl border border-accent-green/30" style={{ background: 'rgba(34,197,94,0.08)' }}>
                        <div className="flex items-center justify-center gap-2 text-accent-green mb-2">
                          <FiCalendar size={18} />
                          <span className="font-semibold">Desbloqueada</span>
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                      <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-center gap-2 mb-2" style={{ color: 'var(--text-muted)' }}>
                          <FiLock size={18} />
                          <span className="font-semibold">Bloqueada</span>
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Esta insignia aún no ha sido desbloqueada
                        </div>
                      </div>
                    )}

                    {canShare() && (
                      <button
                        onClick={() => handleShareBadge(selectedBadge)}
                        disabled={sharing}
                        className="btn-primary w-full flex items-center justify-center gap-2 min-h-[48px]"
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
                      className="btn-secondary w-full min-h-[48px]"
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
