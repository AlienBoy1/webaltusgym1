import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSave, FiBell, FiGlobe, FiShield, FiDatabase, FiSend, FiTarget, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'

function ChallengeTypesTab() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingType, setEditingType] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState({
    id: '',
    name: '',
    unit: '',
    default_xp: 50,
    icon: '🎯',
    sort_order: 99,
    active: true
  })

  useEffect(() => {
    fetchTypes()
  }, [])

  const fetchTypes = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/challenges/admin/types')
      setTypes(data || [])
    } catch (error) {
      toast.error('Error al cargar tipos de reto')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveType = async (type) => {
    setSaving(true)
    try {
      await api.put(`/challenges/admin/types/${type.id}`, {
        name: type.name,
        unit: type.unit,
        default_xp: type.default_xp,
        icon: type.icon,
        sort_order: type.sort_order,
        active: type.active
      })
      toast.success('Tipo actualizado')
      setEditingType(null)
      fetchTypes()
    } catch (error) {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleAddType = async () => {
    if (!newType.id || !newType.name) {
      toast.error('ID y nombre son requeridos')
      return
    }
    setSaving(true)
    try {
      await api.post('/challenges/admin/types', newType)
      toast.success('Tipo creado')
      setShowAddModal(false)
      setNewType({ id: '', name: '', unit: '', default_xp: 50, icon: '🎯', sort_order: 99, active: true })
      fetchTypes()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear tipo')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (type) => {
    try {
      await api.put(`/challenges/admin/types/${type.id}`, { active: !type.active })
      toast.success(type.active ? 'Tipo desactivado' : 'Tipo activado')
      fetchTypes()
    } catch (error) {
      toast.error('Error al cambiar estado')
    }
  }

  const handleDeleteType = async (type) => {
    if (!confirm(`¿Eliminar el tipo "${type.name}"? Esto puede afectar retos existentes.`)) return
    try {
      await api.delete(`/challenges/admin/types/${type.id}`)
      toast.success('Tipo eliminado')
      fetchTypes()
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

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
        <div>
          <h2 className="font-display text-xl">Tipos de Reto</h2>
          <p className="text-sm text-gray-400 mt-1">Gestiona los tipos de reto y sus XP por defecto</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <FiPlus size={16} />
          Nuevo Tipo
        </button>
      </div>

      <div className="space-y-3">
        {types.map((type) => (
          <div key={type.id} className={`rounded-xl border p-4 transition-colors ${
            type.active ? 'border-white/10 bg-dark-200' : 'border-white/5 bg-dark-300 opacity-60'
          }`}>
            {editingType?.id === type.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={editingType.name}
                      onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Unidad</label>
                    <input
                      type="text"
                      value={editingType.unit}
                      onChange={(e) => setEditingType({ ...editingType, unit: e.target.value })}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">XP por Defecto</label>
                    <input
                      type="number"
                      value={editingType.default_xp}
                      onChange={(e) => setEditingType({ ...editingType, default_xp: parseInt(e.target.value) || 0 })}
                      className="input-field w-full text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Icono</label>
                    <input
                      type="text"
                      value={editingType.icon}
                      onChange={(e) => setEditingType({ ...editingType, icon: e.target.value })}
                      className="input-field w-full text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingType(null)}
                    className="btn-secondary text-sm px-3 py-1.5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSaveType(editingType)}
                    disabled={saving}
                    className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1"
                  >
                    <FiCheck size={14} />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-2xl">{type.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{type.name}</span>
                    <span className="text-xs text-gray-400">({type.id})</span>
                    {!type.active && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Inactivo</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {type.unit} · <span className="text-accent-yellow">{type.default_xp} XP</span> · Orden: {type.sort_order}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(type)}
                    className={`w-10 h-5 rounded-full transition-colors ${type.active ? 'bg-primary-500' : 'bg-dark-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${type.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button
                    onClick={() => setEditingType({ ...type })}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-300"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteType(type)}
                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-dark-300"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Type Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl">Nuevo Tipo de Reto</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-dark-200 rounded-lg">
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ID (slug único)</label>
                  <input
                    type="text"
                    value={newType.id}
                    onChange={(e) => setNewType({ ...newType, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="input-field w-full"
                    placeholder="ej: flexibility"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={newType.name}
                    onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                    className="input-field w-full"
                    placeholder="ej: Flexibilidad"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Unidad</label>
                    <input
                      type="text"
                      value={newType.unit}
                      onChange={(e) => setNewType({ ...newType, unit: e.target.value })}
                      className="input-field w-full"
                      placeholder="ej: sesiones"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">XP por Defecto</label>
                    <input
                      type="number"
                      value={newType.default_xp}
                      onChange={(e) => setNewType({ ...newType, default_xp: parseInt(e.target.value) || 50 })}
                      className="input-field w-full"
                      min="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Icono (emoji)</label>
                    <input
                      type="text"
                      value={newType.icon}
                      onChange={(e) => setNewType({ ...newType, icon: e.target.value })}
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Orden</label>
                    <input
                      type="number"
                      value={newType.sort_order}
                      onChange={(e) => setNewType({ ...newType, sort_order: parseInt(e.target.value) || 0 })}
                      className="input-field w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancelar</button>
                  <button onClick={handleAddType} disabled={saving} className="btn-primary flex-1">
                    {saving ? 'Creando...' : 'Crear Tipo'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState({ title: '', body: '' })
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  
  const [settings, setSettings] = useState({
    gymName: 'QYNTRA GYM',
    email: 'contacto@qyntragym.com',
    phone: '+52 123 456 7890',
    address: 'Av. Principal #123, Ciudad',
    openingHours: '6:00 AM - 10:00 PM',
    maxCapacity: 100,
    bookingAdvanceDays: 7,
    autoRenewal: true,
    emailNotifications: true,
    membershipReminder: 7
  })
  
  const handleSave = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    toast.success('Configuración guardada')
  }
  
  const handleBroadcast = async (e) => {
    e.preventDefault()
    if (!broadcastMessage.title || !broadcastMessage.body) {
      toast.error('Completa todos los campos')
      return
    }
    
    setSendingBroadcast(true)
    try {
      await api.post('/notifications/broadcast', broadcastMessage)
      toast.success('Notificación enviada a todos los usuarios')
      setBroadcastMessage({ title: '', body: '' })
    } catch (error) {
      toast.error('Error al enviar notificación')
    } finally {
      setSendingBroadcast(false)
    }
  }
  
  const tabs = [
    { id: 'general', label: 'General', icon: FiGlobe },
    { id: 'notifications', label: 'Notificaciones', icon: FiBell },
    { id: 'challenges', label: 'Retos', icon: FiTarget },
    { id: 'security', label: 'Seguridad', icon: FiShield },
    { id: 'broadcast', label: 'Broadcast', icon: FiSend }
  ]
  
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Configuración del Sistema</h1>
      
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500/10 text-primary-500'
                  : 'text-gray-400 hover:bg-dark-200 hover:text-white'
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl">Información del Gimnasio</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Nombre del Gimnasio</label>
                    <input
                      type="text"
                      value={settings.gymName}
                      onChange={(e) => setSettings({ ...settings, gymName: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Email de Contacto</label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Teléfono</label>
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Horario</label>
                    <input
                      type="text"
                      value={settings.openingHours}
                      onChange={(e) => setSettings({ ...settings, openingHours: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-400 mb-2">Dirección</label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Capacidad Máxima</label>
                    <input
                      type="number"
                      value={settings.maxCapacity}
                      onChange={(e) => setSettings({ ...settings, maxCapacity: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Días Anticipados para Reservar</label>
                    <input
                      type="number"
                      value={settings.bookingAdvanceDays}
                      onChange={(e) => setSettings({ ...settings, bookingAdvanceDays: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl">Configuración de Notificaciones</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <div className="font-medium">Notificaciones por Email</div>
                      <div className="text-gray-400 text-sm">Enviar emails automáticos a usuarios</div>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.emailNotifications ? 'bg-primary-500' : 'bg-dark-300'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.emailNotifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <div className="font-medium">Renovación Automática</div>
                      <div className="text-gray-400 text-sm">Renovar membresías automáticamente</div>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, autoRenewal: !settings.autoRenewal })}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.autoRenewal ? 'bg-primary-500' : 'bg-dark-300'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.autoRenewal ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  
                  <div className="py-3">
                    <label className="block font-medium mb-2">Recordatorio de Membresía (días antes)</label>
                    <input
                      type="number"
                      value={settings.membershipReminder}
                      onChange={(e) => setSettings({ ...settings, membershipReminder: e.target.value })}
                      className="input-field w-32"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Challenge Types */}
            {activeTab === 'challenges' && <ChallengeTypesTab />}
            
            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl">Seguridad</h2>
                
                <div className="bg-dark-300/50 rounded-xl p-4">
                  <h3 className="font-medium mb-2">Base de Datos</h3>
                  <p className="text-gray-400 text-sm mb-4">MongoDB Atlas</p>
                  <div className="flex items-center gap-2 text-accent-green">
                    <FiDatabase /> Conectado
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <div className="font-medium">Autenticación de 2 Factores (Admin)</div>
                      <div className="text-gray-400 text-sm">Requerir 2FA para administradores</div>
                    </div>
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 rounded-full text-sm">
                      Próximamente
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <div className="font-medium">Logs de Actividad</div>
                      <div className="text-gray-400 text-sm">Registrar todas las acciones de admin</div>
                    </div>
                    <span className="px-3 py-1 bg-accent-green/20 text-accent-green rounded-full text-sm">
                      Activo
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Broadcast */}
            {activeTab === 'broadcast' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl">Enviar Notificación Masiva</h2>
                <p className="text-gray-400">Envía un mensaje a todos los usuarios de la plataforma</p>
                
                <form onSubmit={handleBroadcast} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Título</label>
                    <input
                      type="text"
                      value={broadcastMessage.title}
                      onChange={(e) => setBroadcastMessage({ ...broadcastMessage, title: e.target.value })}
                      placeholder="Ej: ¡Nuevas clases disponibles!"
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Mensaje</label>
                    <textarea
                      value={broadcastMessage.body}
                      onChange={(e) => setBroadcastMessage({ ...broadcastMessage, body: e.target.value })}
                      placeholder="Escribe el mensaje para todos los usuarios..."
                      rows={4}
                      className="input-field resize-none"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={sendingBroadcast}
                    className="btn-primary flex items-center gap-2"
                  >
                    {sendingBroadcast ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiSend /> Enviar a Todos
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
            
            {/* Save Button */}
            {activeTab !== 'broadcast' && activeTab !== 'challenges' && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <FiSave /> Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
