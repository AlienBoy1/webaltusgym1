/**
 * Lightweight ES/EN i18n. Language comes from Settings → Apariencia.
 */
const STORAGE_KEY = 'qyntra:settings'

const dict = {
  es: {
    nav_home: 'Inicio',
    nav_social: 'Social',
    nav_workouts: 'Entrenos',
    nav_progress: 'Progreso',
    nav_profile: 'Perfil',
    nav_classes: 'Clases',
    nav_challenges: 'Retos',
    nav_chat: 'Mensajes',
    nav_notifications: 'Notificaciones',
    nav_settings: 'Ajustes',
    training: 'Entrenando',
    notifications: 'Notificaciones',
    notifications_desc: 'Recibe alertas en tu dispositivo',
    pull_refresh: 'Actualizar',
    share_failed_image: 'No se pudo compartir la imagen',
    storage_needed: 'Activa el acceso a multimedia en Ajustes → Permisos',
    challenges_load_error: 'Error al cargar retos',
    language: 'Idioma'
  },
  en: {
    nav_home: 'Home',
    nav_social: 'Social',
    nav_workouts: 'Workouts',
    nav_progress: 'Progress',
    nav_profile: 'Profile',
    nav_classes: 'Classes',
    nav_challenges: 'Challenges',
    nav_chat: 'Messages',
    nav_notifications: 'Notifications',
    nav_settings: 'Settings',
    training: 'Training',
    notifications: 'Notifications',
    notifications_desc: 'Get alerts on your device',
    pull_refresh: 'Refresh',
    share_failed_image: 'Could not share the image',
    storage_needed: 'Enable media access in Settings → Permissions',
    challenges_load_error: 'Failed to load challenges',
    language: 'Language'
  }
}

export function getAppLanguage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const lang = String(parsed?.language || 'es').toLowerCase()
      if (lang.startsWith('en')) return 'en'
      return 'es'
    }
    // Fallback: per-user settings key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('settings_')) {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}')
        const lang = String(parsed?.language || '').toLowerCase()
        if (lang.startsWith('en')) return 'en'
        if (lang.startsWith('es')) return 'es'
      }
    }
  } catch {
    /* ignore */
  }
  return 'es'
}

export function t(key, lang = getAppLanguage()) {
  const table = dict[lang] || dict.es
  return table[key] || dict.es[key] || key
}

export function setDocumentLanguage(lang = getAppLanguage()) {
  try {
    document.documentElement.lang = lang === 'en' ? 'en' : 'es'
  } catch {
    /* ignore */
  }
}

/** Subscribe to settings/language changes */
export function subscribeLanguage(callback) {
  const fire = () => callback(getAppLanguage())
  const onStorage = (e) => {
    if (!e || e.key === STORAGE_KEY || e.key === null) fire()
  }
  const onCustom = () => fire()
  window.addEventListener('storage', onStorage)
  window.addEventListener('qyntra:settings', onCustom)
  window.addEventListener('qyntra:language', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('qyntra:settings', onCustom)
    window.removeEventListener('qyntra:language', onCustom)
  }
}

export function notifyLanguageChanged() {
  try {
    window.dispatchEvent(new CustomEvent('qyntra:language'))
  } catch {
    /* ignore */
  }
}
