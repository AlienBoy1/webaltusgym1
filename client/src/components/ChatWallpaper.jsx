/** Gym-native animated chat wallpapers. Default = none (theme adaptive). */

export const CHAT_WALLPAPER_NONE = 'none'

export const CHAT_WALLPAPER_STYLES = [
  {
    id: 'nebula',
    name: 'Voltaje Qyntra',
    subtitle: 'Energía eléctrica',
    className: 'chat-wall-nebula',
    swatch: 'linear-gradient(135deg,#FF6B35,#00F5FF)'
  },
  {
    id: 'grid',
    name: 'Pista de hierro',
    subtitle: 'Marcas de cancha',
    className: 'chat-wall-grid',
    swatch: 'linear-gradient(135deg,#1a1a1a,#FF6B35 55%,#333)'
  },
  {
    id: 'aurora',
    name: 'Afterburn',
    subtitle: 'Estela de rendimiento',
    className: 'chat-wall-aurora',
    swatch: 'linear-gradient(135deg,#00F5FF,#7C3AED,#FF6B35)'
  },
  {
    id: 'pulse',
    name: 'Latido athlete',
    subtitle: 'Ritmo cardíaco',
    className: 'chat-wall-pulse',
    swatch: 'radial-gradient(circle,#ef4444,#7f1d1d)'
  },
  {
    id: 'waves',
    name: 'Hidratación',
    subtitle: 'Recuperación azul',
    className: 'chat-wall-waves',
    swatch: 'linear-gradient(135deg,#0369a1,#22d3ee)'
  },
  {
    id: 'ember',
    name: 'Forja',
    subtitle: 'Hierro al rojo',
    className: 'chat-wall-ember',
    swatch: 'linear-gradient(180deg,#1c0802,#ea580c 50%,#fbbf24)'
  },
  {
    id: 'mist',
    name: 'Carbono',
    subtitle: 'Textura premium',
    className: 'chat-wall-mist',
    swatch: 'linear-gradient(135deg,#111,#555,#222)'
  },
  {
    id: 'orbit',
    name: 'Medalla PR',
    subtitle: 'Récord personal',
    className: 'chat-wall-orbit',
    swatch: 'radial-gradient(circle,#1e293b,#fbbf24 45%,#0f172a)'
  }
]

export function isStyledWallpaper(styleId) {
  return Boolean(styleId && styleId !== CHAT_WALLPAPER_NONE && CHAT_WALLPAPER_STYLES.some((s) => s.id === styleId))
}

export function getChatWallpaper(peerId) {
  try {
    const raw = localStorage.getItem(`qyntra_chat_wall:${peerId}`)
    if (!raw || raw === CHAT_WALLPAPER_NONE) return CHAT_WALLPAPER_NONE
    if (CHAT_WALLPAPER_STYLES.some((s) => s.id === raw)) return raw
  } catch {
    /* ignore */
  }
  return CHAT_WALLPAPER_NONE
}

export function setChatWallpaper(peerId, styleId) {
  try {
    const key = `qyntra_chat_wall:${peerId}`
    if (!styleId || styleId === CHAT_WALLPAPER_NONE) {
      localStorage.removeItem(key)
      return
    }
    if (CHAT_WALLPAPER_STYLES.some((s) => s.id === styleId)) {
      localStorage.setItem(key, styleId)
    }
  } catch {
    /* ignore */
  }
}

export default function ChatWallpaper({ styleId = CHAT_WALLPAPER_NONE }) {
  if (!isStyledWallpaper(styleId)) {
    return (
      <div
        className="chat-wall-none pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      />
    )
  }
  const style = CHAT_WALLPAPER_STYLES.find((s) => s.id === styleId)
  return (
    <div
      className={`chat-wallpaper pointer-events-none absolute inset-0 overflow-hidden ${style.className}`}
      aria-hidden
    >
      <span className="chat-wall-layer chat-wall-base" />
      <span className="chat-wall-layer chat-wall-a" />
      <span className="chat-wall-layer chat-wall-b" />
      <span className="chat-wall-layer chat-wall-c" />
      <span className="chat-wall-layer chat-wall-motif" />
      <span className="chat-wall-layer chat-wall-vignette" />
      <span className="chat-wall-layer chat-wall-noise" />
    </div>
  )
}
