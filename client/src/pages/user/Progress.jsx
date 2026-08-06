import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { FiTrendingUp, FiTrendingDown, FiAward, FiTarget } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'

export default function Progress() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('weight')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Sample data - in production this would come from the API
  const weightData = [
    { date: 'Sem 1', weight: 75 },
    { date: 'Sem 2', weight: 74.5 },
    { date: 'Sem 3', weight: 74 },
    { date: 'Sem 4', weight: 73.5 },
    { date: 'Sem 5', weight: 73.2 },
    { date: 'Sem 6', weight: 72.8 },
  ]

  const strengthData = [
    { date: 'Sem 1', bench: 60, squat: 80, deadlift: 100 },
    { date: 'Sem 2', bench: 62.5, squat: 85, deadlift: 105 },
    { date: 'Sem 3', bench: 65, squat: 87.5, deadlift: 110 },
    { date: 'Sem 4', bench: 67.5, squat: 90, deadlift: 115 },
    { date: 'Sem 5', bench: 70, squat: 95, deadlift: 120 },
    { date: 'Sem 6', bench: 72.5, squat: 100, deadlift: 125 },
  ]
  
  useEffect(() => {
    fetchStats()
  }, [])
  
  const fetchStats = async () => {
    try {
      const { data } = await api.get('/users/stats')
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const badges = user?.badges || []
  const [totalBadges, setTotalBadges] = useState(0)

  useEffect(() => {
    api
      .get('/users/badges/definitions')
      .then(({ data }) => setTotalBadges(Array.isArray(data) ? data.length : 0))
      .catch(() => setTotalBadges(0))
  }, [])

  const xpTotal = user?.stats?.xp || 0
  const xpIntoLevel = xpTotal % 100
  const xpForNextLevel = 100

  const goals = [
    {
      name: 'Entrenamientos/mes',
      current: user?.stats?.totalWorkouts || 0,
      target: 20,
      unit: '',
      progress: Math.min(100, ((user?.stats?.totalWorkouts || 0) / 20) * 100)
    },
    {
      name: 'Racha de días',
      current: user?.stats?.currentStreak || 0,
      target: 30,
      unit: 'días',
      progress: Math.min(100, ((user?.stats?.currentStreak || 0) / 30) * 100)
    },
    {
      name: 'XP hacia siguiente nivel',
      current: xpIntoLevel,
      target: xpForNextLevel,
      unit: 'XP',
      progress: Math.min(100, (xpIntoLevel / xpForNextLevel) * 100)
    }
  ]
  
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Mi Progreso</h1>
      
      {/* Stats Overview */}
      <div data-tour="tour-progress-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Entrenamientos', value: user?.stats?.totalWorkouts || 0, change: 'total', positive: true },
          { label: 'Mejor racha', value: `${user?.stats?.longestStreak || 0} días`, change: 'récord', positive: true },
          { label: 'Nivel', value: user?.stats?.level || 1, change: `${user?.stats?.xp || 0} XP`, positive: true },
          { label: 'Logros', value: `${badges.length}/${totalBadges || '…'}`, change: totalBadges ? `${Math.round((badges.length / totalBadges) * 100)}%` : 'cargando', positive: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card"
          >
            <div className="text-gray-400 text-sm mb-1">{stat.label}</div>
            <div className="font-display text-2xl">{stat.value}</div>
            <div className={`text-sm flex items-center gap-1 ${stat.positive ? 'text-accent-green' : 'text-red-500'}`}>
              {stat.positive ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
              {stat.change}
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        data-tour="tour-progress-charts"
        className="card"
      >
        <div className="flex gap-4 mb-6">
          {['weight', 'strength'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab 
                  ? 'bg-primary-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'weight' ? 'Peso Corporal' : 'Fuerza'}
            </button>
          ))}
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'weight' ? (
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF6B35" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip 
                  contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="weight" stroke="#FF6B35" fill="url(#weightGradient)" strokeWidth={3} />
              </AreaChart>
            ) : (
              <LineChart data={strengthData}>
                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="bench" stroke="#FF6B35" strokeWidth={2} dot={{ fill: '#FF6B35' }} name="Press Banca" />
                <Line type="monotone" dataKey="squat" stroke="#00F5FF" strokeWidth={2} dot={{ fill: '#00F5FF' }} name="Sentadilla" />
                <Line type="monotone" dataKey="deadlift" stroke="#A855F7" strokeWidth={2} dot={{ fill: '#A855F7' }} name="Peso Muerto" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </motion.div>
      
      {/* Goals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        data-tour="tour-progress-goals"
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <FiTarget className="text-primary-500" />
          <h2 className="font-display text-xl">Mis Objetivos</h2>
        </div>
        
        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">{goal.name}</span>
                <span className="text-sm">
                  <span className="text-primary-500 font-semibold">{goal.current}</span>
                  <span className="text-gray-500"> / {goal.target} {goal.unit}</span>
                </span>
              </div>
              <div className="h-2 bg-dark-300 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goal.progress}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
      
      {/* Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <FiAward className="text-accent-yellow" />
          <h2 className="font-display text-xl">Logros</h2>
        </div>
        
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
          {(badges.length ? badges : [{ id: 'empty', name: 'Sin logros', icon: '—' }]).slice(0, 12).map((badge, idx) => (
            <div
              key={String(badge.id || badge._id || badge.name || 'badge') + '-' + idx}
              className="rounded-xl p-3 text-center transition-all"
              style={{ background: 'var(--bg-muted)' }}
            >
              <div className="mb-2 text-3xl">{badge.icon || '🏅'}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {badge.name || badge.id}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {badges.length} de {totalBadges || '…'} logros desbloqueados · Total XP: {xpTotal}
        </p>
      </motion.div>
    </div>
  )
}
