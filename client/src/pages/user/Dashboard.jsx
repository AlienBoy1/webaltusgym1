import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FiTrendingUp, FiCalendar, FiAward, FiZap, FiChevronRight, FiActivity, FiUsers, FiTarget, FiClock } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import api from '../../utils/api'
import { Link } from 'react-router-dom'
import {
  FREE_ERA_END_ISO,
  formatMembershipDate,
  freeEraEndLabel,
  membershipStatusLabel,
  paidEraStartLabel
} from '../../utils/membershipLifecycle'
import TutorialHelpButton from '../../components/TutorialHelpButton'
import ChatShortcutsRail from '../../components/ChatShortcutsRail'
import { TUTORIAL_IDS } from '../../tutorials/registry'

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
  'Tu historial de XP es el diario de tu superación.',
  'Las excusas no queman calorías. Tú sí.',
  'No necesitas motivación: necesitas compromiso contigo mismo.',
  'Cada repetición te aleja del que eras y te acerca al que serás.',
  'El dolor de hoy es la fuerza de mañana.',
  'Los límites están en la cabeza, no en los músculos.',
  'Nadie construyó un gran cuerpo sentado. Tú ya estás aquí.',
  'Si hoy te cuesta, mañana te costará menos. Eso es progreso.',
  'Tu único rival real es la versión que no entrenó.',
  'Más peso en la barra, menos peso en la mente.',
  'El gym no es un castigo: es una inversión en tu futuro.',
  'Hoy te levantas, te presentas y ejecutas. Simple y poderoso.',
  'La consistencia es el suplemento que nadie vende y todos necesitan.',
  'No cuentas los días. Haz que los días cuenten.',
  'El sudor de hoy es la confianza de mañana.',
  'Tu cuerpo puede. Es tu mente la que debes convencer.',
  'Cada paso hacia el gym es un paso hacia tu mejor vida.',
  'Entrena como si tu versión ideal te estuviera mirando.',
  'Hoy es lunes interior. Siempre es buen día para empezar.',
  'El progreso no se ve todos los días, pero se siente cada semana.',
  'No esperes resultados distintos si entrenas igual que ayer.',
  'Lo que haces cuando nadie mira define quién eres realmente.',
  'El primer paso siempre es el más difícil. Ya lo diste.',
  'Transforma tu disciplina en tu superpoder.',
  'Recuerda por qué empezaste. Y luego sigue.'
]

function pickMessage(seedKey) {
  let hash = 0
  const raw = String(seedKey || 'qyntra')
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  return MOTIVATIONAL_MESSAGES[hash % MOTIVATIONAL_MESSAGES.length]
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const [stats, setStats] = useState(null)
  const [visitTick, setVisitTick] = useState(0)

  useEffect(() => {
    loadData()
    setVisitTick((n) => n + 1)
  }, [])

  const loadData = async () => {
    try {
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

  const [motivation, motivation2] = useMemo(() => {
    const seed = `${user?._id || user?.id || 'guest'}-${visitTick}-${Date.now()}`
    const m1 = pickMessage(seed)
    const m2 = pickMessage(seed + '-sec')
    if (m2 !== m1) return [m1, m2]
    const idx = MOTIVATIONAL_MESSAGES.indexOf(m1)
    return [m1, MOTIVATIONAL_MESSAGES[(idx + 7) % MOTIVATIONAL_MESSAGES.length]]
  }, [user?._id, user?.id, visitTick])

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
        className="noise relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{
          background:
            'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.95) 0%, rgba(var(--color-primary-rgb),0.72) 50%, rgba(var(--color-accent-rgb),0.4) 100%)'
        }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-sm" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-black/[0.12]" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-16 w-16 rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute bottom-4 right-8 h-24 w-24 rounded-full border border-white/[0.08]" />

        <div className="relative z-10 text-white">
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="text-sm font-medium tracking-wide text-white/80"
          >
            {greeting}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-4 flex items-center gap-2.5 font-display text-3xl tracking-wide md:text-4xl"
          >
            <span>{user?.name || 'Atleta'}</span>
            <TutorialHelpButton
              tutorialId={TUTORIAL_IDS.QUICK_START}
              size="sm"
              className="border-white/25 bg-white/15 text-white hover:border-white/40 hover:bg-white/25 hover:text-white"
              message="El inicio tiene un tutorial rápido para conocer el menú, comunidad, entrenos y accesos."
            />
          </motion.h1>
          <div className="space-y-2">
            <div className="rounded-2xl border border-white/20 bg-black/25 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">
                Motivación Qyntra
              </p>
              <p className="mt-1.5 text-base leading-relaxed text-white/95 sm:text-lg">{motivation}</p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl border border-white/10 bg-white/[0.07] px-4 py-2.5 backdrop-blur-sm"
            >
              <p className="text-sm italic leading-relaxed text-white/75">{motivation2}</p>
            </motion.div>
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
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-accent-cyan">
              Membresía {user?.membership?.plan?.toUpperCase() || 'BÁSICA'}
            </div>
            <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                {membershipStatusLabel(user?.membership?.status)}
              </span>
              {(user?.membership?.endDate || true) && (
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}
                  · Vence:{' '}
                  {formatMembershipDate(user?.membership?.endDate || FREE_ERA_END_ISO)}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Acceso gratuito hasta {freeEraEndLabel()}. Planes de pago desde {paidEraStartLabel()}.
            </p>
          </div>
          <Link to="/profile" className="btn-primary shrink-0 px-4 py-2.5 text-sm text-center">
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
            <motion.div key={action.to} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
            <Link
              to={action.to}
              className="card flex flex-col items-center text-center"
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
            </motion.div>
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
            // Align labels with local week starting Monday (L=0 … D=6)
            const mondayBasedToday = (new Date().getDay() + 6) % 7
            const isToday = i === mondayBasedToday
            const streak = user?.stats?.currentStreak || 0
            const daysBack = (mondayBasedToday - i + 7) % 7
            const completed =
              streak > 0 && i <= mondayBasedToday && daysBack < streak
            return (
              <div
                key={day}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition ${
                  isToday
                    ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-[color:var(--bg-card)]'
                    : ''
                } ${completed ? 'bg-primary-500 text-white' : ''}`}
                style={
                  completed
                    ? undefined
                    : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }
                }
                title={isToday ? 'Hoy' : undefined}
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

      <ChatShortcutsRail />
    </div>
  )
}
