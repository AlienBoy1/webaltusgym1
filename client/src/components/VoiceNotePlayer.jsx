import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FiPause, FiPlay } from 'react-icons/fi'
import { claimVoicePlayback, releaseVoicePlayback } from '../utils/voicePlayback'

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function barsFromSeed(seed, count = 28) {
  let h = 0
  const str = String(seed || 'qyntra')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  const bars = []
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0
    bars.push(0.28 + (h % 72) / 100)
  }
  return bars
}

function resolveDuration(el, fallbackSec) {
  const media = el?.duration
  if (media && Number.isFinite(media) && media > 0 && media !== Infinity) return media
  const fb = Number(fallbackSec) || 0
  return fb > 0 ? fb : 0
}

/**
 * WhatsApp-style voice note: play + scrubber waveform, no download UI.
 * Only one instance plays at a time app-wide.
 */
export default function VoiceNotePlayer({ src, durationSec = 0, isMe = false, avatar = null, name = '' }) {
  const reactId = useId()
  const audioRef = useRef(null)
  const rafRef = useRef(0)
  const controllerRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(() => Math.max(0, Number(durationSec) || 0))
  const bars = useMemo(() => barsFromSeed(src, 32), [src])

  useEffect(() => {
    const controller = {
      id: reactId,
      pause: () => {
        const el = audioRef.current
        if (el && !el.paused) {
          el.pause()
        }
        setPlaying(false)
      }
    }
    controllerRef.current = controller
    return () => {
      releaseVoicePlayback(controller)
    }
  }, [reactId])

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setDuration(Math.max(0, Number(durationSec) || 0))
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    releaseVoicePlayback(controllerRef.current)
  }, [src, durationSec])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return undefined

    const syncDuration = () => {
      const d = resolveDuration(el, durationSec)
      if (d > 0) setDuration(d)
    }

    const onEnded = () => {
      setPlaying(false)
      setProgress(0)
      el.currentTime = 0
      releaseVoicePlayback(controllerRef.current)
    }

    el.addEventListener('loadedmetadata', syncDuration)
    el.addEventListener('durationchange', syncDuration)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('loadedmetadata', syncDuration)
      el.removeEventListener('durationchange', syncDuration)
      el.removeEventListener('ended', onEnded)
    }
  }, [durationSec, src])

  useEffect(() => {
    const el = audioRef.current
    if (!playing || !el) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      return undefined
    }

    const tick = () => {
      const node = audioRef.current
      if (!node) return
      const d = resolveDuration(node, durationSec || duration)
      if (d > 0) {
        const ratio = Math.min(1, Math.max(0, node.currentTime / d))
        setProgress(ratio)
        if (duration <= 0 || Math.abs(duration - d) > 0.35) setDuration(d)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [playing, durationSec, duration])

  const toggle = async () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
      releaseVoicePlayback(controllerRef.current)
      return
    }
    try {
      claimVoicePlayback(controllerRef.current)
      if (!(el.duration && Number.isFinite(el.duration) && el.duration > 0) && durationSec > 0) {
        setDuration(durationSec)
      }
      await el.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
      releaseVoicePlayback(controllerRef.current)
    }
  }

  const seek = (e) => {
    const el = audioRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const d = resolveDuration(el, duration || durationSec)
    if (d > 0) {
      el.currentTime = ratio * d
      setProgress(ratio)
    }
  }

  const tint = isMe ? 'rgba(255,255,255,0.85)' : 'var(--color-primary)'
  const track = isMe ? 'rgba(255,255,255,0.28)' : 'rgba(var(--color-primary-rgb),0.22)'
  const total = duration || durationSec || 0
  const shown = playing || progress > 0 ? progress * total : total

  return (
    <div
      className="flex min-w-[13.5rem] max-w-[16.5rem] items-center gap-2.5 py-0.5 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        playsInline
        controlsList="nodownload noplaybackrate"
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          isMe
            ? 'bg-white/20 text-white hover:bg-white/28'
            : 'bg-[rgba(var(--color-primary-rgb),0.16)] text-[color:var(--color-primary)] hover:bg-[rgba(var(--color-primary-rgb),0.24)]'
        }`}
        aria-label={playing ? 'Pausar audio' : 'Reproducir audio'}
      >
        {playing ? <FiPause size={18} fill="currentColor" /> : <FiPlay size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={seek}
          className="relative flex h-8 w-full items-center gap-[2px]"
          aria-label="Posición del audio"
        >
          {bars.map((h, i) => {
            const threshold = (i + 0.5) / bars.length
            const filled = progress >= threshold
            return (
              <span
                key={i}
                className="flex-1 rounded-full"
                style={{
                  height: `${Math.round(h * 100)}%`,
                  minHeight: 4,
                  maxHeight: 28,
                  background: filled ? tint : track,
                  transition: playing ? 'none' : 'background-color 120ms ease'
                }}
              />
            )
          })}
        </button>
        <div
          className={`mt-0.5 flex items-center justify-between text-[10px] tabular-nums ${
            isMe ? 'text-white/70' : 'text-[color:var(--text-muted)]'
          }`}
        >
          <span>{formatTime(shown)}</span>
        </div>
      </div>

      {avatar !== undefined && (
        <div
          className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ${
            isMe ? 'ring-white/25' : 'ring-[rgba(var(--color-primary-rgb),0.2)]'
          }`}
          aria-hidden
        >
          {typeof avatar === 'string' && (avatar.startsWith('data:') || avatar.startsWith('http')) ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={avatar} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center text-xs font-bold ${
                isMe ? 'bg-white/25 text-white' : 'bg-[rgba(var(--color-primary-rgb),0.2)] text-[color:var(--color-primary)]'
              }`}
            >
              {(name || '?').charAt(0)}
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
              isMe ? 'bg-white text-[color:var(--color-primary)]' : 'bg-[color:var(--color-primary)] text-white'
            }`}
          >
            ♪
          </span>
        </div>
      )}
    </div>
  )
}
