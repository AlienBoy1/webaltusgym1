import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiDownloadCloud, FiRefreshCw, FiCheck, FiZap } from 'react-icons/fi'
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

export default function UpdateCenter() {
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [remoteVersion, setRemoteVersion] = useState(null)
  const waitingWorkerRef = useRef(null)
  const [statusText, setStatusText] = useState('')

  const openPrompt = useCallback((version, worker = null) => {
    if (version) setRemoteVersion(version)
    if (worker) waitingWorkerRef.current = worker
    setPhase('prompt')
    setVisible(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    let pollId

    const checkVersion = async () => {
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
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
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
  }, [openPrompt])

  const runUpdate = async () => {
    setPhase('updating')
    setProgress(0)

    const steps = [
      { p: 20, text: 'Verificando nueva versión…', action: null },
      { p: 42, text: 'Descargando recursos…', action: null },
      {
        p: 68,
        text: 'Limpiando caché anterior…',
        action: async () => {
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
      { p: 88, text: 'Aplicando cambios…', action: null },
      { p: 100, text: '¡Listo!', action: null }
    ]

    for (const step of steps) {
      setStatusText(step.text)
      if (step.action) {
        try {
          await step.action()
        } catch {
          /* continue */
        }
      }
      setProgress(step.p)
      await delay(480)
    }

    try {
      const remote = remoteVersion || (await fetchRemoteVersion().catch(() => null))
      if (remote?.version) localStorage.setItem(VERSION_KEY, remote.version)
    } catch {
      /* ignore */
    }

    setPhase('done')
    setStatusText('Reiniciando app…')
    await delay(800)
    window.location.reload()
  }

  if (!visible) return null

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
      >
        <motion.div
          initial={{ y: 48, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="w-full max-w-md bg-dark-200 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
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
                  <FiZap size={12} /> Nueva versión disponible
                </div>
                <h2 className="font-display text-2xl sm:text-3xl tracking-wide">
                  Actualiza QYNTRA
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed px-1">
                  Hay una versión más nueva lista. Actualiza ahora para obtener mejoras y
                  correcciones — sin borrar cookies ni datos a mano.
                </p>
                {remoteVersion?.version && (
                  <p className="text-xs text-gray-500">Versión {remoteVersion.version}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={runUpdate}
                    className="btn-primary flex-1 py-3.5 flex items-center justify-center gap-2"
                  >
                    <FiDownloadCloud size={18} />
                    Actualizar ahora
                  </button>
                  <button
                    onClick={() => setVisible(false)}
                    className="btn-secondary flex-1 py-3.5"
                  >
                    Más tarde
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
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.4 }}
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
                  {['Caché', 'Assets', 'App'].map((label, i) => (
                    <div
                      key={label}
                      className={`rounded-xl py-3 text-xs border transition-colors ${
                        progress >= (i + 1) * 30
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
