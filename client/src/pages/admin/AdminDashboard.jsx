import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiUsers, FiCreditCard, FiTrendingUp, FiCalendar, FiAlertCircle } from 'react-icons/fi'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Link } from 'react-router-dom'
import api from '../../utils/api'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeMembers: 0,
    expiringMembers: 0,
    expiredMembers: 0,
    todayAttendance: 0,
    monthlyRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [recentUsers, setRecentUsers] = useState([])
  
  useEffect(() => {
    fetchData()
  }, [])
  
  const fetchData = async () => {
    try {
      const [dashRes, usersRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users?limit=5')
      ])
      setStats(dashRes.data)
      setRecentUsers(usersRes.data.users || [])
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const statsCards = [
    { label: 'Usuarios Totales', value: stats.totalUsers, change: '+12%', icon: FiUsers, color: 'primary' },
    { label: 'Membresías Activas', value: stats.activeMembers, change: '+8%', icon: FiCreditCard, color: 'cyan' },
    { label: 'Ingresos Mensuales', value: `$${stats.monthlyRevenue?.toLocaleString() || 0}`, change: '+15%', icon: FiTrendingUp, color: 'green' },
    { label: 'Asistencia Hoy', value: stats.todayAttendance, change: '+23', icon: FiCalendar, color: 'purple' },
  ]
  
  const alerts = [
    { type: 'warning', message: `${stats.expiringMembers} membresías vencen esta semana`, action: 'Ver lista' },
    { type: 'error', message: `${stats.expiredMembers} membresías vencidas`, action: 'Gestionar' },
  ].filter(a => a.message.match(/\d+/)?.[0] !== '0')
  
  // Sample data for charts
  const attendanceData = [
    { day: 'Lun', visits: 145 },
    { day: 'Mar', visits: 132 },
    { day: 'Mie', visits: 158 },
    { day: 'Jue', visits: 141 },
    { day: 'Vie', visits: 167 },
    { day: 'Sab', visits: 189 },
    { day: 'Dom', visits: 98 },
  ]
  
  const revenueData = [
    { month: 'Jul', revenue: 32000 },
    { month: 'Ago', revenue: 35000 },
    { month: 'Sep', revenue: 38000 },
    { month: 'Oct', revenue: 41000 },
    { month: 'Nov', revenue: 43000 },
    { month: 'Dic', revenue: stats.monthlyRevenue || 45000 },
  ]
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Dashboard</h1>
          <p className="text-gray-400">Bienvenido al panel de administración</p>
        </div>
        <div className="text-sm text-gray-400">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                stat.color === 'primary' ? 'bg-primary-500/20 text-primary-500' :
                stat.color === 'cyan' ? 'bg-accent-cyan/20 text-accent-cyan' :
                stat.color === 'green' ? 'bg-accent-green/20 text-accent-green' :
                'bg-accent-purple/20 text-accent-purple'
              }`}>
                <stat.icon size={20} />
              </div>
              <span className="text-accent-green text-sm font-medium">{stat.change}</span>
            </div>
            <div className="font-display text-2xl mb-1">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </motion.div>
        ))}
      </div>
      
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                alert.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                'bg-accent-cyan/10 border-accent-cyan/30'
              }`}
            >
              <FiAlertCircle className={
                alert.type === 'warning' ? 'text-yellow-500' :
                alert.type === 'error' ? 'text-red-500' : 'text-accent-cyan'
              } size={20} />
              <span className="flex-1">{alert.message}</span>
              <Link to="/admin/users" className="text-sm font-medium text-primary-500 hover:text-primary-400">
                {alert.action}
              </Link>
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h2 className="font-display text-xl mb-4">Asistencia Semanal</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <XAxis dataKey="day" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }}
                />
                <Bar dataKey="visits" fill="#FF6B35" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
        >
          <h2 className="font-display text-xl mb-4">Ingresos Mensuales</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }}
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#22C55E" fill="url(#revenueGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
      
      {/* Recent Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Usuarios Recientes</h2>
          <Link to="/admin/users" className="text-primary-500 text-sm">Ver todos</Link>
        </div>
        
        {recentUsers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No hay usuarios registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-white/5">
                  <th className="pb-3">Usuario</th>
                  <th className="pb-3">Plan</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user._id} className="border-b border-white/5 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-primary-500 font-medium ${
                          user.role === 'admin' ? 'bg-accent-purple/20' : 'bg-primary-500/20'
                        }`}>
                          {user.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.name}
                            {user.role === 'admin' && (
                              <span className="text-xs bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-sm">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.membership?.plan === 'elite' ? 'bg-accent-purple/20 text-accent-purple' :
                        user.membership?.plan === 'premium' ? 'bg-primary-500/20 text-primary-500' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.membership?.plan || 'Básico'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.membership?.status === 'active' ? 'bg-accent-green/20 text-accent-green' :
                        user.membership?.status === 'expiring' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {user.membership?.status === 'active' ? 'Activo' :
                         user.membership?.status === 'expiring' ? 'Por vencer' : 'Vencido'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link to={`/admin/users`} className="text-gray-400 hover:text-white text-sm">
                        Ver perfil
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
