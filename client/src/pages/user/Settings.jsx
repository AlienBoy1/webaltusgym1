import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiBell, FiMoon, FiSun, FiEye, FiActivity, FiSave, FiChevronRight, FiSmartphone, FiMail, FiUser, FiHeart, FiTarget, FiClock, FiCheck, FiHardDrive, FiLink, FiTrash2, FiSlash, FiUserX } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
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
import { setWorkoutPreferences, checkWorkoutOverlayPermission, requestWorkoutOverlayPermission, forceShowWorkoutOverlay, getWorkoutSession } from '../../utils/workoutSession'
import { getStorageAccessGranted, setStorageAccessGranted } from '../../utils/storageAccess'
import { isNativeApp } from '../../utils/appMode'
import {
  isWorkoutBubblePrefOn,
  isChatBubblesPrefOn,
  setWorkoutBubblePref,
  setChatBubblesPref,
  syncBubblePrefsToNative
} from '../../utils/bubblePrefs'
import { useAppDialog } from '../../components/AppDialog'
import GoogleIcon from '../../components/GoogleIcon'
import { getGoogleLinkedStatus, startGoogleLink } from '../../utils/googleAuth'
import TutorialHelpButton from '../../components/TutorialHelpButton'
import { TUTORIAL_IDS } from '../../tutorials/registry'
import { Avatar } from '../../utils/avatarUtils'

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
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const dialog = useAppDialog()
  const [searchParams] = useSearchParams()
  const [activeSection, setActiveSection] = useState(() => searchParams.get('section') || 'notifications')
  const [storageAccess, setStorageAccess] = useState(() => getStorageAccessGranted())
  const [overlayAccess, setOverlayAccess] = useState(false)
  const [workoutBubblePref, setWorkoutBubblePrefState] = useState(false)
  const [chatBubblesPref, setChatBubblesPrefState] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [settings, setSettings] = useState(() => {
    const uid = user?._id || user?.id
    const cached = uid ? loadCachedSettings(uid) : loadCachedSettings(null)
    return mergeSettings(DEFAULT_SETTINGS, cached || {})
  })
  const [saving, setSaving] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState([])
  const [blockedLoading, setBlockedLoading] = useState(false)
  const [unblockingId, setUnblockingId] = useState(null)

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
    setWorkoutBubblePrefState(isWorkoutBubblePrefOn())
    setChatBubblesPrefState(isChatBubblesPrefOn())
  }, [])

  useEffect(() => {
    let cancelled = false
    const refreshOverlay = async () => {
      if (!isNativeApp()) {
        if (!cancelled) setOverlayAccess(false)
        return
      }
      try {
        const status = await checkWorkoutOverlayPermission()
        const granted = status === 'granted'
        if (!cancelled) setOverlayAccess(granted)
        if (granted && getWorkoutSession()?.activeWorkout) {
          await forceShowWorkoutOverlay()
        }
      } catch {
        if (!cancelled) setOverlayAccess(false)
      }
    }
    refreshOverlay()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshOverlay()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refreshOverlay)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refreshOverlay)
    }
  }, [activeSection])

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
    if (activeSection !== 'account') return undefined
    let cancelled = false
    setBlockedLoading(true)
    ;(async () => {
      try {
        const { data } = await api.get('/social/blocked')
        if (!cancelled) setBlockedUsers(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setBlockedUsers([])
      } finally {
        if (!cancelled) setBlockedLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSection, user?._id])

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
      localStorage.setItem('qyntra:settings', JSON.stringify(settings))
      cacheAppearance(settings)
      const { notifyLanguageChanged, setDocumentLanguage } = await import('../../i18n')
      setDocumentLanguage(settings.language === 'en' ? 'en' : 'es')
      notifyLanguageChanged()
      toast.success(settings.language === 'en' ? 'Settings saved' : 'Configuración guardada')
    } catch (error) {
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      localStorage.setItem('qyntra:settings', JSON.stringify(settings))
      toast.success(settings.language === 'en' ? 'Saved locally' : 'Configuración guardada localmente')
    } finally {
      setSaving(false)
    }
  }
  
  // Auto-save on change (debounced) — only after hydration to avoid wiping light theme
  useEffect(() => {
    if (!user?._id || !hydrated) return
    
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`settings_${user?._id}`, JSON.stringify(settings))
      localStorage.setItem('qyntra:settings', JSON.stringify(settings))
      cacheAppearance(settings)
      api.put('/users/profile', { settings }).catch(() => {})
      import('../../i18n').then(({ notifyLanguageChanged, setDocumentLanguage }) => {
        setDocumentLanguage(settings.language === 'en' ? 'en' : 'es')
        notifyLanguageChanged()
      }).catch(() => {})
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [settings, user?._id, hydrated])
  
  const handlePushToggle = async (enabled) => {
    if (enabled) {
      try {
        const { subscribeToPush } = await import('../../utils/push')
        await subscribeToPush()
        updateSetting('notifications', 'push', true)
        toast.success('Notificaciones activadas')
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

  const handleUnblockUser = async (entry) => {
    const id = entry?.id || entry?._id || entry?.user?.id || entry?.user?._id
    if (!id) return
    const name = entry?.user?.name || entry?.name || 'este usuario'
    const ok = await dialog.confirm(`¿Desbloquear a ${name}? Podrá volver a interactuar contigo.`, {
      title: 'Desbloquear usuario',
      confirmLabel: 'Desbloquear',
      cancelLabel: 'Cancelar',
      tone: 'info'
    })
    if (!ok) return
    setUnblockingId(id)
    try {
      await api.delete(`/social/${id}/block`)
      setBlockedUsers((prev) => prev.filter((row) => (row.id || row._id) !== id))
      toast.success('Usuario desbloqueado')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo desbloquear')
    } finally {
      setUnblockingId(null)
    }
  }

  const handleDeleteAccount = async () => {
    const ok = await dialog.confirm(
      'Se eliminarán tu perfil, publicaciones, mensajes, rutinas y todos los datos asociados. Esta acción no se puede deshacer.',
      {
        title: '¿Eliminar tu cuenta?',
        confirmLabel: 'Eliminar cuenta'
      }
    )
    if (!ok) return

    setDeletingAccount(true)
    try {
      await api.delete('/users/me')
      await logout()
      toast.success('Cuenta eliminada')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo eliminar la cuenta')
    } finally {
      setDeletingAccount(false)
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

                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-muted)' }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <FiUserX className="text-primary-500" size={18} />
                    <h3 className="font-medium">Usuarios bloqueados</h3>
                  </div>
                  <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Personas que bloqueaste. No pueden enviarte mensajes ni ver tu actividad privada.
                  </p>
                  {blockedLoading ? (
                    <div className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      Cargando…
                    </div>
                  ) : blockedUsers.length === 0 ? (
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                    >
                      <FiSlash size={16} />
                      No tienes usuarios bloqueados
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {blockedUsers.map((row) => {
                        const id = row.id || row._id
                        const u = typeof row.user === 'object' ? row.user : null
                        const name = u?.name || 'Usuario'
                        const username = u?.username
                        return (
                          <li
                            key={id}
                            className="flex items-center gap-3 rounded-lg px-3 py-2"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                          >
                            <Avatar user={u || { name, avatar: null }} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{name}</div>
                              {username ? (
                                <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                                  @{username}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnblockUser(row)}
                              disabled={unblockingId === id}
                              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-60"
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#22C55E'
                              }}
                            >
                              {unblockingId === id ? '…' : 'Desbloquear'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)' }}
                >
                  <h3 className="font-medium text-red-400">Eliminar cuenta</h3>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Elimina permanentemente tu cuenta y datos personales de Qyntra Gym.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
                  >
                    <FiTrash2 size={16} />
                    {deletingAccount ? 'Eliminando…' : 'Eliminar mi cuenta'}
                  </button>
                </div>
              </div>
            )}
            
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiBell className="text-primary-500" /> Notificaciones</h2>
                <div className="space-y-4">
                  {[
                    { key: 'push', icon: FiSmartphone, label: 'Notificaciones', desc: 'Recibe alertas en tu dispositivo', handler: handlePushToggle, tour: 'tour-settings-notifications-push' },
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
                  {isNativeApp() && (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 py-3">
                        <div>
                          <div className="font-medium">Burbuja de entrenamiento</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Cronómetro «entrenando» sobre otras apps. Requiere permiso del sistema.
                          </div>
                        </div>
                        <Toggle
                          enabled={workoutBubblePref}
                          onChange={async (v) => {
                            if (!v) {
                              setWorkoutBubblePref(false)
                              setWorkoutBubblePrefState(false)
                              syncBubblePrefsToNative()
                              toast('Burbuja de entrenamiento desactivada')
                              return
                            }
                            const { ensureFeatureOverlay } = await import('../../utils/bubblePrefs')
                            const status = await ensureFeatureOverlay(dialog, 'workout')
                            setWorkoutBubblePrefState(true)
                            syncBubblePrefsToNative()
                            if (status === 'prompted') {
                              toast('Activa “Aparecer encima” y vuelve a Qyntra', { duration: 7000 })
                            } else if (status === 'granted') {
                              toast.success('Burbuja de entrenamiento lista')
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 py-3">
                        <div>
                          <div className="font-medium">Burbujas de chat</div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Cabezas de chat estilo Messenger cuando te escriben fuera de la app.
                          </div>
                        </div>
                        <Toggle
                          enabled={chatBubblesPref}
                          onChange={async (v) => {
                            if (!v) {
                              setChatBubblesPref(false)
                              setChatBubblesPrefState(false)
                              syncBubblePrefsToNative()
                              toast('Burbujas de chat desactivadas')
                              return
                            }
                            const { ensureFeatureOverlay } = await import('../../utils/bubblePrefs')
                            const status = await ensureFeatureOverlay(dialog, 'chat')
                            setChatBubblesPrefState(true)
                            syncBubblePrefsToNative()
                            if (status === 'prompted') {
                              toast('Activa “Aparecer encima” y vuelve a Qyntra', { duration: 7000 })
                            } else if (status === 'granted') {
                              toast.success('Burbujas de chat listas')
                            }
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {activeSection === 'workout' && (
              <div className="space-y-6">
                <h2 className="font-display text-xl flex items-center gap-2"><FiActivity className="text-accent-green" /> Entrenamiento</h2>
                <div className="space-y-4">
                  {isNativeApp() && (
                    <div className="flex items-center justify-between border-b border-white/5 py-3">
                      <div>
                        <div className="font-medium">Burbuja «entrenando»</div>
                        <div className="text-sm text-gray-400">
                          {workoutBubblePref && overlayAccess
                            ? 'Preferencia y permiso activos.'
                            : workoutBubblePref
                              ? 'Preferencia activa — falta permiso del sistema.'
                              : 'Desactivada. Se pedirá al iniciar un entrenamiento.'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary shrink-0 px-3 py-2 text-sm"
                        onClick={async () => {
                          const { ensureFeatureOverlay } = await import('../../utils/bubblePrefs')
                          const status = await ensureFeatureOverlay(dialog, 'workout')
                          setWorkoutBubblePrefState(true)
                          syncBubblePrefsToNative()
                          if (status === 'granted') {
                            toast.success('Burbuja de entrenamiento lista')
                            if (getWorkoutSession()?.activeWorkout) {
                              await forceShowWorkoutOverlay()
                            }
                          } else if (status === 'prompted') {
                            toast('Activa el permiso y vuelve a Qyntra', { duration: 7000 })
                          }
                        }}
                      >
                        {workoutBubblePref && overlayAccess ? 'Activa' : 'Activar'}
                      </button>
                    </div>
                  )}
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
                    <div className="font-medium mb-3">Idioma / Language</div>
                    <select
                      value={settings.language || 'es'}
                      onChange={(e) => {
                        const language = e.target.value
                        setSettings((prev) => ({ ...prev, language }))
                        try {
                          const next = { ...settings, language }
                          localStorage.setItem('qyntra:settings', JSON.stringify(next))
                          if (user?._id) localStorage.setItem(`settings_${user._id}`, JSON.stringify(next))
                        } catch {
                          /* ignore */
                        }
                        import('../../i18n').then(({ notifyLanguageChanged, setDocumentLanguage }) => {
                          setDocumentLanguage(language === 'en' ? 'en' : 'es')
                          notifyLanguageChanged()
                        })
                      }}
                      className="input-field"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                    <p className="mt-2 text-xs text-app-secondary">
                      {(settings.language || 'es') === 'en'
                        ? 'Navigation and key screens switch to English. More screens follow as translations expand.'
                        : 'La navegación y pantallas clave cambian de idioma. Se irán ampliando más textos.'}
                    </p>
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
