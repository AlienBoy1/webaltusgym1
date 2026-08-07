import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiDownloadCloud, FiCheck, FiZap, FiShield, FiHardDrive, FiCpu } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import SessionTheater from './SessionTheater'
import QyntraLogo from './QyntraLogo'
import { setUpdateBlocking, setUpdateSettled } from '../utils/appGate'

const VERSION_KEY = 'qyntra_app_version'
const POLL_MS = 45_000
const POLL_VISIBLE_MS = 20_000

async function fetchRemoteVersion() {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('version fetch failed')
  const data = await res.json()
  // Guard against SW offline fallback / garbage payloads that caused false prompts
  if (!data?.version || data.version === 'offline' || data.error) {
    throw new Error('invalid version payload')
  }
  return data
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

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

async function runSyncedStep({ from, to, minDurationMs, work, setProgress }) {
  const workPromise = (async () => {
    if (!work) return
    try {
      await work()
    } catch {
      /* continue */
    }
  })()
  await Promise.all([workPromise, animateProgress(from, to, minDurationMs, setProgress)])
  setProgress(to)
}

const MILESTONES = [
  { id: 'verify', label: 'Verificar', icon: FiShield, at: 18 },
  { id: 'download', label: 'Descargar', icon: FiDownloadCloud, at: 40 },
  { id: 'cache', label: 'Caché', icon: FiHardDrive, at: 68 },
  { id: 'apply', label: 'Aplicar', icon: FiCpu, at: 100 }
]

export default function UpdateCenter() {
  const { isAuthenticated } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [remoteVersion, setRemoteVersion] = useState(null)
  const [statusText, setStatusText] = useState('')
  const [scene, setScene] = useState(0)
  const waitingWorkerRef = useRef(null)
  const updatingRef = useRef(false)
  const promptReadyRef = useRef(false)
  const pendingPromptRef = useRef(null)

  const showPromptNow = useCallback((version, worker = null) => {
    if (updatingRef.current) return
    if (version) setRemoteVersion(version)
    if (worker) waitingWorkerRef.current = worker
    setPhase('prompt')
    setVisible(true)
    setUpdateBlocking(true)
    setUpdateSettled(true)

    // Notify users with persisted session / granted notifications
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification('Qyntra Gym · Actualización disponible', {
          body: `Hay una nueva versión${version?.version ? ` (v${version.version})` : ''} lista. Entra a la app para actualizar.`,
          icon: '/icons/icon-192.png',
          tag: 'qyntra-app-update',
          renotify: true
        })
        n.onclick = () => {
          window.focus()
          n.close()
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  const openPrompt = useCallback((version, worker = null) => {
    if (updatingRef.current) return
    // SW waiting alone is not enough — verify version.json mismatch to avoid spam on resume
    if (!version && worker) {
      waitingWorkerRef.current = worker
      fetchRemoteVersion()
        .then((remote) => {
          const local = localStorage.getItem(VERSION_KEY)
          if (remote?.version && local && String(remote.version) !== String(local)) {
            if (!promptReadyRef.current) {
              pendingPromptRef.current = { version: remote, worker }
              return
            }
            showPromptNow(remote, worker)
          }
        })
        .catch(() => {
          /* network blip — do not prompt */
        })
      return
    }
    if (!promptReadyRef.current) {
      pendingPromptRef.current = { version, worker }
      return
    }
    showPromptNow(version, worker)
  }, [showPromptNow])

  useEffect(() => {
    if (!isAuthenticated) {
      promptReadyRef.current = false
      pendingPromptRef.current = null
      setVisible(false)
      setPhase('idle')
      updatingRef.current = false
      setUpdateBlocking(false)
      setUpdateSettled(false)
      return undefined
    }

    // Don't settle / show update until username is claimed (listeners still mount)
    const initialUser = useAuthStore.getState().user
    if (initialUser && !initialUser.username) {
      setUpdateBlocking(false)
      setUpdateSettled(false)
    }

    promptReadyRef.current = false
    const readyTimer = window.setTimeout(() => {
      promptReadyRef.current = true
      const u = useAuthStore.getState().user
      if (u && !u.username) return
      if (pendingPromptRef.current && !updatingRef.current) {
        const pending = pendingPromptRef.current
        pendingPromptRef.current = null
        showPromptNow(pending.version, pending.worker)
      }
    }, 900)

    let cancelled = false
    let pollId

    const checkVersion = async () => {
      if (!isAuthenticated || updatingRef.current) return
      const currentUser = useAuthStore.getState().user
      if (currentUser && !currentUser.username) {
        setUpdateSettled(false)
        return
      }
      try {
        const remote = await fetchRemoteVersion()
        if (cancelled || !remote?.version) {
          if (!cancelled) {
            setUpdateBlocking(false)
            setUpdateSettled(true)
          }
          return
        }
        const local = localStorage.getItem(VERSION_KEY)
        if (!local) {
          localStorage.setItem(VERSION_KEY, remote.version)
          setUpdateBlocking(false)
          setUpdateSettled(true)
          return
        }
        if (local !== remote.version) {
          openPrompt(remote)
        } else {
          setUpdateBlocking(false)
          setUpdateSettled(true)
        }
      } catch {
        if (!cancelled) {
          setUpdateBlocking(false)
          setUpdateSettled(true)
        }
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
        const tick = () => {
          reg.update().catch(() => {})
          checkVersion()
        }
        pollId = setInterval(tick, document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_MS)
      } catch {
        /* ignore */
      }
    }

    const uNow = useAuthStore.getState().user
    if (!uNow || uNow.username) {
      checkVersion()
      setupSW()
    }

    const onFocus = () => {
      window.setTimeout(() => {
        if (!cancelled) checkVersion()
      }, 2000)
    }
    window.addEventListener('focus', onFocus)
    let visTimer = 0
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      window.clearTimeout(visTimer)
      visTimer = window.setTimeout(() => {
        if (cancelled) return
        checkVersion()
        if (promptReadyRef.current && pendingPromptRef.current && !updatingRef.current) {
          const pending = pendingPromptRef.current
          pendingPromptRef.current = null
          showPromptNow(pending.version, pending.worker)
        }
      }, 2500)
    }
    document.addEventListener('visibilitychange', onVis)

    // Re-run when username gets claimed
    let prevUsername = useAuthStore.getState().user?.username
    const unsub = useAuthStore.subscribe((state) => {
      const nextUsername = state.user?.username
      if (nextUsername && !prevUsername) {
        checkVersion()
        setupSW()
        if (promptReadyRef.current && pendingPromptRef.current && !updatingRef.current) {
          const pending = pendingPromptRef.current
          pendingPromptRef.current = null
          showPromptNow(pending.version, pending.worker)
        }
      }
      prevUsername = nextUsername
    })

    return () => {
      cancelled = true
      clearTimeout(readyTimer)
      clearInterval(pollId)
      window.clearTimeout(visTimer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      unsub()
    }
  }, [isAuthenticated, openPrompt, showPromptNow])

  useEffect(() => {
    if (phase !== 'updating') return undefined
    const id = window.setInterval(() => setScene((s) => (s + 1) % 3), 2200)
    return () => window.clearInterval(id)
  }, [phase])

  const runUpdate = async () => {
    if (updatingRef.current) return
    updatingRef.current = true
    try {
      document.body.dataset.qyntraUpdating = '1'
    } catch {
      /* ignore */
    }
    setPhase('updating')
    setProgress(0)
    setScene(0)

    let latestVersion = remoteVersion

    const steps = [
      {
        to: 18,
        text: 'Verificando integridad de la versión…',
        minDurationMs: 900,
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
        text: 'Descargando recursos actualizados…',
        minDurationMs: 1100,
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
        text: 'Purgando caché anterior…',
        minDurationMs: 1200,
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
        text: 'Aplicando cambios de QYNTRA…',
        minDurationMs: 900,
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
        text: 'Listo. Reiniciando…',
        minDurationMs: 600,
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
    await delay(900)
    window.location.reload()
  }

  if (!isAuthenticated || !visible) return null

  const sceneCopy = [
    'Sincronizando experiencia…',
    'Optimizando rendimiento…',
    'Preparando el nuevo build…'
  ]

  if (phase === 'updating' || phase === 'done') {
    return (
      <SessionTheater
        visible
        variant="update"
        title={phase === 'done' ? 'Listo' : 'QYNTRA'}
        subtitle={phase === 'done' ? 'Reiniciando aplicación…' : sceneCopy[scene]}
        status={statusText}
        progress={progress}
      >
        <div className="grid grid-cols-4 gap-2">
          {MILESTONES.map(({ id, label, icon: Icon, at }) => {
            const done = progress >= at
            const active = !done && progress >= at - 25
            return (
              <motion.div
                key={id}
                animate={{ opacity: done || active ? 1 : 0.4, scale: active ? 1.04 : 1 }}
                className={`rounded-xl border px-1 py-3 text-center ${
                  done
                    ? 'border-primary-500/40 bg-primary-500/15 text-primary-500'
                    : active
                      ? 'border-[color:var(--border-strong)] bg-[color:var(--bg-muted)] text-app'
                      : 'border-app bg-elevated text-app-secondary opacity-60'
                }`}
              >
                <Icon className="mx-auto mb-1" size={14} />
                <p className="text-[10px] font-medium">{label}</p>
              </motion.div>
            )
          })}
        </div>
      </SessionTheater>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        key="update-prompt"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[250] flex items-end justify-center sm:items-center"
        style={{ background: 'color-mix(in srgb, var(--bg-app) 88%, #000)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/25 via-transparent to-accent-cyan/15" />
        <motion.div
          className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-primary-500/25 blur-[100px]"
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="pointer-events-none absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-accent-cyan/15 blur-[110px]"
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          initial={{ y: 56, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border shadow-2xl backdrop-blur-xl sm:rounded-3xl"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)'
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="update-title"
        >
          <div className="h-1 bg-gradient-to-r from-primary-500 via-orange-400 to-accent-cyan" />
          <div className="px-6 pb-8 pt-8 sm:px-8">
            <div className="mb-6 flex justify-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <QyntraLogo size="xl" withGlow />
              </motion.div>
            </div>

            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/15 px-3 py-1 text-xs font-medium text-primary-400">
                <FiZap size={12} /> Actualización requerida
              </div>
              <h2 id="update-title" className="font-display text-3xl tracking-wide">
                <span className="text-primary-500">QYNTRA</span> Update
              </h2>
              <p className="px-1 text-sm leading-relaxed sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                Hay una versión nueva lista. Actualiza ahora para continuar con las últimas mejoras.
              </p>
              {remoteVersion?.version && (
                <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  v{remoteVersion.version}
                </p>
              )}
              <div className="pt-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={runUpdate}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3.5"
                >
                  <FiDownloadCloud size={18} />
                  Actualizar ahora
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
