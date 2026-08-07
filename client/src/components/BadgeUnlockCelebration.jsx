import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiAward, FiShare2 } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useConfetti } from './Confetti'

export const BADGE_UNLOCK_EVENT = 'qyntra:badge-unlocked'

/**
 * Fire from anywhere after a badge unlock (tutorials, sync, etc.).
 * @param {Array<{ id: string, name: string, icon: string, xpReward?: number }>} badges
 * @param {{ title?: string, subtitle?: string }} [meta]
 */
export function showBadgeUnlockCelebration(badges, meta = {}) {
  const list = (badges || []).filter((b) => b?.id || b?.name)
  if (!list.length) return
  try {
    window.dispatchEvent(
      new CustomEvent(BADGE_UNLOCK_EVENT, {
        detail: {
          badges: list,
          title: meta.title || null,
          subtitle: meta.subtitle || null
        }
      })
    )
  } catch {
    /* ignore */
  }
}

/**
 * Global celebration modal: confetti + badge showcase + share / dismiss.
 * Mount once in MainLayout.
 */
export default function BadgeUnlockCelebration() {
  const navigate = useNavigate()
  const { celebration } = useConfetti()
  const [payload, setPayload] = useState(null) // { badges, title, subtitle }
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const onUnlock = (e) => {
      const detail = e?.detail || {}
      const badges = Array.isArray(detail.badges) ? detail.badges : []
      if (!badges.length) return
      setPayload({
        badges,
        title: detail.title || null,
        subtitle: detail.subtitle || null
      })
      celebration()
    }
    window.addEventListener(BADGE_UNLOCK_EVENT, onUnlock)
    return () => window.removeEventListener(BADGE_UNLOCK_EVENT, onUnlock)
  }, [celebration])

  const close = () => setPayload(null)

  const share = async () => {
    if (!payload?.badges?.length || sharing) return
    setSharing(true)
    try {
      const badges = payload.badges
      const primary = badges[0]
      const content =
        badges.length === 1
          ? `¡Acabo de desbloquear la insignia ${primary.icon || ''} ${primary.name}! 🎉`
          : `¡Desbloqueé ${badges.map((b) => `${b.icon || ''} ${b.name}`.trim()).join(', ')}! 🎉`

      await api.post('/social', {
        content,
        postType: 'badge',
        badgeData: {
          badgeId: primary.id,
          badgeName: primary.name,
          badgeIcon: primary.icon,
          earnedAt: new Date().toISOString()
        }
      })
      toast.success('¡Insignia compartida en la comunidad!')
      close()
      navigate('/social')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo compartir')
    } finally {
      setSharing(false)
    }
  }

  if (typeof document === 'undefined') return null

  const badges = payload?.badges || []
  const bonusXp = badges.reduce((s, b) => s + (Number(b.xpReward) || 0), 0)
  const heading =
    badges.length > 1 ? '¡Insignias desbloqueadas!' : '¡Insignia desbloqueada!'

  return createPortal(
    <AnimatePresence>
      {payload && (
        <motion.div
          className="fixed inset-0 z-[230] flex items-end justify-center sm:items-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-unlock-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={close}
          />
          <motion.div
            initial={{ y: 36, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 340 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-6 pt-7 pb-5 text-center"
              style={{
                background:
                  'linear-gradient(160deg, rgba(var(--color-primary-rgb),0.22) 0%, rgba(var(--color-primary-rgb),0.05) 55%, transparent 100%)'
              }}
            >
              <motion.div
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.05 }}
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--color-primary)] to-[rgba(var(--color-primary-rgb),0.65)] shadow-lg shadow-[rgba(var(--color-primary-rgb),0.35)]"
              >
                <FiAward size={36} className="text-white" />
              </motion.div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-primary)]">
                Logro
              </p>
              <h2
                id="badge-unlock-title"
                className="mt-1.5 font-display text-2xl text-[color:var(--text-primary)]"
              >
                {heading}
              </h2>
              {(payload.title || payload.subtitle) && (
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  {payload.subtitle || payload.title}
                </p>
              )}
            </div>

            <div className="px-6 pb-2">
              <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/80 px-4 py-4">
                <div className="flex flex-wrap items-start justify-center gap-4">
                  {badges.map((badge, idx) => (
                    <motion.div
                      key={badge.id || `${badge.name}-${idx}`}
                      initial={{ opacity: 0, y: 12, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.12 + idx * 0.08, type: 'spring', damping: 16 }}
                      className="min-w-[5.5rem] max-w-[7.5rem] text-center"
                    >
                      <div className="mx-auto mb-1.5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] text-4xl shadow-sm">
                        {badge.icon || '🏅'}
                      </div>
                      <p className="text-sm font-semibold leading-snug text-[color:var(--text-primary)]">
                        {badge.name}
                      </p>
                      {Number(badge.xpReward) > 0 && (
                        <p className="mt-0.5 text-xs font-medium text-[color:var(--color-primary)]">
                          +{badge.xpReward} XP
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {bonusXp > 0 && (
                <div className="mt-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[rgba(var(--color-primary-rgb),0.1)] px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-[color:var(--color-primary)]">+{bonusXp} XP</p>
                  <p className="text-xs text-[color:var(--text-muted)]">Sumado a tu cuenta</p>
                </div>
              )}
            </div>

            <div
              className="space-y-2 px-6 pt-4"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={share}
                disabled={sharing}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-60"
              >
                <FiShare2 size={16} />
                {sharing ? 'Compartiendo…' : 'Compartir con la comunidad'}
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full py-2.5 text-sm text-[color:var(--text-muted)] transition hover:text-[color:var(--text-primary)]"
              >
                Ahora no
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
