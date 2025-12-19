import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiBell, FiCheck, FiTrash2, FiCheckCircle } from 'react-icons/fi'
import { useNotificationStore } from '../../store/notificationStore'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const typeIcons = {
  welcome: '🎉',
  workout: '💪',
  social: '👥',
  membership: '💳',
  admin: '📢',
  achievement: '🏆',
  general: '🔔'
}

export default function Notifications() {
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
  
  const handleMarkAsRead = async (id) => {
    await markAsRead(id)
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-gray-400">{unreadCount} sin leer</p>
          )}
        </div>
        
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            >
              <FiCheckCircle size={16} /> Marcar todas
            </button>
          )}
          {notifications.some(n => n.read) && (
            <button 
              onClick={clearRead}
              className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            >
              <FiTrash2 size={16} /> Limpiar leídas
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
            {notifications.map((notification, i) => (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: i * 0.05 }}
                className={`card flex gap-4 ${!notification.read ? 'border-l-4 border-l-primary-500' : 'opacity-70'}`}
              >
                <div className="text-2xl">
                  {notification.icon || typeIcons[notification.type] || '🔔'}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{notification.body}</p>
                  
                  <div className="flex gap-3 mt-3">
                    {!notification.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notification._id)}
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
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
