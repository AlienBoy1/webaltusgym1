import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSave, FiBell, FiMail, FiGlobe, FiShield, FiDatabase, FiSend } from 'react-icons/fi'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState({ title: '', body: '' })
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  
  const [settings, setSettings] = useState({
    gymName: 'ALTUS GYM',
    email: 'contacto@altusgym.com',
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
    // Simulate save
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
            
            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl">Seguridad</h2>
                
                <div className="bg-dark-300/50 rounded-xl p-4">
                  <h3 className="font-medium mb-2">Base de Datos</h3>
                  <p className="text-gray-400 text-sm mb-4">MongoDB Atlas - altusGym</p>
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
            {activeTab !== 'broadcast' && (
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
