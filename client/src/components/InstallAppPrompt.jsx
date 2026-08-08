import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiDownload, FiShare2, FiPlusSquare, FiX, FiSmartphone, FiMonitor } from 'react-icons/fi'
import { FaApple, FaAndroid, FaWindows } from 'react-icons/fa'
import QyntraLogo from './QyntraLogo'
import { useAuthStore } from '../store/authStore'
import {
  captureInstallPrompt,
  shouldOfferInstall,
  dismissInstallForSession,
  neverShowInstallPrompt,
  promptNativeInstall,
  subscribeInstallPrompt,
  detectInstallPlatform,
  getDeferredInstallPrompt
} from '../utils/pwaInstall'
import { isInstalledApp } from '../utils/appMode'
import {
  canShowPrompt,
  setInstallBlocking,
  subscribeAppGate
} from '../utils/appGate'

const SHOW_DELAY_MS = 2200

/**
 * Premium in-app install sheet for browser sessions.
 * - Guests: every visit; no "never show"
 * - Logged-in: after higher-priority gate prompts; every session until "No volver a mostrar"
 */
export default function InstallAppPrompt() {
  const user = useAuthStore((s) => s.user)
  const isLoggedIn = Boolean(user?._id || user?.id)
  const [open, setOpen] = useState(false)
  const [hasNativePrompt, setHasNativePrompt] = useState(Boolean(getDeferredInstallPrompt()))
  const [installing, setInstalling] = useState(false)
  const [iosSteps, setIosSteps] = useState(false)
  const platform = useMemo(() => detectInstallPlatform(), [])

  useEffect(() => {
    captureInstallPrompt()
    return subscribeInstallPrompt((evt) => setHasNativePrompt(Boolean(evt)))
  }, [])

  useEffect(() => {
    if (isInstalledApp()) return undefined
    if (!shouldOfferInstall({ isLoggedIn })) return undefined

    // Guests are outside the auth onboarding queue
    if (!isLoggedIn) {
      const t = window.setTimeout(() => {
        if (!isInstalledApp() && shouldOfferInstall({ isLoggedIn: false })) setOpen(true)
      }, SHOW_DELAY_MS)
      const onInstalled = () => setOpen(false)
      window.addEventListener('appinstalled', onInstalled)
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    const tryShow = () => {
      if (isInstalledApp() || !shouldOfferInstall({ isLoggedIn: true })) {
        setInstallBlocking(false)
        setOpen(false)
        return
      }
      if (document.body.dataset.qyntraTutorial === '1') return
      if (!canShowPrompt('install')) {
        setOpen(false)
        return
      }
      setInstallBlocking(true)
      setOpen(true)
    }

    const t = window.setTimeout(tryShow, SHOW_DELAY_MS)
    const unsub = subscribeAppGate(tryShow)
    const onInstalled = () => {
      setInstallBlocking(false)
      setOpen(false)
    }
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.clearTimeout(t)
      unsub()
      window.removeEventListener('appinstalled', onInstalled)
      setInstallBlocking(false)
    }
  }, [isLoggedIn, user?._id, user?.id])

  const closeSession = () => {
    setOpen(false)
    setIosSteps(false)
    setInstallBlocking(false)
    // Logged-in: snooze until next browser session. Guests: just close (shows again next visit/load).
    if (isLoggedIn) dismissInstallForSession()
  }

  const closeForever = () => {
    setOpen(false)
    setIosSteps(false)
    setInstallBlocking(false)
    neverShowInstallPrompt()
  }

  const handleInstall = async () => {
    if (platform === 'ios') {
      setIosSteps(true)
      return
    }
    if (hasNativePrompt) {
      setInstalling(true)
      const result = await promptNativeInstall()
      setInstalling(false)
      if (result.ok) {
        setInstallBlocking(false)
        setOpen(false)
        return
      }
    }
  }

  if (typeof document === 'undefined') return null

  const meta = {
    ios: {
      icon: FaApple,
      title: 'Instala Qyntra en tu iPhone',
      subtitle: 'Acceso directo en tu pantalla de inicio, más rápida y como app nativa.',
      cta: 'Ver cómo instalar'
    },
    android: {
      icon: FaAndroid,
      title: 'Instala Qyntra en Android',
      subtitle: 'Ábrela a pantalla completa sin la barra del navegador.',
      cta: hasNativePrompt ? 'Instalar ahora' : 'Continuar'
    },
    windows: {
      icon: FaWindows,
      title: 'Instala Qyntra en tu PC',
      subtitle: 'Úsala como aplicación de escritorio desde el menú Inicio.',
      cta: hasNativePrompt ? 'Instalar ahora' : 'Continuar'
    },
    mac: {
      icon: FaApple,
      title: 'Instala Qyntra en tu Mac',
      subtitle: 'Agrégala a tu Dock y ábrela como una app independiente.',
      cta: hasNativePrompt ? 'Instalar ahora' : 'Continuar'
    },
    desktop: {
      icon: FiMonitor,
      title: 'Instala la app Qyntra',
      subtitle: 'Mejor rendimiento, atajos y experiencia a pantalla completa.',
      cta: hasNativePrompt ? 'Instalar ahora' : 'Continuar'
    }
  }[platform] || {
    icon: FiSmartphone,
    title: 'Instala la app Qyntra',
    subtitle: 'Llévala contigo como aplicación instalada.',
    cta: 'Instalar'
  }

  const PlatformIcon = meta.icon

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay-sheet fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={closeSession}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-app-title"
            initial={{ y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="app-bottom-sheet-panel relative w-full sm:max-w-md overflow-hidden rounded-t-[1.75rem] sm:rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  'radial-gradient(ellipse 90% 55% at 10% -10%, rgba(var(--color-primary-rgb),0.22), transparent 55%), radial-gradient(ellipse 70% 45% at 100% 0%, rgba(var(--color-accent-rgb),0.12), transparent 50%)'
              }}
              aria-hidden
            />

            <div className="relative px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[rgba(var(--color-primary-rgb),0.14)] ring-1 ring-[rgba(var(--color-primary-rgb),0.22)]">
                    <QyntraLogo size="md" className="!h-10 !w-10 !shadow-none" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
                      Aplicación
                    </p>
                    <h2
                      id="install-app-title"
                      className="font-display text-[1.55rem] leading-none tracking-tight text-[color:var(--text-primary)] sm:text-[1.75rem]"
                    >
                      Qyntra Gym
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeSession}
                  className="rounded-xl p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]"
                  aria-label="Cerrar"
                >
                  <FiX size={20} />
                </button>
              </div>

              {!iosSteps ? (
                <>
                  <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/70 p-3.5">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--bg-elevated)] text-[color:var(--color-primary)] shadow-sm">
                      <PlatformIcon size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[color:var(--text-primary)]">{meta.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-secondary)]">
                        {meta.subtitle}
                      </p>
                    </div>
                  </div>

                  <ul className="mb-5 space-y-2 text-sm text-[color:var(--text-secondary)]">
                    <li className="flex items-center gap-2">
                      <FiSmartphone className="shrink-0 text-[color:var(--color-primary)]" size={16} />
                      Más rápida y cómoda que el navegador
                    </li>
                    <li className="flex items-center gap-2">
                      <FiDownload className="shrink-0 text-[color:var(--color-primary)]" size={16} />
                      Icono en tu pantalla de inicio o escritorio
                    </li>
                  </ul>

                  <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                    <button
                      type="button"
                      disabled={installing}
                      onClick={handleInstall}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(var(--color-primary-rgb),0.32)] transition hover:brightness-110 disabled:opacity-60"
                    >
                      {installing ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <>
                          <FiDownload size={18} />
                          {meta.cta}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeSession}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-4 py-3.5 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-app)]"
                    >
                      Ahora no
                    </button>
                  </div>

                  {isLoggedIn && (
                    <button
                      type="button"
                      onClick={closeForever}
                      className="mt-3 w-full text-center text-[12px] font-medium text-[color:var(--text-muted)] underline-offset-2 hover:text-[color:var(--text-secondary)] hover:underline"
                    >
                      No volver a mostrar
                    </button>
                  )}

                  {!hasNativePrompt && platform !== 'ios' && (
                    <p className="mt-3 text-center text-[11px] leading-relaxed text-[color:var(--text-muted)]">
                      Si no aparece el instalador del sistema, usa el menú del navegador →{' '}
                      <strong className="text-[color:var(--text-secondary)]">Instalar aplicación</strong>.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h3 className="mb-3 font-display text-xl tracking-wide text-[color:var(--text-primary)]">
                    Instalar en iPhone / iPad
                  </h3>
                  <ol className="space-y-3 text-sm text-[color:var(--text-secondary)]">
                    <li className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-xs font-bold text-[color:var(--color-primary)]">
                        1
                      </span>
                      <span>
                        Ábrela en <strong className="text-[color:var(--text-primary)]">Safari</strong> (no en Chrome).
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-xs font-bold text-[color:var(--color-primary)]">
                        2
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        Toca <FiShare2 className="inline" />{' '}
                        <strong className="text-[color:var(--text-primary)]">Compartir</strong>.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.15)] text-xs font-bold text-[color:var(--color-primary)]">
                        3
                      </span>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        Elige <FiPlusSquare className="inline" />{' '}
                        <strong className="text-[color:var(--text-primary)]">Agregar a pantalla de inicio</strong>.
                      </span>
                    </li>
                  </ol>
                  <button type="button" onClick={closeSession} className="btn-primary mt-5 w-full py-3">
                    Entendido
                  </button>
                  {isLoggedIn && (
                    <button
                      type="button"
                      onClick={closeForever}
                      className="mt-3 w-full text-center text-[12px] font-medium text-[color:var(--text-muted)] underline-offset-2 hover:underline"
                    >
                      No volver a mostrar
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
