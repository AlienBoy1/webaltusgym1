import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FiTrendingUp, FiCalendar, FiAward, FiZap, FiChevronRight, FiActivity, FiUsers, FiTarget, FiClock } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import api from '../../utils/api'
import { Link } from 'react-router-dom'

const MOTIVATIONAL_MESSAGES = [
  'Cada serie cuenta. Hoy sumas un paso más hacia tu mejor versión.',
  'La constancia vence al talento cuando el talento no se entrena.',
  'No busques perfección: busca progreso medible y real.',
  'Tu futuro yo ya está agradecido por el esfuerzo de hoy.',
  'El gimnasio no cambia tu vida en un día. La cambia por disciplina.',
  'Hoy no entrenas por vanidad: entrenas por capacidad.',
  'Pequeñas victorias diarias construyen grandes resultados.',
  'Si duele un poco, creces. Si abandonas, te estancas.',
  'Tu cuerpo escucha lo que tu mente decide repetir.',
  'La energía que inviertes aquí se multiplica fuera del gym.',
  'Un mal día de entrenamiento sigue ganando a un día sin entrenar.',
  'Respira, enfócate y ejecuta. Eso es Gym OS en acción.',
  'El PR no llega por suerte. Llega por repetición inteligente.',
  'Hoy es un buen día para superar tu versión de ayer.',
  'Tu racha es prueba viva de que sí puedes sostener el hábito.',
  'Entrena con intención. El resto es ruido.',
  'La fuerza mental se forja entre series, no entre excusas.',
  'Cada descanso bien usado también forma parte del progreso.',
  'No compares tu inicio con el highlight reel de otro.',
  'Abre sesión. Cierra dudas. Eleva tu potencial.',
  'El sistema está listo. Tú también. A entrenar.',
  'La disciplina silenciosa es el verdadero flex.',
  'Hoy eliges movimiento. Eso ya te pone por delante.',
  'Tu historial de XP es el diario de tu superación.'
]

function pickMessage(seedKey) {
  let hash = 0
  const raw = String(seedKey || 'qyntra')
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  return MOTIVATIONAL_MESSAGES[hash % MOTIVATIONAL_MESSAGES.length]
}

export default function Dashboard() {
  const { user, refreshUser } = useAuthStore()
  const { fetchNotifications, unreadCount } = useNotificationStore()
  const [stats, setStats] = useState(null)
  const [visitTick, setVisitTick] = useState(0)

  useEffect(() => {
    loadData()
    setVisitTick((n) => n + 1)
  }, [])

  const loadData = async () => {
    try {
      await refreshUser()
      await fetchNotifications()
      const { data } = await api.get('/users/stats')
      setStats(data)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    }
  }

  const greeting =
    new Date().getHours() < 12
      ? 'Buenos días'
      : new Date().getHours() < 18
        ? 'Buenas tardes'
        : 'Buenas noches'

  const motivation = useMemo(
    () => pickMessage(`${user?._id || user?.id || 'guest'}-${visitTick}-${Date.now()}`),
    [user?._id, user?.id, visitTick]
  )

  const quickStats = [
    {
      label: 'Entrenamientos',
      value: stats?.totalWorkouts || user?.stats?.totalWorkouts || 0,
      icon: FiZap,
      color: 'primary'
    },
    {
      label: 'Días Seguidos',
      value: stats?.currentStreak || user?.stats?.currentStreak || 0,
      icon: FiCalendar,
      color: 'cyan'
    },
    {
      label: 'Nivel',
      value: stats?.level || user?.stats?.level || 1,
      icon: FiAward,
      color: 'yellow'
    },
    {
      label: 'XP',
      value: stats?.xp || user?.stats?.xp || 0,
      icon: FiTrendingUp,
      color: 'green'
    }
  ]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6"
        style={{
          background:
            'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.95), rgba(var(--color-primary-rgb),0.75) 55%, rgba(var(--color-accent-rgb),0.35))'
        }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-black/10" />

        <div className="relative z-10 text-white">
          <p className="text-sm text-white/80">{greeting}</p>
          <h1 className="font-display mb-3 text-3xl tracking-wide md:text-4xl">
            {user?.name || 'Atleta'}
          </h1>
          <div className="rounded-2xl border border-white/20 bg-black/20 px-4 py-3 backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Motivación Qyntra
            </p>
            <p className="mt-1.5 text-base leading-relaxed text-white/95 sm:text-lg">{motivation}</p>
          </div>

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/30"
            >
              Panel de Administración <FiChevronRight />
            </Link>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {quickStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                stat.color === 'primary'
                  ? 'bg-primary-500/20 text-primary-500'
                  : stat.color === 'cyan'
                    ? 'bg-accent-cyan/20 text-accent-cyan'
                    : stat.color === 'yellow'
                      ? 'bg-accent-yellow/20 text-accent-yellow'
                      : 'bg-accent-green/20 text-accent-green'
              }`}
            >
              <stat.icon size={20} />
            </div>
            <div className="font-display text-2xl">{stat.value}</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass rounded-2xl border border-accent-cyan/20 p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold text-accent-cyan">
              Membresía {user?.membership?.plan?.toUpperCase() || 'BÁSICA'}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Estado:{' '}
              <span
                className={
                  user?.membership?.status === 'active'
                    ? 'text-accent-green'
                    : user?.membership?.status === 'expiring'
                      ? 'text-yellow-500'
                      : 'text-red-500'
                }
              >
                {user?.membership?.status === 'active'
                  ? 'Activa'
                  : user?.membership?.status === 'expiring'
                    ? 'Por vencer'
                    : 'Vencida'}
              </span>
              {user?.membership?.endDate && (
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}
                  · Vence: {new Date(user.membership.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <Link to="/profile" className="btn-primary px-4 py-2 text-sm">
            Ver más
          </Link>
        </div>
      </motion.div>

      {unreadCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Link to="/notifications" className="card flex items-center gap-4 hover:border-primary-500/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/20 text-primary-500">
              <FiZap size={22} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Tienes {unreadCount} notificaciones</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Toca para ver
              </div>
            </div>
            <FiChevronRight style={{ color: 'var(--text-muted)' }} />
          </Link>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <h2 className="font-display mb-4 text-xl tracking-wide">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { to: '/workouts', label: 'Entrenar', hint: 'Rutinas', icon: FiActivity, tone: 'primary' },
            { to: '/social', label: 'Comunidad', hint: 'Feed', icon: FiUsers, tone: 'cyan' },
            { to: '/challenges', label: 'Retos', hint: 'Compite', icon: FiTarget, tone: 'purple' },
            { to: '/classes', label: 'Clases', hint: 'Agenda', icon: FiClock, tone: 'green' }
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="card flex flex-col items-center text-center transition-transform hover:scale-[1.03]"
            >
              <div
                className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  background:
                    action.tone === 'primary'
                      ? 'rgba(var(--color-primary-rgb), 0.14)'
                      : action.tone === 'cyan'
                        ? 'rgba(var(--color-accent-rgb), 0.14)'
                        : action.tone === 'purple'
                          ? 'rgba(168, 85, 247, 0.14)'
                          : 'rgba(34, 197, 94, 0.14)',
                  color:
                    action.tone === 'primary'
                      ? 'var(--color-primary)'
                      : action.tone === 'cyan'
                        ? 'var(--color-accent)'
                        : action.tone === 'purple'
                          ? '#A855F7'
                          : '#22C55E'
                }}
              >
                <action.icon size={22} strokeWidth={2.25} />
              </div>
              <div className="font-display text-xl tracking-wide" style={{ color: 'var(--color-primary)' }}>
                {action.label}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {action.hint}
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="card text-center"
      >
        <h2 className="font-display mb-4 text-2xl tracking-wide">Tu actividad semanal</h2>
        <div className="flex justify-center gap-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => {
            const completed = i < (user?.stats?.currentStreak || 0) % 7
            return (
              <div
                key={day}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                  completed ? 'bg-primary-500 text-white' : ''
                }`}
                style={
                  completed
                    ? undefined
                    : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }
                }
              >
                {day}
              </div>
            )
          })}
        </div>
        <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
          Racha actual: {user?.stats?.currentStreak || 0} días
        </p>
      </motion.div>
    </div>
  )
}
