import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { FiMoon, FiSun, FiArrowLeft, FiWifi } from 'react-icons/fi'
import QyntraLogo from './QyntraLogo'
import { applyGuestTheme, getGuestTheme } from '../utils/guestTheme'
import { isInstalledApp } from '../utils/appMode'

const PANEL_IMAGE = {
  webp: '/landing/hero-gym.webp',
  jpg: '/landing/hero-gym.jpg',
  alt: 'Qyntra Gym — ambiente tecnofitness'
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: false })
}

/**
 * Guest auth: cinematic stage + professional phone device (mobile sheet + desktop showcase).
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  showBackHome = true,
  panelEyebrow = 'GYM OS',
  panelHeadline = 'ENTRENA CON SISTEMA'
}) {
  const reduceMotion = useReducedMotion()
  const installed = isInstalledApp()
  const clock = useClock()
  const [theme, setTheme] = useState(() => getGuestTheme())

  useEffect(() => {
    applyGuestTheme(theme)
  }, [theme])

  useEffect(() => {
    const prev = document.body.style.overflow
    const mq = window.matchMedia('(max-width: 1023px)')
    const lock = () => {
      document.body.style.overflow = mq.matches ? 'hidden' : prev || ''
    }
    lock()
    mq.addEventListener?.('change', lock)
    return () => {
      mq.removeEventListener?.('change', lock)
      document.body.style.overflow = prev
    }
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <div
      className="auth-shell relative h-[100svh] max-h-[100svh] overflow-hidden lg:h-auto lg:max-h-none lg:min-h-[100svh] lg:overflow-visible"
      data-auth-theme={theme}
    >
      {/* Desktop full-bleed stage */}
      <div className="auth-desktop-stage pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <picture className="absolute inset-0 block h-full w-full">
          <source srcSet={PANEL_IMAGE.webp} type="image/webp" />
          <img
            src={PANEL_IMAGE.jpg}
            alt=""
            className="h-full w-full object-cover object-center"
            loading="eager"
            decoding="async"
            fetchpriority="high"
            draggable={false}
          />
        </picture>
        <div className="auth-desktop-stage-overlay absolute inset-0" />
        {!reduceMotion && (
          <motion.div
            className="absolute -left-20 top-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl"
            style={{ background: 'rgba(var(--color-primary-rgb), 0.28)' }}
            animate={{ opacity: [0.3, 0.55, 0.3], x: [0, 30, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <div className="auth-layout relative z-10 flex h-full min-h-0 flex-col lg:grid lg:min-h-[100svh] lg:h-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,28rem)] lg:items-stretch lg:gap-8 lg:px-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,30rem)] xl:px-16 2xl:px-24">
        {/* Brand / hero strip */}
        <aside className="auth-visual relative isolate shrink-0 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:overflow-visible lg:py-10">
          {/* Mobile photo band — compact so form fits without page scroll */}
          <div className="relative h-16 w-full sm:h-[4.5rem] lg:hidden">
            <picture className="absolute inset-0 block h-full w-full">
              <source srcSet={PANEL_IMAGE.webp} type="image/webp" />
              <img
                src={PANEL_IMAGE.jpg}
                alt={PANEL_IMAGE.alt}
                className="h-full w-full object-cover object-[center_28%]"
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </picture>
            <div className="auth-visual-overlay absolute inset-0" />
            <div
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  'radial-gradient(ellipse at 30% 20%, rgba(var(--color-primary-rgb),0.38), transparent 52%)'
              }}
            />
            <div className="relative z-10 flex h-full flex-col justify-center p-3 sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <Link to={installed ? '/login' : '/'} className="flex min-w-0 items-center gap-2">
                  <QyntraLogo size="sm" withGlow />
                  <div className="min-w-0">
                    <span className="auth-force-white font-display block text-lg tracking-[0.14em] leading-none">
                      QYNTRA
                    </span>
                    <span
                      className="text-[8px] uppercase tracking-[0.28em]"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {panelEyebrow}
                    </span>
                  </div>
                </Link>
                {showBackHome && !installed && (
                  <Link
                    to="/"
                    className="auth-force-white-muted inline-flex h-8 items-center gap-1 rounded-full border border-white/25 bg-black/40 px-2.5 text-[11px] font-medium backdrop-blur-md"
                  >
                    <FiArrowLeft size={12} /> Inicio
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Desktop brand column */}
          <div className="relative z-10 hidden h-full flex-col justify-between lg:flex">
            <div className="flex items-center justify-between gap-4">
              <Link to={installed ? '/login' : '/'} className="flex min-w-0 items-center gap-3">
                <QyntraLogo size="lg" withGlow />
                <div className="min-w-0">
                  <span className="auth-force-white font-display block text-4xl tracking-[0.14em] leading-none">
                    QYNTRA
                  </span>
                  <span
                    className="text-xs uppercase tracking-[0.32em]"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {panelEyebrow}
                  </span>
                </div>
              </Link>
              {showBackHome && !installed && (
                <Link
                  to="/"
                  className="auth-force-white-muted inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-black/50"
                >
                  <FiArrowLeft size={16} /> Volver al inicio
                </Link>
              )}
            </div>

            <div className="max-w-xl py-10">
              <p
                className="mb-4 text-xs font-semibold uppercase tracking-[0.38em]"
                style={{ color: 'var(--color-primary)' }}
              >
                Tecnofitness
              </p>
              <h2 className="auth-force-white font-display text-6xl tracking-wide xl:text-7xl">
                {panelHeadline}
              </h2>
              <p className="auth-force-white-soft mt-5 max-w-md text-lg leading-relaxed">
                Entra a Qyntra desde el mismo sistema que usas en el gym: sesión clara, progreso medible
                y comunidad lista cuando entrenas.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <span className="auth-chip auth-chip-on-photo">Gym OS</span>
                <span className="auth-chip auth-chip-accent auth-chip-on-photo">Training+</span>
                <span className="auth-chip auth-chip-on-photo">App instalable</span>
              </div>
            </div>

            <p className="auth-force-white-muted text-sm">Eleva tu potencial · Qyntra Gym</p>
          </div>
        </aside>

        {/* Phone device stage */}
        <main className="auth-form relative z-20 -mt-3 flex min-h-0 flex-1 flex-col px-2.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] sm:-mt-4 sm:px-5 lg:mt-0 lg:items-center lg:justify-center lg:px-0 lg:py-8 lg:pb-8">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="auth-device mx-auto flex h-full min-h-0 w-full max-w-[26.5rem] flex-1 flex-col lg:h-auto lg:max-h-[min(860px,calc(100svh-4rem))] lg:w-[min(100%,26rem)] lg:flex-none xl:w-[27rem]"
          >
            <span className="auth-device-btn auth-device-btn-silent" aria-hidden />
            <span className="auth-device-btn auth-device-btn-vol-up" aria-hidden />
            <span className="auth-device-btn auth-device-btn-vol-down" aria-hidden />
            <span className="auth-device-btn auth-device-btn-power" aria-hidden />

            <div className="auth-device-bezel relative flex min-h-0 flex-1 flex-col">
              <div className="auth-island pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2" aria-hidden>
                <span className="auth-island-speaker" />
                <span className="auth-island-lens" />
              </div>

              <div className="auth-device-screen-shell relative flex min-h-0 flex-1 flex-col">
                <div className="auth-status relative z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 pb-1.5 pt-[1.85rem]">
                  <span className="auth-status-text text-[12px] font-semibold tabular-nums tracking-tight">
                    {clock}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 px-2">
                    <span className="auth-status-pulse" aria-hidden />
                    <span className="auth-status-brand font-display text-[10px] tracking-[0.24em]">
                      QYNTRA
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="auth-signal" aria-hidden>
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <FiWifi size={12} className="auth-status-icon" aria-hidden />
                    <span className="auth-battery" aria-hidden>
                      <span className="auth-battery-level" />
                    </span>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="auth-status-theme inline-flex h-6 w-6 items-center justify-center rounded-full transition active:scale-95"
                      aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
                    >
                      {theme === 'dark' ? <FiSun size={12} /> : <FiMoon size={12} />}
                    </button>
                  </div>
                </div>

                <div className="auth-device-screen relative z-10 mx-auto flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y px-3.5 pb-1 pt-0.5 sm:px-5">
                  <div className="auth-screen-grid pointer-events-none absolute inset-0" aria-hidden />
                  <div className="auth-screen-glow pointer-events-none absolute inset-x-0 top-0 h-16" aria-hidden />

                  {(title || subtitle) && (
                    <div className="auth-heading relative mb-2.5 shrink-0 sm:mb-5">
                      <div className="auth-chips mb-1.5 flex flex-wrap items-center gap-1.5 sm:mb-2.5">
                        <span className="auth-chip">Gym OS</span>
                        <span className="auth-chip auth-chip-accent">Training+</span>
                      </div>
                      {title && (
                        <h1
                          className="auth-title font-display text-[1.55rem] tracking-wide sm:text-[1.9rem]"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {title}
                        </h1>
                      )}
                      {subtitle && (
                        <p className="auth-readable-secondary auth-subtitle mt-1 line-clamp-2 text-xs leading-relaxed sm:mt-1.5 sm:text-sm">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="auth-form-card relative mb-1 shrink-0 rounded-[1.1rem] border p-3 sm:mb-2 sm:rounded-[1.25rem] sm:p-5">
                    {children}
                  </div>
                </div>

                <div className="auth-home-bar relative z-20 flex shrink-0 justify-center pb-1.5 pt-1.5 lg:pb-2.5 lg:pt-2" aria-hidden>
                  <span className="auth-home-indicator" />
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      </div>

      <style>{`
        .auth-shell {
          background: var(--bg-app);
          color: var(--text-primary);
        }

        /* Mobile: lock page scroll; form lives inside phone */
        @media (max-width: 1023px) {
          .auth-shell {
            overscroll-behavior: none;
            touch-action: manipulation;
          }
          .auth-shell .auth-layout {
            height: 100%;
            min-height: 0;
          }
          .auth-shell .auth-device {
            min-height: 0;
            filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.32));
          }
          .auth-shell .auth-device-bezel {
            border-radius: 1.75rem;
            padding: 0.28rem;
          }
          .auth-shell .auth-device-screen-shell {
            border-radius: 1.5rem;
          }
          .auth-shell .auth-island {
            top: 0.4rem;
            width: 5.6rem;
            height: 1.35rem;
          }
          .auth-shell .auth-status {
            padding-top: 1.45rem;
            padding-bottom: 0.2rem;
          }
          .auth-shell .auth-device-screen {
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
          }
          .auth-shell .auth-form-card .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 0.55rem;
          }
          .auth-shell .auth-form-card .mt-4 { margin-top: 0.55rem !important; }
          .auth-shell .auth-form-card .mt-6 { margin-top: 0.7rem !important; }
          .auth-shell .auth-form-card .mt-3 { margin-top: 0.45rem !important; }
          .auth-shell .auth-form-card .mb-2 { margin-bottom: 0.35rem !important; }
          .auth-shell .input-field {
            padding-top: 0.58rem;
            padding-bottom: 0.58rem;
            font-size: 0.92rem;
          }
          .auth-shell .btn-primary,
          .auth-shell .btn-secondary {
            padding-top: 0.62rem;
            padding-bottom: 0.62rem;
            font-size: 0.92rem;
          }
          .auth-shell .auth-label {
            margin-bottom: 0.28rem;
            font-size: 0.78rem;
          }
          .auth-shell .auth-home-indicator {
            width: 5.5rem;
            height: 0.22rem;
          }
        }

        @media (max-width: 1023px) and (max-height: 740px) {
          .auth-shell .auth-chips { display: none; }
          .auth-shell .auth-subtitle { display: none; }
          .auth-shell .auth-title { font-size: 1.35rem; }
          .auth-shell .auth-heading { margin-bottom: 0.45rem; }
        }

        .auth-shell .auth-desktop-stage-overlay {
          background:
            linear-gradient(105deg, rgba(7,7,12,0.82) 0%, rgba(7,7,12,0.55) 42%, rgba(7,7,12,0.72) 100%),
            radial-gradient(ellipse at 70% 40%, rgba(var(--color-primary-rgb),0.2), transparent 50%);
        }
        html.light .auth-shell .auth-desktop-stage-overlay {
          background:
            linear-gradient(105deg, rgba(10,10,16,0.78) 0%, rgba(10,10,16,0.5) 45%, rgba(10,10,16,0.68) 100%),
            radial-gradient(ellipse at 70% 40%, rgba(var(--color-primary-rgb),0.22), transparent 50%);
        }

        .auth-shell .auth-visual-overlay {
          background: linear-gradient(
            180deg,
            rgba(7, 7, 12, 0.45) 0%,
            rgba(7, 7, 12, 0.58) 48%,
            rgba(7, 7, 12, 0.9) 100%
          );
        }

        .auth-shell .auth-device {
          position: relative;
          filter: drop-shadow(0 28px 40px rgba(0, 0, 0, 0.38));
        }
        html.light .auth-shell .auth-device {
          filter: drop-shadow(0 22px 36px rgba(16, 16, 24, 0.16));
        }
        @media (min-width: 1024px) {
          .auth-shell .auth-device {
            filter:
              drop-shadow(0 40px 70px rgba(0, 0, 0, 0.55))
              drop-shadow(0 0 40px rgba(var(--color-primary-rgb), 0.12));
            height: min(860px, calc(100svh - 4rem));
            flex: none;
          }
          html.light .auth-shell .auth-device {
            filter:
              drop-shadow(0 36px 60px rgba(0, 0, 0, 0.4))
              drop-shadow(0 0 36px rgba(var(--color-primary-rgb), 0.14));
          }
          .auth-shell .auth-device-bezel,
          .auth-shell .auth-device-screen-shell {
            height: 100%;
          }
        }

        .auth-shell .auth-device-bezel {
          position: relative;
          border-radius: 2.4rem;
          padding: 0.42rem;
          background:
            linear-gradient(155deg, #2a2a32 0%, #121218 38%, #1c1c24 72%, #0c0c10 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            inset 0 -1px 0 rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(var(--color-primary-rgb), 0.18);
          min-height: 0;
        }
        html.light .auth-shell .auth-device-bezel {
          background:
            linear-gradient(155deg, #f4f4f5 0%, #d4d4d8 36%, #e4e4e7 68%, #a1a1aa 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            inset 0 -1px 0 rgba(15, 15, 20, 0.12),
            0 0 0 1px rgba(var(--color-primary-rgb), 0.22);
        }
        .auth-shell .auth-device-bezel::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          z-index: 50;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.08),
            inset 0 0 20px rgba(var(--color-primary-rgb), 0.06);
        }

        .auth-shell .auth-device-screen-shell {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-radius: 2.05rem;
          overflow: hidden;
          background: var(--bg-app);
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.04),
            0 0 0 0.5px rgba(0, 0, 0, 0.55);
        }
        html.light .auth-shell .auth-device-screen-shell {
          box-shadow:
            inset 0 0 0 1px rgba(15, 15, 20, 0.06),
            0 0 0 0.5px rgba(15, 15, 20, 0.12);
        }

        .auth-shell .auth-device-btn {
          position: absolute;
          width: 3.5px;
          z-index: 5;
          border-radius: 1px 2px 2px 1px;
          background: linear-gradient(180deg, #4a4a54, #1a1a22 55%, #2e2e36);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.2),
            1px 0 2px rgba(0,0,0,0.35);
        }
        html.light .auth-shell .auth-device-btn {
          background: linear-gradient(180deg, #e4e4e7, #a1a1aa 55%, #71717a);
        }
        .auth-shell .auth-device-btn-silent {
          left: -3.5px;
          top: 14%;
          height: 18px;
          border-radius: 2px 1px 1px 2px;
        }
        .auth-shell .auth-device-btn-vol-up {
          left: -3.5px;
          top: 20%;
          height: 34px;
          border-radius: 2px 1px 1px 2px;
        }
        .auth-shell .auth-device-btn-vol-down {
          left: -3.5px;
          top: 30%;
          height: 34px;
          border-radius: 2px 1px 1px 2px;
        }
        .auth-shell .auth-device-btn-power {
          right: -3.5px;
          top: 24%;
          height: 52px;
        }

        .auth-shell .auth-island {
          width: 7.1rem;
          height: 1.7rem;
          border-radius: 999px;
          background: #050508;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0.55rem 0 0.85rem;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.05) inset,
            0 6px 16px rgba(0,0,0,0.4);
        }
        .auth-shell .auth-island-speaker {
          width: 2.4rem;
          height: 0.28rem;
          border-radius: 999px;
          background: #14141a;
          box-shadow: inset 0 1px 1px rgba(0,0,0,0.65);
        }
        .auth-shell .auth-island-lens {
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          background:
            radial-gradient(circle at 32% 32%, #93c5fd 0%, #0284c7 28%, #0c4a6e 62%, #020617 100%);
          box-shadow:
            0 0 0 1.5px #0a0a0f,
            0 0 10px rgba(var(--color-accent-rgb), 0.35);
        }

        .auth-shell .auth-status-text,
        .auth-shell .auth-status-icon {
          color: var(--text-primary);
        }
        .auth-shell .auth-status-brand {
          color: var(--color-primary);
          line-height: 1;
        }
        .auth-shell .auth-status-pulse {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: var(--color-primary);
          box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.7);
        }
        @media (prefers-reduced-motion: no-preference) {
          .auth-shell .auth-status-pulse {
            animation: auth-pulse 2.2s ease-in-out infinite;
          }
        }
        @keyframes auth-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.7); opacity: 0.6; }
        }
        .auth-shell .auth-status-theme {
          background: rgba(var(--color-primary-rgb), 0.12);
          color: var(--color-primary);
          border: 1px solid rgba(var(--color-primary-rgb), 0.25);
        }

        .auth-shell .auth-signal {
          display: inline-flex;
          align-items: flex-end;
          gap: 1.5px;
          height: 10px;
        }
        .auth-shell .auth-signal i {
          display: block;
          width: 2.5px;
          border-radius: 0.5px;
          background: var(--text-primary);
          opacity: 0.9;
        }
        .auth-shell .auth-signal i:nth-child(1) { height: 3px; }
        .auth-shell .auth-signal i:nth-child(2) { height: 5px; }
        .auth-shell .auth-signal i:nth-child(3) { height: 7px; }
        .auth-shell .auth-signal i:nth-child(4) { height: 9px; opacity: 0.35; }

        .auth-shell .auth-battery {
          width: 18px;
          height: 9px;
          border: 1px solid var(--text-primary);
          border-radius: 2px;
          position: relative;
          opacity: 0.9;
          padding: 1px;
        }
        .auth-shell .auth-battery::after {
          content: '';
          position: absolute;
          right: -3px;
          top: 2px;
          width: 1.5px;
          height: 4px;
          border-radius: 0 1px 1px 0;
          background: var(--text-primary);
          opacity: 0.7;
        }
        .auth-shell .auth-battery-level {
          display: block;
          height: 100%;
          width: 72%;
          border-radius: 0.5px;
          background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
        }

        .auth-shell .auth-screen-grid {
          background-image:
            linear-gradient(rgba(var(--color-primary-rgb), 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(var(--color-accent-rgb), 0.03) 1px, transparent 1px);
          background-size: 20px 20px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.5), transparent 85%);
        }
        .auth-shell .auth-screen-glow {
          background: linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.08), transparent);
        }

        .auth-shell .auth-chip {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.22rem 0.6rem;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-primary);
          background: rgba(var(--color-primary-rgb), 0.1);
          border: 1px solid rgba(var(--color-primary-rgb), 0.22);
        }
        .auth-shell .auth-chip-accent {
          color: var(--color-accent);
          background: rgba(var(--color-accent-rgb), 0.1);
          border-color: rgba(var(--color-accent-rgb), 0.28);
        }
        html.light .auth-shell .auth-chip-accent {
          color: #0e7490;
        }
        .auth-shell .auth-chip-on-photo {
          color: #fff !important;
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.22);
          backdrop-filter: blur(8px);
        }
        .auth-shell .auth-chip-accent.auth-chip-on-photo {
          color: #fff !important;
          background: rgba(var(--color-accent-rgb), 0.18);
          border-color: rgba(var(--color-accent-rgb), 0.45);
        }

        .auth-shell .auth-form-card {
          background: var(--bg-elevated);
          border-color: var(--border-subtle);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
        }
        html.light .auth-shell .auth-form-card {
          box-shadow: 0 10px 28px rgba(16, 16, 24, 0.06);
        }

        .auth-shell .auth-home-indicator {
          width: 7.25rem;
          height: 0.26rem;
          border-radius: 999px;
          background: var(--text-primary);
          opacity: 0.28;
        }

        .auth-shell .auth-force-white,
        html.light .auth-shell .auth-force-white {
          color: #ffffff !important;
        }
        .auth-shell .auth-force-white-soft,
        html.light .auth-shell .auth-force-white-soft {
          color: rgba(255, 255, 255, 0.86) !important;
        }
        .auth-shell .auth-force-white-muted,
        html.light .auth-shell .auth-force-white-muted {
          color: rgba(255, 255, 255, 0.78) !important;
        }
        .auth-shell .auth-readable-secondary {
          color: var(--text-secondary);
        }
        html.light .auth-shell .auth-readable-secondary {
          color: #3f3f46 !important;
        }
        .auth-shell .auth-label {
          color: var(--text-secondary);
        }
        html.light .auth-shell .auth-label {
          color: #27272a !important;
        }

        @media (min-width: 1024px) {
          .auth-shell .auth-device-screen {
            scrollbar-width: thin;
            scrollbar-color: rgba(var(--color-primary-rgb), 0.35) transparent;
          }
        }
      `}</style>
    </div>
  )
}

export function AuthLabel({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`auth-label mb-2 block text-sm font-medium ${className}`}>
      {children}
    </label>
  )
}
