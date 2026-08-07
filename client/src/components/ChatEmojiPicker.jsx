import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiSearch, FiX } from 'react-icons/fi'

const CATEGORIES = [
  {
    id: 'smileys',
    label: '😊',
    title: 'Emociones',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲',
      '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨',
      '🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎',
      '🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖',
      '😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽',
      '👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'
    ]
  },
  {
    id: 'gestures',
    label: '👋',
    title: 'Gestos',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️',
      '👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾','🦵','🦶','👂','👃','🧠',
      '👀','👁️','👅','👄','🫦','💋','🩸'
    ]
  },
  {
    id: 'hearts',
    label: '❤️',
    title: 'Corazones',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
      '💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎',
      '💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗨️','🗯️','💭','💤'
    ]
  },
  {
    id: 'activity',
    label: '🏋️',
    title: 'Deporte',
    emojis: [
      '🏋️','🏋️‍♂️','🏋️‍♀️','🤸','🤼','⛹️','🤾','🏌️','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🥇','🥈','🥉','🏆','🏅',
      '🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎯','🎳','🎮','🕹️',
      '🎰','🎲','♟️','🧩','🧸','♠️','♥️','♦️','♣️','♟️','🃏','🀄','🎴','🎭','🖼️','🎨','🧵','🪡','🧶','🪢'
    ]
  },
  {
    id: 'food',
    label: '🍎',
    title: 'Comida',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
      '🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳',
      '🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','burrito','🫔','🥗',
      '🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡',
      '🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕',
      '🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'
    ]
  },
  {
    id: 'objects',
    label: '✨',
    title: 'Objetos',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥',
      '📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋',
      '🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛',
      '🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️',
      '🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠',
      '🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑',
      '🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊',
      '🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷️','🪧','📪','📫','📬','📭','📮',
      '📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁',
      '📂','🗂️','🗞️','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏',
      '🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓'
    ]
  },
  {
    id: 'symbols',
    label: '🔥',
    title: 'Símbolos',
    emojis: [
      '🔥','⭐','🌟','✨','⚡','💥','💢','💦','💨','🕳️','✅','❌','⭕','❗','❓','❕','❔','‼️','⁉️','🔴',
      '🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','🟫','⬛','⬜','◼️','◻️','◾',
      '◽','▪️','▫️','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔳','🔲','🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️',
      '🏴‍☠️','⬆️','↗️','➡️','↘️','⬇️','↙️','⬅️','↖️','↕️','↔️','↩️','↪️','⤴️','⤵️','🔃','🔄','🔙','🔚','🔛',
      '🔜','🔝'
    ]
  }
]

/**
 * Native WhatsApp-style emoji panel — no third-party packages.
 */
export default function ChatEmojiPicker({ open, onClose, onPick, anchor = 'composer' }) {
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [q, setQ] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setQ('')
      return undefined
    }
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const active = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0]

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return active.emojis
    // Search across all when typing
    const all = CATEGORIES.flatMap((c) => c.emojis)
    // Lightweight: filter by including query as substring of known pairs isn't possible for emoji chars —
    // keep category view when empty, show popular set filtered by nothing useful — just return active.
    return all.filter((e) => e.includes(term)).slice(0, 80)
  }, [q, active])

  const list = q.trim() ? filtered : active.emojis

  const panel = (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: 'spring', damping: 26, stiffness: 360 }}
      className={`w-full max-w-[22rem] overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl ${
        anchor === 'overlay'
          ? ''
          : anchor === 'composer'
            ? 'absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-40 sm:right-auto'
            : 'absolute bottom-14 right-3 z-40 w-[min(100%,22rem)]'
      }`}
      style={{ maxHeight: 'min(52vh, 360px)' }}
      role="dialog"
      aria-label="Emojis"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-2.5 py-2">
        <div className="relative flex-1 min-w-0">
          <FiSearch
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar emoji…"
            className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] py-2 pl-8 pr-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
          aria-label="Cerrar emojis"
        >
          <FiX size={16} />
        </button>
      </div>

      {!q.trim() && (
        <div className="flex gap-0.5 overflow-x-auto border-b border-[color:var(--border-subtle)] px-1.5 py-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.title}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-xl px-2.5 py-1.5 text-lg transition ${
                category === c.id
                  ? 'bg-[rgba(var(--color-primary-rgb),0.16)]'
                  : 'hover:bg-[color:var(--bg-muted)]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-y-auto p-2" style={{ maxHeight: 'min(38vh, 260px)' }}>
        {!q.trim() && (
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            {active.title}
          </p>
        )}
        <div className="grid grid-cols-8 gap-0.5">
          {list.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => onPick?.(emoji)}
              className="flex aspect-square items-center justify-center rounded-xl text-[1.35rem] leading-none transition hover:bg-[color:var(--bg-muted)] active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
        {list.length === 0 && (
          <p className="py-8 text-center text-sm text-[color:var(--text-muted)]">Sin resultados</p>
        )}
      </div>
    </motion.div>
  )

  // Overlay mode: portal + flexbox center (avoid left-1/2 + translate — Framer overwrites transform)
  if (anchor === 'overlay') {
    if (typeof document === 'undefined') return null
    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            key="emoji-overlay-root"
            className="fixed inset-0 z-[200] flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-black/25"
              aria-label="Cerrar emojis"
              onClick={onClose}
            />
            <div className="relative z-10 w-full max-w-[22rem]">{panel}</div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  return <AnimatePresence>{open ? panel : null}</AnimatePresence>
}
