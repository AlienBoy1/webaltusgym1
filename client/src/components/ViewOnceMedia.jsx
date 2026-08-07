import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiLock, FiPlay, FiX } from 'react-icons/fi'
import ViewOnceIcon from './ViewOnceIcon'
import VoiceNotePlayer from './VoiceNotePlayer'
import ProtectedMedia from './ProtectedMedia'

function OpenedPlaceholder({ type, isMe, hasText }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${hasText ? 'mb-2' : ''} ${
        isMe ? 'bg-black/15 text-white/85' : 'bg-black/25 text-[color:var(--text-primary)]'
      }`}
    >
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${isMe ? 'bg-white/15' : 'bg-[color:var(--bg-muted)]'}`}>
        <ViewOnceIcon size={18} />
      </span>
      <span className="text-sm font-medium">{type === 'audio' ? 'Audio abierto' : 'Foto abierta'}</span>
    </div>
  )
}

function LockedBubble({ type, durationSec, isMe, hasText, onOpen, loading }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={loading}
      className={`flex w-full min-w-[12rem] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:opacity-95 disabled:opacity-60 ${
        hasText ? 'mb-2' : ''
      } ${isMe ? 'bg-black/15 text-white' : 'bg-black/30 text-[color:var(--text-primary)]'}`}
    >
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          isMe ? 'bg-white/18' : 'bg-[rgba(var(--color-primary-rgb),0.16)] text-[color:var(--color-primary)]'
        }`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
        ) : type === 'audio' ? (
          <FiPlay size={18} fill="currentColor" className="ml-0.5" />
        ) : (
          <FiLock size={18} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <ViewOnceIcon size={16} active={!isMe} />
          {type === 'audio' ? 'Audio' : 'Foto'}
        </span>
        <span className={`block text-[11px] ${isMe ? 'text-white/65' : 'text-[color:var(--text-muted)]'}`}>
          {type === 'audio'
            ? `Toca para escuchar · ${Math.max(1, Math.floor(durationSec || 1))}s · 1 vez`
            : 'Toca para ver · 1 vez'}
        </span>
      </span>
    </button>
  )
}

function ViewOnceViewer({ url, type, durationSec, localOnly, onClose }) {
  const audioRef = useRef(null)
  const [doneHint, setDoneHint] = useState(false)

  useEffect(() => {
    if (type !== 'audio') return undefined
    const el = audioRef.current
    if (!el) return undefined
    const play = async () => {
      try {
        await el.play()
      } catch {
        /* ignore autoplay block */
      }
    }
    play()
    const onEnded = () => {
      setDoneHint(true)
      if (!localOnly) window.setTimeout(onClose, 500)
    }
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
  }, [type, url, localOnly, onClose])

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="rounded-full p-2.5 hover:bg-white/10" aria-label="Cerrar">
          <FiX size={24} />
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
          <ViewOnceIcon size={18} active />
          {localOnly ? 'Vista previa' : 'Solo una vez'}
        </span>
        <span className="w-10" />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {type === 'image' ? (
          <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#16161c] p-5">
            <audio ref={audioRef} src={url} playsInline className="hidden" />
            <VoiceNotePlayer src={url} durationSec={durationSec} isMe avatar={null} name="" />
            {doneHint ? <p className="mt-3 text-center text-xs text-white/55">Audio reproducido</p> : null}
          </div>
        )}
      </div>
      {type === 'image' && !localOnly ? (
        <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/50">
          Al cerrar no podrás volver a verla
        </p>
      ) : (
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))]" />
      )}
    </div>
  )
}

/**
 * View-once image/audio bubble + one-shot fullscreen viewer.
 */
export function ViewOnceAttachmentBubble({
  messageId,
  attachment,
  isMe,
  hasText,
  avatar,
  name,
  onOpenOnce
}) {
  const [opening, setOpening] = useState(false)
  const [session, setSession] = useState(null)
  const [showViewer, setShowViewer] = useState(false)

  if (!attachment?.viewOnce) return null

  if (attachment.opened && !session) {
    return <OpenedPlaceholder type={attachment.type} isMe={isMe} hasText={hasText} />
  }

  if (isMe && attachment.url && !attachment.opened) {
    if (attachment.type === 'audio') {
      return (
        <div className={hasText ? 'mb-2' : ''}>
          <div className="mb-1 flex items-center gap-1 text-[11px] text-white/70">
            <ViewOnceIcon size={14} />
            Ver una vez
          </div>
          <VoiceNotePlayer
            src={attachment.url}
            durationSec={attachment.durationSec}
            isMe
            avatar={avatar}
            name={name}
          />
        </div>
      )
    }
    if (attachment.type === 'image') {
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setSession({ url: attachment.url, type: 'image', localOnly: true })
              setShowViewer(true)
            }}
            className={`block overflow-hidden rounded-xl text-left ${hasText ? 'mb-2' : ''}`}
          >
            <div className="mb-1 flex items-center gap-1 px-0.5 text-[11px] text-white/70">
              <ViewOnceIcon size={14} />
              Ver una vez
            </div>
            {String(attachment.url).startsWith('data:') ? (
              <img src={attachment.url} alt="" className="max-h-64 max-w-full object-cover" />
            ) : (
              <ProtectedMedia src={attachment.url} alt="" className="max-h-64 max-w-full object-cover" />
            )}
          </button>
          {showViewer && session && typeof document !== 'undefined'
            ? createPortal(
                <ViewOnceViewer
                  url={session.url}
                  type={session.type}
                  durationSec={session.durationSec}
                  localOnly
                  onClose={() => {
                    setShowViewer(false)
                    setSession(null)
                  }}
                />,
                document.body
              )
            : null}
        </>
      )
    }
  }

  const handleOpen = async () => {
    if (opening || session || !messageId) return
    setOpening(true)
    try {
      const media = await onOpenOnce(messageId)
      if (!media?.url) return
      setSession({
        url: media.url,
        type: media.type || attachment.type,
        durationSec: media.durationSec || attachment.durationSec,
        localOnly: false
      })
      setShowViewer(true)
    } finally {
      setOpening(false)
    }
  }

  return (
    <>
      {!session ? (
        <LockedBubble
          type={attachment.type}
          durationSec={attachment.durationSec}
          isMe={isMe}
          hasText={hasText}
          onOpen={handleOpen}
          loading={opening}
        />
      ) : (
        <OpenedPlaceholder type={attachment.type} isMe={isMe} hasText={hasText} />
      )}
      {showViewer && session && typeof document !== 'undefined'
        ? createPortal(
            <ViewOnceViewer
              url={session.url}
              type={session.type}
              durationSec={session.durationSec}
              localOnly={Boolean(session.localOnly)}
              onClose={() => {
                setShowViewer(false)
                if (!session.localOnly) setSession((s) => (s ? { ...s, closed: true } : s))
              }}
            />,
            document.body
          )
        : null}
    </>
  )
}
