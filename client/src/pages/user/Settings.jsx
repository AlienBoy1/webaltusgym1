import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiBell, FiMoon, FiSun, FiVolume2, FiEye, FiActivity, FiSave, FiChevronRight, FiSmartphone, FiMail, FiUser, FiHeart, FiTarget, FiClock, FiCheck } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'

const COLOR_THEMES = [
  { id: 'orange', name: 'Naranja', primary: '#FF6B35', accent: '#00F5FF' },
  { id: 'blue', name: 'Azul', primary: '#3B82F6', accent: '#22D3EE' },
  { id: 'green', name: 'Verde', primary: '#22C55E', accent: '#A855F7' },
  { id: 'purple', name: 'Púrpura', primary: '#A855F7', accent: '#F472B6' },
  { id: 'red', name: 'Rojo', primary: '#EF4444', accent: '#FACC15' },
  { id: 'cyan', name: 'Cian', primary: '#06B6D4', accent: '#F97316' },
  { id: 'pink', name: 'Rosa', primary: '#EC4899', accent: '#8B5CF6' },
  { id: 'yellow', name: 'Dorado', primary: '#EAB308', accent: '#14B8A6' },
]

const settingsSections = [
  { id: 'notifications', title: 'Notificaciones', icon: FiBell, color: 'primary' },
  { id: 'privacy', title: 'Privacidad', icon: FiEye, color: 'cyan' },
  { id: 'workout', title: 'Entrenamiento', icon: FiActivity, color: 'green' },
  { id: 'appearance', title: 'Apariencia', icon: FiMoon, color: 'purple' },
  { id: 'accessibility', title: 'Accesibilidad', icon: FiUser, color: 'yellow' },
  { id: 'units', title: 'Unidades', icon: FiTarget, color: 'cyan' }
]

export default function UserSettings() {
  const { user } = useAuthStore()
  const [activeSection, setActiveSection] = useState('notifications')
  const [settings, setSettings] = useState({
    notifications: { push: false, email: true, workoutReminders: true, socialActivity: true, challenges: true, marketing: false },
    privacy: { profilePublic: true, showProgress: true, showWorkouts: true, allowMessages: true },
    workout: { restTimerDefault: 60, autoStartTimer: true, vibration: true, sound: true, keepScreenOn: true },
    theme: 'dark',
    colorTheme: 'orange',
    language: 'es',
    accessibility: { reducedMotion: false, highContrast: false, fontSize: 'medium', voiceControl: false },
    units: { weight: 'kg', distance: 'km', height: 'cm' }
  })
  const [saving, setSaving] = useState(false)
  
  useEffect(() => {
    if (user?._id) {
      loadSettings()
    }
  }, [user?._id])
  
  const loadSettings = async () => {
    try {
      // Try to load from backend first
      const { data } = await api.get('/users/profile')
      if (data?.settings) {
        setSettings(data.settings)
        applySettings(data.settings)
        return
      }
    } catch (error) {
      // Fallback to localStorage
      const saved = localStorage.getItem(`settings_${user?._id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSettings(parsed)
        applySettings(parsed)
      }
    }
  }
  
  const applySettings = (settingsToApply) => {
    // Apply color theme
    const theme = COLOR_THEMES.find(t => t.id === settingsToApply.colorTheme)
    if (theme) {
      document.documentElement.style.setProperty('--color-primary', theme.primary)
      document.documentElement.style.setProperty('--color-accent', theme.accent)
    }
    
    // Apply dark/light theme
    if (settingsToApply.theme === 'light') {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    } else if (settingsToApply.theme === 'dark') {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    } else {
      // System theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        document.documentElement.classList.remove('light')
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.add('light')
      }
    }
    
    // Apply font size
    if (settingsToApply.accessibility?.fontSize) {
      const fontSizeMap = { small: '14px', medium: '16px', large: '18px' }
      document.documentElement.style.setProperty('--font-size-base', fontSizeMap[settingsToApply.accessibility.fontSize] || '16px')
    }
  }
  
  useEffect(() => {
    applySettings(settings)
  }, [settings.theme, settings.colorTheme, settings.accessibility?.fontSize])
  
  const updateSetting = (category, key, value) => {
    setSettings(prev => ({ ...prev, [category]: { ...prev[category], [key]: value } }))
  }
  
  const handleSave = async () => {
    if (!user?._id) return
    
    setSaving(true)
    try {
      // Save to backend
      await api.put('/users/profile', { settings })
      // Also save to localStorage as backup
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      toast.success('Configuración guardada')
    } catch (error) {
      // Fallback to localStorage only
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      toast.success('Configuración guardada localmente')
    } finally {
      setSaving(false)
    }
  }
  
  // Auto-save on change (debounced)
  useEffect(() => {
    if (!user?._id) return
    
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      // Auto-save to backend in background
      api.put('/users/profile', { settings }).catch(() => {})
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [settings, user?._id])
  
  const handlePushToggle = async (enabled) => {
    if (enabled && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        updateSetting('notifications', 'push', true)
        toast.success('Notificaciones push activadas')
      } else {
        toast.error('Permiso denegado')
      }
    } else {
      updateSetting('notifications', 'push', false)
    }
  }
  
  const Toggle = ({ enabled, onChange }) => (
    <button onClick={() => onChange(!enabled)} className={`w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-dark-300'}`}>
      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="font-display text-3xl">Configuración</h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          {settingsSections.map((section) => (
            <button key={section.id} onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeSection === section.id ? 'bg-primary-500/10 text-primary-500' : 'text-gray-400 hover:bg-dark-200 hover:text-white'}`}>
              <section.icon size={20} /><span className="flex-1 text-left">{section.title}</span><FiChevronRight size={16} />
            </button>
          ))}
        </div>
        
        <div className="md:col-span-2">
          <motion.div key={activeSection} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card">
            
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiBell className="text-primary-500" /> Notificaciones</h2>
                <div className="space-y-4">
                  {[
                    { key: 'push', icon: FiSmartphone, label: 'Notificaciones Push', desc: 'Recibe alertas en tu dispositivo', handler: handlePushToggle },
                    { key: 'email', icon: FiMail, label: 'Emails', desc: 'Recibe recordatorios por email' },
                    { key: 'workoutReminders', icon: FiActivity, label: 'Recordatorios de Entrenamiento', desc: 'Notificaciones para entrenar' },
                    { key: 'socialActivity', icon: FiHeart, label: 'Actividad Social', desc: 'Likes, comentarios y seguidores' },
                    { key: 'challenges', icon: FiTarget, label: 'Retos', desc: 'Actualizaciones de retos' },
                    { key: 'marketing', icon: FiMail, label: 'Marketing', desc: 'Ofertas y promociones' },
                  ].map((item, i) => (
                    <div key={item.key} className={`flex items-center justify-between py-3 ${i < 5 ? 'border-b border-white/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <item.icon className="text-gray-400" />
                        <div><div className="font-medium">{item.label}</div><div className="text-gray-400 text-sm">{item.desc}</div></div>
                      </div>
                      <Toggle enabled={settings.notifications?.[item.key]} onChange={item.handler || ((v) => updateSetting('notifications', item.key, v))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeSection === 'privacy' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiEye className="text-accent-cyan" /> Privacidad</h2>
                <div className="space-y-4">
                  {[
                    { key: 'profilePublic', label: 'Perfil Público', desc: 'Otros pueden ver tu perfil' },
                    { key: 'showProgress', label: 'Mostrar Progreso', desc: 'Compartir estadísticas y logros' },
                    { key: 'showWorkouts', label: 'Mostrar Entrenamientos', desc: 'Visible en tu perfil público' },
                    { key: 'allowMessages', label: 'Permitir Mensajes', desc: 'Recibir mensajes de otros usuarios' },
                  ].map((item, i) => (
                    <div key={item.key} className={`flex items-center justify-between py-3 ${i < 3 ? 'border-b border-white/5' : ''}`}>
                      <div><div className="font-medium">{item.label}</div><div className="text-gray-400 text-sm">{item.desc}</div></div>
                      <Toggle enabled={settings.privacy?.[item.key]} onChange={(v) => updateSetting('privacy', item.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeSection === 'workout' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiActivity className="text-accent-green" /> Entrenamiento</h2>
                <div className="space-y-4">
                  <div className="py-3 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-3"><FiClock className="text-gray-400" /><div><div className="font-medium">Timer de Descanso (segundos)</div></div></div>
                    <input type="range" min="15" max="180" step="15" value={settings.workout?.restTimerDefault || 60} onChange={(e) => updateSetting('workout', 'restTimerDefault', parseInt(e.target.value))} className="w-full" />
                    <div className="text-center text-primary-500 font-semibold mt-2">{settings.workout?.restTimerDefault || 60}s</div>
                  </div>
                  {[
                    { key: 'autoStartTimer', label: 'Auto-iniciar Timer', desc: 'Iniciar timer al completar serie' },
                    { key: 'vibration', label: 'Vibración', desc: 'Vibrar al terminar descanso' },
                    { key: 'sound', label: 'Sonido', desc: 'Alertas con sonido' },
                    { key: 'keepScreenOn', label: 'Pantalla Siempre Encendida', desc: 'Evitar que se apague' },
                  ].map((item, i) => (
                    <div key={item.key} className={`flex items-center justify-between py-3 ${i < 3 ? 'border-b border-white/5' : ''}`}>
                      <div><div className="font-medium">{item.label}</div><div className="text-gray-400 text-sm">{item.desc}</div></div>
                      <Toggle enabled={settings.workout?.[item.key]} onChange={(v) => updateSetting('workout', item.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiMoon className="text-accent-purple" /> Apariencia</h2>
                <div className="space-y-4">
                  <div className="py-3">
                    <div className="font-medium mb-3">Tema</div>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ value: 'dark', label: 'Oscuro', icon: FiMoon }, { value: 'light', label: 'Claro', icon: FiSun }, { value: 'system', label: 'Sistema', icon: FiSmartphone }].map((theme) => (
                        <button key={theme.value} onClick={() => setSettings(prev => ({ ...prev, theme: theme.value }))}
                          className={`p-4 rounded-xl border-2 transition-all ${settings.theme === theme.value ? 'border-primary-500 bg-primary-500/10' : 'border-white/10 hover:border-white/20'}`}>
                          <theme.icon size={24} className="mx-auto mb-2" /><div className="text-sm">{theme.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="py-3 border-t border-white/5">
                    <div className="font-medium mb-3">Color Principal</div>
                    <div className="grid grid-cols-4 gap-3">
                      {COLOR_THEMES.map((theme) => (
                        <button key={theme.id} onClick={() => setSettings(prev => ({ ...prev, colorTheme: theme.id }))}
                          className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${settings.colorTheme === theme.id ? 'border-white' : 'border-white/10 hover:border-white/20'}`}>
                          <div className="w-8 h-8 rounded-full relative" style={{ background: `linear-gradient(135deg, ${theme.primary} 50%, ${theme.accent} 50%)` }}>
                            {settings.colorTheme === theme.id && <FiCheck className="absolute inset-0 m-auto text-white" size={16} />}
                          </div>
                          <span className="text-xs">{theme.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="py-3 border-t border-white/5">
                    <div className="font-medium mb-3">Idioma</div>
                    <select value={settings.language || 'es'} onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))} className="input-field">
                      <option value="es">Español</option><option value="en">English</option><option value="pt">Português</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            {activeSection === 'accessibility' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiUser className="text-accent-yellow" /> Accesibilidad</h2>
                <div className="space-y-4">
                  {[
                    { key: 'reducedMotion', label: 'Reducir Movimiento', desc: 'Minimizar animaciones' },
                    { key: 'highContrast', label: 'Alto Contraste', desc: 'Mejorar legibilidad' },
                  ].map((item, i) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5">
                      <div><div className="font-medium">{item.label}</div><div className="text-gray-400 text-sm">{item.desc}</div></div>
                      <Toggle enabled={settings.accessibility?.[item.key]} onChange={(v) => updateSetting('accessibility', item.key, v)} />
                    </div>
                  ))}
                  <div className="py-3 border-b border-white/5">
                    <div className="font-medium mb-3">Tamaño de Fuente</div>
                    <div className="grid grid-cols-3 gap-3">
                      {['small', 'medium', 'large'].map((size) => (
                        <button key={size} onClick={() => updateSetting('accessibility', 'fontSize', size)}
                          className={`p-3 rounded-xl border-2 transition-all ${settings.accessibility?.fontSize === size ? 'border-primary-500 bg-primary-500/10' : 'border-white/10'}`}>
                          <span className={size === 'small' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-base'}>
                            {size === 'small' ? 'Pequeña' : size === 'large' ? 'Grande' : 'Normal'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeSection === 'units' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiTarget className="text-accent-cyan" /> Unidades</h2>
                <div className="space-y-4">
                  {[
                    { key: 'weight', label: 'Peso', options: [{ value: 'kg', label: 'Kilogramos (kg)' }, { value: 'lb', label: 'Libras (lb)' }] },
                    { key: 'distance', label: 'Distancia', options: [{ value: 'km', label: 'Kilómetros (km)' }, { value: 'mi', label: 'Millas (mi)' }] },
                    { key: 'height', label: 'Altura', options: [{ value: 'cm', label: 'Centímetros (cm)' }, { value: 'ft', label: 'Pies (ft)' }] },
                  ].map((unit) => (
                    <div key={unit.key} className="py-3 border-b border-white/5">
                      <div className="font-medium mb-3">{unit.label}</div>
                      <div className="grid grid-cols-2 gap-3">
                        {unit.options.map((opt) => (
                          <button key={opt.value} onClick={() => updateSetting('units', unit.key, opt.value)}
                            className={`p-3 rounded-xl border-2 transition-all ${settings.units?.[unit.key] === opt.value ? 'border-primary-500 bg-primary-500/10' : 'border-white/10'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-white/5">
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FiSave /> Guardar Cambios</>}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
