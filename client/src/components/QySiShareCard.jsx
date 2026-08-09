import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiCpu } from 'react-icons/fi'
import { QISI_HANDLE, QISI_MEANING, QISI_NAME, QISI_USERNAME } from '../utils/qisi'
import { getProfilePath } from '../utils/appLinks'
import { QYSI_AVATAR_SRC } from './QySiAvatar'

/**
 * Build structured payload for chat attachments + community workoutData.
 */
export function buildQySiSharePayload(qysiUser = null) {
  const username = qysiUser?.username || QISI_USERNAME
  return {
    shareKind: 'qysi',
    kind: 'qysi_share',
    name: QISI_NAME,
    handle: QISI_HANDLE,
    username,
    userId: qysiUser?._id || qysiUser?.id || null,
    meaning: QISI_MEANING,
    avatar: QYSI_AVATAR_SRC,
    path: getProfilePath(username),
    chips: ['5 variantes', 'Tu nivel', 'Entrenamientos']
  }
}

export function isQySiShareData(data) {
  if (!data || typeof data !== 'object') return false
  if (data.shareKind === 'qysi' || data.kind === 'qysi_share') return true
  return data.type === 'profile' && (data.kind === 'qysi_share' || data.username === QISI_USERNAME)
}

/**
 * Premium native QySi profile share card (chat / feed / composer).
 *
 * @param {'chat'|'feed'|'compact'} variant
 */
export default function QySiShareCard({
  data = null,
  variant = 'feed',
  onOpen,
  className = '',
  interactive = true,
  ctaLabel = 'Ver perfil'
}) {
  const navigate = useNavigate()
  const payload = data && typeof data === 'object' ? data : buildQySiSharePayload()
  const name = payload.name || QISI_NAME
  const handle = payload.handle || QISI_HANDLE
  const meaning = payload.meaning || QISI_MEANING
  const avatar = payload.avatar || QYSI_AVATAR_SRC
  const path = payload.path || getProfilePath(payload.username || QISI_USERNAME)
  const chips = Array.isArray(payload.chips) ? payload.chips : ['5 variantes', 'Tu nivel', 'Entrenamientos']

  const open = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!interactive) return
    if (onOpen) {
      onOpen(payload)
      return
    }
    navigate(path)
  }

  const isChat = variant === 'chat'
  const isCompact = variant === 'compact'

  const inner = (
    <>
      <div
        className={`pointer-events-none absolute inset-0 opacity-90 ${
          isChat
            ? 'bg-gradient-to-br from-[rgba(var(--color-primary-rgb),0.28)] via-[color:var(--bg-elevated)] to-[color:var(--bg-elevated)]'
            : 'bg-gradient-to-br from-[rgba(var(--color-primary-rgb),0.2)] via-[rgba(var(--color-accent-rgb),0.06)] to-transparent'
        }`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[rgba(var(--color-primary-rgb),0.22)] blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-[rgba(var(--color-accent-rgb),0.14)] blur-xl"
        aria-hidden
      />

      <div className={`relative ${isCompact ? 'p-3' : isChat ? 'p-3.5' : 'p-4'}`}>
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span
              className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-accent)] opacity-90"
              aria-hidden
            />
            <img
              src={avatar}
              alt=""
              className={`relative rounded-full object-cover ring-2 ring-[color:var(--bg-elevated)] ${
                isCompact ? 'h-12 w-12' : isChat ? 'h-14 w-14' : 'h-16 w-16'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`font-semibold uppercase tracking-[0.16em] text-[color:var(--color-primary)] ${
                isCompact ? 'text-[9px]' : 'text-[10px]'
              }`}
            >
              Sistema inteligente
            </p>
            <p
              className={`mt-0.5 truncate font-display tracking-wide text-[color:var(--text-primary)] ${
                isCompact ? 'text-lg' : isChat ? 'text-xl' : 'text-2xl'
              }`}
            >
              {name}
            </p>
            <p className="truncate text-xs font-medium text-[color:var(--color-primary)]">@{handle}</p>
            {!isCompact && (
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-[color:var(--text-secondary)] sm:text-[13px]">
                {meaning}. Entrena con variantes listas según tu nivel.
              </p>
            )}
          </div>
        </div>

        {!isCompact && chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-[rgba(var(--color-primary-rgb),0.28)] bg-[rgba(var(--color-primary-rgb),0.1)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text-primary)] sm:text-[11px]"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {isCompact && (
          <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[color:var(--text-secondary)]">
            {meaning} · @{handle}
          </p>
        )}

        <div
          className={`mt-3 flex items-center justify-between rounded-xl border border-[rgba(var(--color-primary-rgb),0.28)] bg-[rgba(var(--color-primary-rgb),0.12)] ${
            isCompact ? 'px-3 py-2' : 'px-3.5 py-2.5'
          }`}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-primary)]">
            <FiCpu size={15} />
            {ctaLabel}
          </span>
          <FiArrowRight size={16} className="text-[color:var(--color-primary)]" />
        </div>
      </div>
    </>
  )

  const shellClass = `relative overflow-hidden rounded-2xl border border-[rgba(var(--color-primary-rgb),0.32)] bg-[color:var(--bg-elevated)] text-left shadow-[0_10px_28px_rgba(0,0,0,0.12)] transition ${
    interactive ? 'hover:border-[rgba(var(--color-primary-rgb),0.5)] active:scale-[0.99]' : ''
  } ${isChat ? 'w-[min(260px,78vw)]' : 'w-full'} ${className}`

  if (!interactive) {
    return <div className={shellClass}>{inner}</div>
  }

  return (
    <button type="button" data-no-swipe data-no-post-open onClick={open} className={shellClass}>
      {inner}
    </button>
  )
}
