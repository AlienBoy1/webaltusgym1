/** Chat wallpaper styles — adaptive to theme tokens + animated */

export const CHAT_WALLPAPER_STYLES = [
  {
    id: 'nebula',
    name: 'Nebulosa',
    className: 'chat-wall-nebula'
  },
  {
    id: 'grid',
    name: 'Cuadrícula',
    className: 'chat-wall-grid'
  },
  {
    id: 'aurora',
    name: 'Aurora',
    className: 'chat-wall-aurora'
  },
  {
    id: 'pulse',
    name: 'Pulso',
    className: 'chat-wall-pulse'
  },
  {
    id: 'waves',
    name: 'Olas',
    className: 'chat-wall-waves'
  },
  {
    id: 'ember',
    name: 'Ember',
    className: 'chat-wall-ember'
  },
  {
    id: 'mist',
    name: 'Niebla',
    className: 'chat-wall-mist'
  },
  {
    id: 'orbit',
    name: 'Órbita',
    className: 'chat-wall-orbit'
  }
]

export function getChatWallpaper(peerId) {
  try {
    const raw = localStorage.getItem(`qyntra_chat_wall:${peerId}`)
    if (raw && CHAT_WALLPAPER_STYLES.some((s) => s.id === raw)) return raw
  } catch {
    /* ignore */
  }
  return 'nebula'
}

export function setChatWallpaper(peerId, styleId) {
  try {
    localStorage.setItem(`qyntra_chat_wall:${peerId}`, styleId)
  } catch {
    /* ignore */
  }
}

export default function ChatWallpaper({ styleId = 'nebula' }) {
  const style = CHAT_WALLPAPER_STYLES.find((s) => s.id === styleId) || CHAT_WALLPAPER_STYLES[0]
  return (
    <div className={`chat-wallpaper pointer-events-none absolute inset-0 overflow-hidden ${style.className}`} aria-hidden>
      <span className="chat-wall-layer chat-wall-a" />
      <span className="chat-wall-layer chat-wall-b" />
      <span className="chat-wall-layer chat-wall-c" />
    </div>
  )
}
