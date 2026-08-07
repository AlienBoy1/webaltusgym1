import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import ViewOnceIcon from './ViewOnceIcon'
import VoiceNotePlayer from './VoiceNotePlayer'

function OpenedPlaceholder({ type, isMe, onPress }) {
  return (
    <button
      type="button"
      data-no-swipe
      onClick={() => onPress?.(type)}
      className={`flex min-w-[11rem] items-center gap-3 rounded-xl px-1 py-1 text-left transition enabled:active:scale-[0.99] ${
        isMe ? 'text-white' : 'text-[color:var(--text-primary)]'
      }`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          isMe ? 'bg-white/15 text-white/75' : 'bg-black/10 text-[color:var(--text-muted)]'
        }`}
      >
        <ViewOnceIcon size={22} />
      </span>
      <span className={`text-[15px] font-medium capitalize ${isMe ? 'text-white/85' : 'text-[color:var(--text-secondary)]'}`}>
        Abierto
      </span>
    </button>
  )
}

/** WhatsApp-like locked row: icon + Foto/Audio (no thumbnail). */
function LockedBubble({ type, isMe, onOpen, loading }) {
  return (
    <button
      type="button"
      data-no-swipe
      onClick={onOpen}
      disabled={loading}
      className={`flex min-w-[11.5rem] items-center gap-3 rounded-xl px-1 py-1 text-left transition enabled:active:scale-[0.99] disabled:opacity-60 ${
        isMe ? 'text-white' : 'text-[color:var(--text-primary)]'
      }`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          isMe
            ? 'bg-white/18 text-white'
            : 'bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]'
        }`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
        ) : (
          <ViewOnceIcon size={22} active={!isMe} />
        )}
      </span>
      <span className="text-[16px] font-semibold tracking-wide">{type === 'audio' ? 'Audio' : 'Foto'}</span>
    </button>
  )
}

function ViewOnceViewer({ url, type, durationSec, caption, onClose }) {
  const audioRef = useRef(null)
  const closedRef = useRef(false)

  const closeOnce = () => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }

  useEffect(() => {
    if (type !== 'audio') return undefined
    const el = audioRef.current
    if (!el) return undefined
    const play = async () => {
      try {
        await el.play()
      } catch {
        /* ignore */
      }
    }
    play()
    const onEnded = () => window.setTimeout(closeOnce, 350)
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, url])

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={closeOnce} className="rounded-full p-2.5 hover:bg-white/10" aria-label="Cerrar">
          <FiX size={24} />
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
          <ViewOnceIcon size={18} active />
          Solo una vez
        </span>
        <span className="w-10" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4">
        {type === 'image' ? (
          <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#16161c] p-5">
            <audio ref={audioRef} src={url} playsInline className="hidden" />
            <VoiceNotePlayer src={url} durationSec={durationSec} isMe avatar={null} name="" />
          </div>
        )}
        {caption ? (
          <p className="max-w-md text-center text-sm text-white/85">{caption}</p>
        ) : null}
      </div>
      <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/50">
        {type === 'audio' ? 'Al terminar no podrás volver a escucharlo' : 'Al cerrar no podrás volver a verla'}
      </p>
    </div>
  )
}

/**
 * View-once image/audio — WhatsApp style (locked, then "Abierto", never reopen).
 */
export function ViewOnceAttachmentBubble({
  messageId,
  attachment,
  isMe,
  caption = '',
  onOpenOnce,
  onAlreadyOpened,
  onMarkOpened
}) {
  const [opening, setOpening] = useState(false)
  const [session, setSession] = useState(null)
  const [showViewer, setShowViewer] = useState(false)
  const [consumed, setConsumed] = useState(() =>
    Boolean(attachment?.opened || attachment?.viewedByMe || (attachment?.viewOnce && !attachment?.url))
  )

  useEffect(() => {
    if (attachment?.opened || attachment?.viewedByMe || (attachment?.viewOnce && !attachment?.url)) {
      setConsumed(true)
    }
  }, [attachment?.opened, attachment?.viewedByMe, attachment?.url, attachment?.viewOnce])

  if (!attachment?.viewOnce) return null

  if (consumed && !showViewer) {
    return <OpenedPlaceholder type={attachment.type} isMe={isMe} onPress={onAlreadyOpened} />
  }

  const finishConsumed = () => {
    setConsumed(true)
    setShowViewer(false)
    setSession(null)
    onMarkOpened?.(messageId)
  }

  const handleOpen = async () => {
    if (opening || consumed) {
      if (consumed) onAlreadyOpened?.(attachment.type)
      return
    }

    if (attachment.opened || attachment.viewedByMe || !attachment.url) {
      setConsumed(true)
      onAlreadyOpened?.(attachment.type)
      return
    }

    // Recipient: scrub on server first, then show once
    if (!isMe) {
      if (!messageId) return
      setOpening(true)
      try {
        const media = await onOpenOnce(messageId)
        if (!media?.url) {
          setConsumed(true)
          onAlreadyOpened?.(attachment.type)
          return
        }
        // Lock immediately so close / remount can't reopen
        setConsumed(true)
        onMarkOpened?.(messageId)
        setSession({
          url: media.url,
          type: media.type || attachment.type,
          durationSec: media.durationSec || attachment.durationSec,
          caption
        })
        setShowViewer(true)
      } finally {
        setOpening(false)
      }
      return
    }

    // Sender preview: still one session view, then marks Abierto locally until peer opens (peer open updates via sync)
    setConsumed(true)
    setSession({
      url: attachment.url,
      type: attachment.type,
      durationSec: attachment.durationSec,
      caption
    })
    setShowViewer(true)
  }

  return (
    <>
      {!showViewer ? (
        <LockedBubble type={attachment.type} isMe={isMe} onOpen={handleOpen} loading={opening} />
      ) : (
        <OpenedPlaceholder type={attachment.type} isMe={isMe} onPress={onAlreadyOpened} />
      )}
      {showViewer && session && typeof document !== 'undefined'
        ? createPortal(
            <ViewOnceViewer
              url={session.url}
              type={session.type}
              durationSec={session.durationSec}
              caption={session.caption}
              onClose={finishConsumed}
            />,
            document.body
          )
        : null}
    </>
  )
}
