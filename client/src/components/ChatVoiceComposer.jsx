import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiMic, FiPause, FiPlay, FiSend, FiTrash2 } from 'react-icons/fi'
import ViewOnceIcon from './ViewOnceIcon'

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function LiveBars({ active }) {
  const [seed, setSeed] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const id = window.setInterval(() => setSeed((v) => v + 1), 120)
    return () => window.clearInterval(id)
  }, [active])
  const bars = useMemo(() => {
    const out = []
    let h = (seed * 9973 + 13) >>> 0
    for (let i = 0; i < 36; i++) {
      h = (h * 1664525 + 1013904223) >>> 0
      const base = active ? 0.25 + (h % 75) / 100 : 0.18
      out.push(base)
    }
    return out
  }, [seed, active])
  return (
    <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="flex-1 rounded-full bg-white/55"
          style={{ height: `${Math.round(h * 100)}%`, minHeight: 3, maxHeight: 28 }}
        />
      ))}
    </div>
  )
}

function PreviewWave({ src, durationSec }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return undefined
    const onTime = () => {
      const d = el.duration && Number.isFinite(el.duration) ? el.duration : durationSec
      if (d > 0) setProgress(el.currentTime / d)
    }
    const onEnded = () => {
      setPlaying(false)
      setProgress(0)
      el.currentTime = 0
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnded)
    }
  }, [durationSec, src])

  const toggle = async () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
      return
    }
    try {
      await el.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <audio ref={audioRef} src={src} preload="metadata" playsInline className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? <FiPause size={18} fill="currentColor" /> : <FiPlay size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-[2px]" aria-hidden>
        {Array.from({ length: 32 }).map((_, i) => {
          const filled = i / 32 <= progress
          const h = 0.28 + ((i * 17) % 70) / 100
          return (
            <span
              key={i}
              className="flex-1 rounded-full"
              style={{
                height: `${Math.round(h * 100)}%`,
                minHeight: 3,
                maxHeight: 28,
                background: filled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)'
              }}
            />
          )
        })}
      </div>
      <span className="shrink-0 tabular-nums text-sm text-white">{formatTime(durationSec)}</span>
    </div>
  )
}

/**
 * WhatsApp-like voice recording chrome (immersive dark panel, theme-safe).
 * mode: 'recording' | 'paused' | 'review'
 */
export default function ChatVoiceComposer({
  open,
  mode = 'recording',
  seconds = 0,
  previewUrl = null,
  viewOnce = false,
  sending = false,
  onToggleViewOnce,
  onDelete,
  onPause,
  onResume,
  onSend
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[115] flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      <div className="force-dark pointer-events-auto w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#121218] px-3 py-3 text-white shadow-[0_-8px_40px_rgba(0,0,0,0.45)]">
        <div className="mb-3 flex items-center gap-2">
          {mode === 'recording' ? (
            <>
              <span className="shrink-0 tabular-nums text-base font-medium text-white">{formatTime(seconds)}</span>
              <LiveBars active />
            </>
          ) : previewUrl ? (
            <PreviewWave src={previewUrl} durationSec={seconds} />
          ) : (
            <>
              <span className="shrink-0 tabular-nums text-base font-medium text-white">{formatTime(seconds)}</span>
              <LiveBars active={false} />
            </>
          )}
          <button
            type="button"
            onClick={onToggleViewOnce}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
              viewOnce ? 'bg-white/15 text-[color:var(--color-primary)]' : 'text-white/85 hover:bg-white/10'
            }`}
            aria-label="Ver una sola vez"
            aria-pressed={viewOnce}
          >
            <ViewOnceIcon size={22} active={viewOnce} />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onDelete}
            disabled={sending}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#3a1518] text-red-400 transition enabled:active:scale-95 disabled:opacity-40"
            aria-label="Eliminar audio"
          >
            <FiTrash2 size={20} />
          </button>

          {mode === 'recording' ? (
            <button
              type="button"
              onClick={onPause}
              disabled={sending}
              className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#2a2a32] text-[15px] font-semibold text-white transition enabled:active:scale-[0.99] disabled:opacity-40"
            >
              <FiPause size={18} fill="currentColor" />
              Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              disabled={sending}
              className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#4a1520] text-[15px] font-semibold text-white transition enabled:active:scale-[0.99] disabled:opacity-40"
            >
              <FiMic size={18} />
              Continuar
            </button>
          )}

          <button
            type="button"
            onClick={onSend}
            disabled={sending || seconds < 1}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff2d6a] text-white shadow-lg shadow-[#ff2d6a]/30 transition enabled:active:scale-95 disabled:opacity-40"
            aria-label="Enviar audio"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <FiSend size={18} className="-ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
