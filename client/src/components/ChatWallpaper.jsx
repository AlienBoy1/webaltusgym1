/** Chat wallpaper styles — visually distinct, theme-adaptive, animated */

export const CHAT_WALLPAPER_STYLES = [
  { id: 'nebula', name: 'Nebulosa', className: 'chat-wall-nebula', swatch: 'linear-gradient(135deg,#7c3aed,#22d3ee)' },
  { id: 'grid', name: 'Cuadrícula', className: 'chat-wall-grid', swatch: 'linear-gradient(135deg,#0f172a,#38bdf8)' },
  { id: 'aurora', name: 'Aurora', className: 'chat-wall-aurora', swatch: 'linear-gradient(135deg,#10b981,#6366f1,#ec4899)' },
  { id: 'pulse', name: 'Pulso', className: 'chat-wall-pulse', swatch: 'radial-gradient(circle,#f97316,#7c2d12)' },
  { id: 'waves', name: 'Olas', className: 'chat-wall-waves', swatch: 'linear-gradient(135deg,#0284c7,#67e8f9)' },
  { id: 'ember', name: 'Ember', className: 'chat-wall-ember', swatch: 'linear-gradient(180deg,#451a03,#ea580c 60%,#fbbf24)' },
  { id: 'mist', name: 'Niebla', className: 'chat-wall-mist', swatch: 'linear-gradient(135deg,#64748b,#e2e8f0,#94a3b8)' },
  { id: 'orbit', name: 'Órbita', className: 'chat-wall-orbit', swatch: 'radial-gradient(circle,#1e1b4b,#a78bfa 40%,#312e81)' }
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
    <div
      className={`chat-wallpaper pointer-events-none absolute inset-0 overflow-hidden ${style.className}`}
      aria-hidden
    >
      <span className="chat-wall-layer chat-wall-base" />
      <span className="chat-wall-layer chat-wall-a" />
      <span className="chat-wall-layer chat-wall-b" />
      <span className="chat-wall-layer chat-wall-c" />
      <span className="chat-wall-layer chat-wall-noise" />
    </div>
  )
}
