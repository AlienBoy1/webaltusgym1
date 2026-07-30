import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiBell, FiCheck, FiTrash2, FiCheckCircle, FiX, FiUser } from 'react-icons/fi'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useNotificationStore } from '../../store/notificationStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const typeIcons = {
  welcome: '🎉',
  workout: '💪',
  social: '👥',
  membership: '💳',
  admin: '📢',
  achievement: '🏆',
  general: '🔔',
  follow_request: '👤',
  follow_accepted: '✅',
  level_up: '⬆️',
  badge_unlocked: '🏅',
  challenge_invite: '🎯',
  challenge_completed: '🏆',
  challenge_update: '🎯',
  class_reminder: '📅',
  class_cancelled: '📅',
  class_registered: '📅',
  registration_request: '📝',
  message: '💬'
}

function getDeepLink(notification) {
  const related = notification.relatedUser
  const data = notification.relatedData || {}
  switch (notification.type) {
    case 'follow_request':
    case 'follow_accepted':
    case 'social':
      return related ? `/user/${related}` : null
    case 'message':
      return '/chat'
    case 'challenge_invite':
    case 'challenge_completed':
    case 'challenge_update':
      return data.challengeId ? `/challenges` : '/challenges'
    case 'class_reminder':
    case 'class_cancelled':
    case 'class_registered':
      return '/classes'
    case 'workout':
      return '/workouts'
    case 'badge_unlocked':
    case 'level_up':
    case 'achievement':
      return '/profile'
    default:
      return related ? `/user/${related}` : null
  }
}

export default function Notifications() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef(null)
  const [pulseId, setPulseId] = useState(highlightId)
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead
  } = useNotificationStore()

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (!highlightId || loading) return
    const target = notifications.find((n) => n._id === highlightId || n.id === highlightId)
    if (target && !target.read) {
      markAsRead(target._id)
    }
    setPulseId(highlightId)
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    const clearPulse = setTimeout(() => {
      setPulseId(null)
      const next = new URLSearchParams(searchParams)
      next.delete('highlight')
      setSearchParams(next, { replace: true })
    }, 6000)
    return () => {
      clearTimeout(t)
      clearTimeout(clearPulse)
    }
  }, [highlightId, loading, notifications.length])

  const handleAcceptFollow = async (notification) => {
    const requesterId = notification.relatedUser
    if (!requesterId) return
    try {
      await api.post(`/social/${requesterId}/accept-follow`)
      toast.success('Solicitud aceptada')
      await markAsRead(notification._id)
      await deleteNotification(notification._id)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al aceptar')
    }
  }

  const handleRejectFollow = async (notification) => {
    const requesterId = notification.relatedUser
    if (!requesterId) return
    try {
      await api.post(`/social/${requesterId}/reject-follow`)
      toast.success('Solicitud rechazada')
      await deleteNotification(notification._id)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al rechazar')
    }
  }

  const handleClickNotification = async (notification) => {
    if (!notification.read) await markAsRead(notification._id)
    if (notification.type === 'follow_request') return
    const link = getDeepLink(notification)
    if (link) navigate(link)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Notificaciones</h1>
          {unreadCount > 0 && <p className="text-gray-400">{unreadCount} sin leer</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn-secondary py-2 px-3 sm:px-4 text-sm flex items-center gap-2"
            >
              <FiCheckCircle size={16} />
              <span className="hidden xs:inline sm:inline">Marcar todas</span>
            </button>
          )}
          {notifications.some((n) => n.read) && (
            <button
              onClick={clearRead}
              className="btn-secondary py-2 px-3 sm:px-4 text-sm flex items-center gap-2"
            >
              <FiTrash2 size={16} />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <FiBell className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {notifications.map((notification, i) => {
              const isHighlighted =
                pulseId && (notification._id === pulseId || notification.id === pulseId)
              return (
              <motion.div
                key={notification._id}
                ref={isHighlighted ? highlightRef : null}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: isHighlighted ? [1, 1.02, 1] : 1
                }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={`card flex gap-3 sm:gap-4 transition-shadow ${
                  isHighlighted
                    ? 'border-l-4 border-l-primary-500 ring-2 ring-primary-500/60 bg-primary-500/10 shadow-[0_0_24px_rgba(255,107,53,0.25)]'
                    : !notification.read
                      ? 'border-l-4 border-l-primary-500'
                      : 'opacity-70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleClickNotification(notification)}
                  className="text-2xl flex-shrink-0 self-start"
                >
                  {notification.icon || typeIcons[notification.type] || '🔔'}
                </button>

                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleClickNotification(notification)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`font-semibold text-sm sm:text-base ${
                          !notification.read ? 'text-white' : 'text-gray-300'
                        }`}
                      >
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: es
                        })}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{notification.body}</p>
                  </button>

                  {notification.type === 'follow_request' && notification.relatedUser && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => handleAcceptFollow(notification)}
                        className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1"
                      >
                        <FiCheck size={14} /> Aceptar
                      </button>
                      <button
                        onClick={() => handleRejectFollow(notification)}
                        className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1"
                      >
                        <FiX size={14} /> Rechazar
                      </button>
                      <Link
                        to={`/user/${notification.relatedUser}`}
                        className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1"
                      >
                        <FiUser size={14} /> Ver perfil
                      </Link>
                    </div>
                  )}

                  {notification.type !== 'follow_request' && (
                    <div className="flex flex-wrap gap-3 mt-3">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification._id)}
                          className="text-sm text-primary-500 flex items-center gap-1 hover:text-primary-400"
                        >
                          <FiCheck size={14} /> Marcar como leída
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification._id)}
                        className="text-sm text-gray-500 flex items-center gap-1 hover:text-red-500"
                      >
                        <FiTrash2 size={14} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
