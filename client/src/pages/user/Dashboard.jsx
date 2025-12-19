import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FiTrendingUp, FiCalendar, FiAward, FiZap, FiChevronRight } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import api from '../../utils/api'
import { Link } from 'react-router-dom'

const motivationalMessages = [
  "¡Sigue así, cada día eres más fuerte! 💪",
  "El éxito es la suma de pequeños esfuerzos",
  "Hoy es un buen día para superar tus límites"
]

export default function Dashboard() {
  const { user, refreshUser } = useAuthStore()
  const { fetchNotifications, unreadCount } = useNotificationStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    try {
      await refreshUser()
      await fetchNotifications()
      const { data } = await api.get('/users/stats')
      setStats(data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : 
                   new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'
  
  const quickStats = [
    { label: 'Entrenamientos', value: stats?.totalWorkouts || user?.stats?.totalWorkouts || 0, icon: FiZap, color: 'primary' },
    { label: 'Días Seguidos', value: stats?.currentStreak || user?.stats?.currentStreak || 0, icon: FiCalendar, color: 'cyan' },
    { label: 'Nivel', value: stats?.level || user?.stats?.level || 1, icon: FiAward, color: 'yellow' },
    { label: 'XP', value: stats?.xp || user?.stats?.xp || 0, icon: FiTrendingUp, color: 'green' },
  ]
  
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-6"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <p className="text-white/80 text-sm">{greeting}</p>
          <h1 className="font-display text-3xl md:text-4xl mb-2">
            {user?.name || 'Atleta'}
          </h1>
          <p className="text-white/80 text-lg">
            {motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]}
          </p>
          
          {user?.role === 'admin' && (
            <Link 
              to="/admin" 
              className="inline-flex items-center gap-2 mt-4 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Panel de Administración <FiChevronRight />
            </Link>
          )}
        </div>
      </motion.div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
              stat.color === 'primary' ? 'bg-primary-500/20 text-primary-500' :
              stat.color === 'cyan' ? 'bg-accent-cyan/20 text-accent-cyan' :
              stat.color === 'yellow' ? 'bg-accent-yellow/20 text-accent-yellow' :
              'bg-accent-green/20 text-accent-green'
            }`}>
              <stat.icon size={20} />
            </div>
            <div className="font-display text-2xl">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </motion.div>
        ))}
      </div>
      
      {/* Membership Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-5 border border-accent-cyan/20"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">💳</div>
          <div className="flex-1">
            <div className="font-semibold text-accent-cyan">
              Membresía {user?.membership?.plan?.toUpperCase() || 'BÁSICA'}
            </div>
            <div className="text-gray-300">
              Estado: <span className={
                user?.membership?.status === 'active' ? 'text-accent-green' :
                user?.membership?.status === 'expiring' ? 'text-yellow-500' : 'text-red-500'
              }>
                {user?.membership?.status === 'active' ? 'Activa' :
                 user?.membership?.status === 'expiring' ? 'Por vencer' : 'Vencida'}
              </span>
              {user?.membership?.endDate && (
                <span className="text-gray-400">
                  {' '}• Vence: {new Date(user.membership.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <Link to="/profile" className="btn-primary py-2 px-4 text-sm">
            Ver más
          </Link>
        </div>
      </motion.div>
      
      {/* Notifications Preview */}
      {unreadCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link 
            to="/notifications"
            className="card flex items-center gap-4 hover:border-primary-500/50"
          >
            <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center text-2xl">
              🔔
            </div>
            <div className="flex-1">
              <div className="font-semibold">Tienes {unreadCount} notificaciones</div>
              <div className="text-gray-400 text-sm">Toca para ver</div>
            </div>
            <FiChevronRight className="text-gray-400" />
          </Link>
        </motion.div>
      )}
      
      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="font-display text-xl mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { to: '/workouts', label: 'Entrenar', emoji: '🏋️', color: 'primary' },
            { to: '/social', label: 'Comunidad', emoji: '👥', color: 'cyan' },
            { to: '/challenges', label: 'Retos', emoji: '🎯', color: 'purple' },
            { to: '/classes', label: 'Clases', emoji: '📅', color: 'green' },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="card text-center hover:scale-105 transition-transform"
            >
              <div className="text-3xl mb-2">{action.emoji}</div>
              <div className="font-medium">{action.label}</div>
            </Link>
          ))}
        </div>
      </motion.div>
      
      {/* Activity Ring */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card text-center"
      >
        <h2 className="font-display text-2xl mb-4">Tu Actividad Semanal</h2>
        <div className="flex justify-center gap-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => {
            const completed = i < (user?.stats?.currentStreak || 0) % 7
            return (
              <div
                key={day}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  completed ? 'bg-primary-500 text-white' : 
                  'bg-dark-100 text-gray-500'
                }`}
              >
                {day}
              </div>
            )
          })}
        </div>
        <p className="text-gray-400 mt-4">
          Racha actual: {user?.stats?.currentStreak || 0} días
        </p>
      </motion.div>
    </div>
  )
}
