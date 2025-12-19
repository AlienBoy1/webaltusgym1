import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiCreditCard, FiPlus, FiCheck, FiAlertCircle, FiClock, FiDollarSign, FiX, FiEdit2, FiEye } from 'react-icons/fi'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const PLAN_COLORS = {
  basic: '#6B7280',
  premium: '#FF6B35',
  elite: '#A855F7'
}

export default function AdminMemberships() {
  const [memberships, setMemberships] = useState([])
  const [stats, setStats] = useState({ byPlan: [], byStatus: [] })
  const [expiringUsers, setExpiringUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMembership, setSelectedMembership] = useState(null)
  const [formData, setFormData] = useState({
    plan: '',
    name: '',
    description: '',
    price: '',
    duration: '',
    durationUnit: 'months', // 'days' or 'months'
    benefits: [],
    features: {
      accessToClasses: true,
      accessToChallenges: true,
      accessToSocial: true,
      accessToChat: true,
      accessToReports: false,
      personalTrainer: false,
      nutritionPlan: false
    }
  })
  const [newBenefit, setNewBenefit] = useState('')
  
  useEffect(() => {
    fetchData()
  }, [])
  
  const fetchData = async () => {
    try {
      const [membershipsRes, reportRes, usersRes] = await Promise.all([
        api.get('/admin/memberships'),
        api.get('/admin/reports/memberships'),
        api.get('/admin/users?status=expiring&limit=10')
      ])
      setMemberships(membershipsRes.data || [])
      setStats(reportRes.data)
      setExpiringUsers(usersRes.data.users || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar membresías')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRenewMembership = async (userId, plan) => {
    try {
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + 1)
      
      await api.put(`/users/${userId}/membership`, {
        plan,
        status: 'active',
        endDate: endDate.toISOString()
      })
      
      toast.success('Membresía renovada')
      fetchData()
    } catch (error) {
      toast.error('Error al renovar')
    }
  }

  const handleViewDetails = (membership) => {
    setSelectedMembership(membership)
    setShowDetailsModal(true)
  }

  const handleEdit = (membership) => {
    setSelectedMembership(membership)
    // Use the stored durationUnit or default to 'days' for backwards compatibility
    const durationUnit = membership.durationUnit || 'days'
    let displayDuration = membership.duration?.toString() || ''
    
    // Convert to months if stored in days and no durationUnit specified (backwards compatibility)
    if (!membership.durationUnit && membership.duration) {
      displayDuration = (membership.duration / 30).toFixed(1)
    }
    
    setFormData({
      plan: membership.plan || '',
      name: membership.name || '',
      description: membership.description || '',
      price: membership.price?.toString() || '',
      duration: displayDuration,
      durationUnit: durationUnit,
      benefits: membership.benefits || [],
      features: membership.features || {
        accessToClasses: true,
        accessToChallenges: true,
        accessToSocial: true,
        accessToChat: true,
        accessToReports: false,
        personalTrainer: false,
        nutritionPlan: false
      }
    })
    setShowEditModal(true)
  }

  const handleAdd = () => {
    setFormData({
      plan: '',
      name: '',
      description: '',
      price: '',
      duration: '',
      durationUnit: 'months',
      benefits: [],
      features: {
        accessToClasses: true,
        accessToChallenges: true,
        accessToSocial: true,
        accessToChat: true,
        accessToReports: false,
        personalTrainer: false,
        nutritionPlan: false
      }
    })
    setShowAddModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      let durationValue = parseFloat(formData.duration)
      
      // Convert to days if months selected
      if (formData.durationUnit === 'months') {
        durationValue = Math.round(durationValue * 30)
      } else {
        durationValue = Math.round(durationValue)
      }
      
      const dataToSend = {
        ...formData,
        duration: durationValue,
        durationUnit: formData.durationUnit
      }
      
      if (selectedMembership) {
        // Update
        await api.put(`/admin/memberships/${selectedMembership._id}`, dataToSend)
        toast.success('Membresía actualizada')
      } else {
        // Create
        await api.post('/admin/memberships', dataToSend)
        toast.success('Membresía creada')
      }
      setShowAddModal(false)
      setShowEditModal(false)
      setSelectedMembership(null)
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar membresía')
    }
  }


  const addBenefit = () => {
    if (newBenefit.trim()) {
      setFormData({
        ...formData,
        benefits: [...formData.benefits, newBenefit.trim()]
      })
      setNewBenefit('')
    }
  }

  const removeBenefit = (index) => {
    setFormData({
      ...formData,
      benefits: formData.benefits.filter((_, i) => i !== index)
    })
  }
  
  const pieData = stats.byPlan?.map(p => ({
    name: p._id || 'Sin plan',
    value: p.count,
    color: PLAN_COLORS[p._id] || '#6B7280'
  })) || []
  
  const statusData = stats.byStatus?.map(s => ({
    name: s._id === 'active' ? 'Activos' : s._id === 'expiring' ? 'Por vencer' : 'Vencidos',
    value: s.count,
    color: s._id === 'active' ? '#22C55E' : s._id === 'expiring' ? '#EAB308' : '#EF4444'
  })) || []
  
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-dark-100 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Membresías</h1>
        <button
          onClick={handleAdd}
          className="btn-primary flex items-center gap-2"
        >
          <FiPlus size={20} />
          Agregar Membresía
        </button>
      </div>
      
      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6">
        {memberships.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-400">
            <FiCreditCard size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay membresías registradas</p>
            <button onClick={handleAdd} className="btn-primary mt-4">
              Crear primera membresía
            </button>
          </div>
        ) : (
          memberships.map((membership, i) => {
            const color = PLAN_COLORS[membership.plan] || '#6B7280'
            const activeCount = stats.byPlan?.find(p => p._id === membership.plan)?.count || 0
            
            return (
              <motion.div
                key={membership._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`card relative overflow-hidden ${membership.plan === 'premium' ? 'ring-2 ring-primary-500' : ''}`}
              >
                {membership.plan === 'premium' && (
                  <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs px-3 py-1 rounded-bl-lg z-10">
                    Popular
                  </div>
                )}
                
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                    <FiCreditCard size={24} style={{ color }} />
                  </div>
                  <h3 className="font-display text-xl">{membership.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${membership.price}</span>
                    <span className="text-gray-400">
                      /{(() => {
                        const durationUnit = membership.durationUnit || 'days'
                        if (durationUnit === 'months') {
                          const months = membership.duration / 30
                          return months === 1 ? 'mes' : `${months.toFixed(1)} meses`
                        } else {
                          return membership.duration === 1 ? 'día' : `${membership.duration} días`
                        }
                      })()}
                    </span>
                  </div>
                </div>
                
                <ul className="space-y-2 mb-4 min-h-[100px]">
                  {membership.benefits && membership.benefits.length > 0 ? (
                    membership.benefits.map((benefit, j) => (
                      <li key={j} className="flex items-center gap-2 text-gray-300">
                        <FiCheck className="text-accent-green" size={16} />
                        {benefit}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400 text-sm text-center py-2">Sin beneficios definidos</li>
                  )}
                </ul>
                
                <div className="text-center text-gray-400 text-sm mb-4">
                  {activeCount} {activeCount === 1 ? 'miembro activo' : 'miembros activos'}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleViewDetails(membership)}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2"
                  >
                    <FiEye size={16} />
                    Ver
                  </button>
                  <button
                    onClick={() => handleEdit(membership)}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 py-2"
                  >
                    <FiEdit2 size={16} />
                    Editar
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
      
      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <h2 className="font-display text-xl mb-4">Distribución por Plan</h2>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No hay datos
              </div>
            )}
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h2 className="font-display text-xl mb-4">Estado de Membresías</h2>
          <div className="h-64">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No hay datos
              </div>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Expiring Memberships */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-4">
          <FiAlertCircle className="text-yellow-500" />
          <h2 className="font-display text-xl">Membresías por Vencer</h2>
        </div>
        
        {expiringUsers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No hay membresías por vencer</p>
        ) : (
          <div className="space-y-3">
            {expiringUsers.map((user) => (
              <div key={user._id} className="flex items-center gap-4 p-3 bg-dark-300/50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 font-medium">
                  {user.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-gray-400 text-sm">
                    Vence: {new Date(user.membership?.endDate).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRenewMembership(user._id, user.membership?.plan)}
                  className="btn-primary py-2 px-4 text-sm"
                >
                  Renovar
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedMembership && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl">Detalles de Membresía</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setSelectedMembership(null)
                  }}
                  className="p-2 hover:bg-dark-200 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Plan</label>
                  <div className="text-lg font-semibold">{selectedMembership.plan?.toUpperCase()}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nombre</label>
                  <div className="text-lg">{selectedMembership.name}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Descripción</label>
                  <div className="text-gray-300">{selectedMembership.description || 'Sin descripción'}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Precio</label>
                    <div className="text-lg font-semibold text-primary-500">${selectedMembership.price}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Duración</label>
                    <div className="text-lg">
                      {(() => {
                        const durationUnit = selectedMembership.durationUnit || 'days'
                        if (durationUnit === 'months') {
                          const months = selectedMembership.duration / 30
                          return `${months.toFixed(1)} ${months === 1 ? 'mes' : 'meses'}`
                        } else {
                          return `${selectedMembership.duration} ${selectedMembership.duration === 1 ? 'día' : 'días'}`
                        }
                      })()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Beneficios</label>
                  {selectedMembership.benefits && selectedMembership.benefits.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedMembership.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center gap-2 text-gray-300">
                          <FiCheck className="text-accent-green" size={16} />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">Sin beneficios definidos</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Características</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedMembership.features || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        {value ? (
                          <FiCheck className="text-accent-green" size={16} />
                        ) : (
                          <FiX className="text-red-500" size={16} />
                        )}
                        <span className="text-sm text-gray-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      handleEdit(selectedMembership)
                    }}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <FiEdit2 size={18} />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      setSelectedMembership(null)
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl">
                  {showEditModal ? 'Editar Membresía' : 'Nueva Membresía'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setShowEditModal(false)
                    setSelectedMembership(null)
                  }}
                  className="p-2 hover:bg-dark-200 rounded-lg"
                >
                  <FiX size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Plan *</label>
                    <select
                      value={formData.plan}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                      className="input-field w-full"
                      required
                      disabled={showEditModal}
                    >
                      <option value="">Seleccionar plan</option>
                      <option value="basic">Básico</option>
                      <option value="premium">Premium</option>
                      <option value="elite">Elite</option>
                      <option value="annual">Anual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Nombre *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-field w-full"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field w-full"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Precio *</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="input-field w-full"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Duración *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="input-field flex-1"
                        required
                        min="1"
                        step={formData.durationUnit === 'months' ? '0.5' : '1'}
                      />
                      <select
                        value={formData.durationUnit}
                        onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value })}
                        className="input-field w-32"
                      >
                        <option value="days">Días</option>
                        <option value="months">Meses</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Beneficios</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newBenefit}
                      onChange={(e) => setNewBenefit(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                      className="input-field flex-1"
                      placeholder="Agregar beneficio"
                    />
                    <button
                      type="button"
                      onClick={addBenefit}
                      className="btn-primary px-4"
                    >
                      <FiPlus size={18} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-dark-200 rounded-lg">
                        <FiCheck className="text-accent-green" size={16} />
                        <span className="flex-1 text-gray-300">{benefit}</span>
                        <button
                          type="button"
                          onClick={() => removeBenefit(index)}
                          className="p-1 hover:bg-dark-300 rounded"
                        >
                          <FiX size={16} className="text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Características</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(formData.features).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setFormData({
                            ...formData,
                            features: { ...formData.features, [key]: e.target.checked }
                          })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                  >
                    {showEditModal ? 'Actualizar' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setShowEditModal(false)
                      setSelectedMembership(null)
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
