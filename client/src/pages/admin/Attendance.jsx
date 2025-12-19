import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FiClock, FiLogIn, FiLogOut, FiUsers, FiTrendingUp, FiCalendar, FiSearch, FiFilter } from 'react-icons/fi'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { es } from 'date-fns/locale'

export default function AdminAttendance() {
  const [attendance, setAttendance] = useState([])
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState('')
  const [period, setPeriod] = useState('month') // 'week', 'month', 'year'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [processingUsers, setProcessingUsers] = useState(new Set()) // Track users being processed
  const [todayAttendance, setTodayAttendance] = useState(new Map()) // Cache today's attendance
  
  useEffect(() => {
    fetchUsers()
    fetchTodayAttendance()
    fetchStats()
  }, [period])
  
  useEffect(() => {
    if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
      fetchTodayAttendance()
    } else {
      fetchAttendance()
    }
  }, [selectedDate, selectedUser])
  
  // Refresh today's attendance every 30 seconds
  useEffect(() => {
    if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
      const interval = setInterval(() => {
        fetchTodayAttendance()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [selectedDate])
  
  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users?limit=1000')
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }
  
  const fetchTodayAttendance = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const params = new URLSearchParams()
      params.append('startDate', today)
      params.append('endDate', today)
      params.append('limit', '500')
      
      const { data } = await api.get(`/admin/attendance?${params.toString()}`)
      setAttendance(data || [])
      
      // Cache today's attendance by user
      const attendanceMap = new Map()
      data?.forEach(record => {
        const userId = record.user?._id || record.user
        if (userId) {
          attendanceMap.set(userId.toString(), record)
        }
      })
      setTodayAttendance(attendanceMap)
    } catch (error) {
      console.error('Error fetching today attendance:', error)
    }
  }
  
  const fetchAttendance = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedUser) params.append('userId', selectedUser)
      if (selectedDate) {
        params.append('startDate', selectedDate)
        params.append('endDate', selectedDate)
      }
      params.append('limit', '500')
      
      const { data } = await api.get(`/admin/attendance?${params.toString()}`)
      setAttendance(data || [])
    } catch (error) {
      console.error('Error fetching attendance:', error)
      toast.error('Error al cargar asistencias')
    } finally {
      setLoading(false)
    }
  }
  
  const fetchStats = async () => {
    try {
      const { data } = await api.get(`/admin/attendance/stats?period=${period}`)
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }
  
  const handleCheckIn = async (userId) => {
    setProcessingUsers(prev => new Set(prev).add(userId))
    try {
      const { data } = await api.post('/admin/attendance/checkin', { userId })
      toast.success('✅ Entrada registrada', { icon: '🎯' })
      
      // Update local state immediately
      const attendanceMap = new Map(todayAttendance)
      attendanceMap.set(userId.toString(), data)
      setTodayAttendance(attendanceMap)
      
      // Add to attendance list
      setAttendance(prev => [data, ...prev])
      
      // Refresh stats in background
      fetchStats()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar entrada')
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }
  
  const handleCheckOut = async (userId) => {
    setProcessingUsers(prev => new Set(prev).add(userId))
    try {
      const { data } = await api.post('/admin/attendance/checkout', { userId })
      toast.success('✅ Salida registrada', { icon: '👋' })
      
      // Update local state immediately
      const attendanceMap = new Map(todayAttendance)
      attendanceMap.set(userId.toString(), data)
      setTodayAttendance(attendanceMap)
      
      // Update in attendance list
      setAttendance(prev => prev.map(record => {
        const recordUserId = record.user?._id || record.user
        if (recordUserId?.toString() === userId.toString() && !record.checkOut) {
          return data
        }
        return record
      }))
      
      // Refresh stats in background
      fetchStats()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar salida')
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }
  
  const getTodayStatus = useCallback((userId) => {
    // Use cached today attendance for faster lookups
    if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
      const record = todayAttendance.get(userId.toString())
      if (!record) return 'none'
      if (record.checkOut) return 'completed'
      return 'checked-in'
    }
    
    // For other dates, search in attendance list
    const today = selectedDate || format(new Date(), 'yyyy-MM-dd')
    const todayRecord = attendance.find(a => {
      const checkInDate = format(parseISO(a.checkIn), 'yyyy-MM-dd')
      const recordUserId = a.user?._id || a.user
      return recordUserId?.toString() === userId.toString() && checkInDate === today
    })
    
    if (!todayRecord) return 'none'
    if (todayRecord.checkOut) return 'completed'
    return 'checked-in'
  }, [selectedDate, todayAttendance, attendance])
  
  const getTodayRecord = useCallback((userId) => {
    if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
      return todayAttendance.get(userId.toString())
    }
    const today = selectedDate || format(new Date(), 'yyyy-MM-dd')
    return attendance.find(a => {
      const checkInDate = format(parseISO(a.checkIn), 'yyyy-MM-dd')
      const recordUserId = a.user?._id || a.user
      return recordUserId?.toString() === userId.toString() && checkInDate === today
    })
  }, [selectedDate, todayAttendance, attendance])
  
  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }
  
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return user.name?.toLowerCase().includes(query) || 
             user.email?.toLowerCase().includes(query)
    })
  }, [users, searchQuery])

  // Separate users by status
  const usersByStatus = useMemo(() => {
    return filteredUsers.reduce((acc, user) => {
      const status = getTodayStatus(user._id)
      if (status === 'checked-in') {
        acc.inside.push(user)
      } else if (status === 'completed') {
        acc.completed.push(user)
      } else {
        acc.pending.push(user)
      }
      return acc
    }, { inside: [], completed: [], pending: [] })
  }, [filteredUsers, getTodayStatus])
  
  if (loading && !stats) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Asistencias</h1>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-field"
          >
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
            <option value="year">Anual</option>
          </select>
        </div>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Visitas</p>
                <p className="text-2xl font-bold">{stats.overall.totalVisits}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                <FiUsers className="text-primary-500" size={24} />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Usuarios Únicos</p>
                <p className="text-2xl font-bold">{stats.overall.uniqueUsers}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <FiUsers className="text-cyan-500" size={24} />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Duración Promedio</p>
                <p className="text-2xl font-bold">{formatDuration(Math.round(stats.overall.avgDuration))}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <FiClock className="text-green-500" size={24} />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Asistencia Hoy</p>
                <p className="text-2xl font-bold">
                  {attendance.filter(a => {
                    const checkInDate = format(parseISO(a.checkIn), 'yyyy-MM-dd')
                    return checkInDate === format(new Date(), 'yyyy-MM-dd')
                  }).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <FiCalendar className="text-purple-500" size={24} />
              </div>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Charts */}
      {stats && (
        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <h2 className="font-display text-xl mb-4">Asistencia Diaria</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="_id" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                  <Line type="monotone" dataKey="count" stroke="#FF6B35" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h2 className="font-display text-xl mb-4">Top Usuarios</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.userStats.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="user.name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                  <Bar dataKey="visits" fill="#FF6B35" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Check In/Out Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <h2 className="font-display text-xl mb-4">Registro de Entrada/Salida</h2>
        
        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar usuario..."
                className="input-field w-full pl-10"
              />
            </div>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field"
          />
        </div>
        
        {/* Users Inside Gym */}
        {usersByStatus.inside.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <h3 className="font-semibold text-green-400">
                En el Gimnasio ({usersByStatus.inside.length})
              </h3>
            </div>
            <div className="space-y-2 mb-4">
              {usersByStatus.inside.map((user) => {
                const record = getTodayRecord(user._id)
                const isProcessing = processingUsers.has(user._id)
                
                return (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-sm text-gray-400 truncate">{user.email}</div>
                      {record && (
                        <div className="text-xs text-green-400 mt-1">
                          Entrada: {format(parseISO(record.checkIn), 'HH:mm', { locale: es })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isProcessing ? (
                        <div className="flex items-center gap-2 px-4 py-2">
                          <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                          <span className="text-sm text-gray-400">Procesando...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckOut(user._id)}
                          className="btn-secondary flex items-center gap-2 px-4 py-2 hover:scale-105 transition-transform"
                        >
                          <FiLogOut size={18} />
                          Salida
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Users Pending Check-in */}
        {usersByStatus.pending.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <FiLogIn className="text-primary-500" size={18} />
              <h3 className="font-semibold text-primary-500">
                Sin Entrada ({usersByStatus.pending.length})
              </h3>
            </div>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {usersByStatus.pending.map((user) => {
                const isProcessing = processingUsers.has(user._id)
                
                return (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-dark-200 hover:bg-dark-300 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-sm text-gray-400 truncate">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isProcessing ? (
                        <div className="flex items-center gap-2 px-4 py-2">
                          <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                          <span className="text-sm text-gray-400">Procesando...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(user._id)}
                          className="btn-primary flex items-center gap-2 px-4 py-2 hover:scale-105 transition-transform"
                        >
                          <FiLogIn size={18} />
                          Entrada
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Users Completed */}
        {usersByStatus.completed.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <FiClock className="text-gray-400" size={18} />
              <h3 className="font-semibold text-gray-400">
                Visitas Completadas ({usersByStatus.completed.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {usersByStatus.completed.map((user) => {
                const record = getTodayRecord(user._id)
                
                return (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-dark-200 opacity-75"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center text-white font-medium flex-shrink-0">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{user.name}</div>
                      {record && (
                        <div className="text-xs text-gray-500 mt-1">
                          {format(parseISO(record.checkIn), 'HH:mm', { locale: es })} - {format(parseISO(record.checkOut), 'HH:mm', { locale: es })} 
                          {' '}({formatDuration(record.duration)})
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-500/20 rounded-lg flex-shrink-0">
                      <FiClock size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-400">Completado</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <FiUsers size={32} className="mx-auto mb-2 opacity-50" />
            <p>No se encontraron usuarios</p>
          </div>
        )}
      </motion.div>
      
      {/* Recent Attendance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Registros Recientes</h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Mostrando {attendance.length} registros</span>
          </div>
        </div>
        {loading && selectedDate !== format(new Date(), 'yyyy-MM-dd') ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : attendance.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiCalendar size={32} className="mx-auto mb-2 opacity-50" />
            <p>No hay registros de asistencia para esta fecha</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-300">
                  <th className="text-left p-3 text-gray-400">Usuario</th>
                  <th className="text-left p-3 text-gray-400">Fecha</th>
                  <th className="text-left p-3 text-gray-400">Entrada</th>
                  <th className="text-left p-3 text-gray-400">Salida</th>
                  <th className="text-left p-3 text-gray-400">Duración</th>
                  <th className="text-left p-3 text-gray-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 50).map((record) => {
                  const isToday = format(parseISO(record.checkIn), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  const isCompleted = !!record.checkOut
                  
                  return (
                    <tr 
                      key={record._id} 
                      className={`border-b border-dark-300 hover:bg-dark-200 transition-colors ${
                        isToday ? 'bg-primary-500/5' : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm flex-shrink-0">
                            {record.user?.name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{record.user?.name || 'Usuario'}</div>
                            <div className="text-sm text-gray-400 truncate">{record.user?.email || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-gray-300">
                        {format(parseISO(record.checkIn), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FiLogIn size={16} className="text-green-500" />
                          <span className="text-gray-300">
                            {format(parseISO(record.checkIn), 'HH:mm', { locale: es })}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {isCompleted ? (
                          <div className="flex items-center gap-2">
                            <FiLogOut size={16} className="text-red-500" />
                            <span className="text-gray-300">
                              {format(parseISO(record.checkOut), 'HH:mm', { locale: es })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Pendiente</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isCompleted ? (
                          <span className="text-primary-500 font-medium">
                            {formatDuration(record.duration)}
                          </span>
                        ) : (
                          <span className="text-yellow-500">
                            En curso...
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isCompleted ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            Completado
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                            En el gimnasio
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}

