export const COLOR_THEMES = [
  { id: 'orange', name: 'Naranja', primary: '#FF6B35', accent: '#00F5FF' },
  { id: 'blue', name: 'Azul', primary: '#3B82F6', accent: '#22D3EE' },
  { id: 'green', name: 'Verde', primary: '#22C55E', accent: '#A855F7' },
  { id: 'purple', name: 'Púrpura', primary: '#A855F7', accent: '#F472B6' },
  { id: 'red', name: 'Rojo', primary: '#EF4444', accent: '#FACC15' },
  { id: 'cyan', name: 'Cian', primary: '#06B6D4', accent: '#F97316' },
  { id: 'pink', name: 'Rosa', primary: '#EC4899', accent: '#8B5CF6' },
  { id: 'yellow', name: 'Dorado', primary: '#EAB308', accent: '#14B8A6' },
  { id: 'teal', name: 'Turquesa', primary: '#14B8A6', accent: '#F97316' },
  { id: 'indigo', name: 'Índigo', primary: '#6366F1', accent: '#22D3EE' },
  { id: 'lime', name: 'Lima', primary: '#84CC16', accent: '#A855F7' },
  { id: 'amber', name: 'Ámbar', primary: '#F59E0B', accent: '#06B6D4' },
  { id: 'rose', name: 'Rosé', primary: '#F43F5E', accent: '#38BDF8' },
  { id: 'sky', name: 'Cielo', primary: '#0EA5E9', accent: '#F472B6' },
  { id: 'violet', name: 'Violeta', primary: '#7C3AED', accent: '#34D399' },
  { id: 'emerald', name: 'Esmeralda', primary: '#10B981', accent: '#FBBF24' },
  { id: 'fuchsia', name: 'Fucsia', primary: '#D946EF', accent: '#22D3EE' },
  { id: 'coral', name: 'Coral', primary: '#FF7F50', accent: '#60A5FA' },
  { id: 'mint', name: 'Menta', primary: '#2DD4BF', accent: '#FB7185' },
  { id: 'sunset', name: 'Atardecer', primary: '#FB923C', accent: '#C084FC' },
  { id: 'ocean', name: 'Océano', primary: '#0284C7', accent: '#4ADE80' },
  { id: 'berry', name: 'Mora', primary: '#DB2777', accent: '#A3E635' },
  { id: 'steel', name: 'Acero', primary: '#64748B', accent: '#38BDF8' },
  { id: 'neon', name: 'Neón', primary: '#39FF14', accent: '#FF00FF' },
]

const SETTINGS_KEY_PREFIX = 'settings_'

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveMode(themePreference = 'light') {
  if (themePreference === 'dark') return 'dark'
  if (themePreference === 'system') return prefersDark() ? 'dark' : 'light'
  return 'light'
}

export function applyColorTheme(colorThemeId = 'orange') {
  const theme = COLOR_THEMES.find((t) => t.id === colorThemeId) || COLOR_THEMES[0]
  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-accent', theme.accent)
  root.style.setProperty('--color-primary-rgb', hexToRgb(theme.primary))
  root.style.setProperty('--color-accent-rgb', hexToRgb(theme.accent))
  return theme
}

export function applyThemeMode(themePreference = 'light') {
  const mode = resolveMode(themePreference)
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.dataset.theme = mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'light' ? '#F4F5F7' : '#0A0A0F')
  try {
    window.dispatchEvent(new CustomEvent('qyntra:theme', { detail: { mode } }))
  } catch {
    /* ignore */
  }
  return mode
}

export function applyAppearanceSettings(settings = {}) {
  applyColorTheme(settings.colorTheme || 'orange')
  applyThemeMode(settings.theme || 'light')

  if (settings.accessibility?.fontSize) {
    const fontSizeMap = { small: '14px', medium: '16px', large: '18px' }
    document.documentElement.style.setProperty(
      '--font-size-base',
      fontSizeMap[settings.accessibility.fontSize] || '16px'
    )
  }

  if (settings.accessibility?.reducedMotion) {
    document.documentElement.classList.add('reduce-motion')
  } else {
    document.documentElement.classList.remove('reduce-motion')
  }

  if (settings.accessibility?.highContrast) {
    document.documentElement.classList.add('high-contrast')
  } else {
    document.documentElement.classList.remove('high-contrast')
  }
}

export function loadCachedSettings(userId) {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${userId}`) || localStorage.getItem('qyntra:appearance')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function cacheAppearance(settings) {
  try {
    localStorage.setItem(
      'qyntra:appearance',
      JSON.stringify({
        theme: settings.theme || 'light',
        colorTheme: settings.colorTheme || 'orange',
        accessibility: settings.accessibility || {}
      })
    )
  } catch {
    /* ignore */
  }
}

function hexToRgb(hex) {
  const cleaned = String(hex || '').replace('#', '')
  if (cleaned.length !== 6) return '255, 107, 53'
  const num = parseInt(cleaned, 16)
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
}

let systemListenerBound = false

export function bindSystemThemeListener(getPreference) {
  if (systemListenerBound) return
  systemListenerBound = true
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    const pref = typeof getPreference === 'function' ? getPreference() : 'system'
    if (pref === 'system') applyThemeMode('system')
  }
  mq.addEventListener?.('change', handler)
}

// Apply cached appearance ASAP (before React paints)
try {
  const cached = loadCachedSettings(null)
  if (cached) applyAppearanceSettings(cached)
  else applyAppearanceSettings({ theme: 'light', colorTheme: 'orange' })
} catch {
  applyAppearanceSettings({ theme: 'light', colorTheme: 'orange' })
}
