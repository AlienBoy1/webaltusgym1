import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiBell, FiMoon, FiSun, FiEye, FiActivity, FiSave, FiChevronRight, FiSmartphone, FiMail, FiUser, FiHeart, FiTarget, FiClock, FiCheck, FiHardDrive, FiLink } from 'react-icons/fi'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import {
  COLOR_THEMES,
  applyAppearanceSettings,
  cacheAppearance,
  bindSystemThemeListener,
  loadCachedSettings
} from '../../utils/theme'
import { setWorkoutPreferences } from '../../utils/workoutSession'
import { getStorageAccessGranted, setStorageAccessGranted } from '../../utils/storageAccess'
import { useAppDialog } from '../../components/AppDialog'
import GoogleIcon from '../../components/GoogleIcon'
import { getGoogleLinkedStatus, startGoogleLink } from '../../utils/googleAuth'
import TutorialHelpButton from '../../components/TutorialHelpButton'
import { TUTORIAL_IDS } from '../../tutorials/registry'

const settingsSections = [
  { id: 'account', title: 'Cuenta', icon: FiLink, color: 'primary' },
  { id: 'notifications', title: 'Notificaciones', icon: FiBell, color: 'primary' },
  { id: 'privacy', title: 'Privacidad', icon: FiEye, color: 'cyan' },
  { id: 'permissions', title: 'Permisos', icon: FiHardDrive, color: 'orange' },
  { id: 'workout', title: 'Entrenamiento', icon: FiActivity, color: 'green' },
  { id: 'appearance', title: 'Apariencia', icon: FiMoon, color: 'purple' },
  { id: 'accessibility', title: 'Accesibilidad', icon: FiUser, color: 'yellow' },
  { id: 'units', title: 'Unidades', icon: FiTarget, color: 'cyan' }
]

const DEFAULT_SETTINGS = {
  notifications: { push: false, email: true, workoutReminders: true, socialActivity: true, challenges: true, marketing: false },
  privacy: { profilePublic: true, showProgress: true, showWorkouts: true, allowMessages: true },
  workout: { restTimerDefault: 60, autoStartTimer: true, vibration: true, sound: true, keepScreenOn: true },
  theme: 'dark',
  colorTheme: 'orange',
  language: 'es',
  accessibility: { reducedMotion: false, highContrast: false, fontSize: 'medium', voiceControl: false },
  units: { weight: 'kg', distance: 'km', height: 'cm' }
}

function mergeSettings(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return { ...base }
  return {
    ...base,
    ...incoming,
    notifications: { ...base.notifications, ...(incoming.notifications || {}) },
    privacy: { ...base.privacy, ...(incoming.privacy || {}) },
    workout: { ...base.workout, ...(incoming.workout || {}) },
    accessibility: { ...base.accessibility, ...(incoming.accessibility || {}) },
    units: { ...base.units, ...(incoming.units || {}) }
  }
}

export default function UserSettings() {
  const { user } = useAuthStore()
  const dialog = useAppDialog()
  const [searchParams] = useSearchParams()
  const [activeSection, setActiveSection] = useState(() => searchParams.get('section') || 'notifications')
  const [storageAccess, setStorageAccess] = useState(() => getStorageAccessGranted())
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [settings, setSettings] = useState(() => {
    const uid = user?._id || user?.id
    const cached = uid ? loadCachedSettings(uid) : loadCachedSettings(null)
    return mergeSettings(DEFAULT_SETTINGS, cached || {})
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const section = searchParams.get('section')
    if (section) {
      setActiveSection(section)
      // Scroll permissions block into view on first-time redirect
      if (section === 'permissions') {
        requestAnimationFrame(() => {
          document.getElementById('settings-permissions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await getGoogleLinkedStatus()
        if (!cancelled) setGoogleLinked(Boolean(status.linked))
      } catch {
        if (!cancelled) setGoogleLinked(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?._id, activeSection])

  useEffect(() => {
    if (settings.workout) {
      setWorkoutPreferences({
        restTimerDefault: Number(settings.workout.restTimerDefault) || 60,
        autoStartTimer: settings.workout.autoStartTimer !== false,
        vibration: settings.workout.vibration !== false,
        sound: settings.workout.sound !== false,
        keepScreenOn: settings.workout.keepScreenOn !== false
      })
    }
  }, [settings.workout])
  
  useEffect(() => {
    if (user?._id) {
      loadSettings()
    }
  }, [user?._id])
  
  const loadSettings = async () => {
    try {
      const { data } = await api.get('/users/profile')
      if (data?.settings) {
        const merged = mergeSettings(DEFAULT_SETTINGS, data.settings)
        setSettings(merged)
        applySettings(merged)
        setHydrated(true)
        return
      }
    } catch {
      const saved = localStorage.getItem(`settings_${user?._id}`)
      if (saved) {
        try {
          const merged = mergeSettings(DEFAULT_SETTINGS, JSON.parse(saved))
          setSettings(merged)
          applySettings(merged)
        } catch {
          /* keep current */
        }
      }
    }
    setHydrated(true)
  }
  
  const applySettings = (settingsToApply) => {
    applyAppearanceSettings(settingsToApply)
    cacheAppearance(settingsToApply)
  }

  useEffect(() => {
    applySettings(settings)
  }, [settings.theme, settings.colorTheme, settings.accessibility?.fontSize, settings.accessibility?.reducedMotion, settings.accessibility?.highContrast])

  useEffect(() => {
    bindSystemThemeListener(() => settings.theme)
  }, [settings.theme])
  
  const updateSetting = (category, key, value) => {
    setSettings(prev => ({ ...prev, [category]: { ...prev[category], [key]: value } }))
  }
  
  const handleSave = async () => {
    if (!user?._id) return
    
    setSaving(true)
    try {
      await api.put('/users/profile', { settings })
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      cacheAppearance(settings)
      toast.success('Configuración guardada')
    } catch (error) {
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      toast.success('Configuración guardada localmente')
    } finally {
      setSaving(false)
    }
  }
  
  // Auto-save on change (debounced) — only after hydration to avoid wiping light theme
  useEffect(() => {
    if (!user?._id || !hydrated) return
    
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      cacheAppearance(settings)
      api.put('/users/profile', { settings }).catch(() => {})
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [settings, user?._id, hydrated])
  
  const handlePushToggle = async (enabled) => {
    if (enabled) {
      try {
        const { subscribeToPush } = await import('../../utils/push')
        await subscribeToPush()
        updateSetting('notifications', 'push', true)
        toast.success('Notificaciones push activadas')
      } catch (error) {
        toast.error(error.message || 'Permiso denegado')
      }
    } else {
      try {
        const { unsubscribeFromPush } = await import('../../utils/push')
        await unsubscribeFromPush()
      } catch {
        /* ignore */
      }
      updateSetting('notifications', 'push', false)
    }
  }
  
  const handleLinkGoogle = async () => {
    if (googleLinked || googleLoading) return
    setGoogleLoading(true)
    try {
      await startGoogleLink()
    } catch (error) {
      console.error(error)
      const msg = error?.message || 'No se pudo vincular Google'
      if (/manual linking is disabled/i.test(msg)) {
        toast.error(
          'Vinculación manual desactivada en Supabase. Actívala en Authentication → Providers → Allow manual linking.',
          { duration: 7000 }
        )
      } else if (/already|identity|linked/i.test(msg)) {
        toast.error('Esta cuenta de Google ya está vinculada a otro usuario')
      } else {
        toast.error(msg)
      }
      setGoogleLoading(false)
    }
  }

  const Toggle = ({ enabled, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="w-12 h-6 rounded-full transition-colors"
      style={{ background: enabled ? 'var(--color-primary)' : 'var(--bg-muted)' }}
    >
      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )
  
  return (
    <div data-tour="tour-settings-panel" className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2.5">
        <h1 className="font-display text-3xl">Configuración</h1>
        <TutorialHelpButton
          tutorialId={TUTORIAL_IDS.ESTILOS_QYNTRA}
          message="Hay un tutorial de Estilos Qyntra para personalizar tema y colores. También puedes revisar permisos y privacidad desde el centro de tutoriales."
        />
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          {settingsSections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-tour={
                section.id === 'workout'
                  ? 'tour-settings-workout-section'
                  : section.id === 'permissions'
                    ? 'tour-settings-permissions-section'
                    : section.id === 'notifications'
                      ? 'tour-settings-notifications-section'
                      : section.id === 'privacy'
                        ? 'tour-settings-privacy-section'
                        : section.id === 'appearance'
                          ? 'tour-settings-appearance-section'
                          : undefined
              }
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeSection === section.id ? 'bg-primary-500/10 text-primary-500' : 'text-gray-400 hover:bg-dark-200 hover:text-white'}`}
            >
              <section.icon size={20} /><span className="flex-1 text-left">{section.title}</span><FiChevronRight size={16} />
            </button>
          ))}
        </div>
        
        <div className="md:col-span-2">
          <motion.div key={activeSection} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card">

            {activeSection === 'account' && (
              <div className="space-y-6">
                <h2 className="font-display flex items-center gap-2 text-xl">
                  <FiLink className="text-primary-500" /> Cuenta
                </h2>
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-muted)' }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                      >
                        <GoogleIcon size={22} />
                      </div>
                      <div>
                        <div className="font-medium">Google</div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {googleLinked
                            ? 'Tu cuenta ya puede iniciar sesión con Google.'
                            : 'Vincula Google para entrar más rápido con el mismo correo.'}
                        </div>
                        {user?.email && (
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                    {googleLinked ? (
                      <span
                        className="inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-sm font-medium sm:self-auto"
                        style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}
                      >
                        <FiCheck size={16} /> Vinculado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleLinkGoogle}
                        disabled={googleLoading}
                        className="btn-secondary inline-flex items-center justify-center gap-2 self-stretch sm:self-auto sm:min-w-[10rem]"
                      >
                        {googleLoading ? (
                          <div
                            className="h-5 w-5 animate-spin rounded-full border-2"
                            style={{
                              borderColor: 'var(--border-subtle)',
                              borderTopColor: 'var(--color-primary)'
                            }}
                          />
                        ) : (
                          <>
                            <GoogleIcon size={18} /> Vincular Google
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Usa el mismo correo de tu cuenta Qyntra. Si Google usa otro email, la vinculación fallará.
                </p>
              </div>
            )}
            
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiBell className="text-primary-500" /> Notificaciones</h2>
                <div className="space-y-4">
                  {[
                    { key: 'push', icon: FiSmartphone, label: 'Notificaciones Push', desc: 'Recibe alertas en tu dispositivo', handler: handlePushToggle, tour: 'tour-settings-notifications-push' },
                    { key: 'email', icon: FiMail, label: 'Emails', desc: 'Recibe recordatorios por email' },
                    { key: 'workoutReminders', icon: FiActivity, label: 'Recordatorios de Entrenamiento', desc: 'Notificaciones para entrenar' },
                    { key: 'socialActivity', icon: FiHeart, label: 'Actividad Social', desc: 'Likes, comentarios y seguidores' },
                    { key: 'challenges', icon: FiTarget, label: 'Retos', desc: 'Actualizaciones de retos' },
                    { key: 'marketing', icon: FiMail, label: 'Marketing', desc: 'Ofertas y promociones' },
                  ].map((item, i) => (
                    <div
                      key={item.key}
                      data-tour={item.tour}
                      className={`flex items-center justify-between py-3 ${i < 5 ? 'border-b border-white/5' : ''}`}
                    >
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
                    { key: 'profilePublic', label: 'Perfil Público', desc: 'Si está desactivado, solo tus seguidores ven tus publicaciones', tour: 'tour-settings-profile-public' },
                    { key: 'showProgress', label: 'Mostrar Progreso', desc: 'Compartir estadísticas y logros' },
                    { key: 'showWorkouts', label: 'Mostrar Entrenamientos', desc: 'Visible en tu perfil público' },
                    { key: 'allowMessages', label: 'Permitir Mensajes', desc: 'Recibir mensajes de otros usuarios' },
                  ].map((item, i) => (
                    <div
                      key={item.key}
                      data-tour={item.tour}
                      className={`flex items-center justify-between py-3 ${i < 3 ? 'border-b border-white/5' : ''}`}
                    >
                      <div><div className="font-medium">{item.label}</div><div className="text-gray-400 text-sm">{item.desc}</div></div>
                      <Toggle enabled={settings.privacy?.[item.key]} onChange={(v) => updateSetting('privacy', item.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'permissions' && (
              <div id="settings-permissions" className="space-y-6">
                <h2 className="font-display flex items-center gap-2 text-xl">
                  <FiHardDrive className="text-primary-500" /> Permisos del dispositivo
                </h2>
                <div className="space-y-4">
                  <div
                    data-tour="tour-settings-storage-access"
                    className="flex items-center justify-between border-b border-white/5 py-3"
                  >
                    <div>
                      <div className="font-medium">Acceso a almacenamiento</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Permite a Qyntra Gym usar fotos y videos de tu galería para historias y publicaciones.
                      </div>
                    </div>
                    <Toggle
                      enabled={storageAccess}
                      onChange={async (v) => {
                        if (v) {
                          const ok = await dialog.confirm(
                            'Qyntra Gym necesita acceso a tu almacenamiento para subir historias y medios a tu feed. ¿Deseas permitir el acceso?',
                            {
                              title: 'Permitir almacenamiento',
                              confirmLabel: 'Permitir acceso',
                              cancelLabel: 'Ahora no',
                              tone: 'info'
                            }
                          )
                          if (!ok) return
                          setStorageAccessGranted(true)
                          setStorageAccess(true)
                          toast.success('Acceso a almacenamiento activado')
                        } else {
                          setStorageAccessGranted(false)
                          setStorageAccess(false)
                          toast.success('Acceso a almacenamiento desactivado')
                        }
                      }}
                    />
                  </div>
                  {!storageAccess && (
                    <p className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-muted)' }}>
                      Sin este permiso no podrás subir historias. Actívalo aquí cuando quieras compartir en comunidad.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {activeSection === 'workout' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiActivity className="text-accent-green" /> Entrenamiento</h2>
                <div className="space-y-4">
                  <div data-tour="tour-settings-rest-timer" className="py-3 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-3"><FiClock className="text-gray-400" /><div><div className="font-medium">Timer de Descanso (segundos)</div></div></div>
                    <input type="range" min="15" max="180" step="15" value={settings.workout?.restTimerDefault || 60} onChange={(e) => updateSetting('workout', 'restTimerDefault', parseInt(e.target.value))} className="w-full" />
                    <div className="text-center text-primary-500 font-semibold mt-2">{settings.workout?.restTimerDefault || 60}s</div>
                  </div>
                  {[
                    { key: 'autoStartTimer', label: 'Auto-iniciar Timer', desc: 'Iniciar timer al completar serie', tour: 'tour-settings-rest-autostart' },
                    { key: 'vibration', label: 'Vibración', desc: 'Vibrar al terminar descanso' },
                    { key: 'sound', label: 'Sonido', desc: 'Alertas con sonido' },
                    { key: 'keepScreenOn', label: 'Pantalla Siempre Encendida', desc: 'Evitar que se apague' },
                  ].map((item, i) => (
                    <div
                      key={item.key}
                      data-tour={item.tour}
                      className={`flex items-center justify-between py-3 ${i < 3 ? 'border-b border-white/5' : ''}`}
                    >
                      <div><div className="font-medium">{item.label}</div><div className="text-gray-400 text-sm">{item.desc}</div></div>
                      <Toggle enabled={settings.workout?.[item.key]} onChange={(v) => updateSetting('workout', item.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl flex items-center gap-2">
                    <FiMoon className="text-accent-purple" /> Apariencia
                  </h2>
                  <TutorialHelpButton
                    tutorialId={TUTORIAL_IDS.ESTILOS_QYNTRA}
                    message="Aprende a personalizar tema claro/oscuro y los colores de marca de Qyntra."
                  />
                </div>
                <div className="space-y-4">
                  <div className="py-3" data-tour="tour-settings-theme">
                    <div className="font-medium mb-3">Tema</div>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ value: 'dark', label: 'Oscuro', icon: FiMoon }, { value: 'light', label: 'Claro', icon: FiSun }, { value: 'system', label: 'Sistema', icon: FiSmartphone }].map((theme) => (
                        <button key={theme.value} type="button" onClick={() => setSettings(prev => ({ ...prev, theme: theme.value }))}
                          className={`p-4 rounded-xl border-2 transition-all ${settings.theme === theme.value ? 'border-primary-500 bg-primary-500/10' : 'border-white/10 hover:border-white/20'}`}>
                          <theme.icon size={24} className="mx-auto mb-2" /><div className="text-sm">{theme.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="py-3 border-t border-white/5" data-tour="tour-settings-color-theme">
                    <div className="font-medium mb-1">Color Principal</div>
                    <p className="mb-3 text-xs text-[color:var(--text-muted)]">
                      Elige la combinación de marca. Se aplica en botones, acentos y toda la app.
                    </p>
                    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                      {COLOR_THEMES.map((theme) => (
                        <button key={theme.id} type="button" onClick={() => setSettings(prev => ({ ...prev, colorTheme: theme.id }))}
                          className={`p-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${settings.colorTheme === theme.id ? 'border-white' : 'border-white/10 hover:border-white/20'}`}>
                          <div className="w-8 h-8 rounded-full relative" style={{ background: `linear-gradient(135deg, ${theme.primary} 50%, ${theme.accent} 50%)` }}>
                            {settings.colorTheme === theme.id && <FiCheck className="absolute inset-0 m-auto text-white drop-shadow" size={16} />}
                          </div>
                          <span className="text-[10px] leading-tight text-center">{theme.name}</span>
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
