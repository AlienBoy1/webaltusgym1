import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiDownloadCloud, FiRefreshCw, FiCheck, FiZap } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import QyntraLogo from './QyntraLogo'

const VERSION_KEY = 'qyntra_app_version'
const POLL_MS = 90_000

async function fetchRemoteVersion() {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('version fetch failed')
  return res.json()
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Animate progress from → to over durationMs; resolves when animation ends */
function animateProgress(from, to, durationMs, setProgress) {
  return new Promise((resolve) => {
    const start = performance.now()
    const delta = to - from

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(Math.round(from + delta * eased))
      if (t < 1) requestAnimationFrame(tick)
      else {
        setProgress(to)
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

/**
 * Run real work and progress animation together.
 * Progress reaches `to` only when BOTH the work and the animation have finished.
 */
async function runSyncedStep({ from, to, minDurationMs, work, setProgress }) {
  const workPromise = (async () => {
    if (!work) return
    try {
      await work()
    } catch {
      /* continue update flow */
    }
  })()

  const animPromise = animateProgress(from, to, minDurationMs, setProgress)

  await Promise.all([workPromise, animPromise])
  setProgress(to)
}

export default function UpdateCenter() {
  const { isAuthenticated } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [remoteVersion, setRemoteVersion] = useState(null)
  const [statusText, setStatusText] = useState('')
  const waitingWorkerRef = useRef(null)
  const updatingRef = useRef(false)

  const openPrompt = useCallback((version, worker = null) => {
    if (updatingRef.current) return
    if (version) setRemoteVersion(version)
    if (worker) waitingWorkerRef.current = worker
    setPhase('prompt')
    setVisible(true)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false)
      setPhase('idle')
      updatingRef.current = false
      return
    }

    let cancelled = false
    let pollId

    const checkVersion = async () => {
      if (!isAuthenticated || updatingRef.current) return
      try {
        const remote = await fetchRemoteVersion()
        if (cancelled || !remote?.version) return
        const local = localStorage.getItem(VERSION_KEY)
        if (!local) {
          localStorage.setItem(VERSION_KEY, remote.version)
          return
        }
        if (local !== remote.version) openPrompt(remote)
      } catch {
        /* offline */
      }
    }

    const setupSW = async () => {
      if (!('serviceWorker' in navigator)) return
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        const trackWorker = (worker) => {
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller &&
              isAuthenticated &&
              !updatingRef.current
            ) {
              openPrompt(null, worker)
            }
          })
        }

        if (reg.waiting && navigator.serviceWorker.controller) {
          openPrompt(null, reg.waiting)
        }
        reg.addEventListener('updatefound', () => trackWorker(reg.installing))

        pollId = setInterval(() => {
          reg.update().catch(() => {})
          checkVersion()
        }, POLL_MS)
      } catch {
        /* ignore */
      }
    }

    checkVersion()
    setupSW()

    const onFocus = () => checkVersion()
    window.addEventListener('focus', onFocus)
    const onVis = () => {
      if (document.visibilityState === 'visible') checkVersion()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      clearInterval(pollId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [isAuthenticated, openPrompt])

  const runUpdate = async () => {
    if (updatingRef.current) return
    updatingRef.current = true
    setPhase('updating')
    setProgress(0)

    let latestVersion = remoteVersion

    const steps = [
      {
        to: 18,
        text: 'Verificando nueva versión…',
        minDurationMs: 700,
        work: async () => {
          const remote = await fetchRemoteVersion().catch(() => latestVersion)
          if (remote) {
            latestVersion = remote
            setRemoteVersion(remote)
          }
          await delay(120)
        }
      },
      {
        to: 40,
        text: 'Descargando recursos…',
        minDurationMs: 900,
        work: async () => {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration()
            await reg?.update?.().catch(() => {})
          }
          await delay(150)
        }
      },
      {
        to: 68,
        text: 'Limpiando caché anterior…',
        minDurationMs: 1100,
        work: async () => {
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          }
          const worker = waitingWorkerRef.current
          if (worker) {
            worker.postMessage({ type: 'SKIP_WAITING' })
            worker.postMessage({ type: 'CLEAR_CACHES' })
          } else if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' })
          }
        }
      },
      {
        to: 88,
        text: 'Aplicando cambios…',
        minDurationMs: 800,
        work: async () => {
          try {
            if (!latestVersion) {
              latestVersion = await fetchRemoteVersion().catch(() => null)
            }
            if (latestVersion?.version) {
              localStorage.setItem(VERSION_KEY, latestVersion.version)
            }
          } catch {
            /* ignore */
          }
          await delay(100)
        }
      },
      {
        to: 100,
        text: '¡Listo!',
        minDurationMs: 500,
        work: async () => delay(80)
      }
    ]

    let from = 0
    for (const step of steps) {
      setStatusText(step.text)
      await runSyncedStep({
        from,
        to: step.to,
        minDurationMs: step.minDurationMs,
        work: step.work,
        setProgress
      })
      from = step.to
    }

    setPhase('done')
    setStatusText('Reiniciando app…')
    await delay(700)
    window.location.reload()
  }

  if (!isAuthenticated || !visible) return null

  return (
    <AnimatePresence>
      <motion.div
        key="update-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(255,107,53,0.18), transparent 55%), rgba(10,10,15,0.92)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ y: 48, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="w-full max-w-md bg-dark-200 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="update-title"
        >
          <div className="relative px-5 sm:px-8 pt-8 pb-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-orange-400 to-accent-cyan" />

            <div className="flex justify-center mb-5">
              <motion.div
                animate={
                  phase === 'updating'
                    ? { rotate: 360 }
                    : { y: [0, -5, 0] }
                }
                transition={
                  phase === 'updating'
                    ? { repeat: Infinity, duration: 1.15, ease: 'linear' }
                    : { repeat: Infinity, duration: 2.5, ease: 'easeInOut' }
                }
              >
                <QyntraLogo size="lg" withGlow />
              </motion.div>
            </div>

            {phase === 'prompt' && (
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/15 text-primary-400 text-xs font-medium">
                  <FiZap size={12} /> Actualización requerida
                </div>
                <h2 id="update-title" className="font-display text-2xl sm:text-3xl tracking-wide">
                  Actualiza QYNTRA
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed px-1">
                  Hay una versión más nueva disponible. Debes actualizar para continuar usando
                  la app con las últimas mejoras y correcciones.
                </p>
                {remoteVersion?.version && (
                  <p className="text-xs text-gray-500">Versión {remoteVersion.version}</p>
                )}
                <div className="pt-4">
                  <button
                    onClick={runUpdate}
                    className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
                  >
                    <FiDownloadCloud size={18} />
                    Actualizar ahora
                  </button>
                </div>
              </div>
            )}

            {(phase === 'updating' || phase === 'done') && (
              <div className="text-center space-y-5 py-1">
                <h2 className="font-display text-2xl tracking-wide">
                  {phase === 'done' ? 'Actualización completa' : 'Actualizando…'}
                </h2>
                <p className="text-gray-400 text-sm min-h-[1.25rem]">{statusText}</p>

                <div className="relative h-3 bg-dark-400 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-500 to-accent-cyan"
                    style={{ width: `${progress}%` }}
                  />
                  {phase === 'updating' && (
                    <motion.div
                      className="absolute inset-y-0 w-14 bg-white/25 blur-[2px]"
                      animate={{ left: ['-25%', '110%'] }}
                      transition={{ repeat: Infinity, duration: 1.05, ease: 'linear' }}
                    />
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
                  {phase === 'done' ? (
                    <>
                      <FiCheck className="text-accent-green" size={18} />
                      Reiniciando app…
                    </>
                  ) : (
                    <>
                      <FiRefreshCw className="animate-spin text-primary-500" size={16} />
                      {progress}%
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Caché', at: 40 },
                    { label: 'Assets', at: 68 },
                    { label: 'App', at: 100 }
                  ].map(({ label, at }) => (
                    <div
                      key={label}
                      className={`rounded-xl py-3 text-xs border transition-colors ${
                        progress >= at
                          ? 'border-primary-500/40 bg-primary-500/10 text-primary-300'
                          : 'border-white/5 bg-dark-300 text-gray-500'
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
