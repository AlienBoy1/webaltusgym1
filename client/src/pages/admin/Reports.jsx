import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiDownload, FiUsers, FiDollarSign, FiTrendingUp } from 'react-icons/fi'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('attendance')
  const [dateRange, setDateRange] = useState('30')
  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => { fetchReports() }, [dateRange])
  
  const fetchReports = async () => {
    setLoading(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(dateRange))
      const { data } = await api.get(`/admin/reports/attendance?startDate=${startDate.toISOString()}`)
      setAttendanceData(data.map(d => ({ date: new Date(d._id).toLocaleDateString('es', { day: 'numeric', month: 'short' }), visits: d.count })))
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }
  
  const revenueData = [
    { month: 'Jul', revenue: 32000, expenses: 18000 },
    { month: 'Ago', revenue: 35000, expenses: 19000 },
    { month: 'Sep', revenue: 38000, expenses: 20000 },
    { month: 'Oct', revenue: 41000, expenses: 21000 },
    { month: 'Nov', revenue: 43000, expenses: 22000 },
    { month: 'Dic', revenue: 47000, expenses: 23000 }
  ]
  
  const growthData = [
    { month: 'Jul', members: 150, newMembers: 20 },
    { month: 'Ago', members: 165, newMembers: 25 },
    { month: 'Sep', members: 185, newMembers: 30 },
    { month: 'Oct', members: 210, newMembers: 35 },
    { month: 'Nov', members: 240, newMembers: 40 },
    { month: 'Dic', members: 275, newMembers: 45 }
  ]
  
  const generatePDF = () => {
    const data = activeTab === 'attendance' ? attendanceData : activeTab === 'revenue' ? revenueData : growthData
    
    let content = `REPORTE DE ${activeTab.toUpperCase()} - ALTUS GYM\n`
    content += `Generado: ${new Date().toLocaleString()}\n`
    content += `Período: Últimos ${dateRange} días\n\n`
    content += '='.repeat(50) + '\n\n'
    
    if (activeTab === 'attendance') {
      content += 'ASISTENCIA POR DÍA\n\n'
      data.forEach(d => { content += `${d.date}: ${d.visits} visitas\n` })
      content += `\nTotal: ${data.reduce((s, d) => s + d.visits, 0)} visitas`
    } else if (activeTab === 'revenue') {
      content += 'INGRESOS Y GASTOS\n\n'
      data.forEach(d => { content += `${d.month}: Ingresos $${d.revenue.toLocaleString()} | Gastos $${d.expenses.toLocaleString()}\n` })
      content += `\nTotal Ingresos: $${data.reduce((s, d) => s + d.revenue, 0).toLocaleString()}`
      content += `\nTotal Gastos: $${data.reduce((s, d) => s + d.expenses, 0).toLocaleString()}`
    } else {
      content += 'CRECIMIENTO DE MIEMBROS\n\n'
      data.forEach(d => { content += `${d.month}: ${d.members} miembros (+${d.newMembers} nuevos)\n` })
    }
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${activeTab}_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Reporte descargado')
  }
  
  const tabs = [
    { id: 'attendance', label: 'Asistencia', icon: FiUsers },
    { id: 'revenue', label: 'Ingresos', icon: FiDollarSign },
    { id: 'growth', label: 'Crecimiento', icon: FiTrendingUp }
  ]
  
  const totalVisits = attendanceData.reduce((sum, d) => sum + d.visits, 0)
  const avgDaily = attendanceData.length > 0 ? Math.round(totalVisits / attendanceData.length) : 0
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Reportes</h1>
        <div className="flex gap-3">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input-field py-2">
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 3 meses</option>
          </select>
          <button onClick={generatePDF} className="btn-primary py-2 px-4 flex items-center gap-2">
            <FiDownload size={18} /> Exportar
          </button>
        </div>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-primary-500 text-white' : 'bg-dark-200 text-gray-400 hover:text-white'}`}>
            <tab.icon size={18} />{tab.label}
          </button>
        ))}
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          {activeTab === 'attendance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="card"><div className="text-gray-400 text-sm">Total Visitas</div><div className="font-display text-3xl text-primary-500">{totalVisits}</div></div>
                <div className="card"><div className="text-gray-400 text-sm">Promedio Diario</div><div className="font-display text-3xl text-accent-cyan">{avgDaily}</div></div>
                <div className="card"><div className="text-gray-400 text-sm">Día más Activo</div><div className="font-display text-3xl text-accent-green">{attendanceData.length > 0 ? Math.max(...attendanceData.map(d => d.visits)) : 0}</div></div>
              </div>
              <div className="card">
                <h2 className="font-display text-xl mb-4">Asistencia por Día</h2>
                <div className="h-80">
                  {attendanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceData}>
                        <XAxis dataKey="date" stroke="#666" fontSize={12} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }} />
                        <Bar dataKey="visits" fill="#FF6B35" radius={[4, 4, 0, 0]} name="Visitas" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-gray-400">No hay datos de asistencia</div>}
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'revenue' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="card"><div className="text-gray-400 text-sm">Ingresos Totales</div><div className="font-display text-3xl text-accent-green">${revenueData.reduce((s, d) => s + d.revenue, 0).toLocaleString()}</div></div>
                <div className="card"><div className="text-gray-400 text-sm">Gastos Totales</div><div className="font-display text-3xl text-red-500">${revenueData.reduce((s, d) => s + d.expenses, 0).toLocaleString()}</div></div>
                <div className="card"><div className="text-gray-400 text-sm">Ganancia Neta</div><div className="font-display text-3xl text-primary-500">${revenueData.reduce((s, d) => s + d.revenue - d.expenses, 0).toLocaleString()}</div></div>
              </div>
              <div className="card">
                <h2 className="font-display text-xl mb-4">Ingresos vs Gastos</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/><stop offset="95%" stopColor="#22C55E" stopOpacity={0}/></linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#EF4444" stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }} formatter={(v) => `$${v.toLocaleString()}`} />
                      <Area type="monotone" dataKey="revenue" stroke="#22C55E" fill="url(#revenueGrad)" name="Ingresos" />
                      <Area type="monotone" dataKey="expenses" stroke="#EF4444" fill="url(#expenseGrad)" name="Gastos" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'growth' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="card"><div className="text-gray-400 text-sm">Miembros Actuales</div><div className="font-display text-3xl text-primary-500">{growthData[growthData.length - 1].members}</div></div>
                <div className="card"><div className="text-gray-400 text-sm">Nuevos Este Mes</div><div className="font-display text-3xl text-accent-cyan">+{growthData[growthData.length - 1].newMembers}</div></div>
                <div className="card"><div className="text-gray-400 text-sm">Crecimiento</div><div className="font-display text-3xl text-accent-green">+{Math.round(((growthData[growthData.length - 1].members - growthData[0].members) / growthData[0].members) * 100)}%</div></div>
              </div>
              <div className="card">
                <h2 className="font-display text-xl mb-4">Crecimiento de Miembros</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthData}>
                      <XAxis dataKey="month" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip contentStyle={{ background: '#14141C', border: '1px solid #333', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="members" stroke="#FF6B35" strokeWidth={3} dot={{ fill: '#FF6B35' }} name="Total" />
                      <Line type="monotone" dataKey="newMembers" stroke="#00F5FF" strokeWidth={2} dot={{ fill: '#00F5FF' }} name="Nuevos" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
