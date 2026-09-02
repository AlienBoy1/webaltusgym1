import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiDownload, FiShare2, FiPlusSquare, FiX, FiCheck } from 'react-icons/fi'
import { FaWindows, FaApple, FaAndroid, FaGooglePlay } from 'react-icons/fa'

const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || ''

const PLATFORMS = [
  {
    id: 'windows',
    name: 'Windows',
    icon: FaWindows,
    blurb: 'Instala Qyntra como app de escritorio',
    href: '/downloads/QyntraGym-Setup.exe',
    fileLabel: 'Instalador Windows (.exe)'
  },
  {
    id: 'android',
    name: 'Android',
    icon: FaAndroid,
    blurb: PLAY_STORE_URL ? 'Descarga desde Google Play' : 'APK o instalación PWA rápida',
    href: '/downloads/QyntraGym.apk',
    fileLabel: PLAY_STORE_URL ? 'Google Play Store' : 'Paquete Android (.apk)'
  },
  {
    id: 'ios',
    name: 'iOS',
    icon: FaApple,
    blurb: 'Agrégala a tu pantalla de inicio',
    href: null,
    fileLabel: 'Guía iOS'
  }
]

function detectPlatform() {
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Win/.test(navigator.platform || ua)) return 'windows'
  return 'windows'
}

export default function DownloadApps({ compact = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [iosHelp, setIosHelp] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [active, setActive] = useState(detectPlatform())

  useEffect(() => {
    const onBip = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const installPwa = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  const handleDownload = async (platform) => {
    setActive(platform.id)

    if (platform.id === 'ios') {
      setIosHelp(true)
      return
    }

    if (platform.id === 'android' && PLAY_STORE_URL) {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer')
      return
    }

    // Prefer native PWA install when available
    if (deferredPrompt && (platform.id === 'windows' || platform.id === 'android')) {
      const ok = await installPwa()
      if (ok) return
    }

    // Fallback: try installer file, then guide user
    try {
      const res = await fetch(platform.href, { method: 'HEAD' })
      if (res.ok) {
        const a = document.createElement('a')
        a.href = platform.href
        a.download = ''
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }
    } catch {
      /* file may be placeholder */
    }

    if (platform.id === 'android' || platform.id === 'windows') {
      // Soft fallback: open manifest-driven install instructions
      window.open('/manifest.json', '_blank', 'noopener')
    }
  }

  return (
    <div className={compact ? '' : 'space-y-6'}>
      {!compact && (
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--color-primary)] mb-3">
            Descarga la app
          </p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl mb-3">
            LLEVA QYNTRA <span className="gradient-text">CONTIGO</span>
          </h2>
          <p className="text-[color:var(--text-secondary)] text-base sm:text-lg">
            Elige tu plataforma. En Windows y Android puedes instalarla como aplicación nativa (PWA)
            o descargar el instalador cuando esté disponible.
          </p>
          {installed && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-accent-green">
              <FiCheck /> Ya tienes Qyntra instalada en este dispositivo
            </p>
          )}
        </div>
      )}

      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
        {PLATFORMS.map((platform) => {
          const Icon = platform.id === 'android' && PLAY_STORE_URL ? FaGooglePlay : platform.icon
          const selected = active === platform.id
          return (
            <motion.button
              key={platform.id}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDownload(platform)}
              className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                selected
                  ? 'border-[color:var(--color-primary)] bg-[rgba(var(--color-primary-rgb),0.12)]'
                  : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] hover:border-[color:var(--border-strong)]'
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(var(--color-primary-rgb), 0.15)', color: 'var(--color-primary)' }}
                >
                  <Icon size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-2xl tracking-wide">{platform.name}</h3>
                    <FiDownload className="shrink-0 opacity-70" />
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{platform.blurb}</p>
                  <p className="mt-2 text-xs text-[color:var(--text-muted)]">{platform.fileLabel}</p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {iosHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
            onClick={() => setIosHelp(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-6 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-2xl">Instalar en iOS</h3>
                <button type="button" onClick={() => setIosHelp(false)} className="p-2 text-[color:var(--text-secondary)]">
                  <FiX size={20} />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-[color:var(--text-secondary)]">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-[color:var(--color-primary)]">1</span>
                  <span>Abre Qyntra en <strong className="text-[color:var(--text-primary)]">Safari</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-[color:var(--color-primary)]">2</span>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    Toca <FiShare2 className="inline" /> <strong className="text-[color:var(--text-primary)]">Compartir</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-[color:var(--color-primary)]">3</span>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    Elige <FiPlusSquare className="inline" /> <strong className="text-[color:var(--text-primary)]">Agregar a pantalla de inicio</strong>.
                  </span>
                </li>
              </ol>
              <button type="button" onClick={() => setIosHelp(false)} className="btn-primary mt-6 w-full">
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
