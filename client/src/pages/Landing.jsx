import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import {
  FiArrowRight,
  FiZap,
  FiUsers,
  FiTrendingUp,
  FiSmartphone,
  FiShield,
  FiActivity,
  FiMoon,
  FiSun,
  FiDownload
} from 'react-icons/fi'
import QyntraLogo from '../components/QyntraLogo'
import DownloadApps from '../components/DownloadApps'
import { applyGuestTheme, getGuestTheme } from '../utils/guestTheme'

const LANDING_IMAGES = {
  hero: { webp: '/landing/hero-gym.webp', jpg: '/landing/hero-gym.jpg', alt: 'Gimnasio premium con iluminación tecnofitness' },
  train: { webp: '/landing/train.webp', jpg: '/landing/train.jpg', alt: 'Atleta entrenando con enfoque y precisión' },
  community: { webp: '/landing/community.webp', jpg: '/landing/community.jpg', alt: 'Comunidad fitness motivándose en el gym' },
  app: { webp: '/landing/app-device.webp', jpg: '/landing/app-device.jpg', alt: 'Qyntra Gym en dispositivos móviles' }
}

function LandingPicture({ image, className = '', imgClassName = '', priority = false, sizes = '100vw' }) {
  return (
    <picture className={className}>
      <source srcSet={image.webp} type="image/webp" sizes={sizes} />
      <img
        src={image.jpg}
        alt={image.alt}
        className={imgClassName}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
      />
    </picture>
  )
}

const features = [
  {
    icon: FiZap,
    title: 'Entreno en vivo',
    desc: 'Rutinas con timer de descanso, sesión flotante y seguimiento preciso de cada serie.'
  },
  {
    icon: FiUsers,
    title: 'Comunidad fitness',
    desc: 'Historias, feed social y retos para convertir el gimnasio en un hábito compartido.'
  },
  {
    icon: FiTrendingUp,
    title: 'Progreso medible',
    desc: 'XP, insignias y reportes que vuelven visible cada mejora en fuerza y constancia.'
  },
  {
    icon: FiActivity,
    title: 'Rutinas GymRat',
    desc: 'Comparte y adopta rutinas públicas dentro de tu red de seguidores.'
  },
  {
    icon: FiSmartphone,
    title: 'App instalable',
    desc: 'Experiencia nativa en Windows, Android e iOS sin depender de una tienda.'
  },
  {
    icon: FiShield,
    title: 'Control total',
    desc: 'Privacidad, temas y acentos de color configurables a tu medida.'
  }
]

function EnergyRing({ delay = 0, size = 1, reduceMotion }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full border"
      style={{
        width: `${size * 100}%`,
        height: `${size * 100}%`,
        x: '-50%',
        y: '-50%',
        borderColor: 'rgba(var(--lp-accent-rgb), 0.18)'
      }}
      animate={
        reduceMotion
          ? undefined
          : {
              rotate: 360,
              scale: [1, 1.03, 1],
              opacity: [0.35, 0.7, 0.35]
            }
      }
      transition={{
        rotate: { duration: 28 * size, repeat: Infinity, ease: 'linear', delay },
        scale: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay },
        opacity: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay }
      }}
    />
  )
}

function FloatingOrb({ className, color, delay = 0, reduceMotion }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: color }}
      animate={
        reduceMotion
          ? undefined
          : {
              x: [0, 40, -20, 0],
              y: [0, -30, 20, 0],
              scale: [1, 1.15, 0.95, 1]
            }
      }
      transition={{ duration: 14 + delay * 2, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

export default function Landing() {
  const reduceMotion = useReducedMotion()
  const [theme, setTheme] = useState(() => getGuestTheme())

  const { scrollYProgress } = useScroll()
  const heroParallax = useTransform(scrollYProgress, [0, 0.25], [0, -80])
  const heroImageY = useTransform(scrollYProgress, [0, 0.35], [0, 120])
  const heroFade = useTransform(scrollYProgress, [0, 0.2], [1, 0.4])

  useEffect(() => {
    applyGuestTheme(theme)
  }, [theme])

  const vars = useMemo(() => {
    if (theme === 'light') {
      return {
        '--lp-bg': '#F3F5F8',
        '--lp-bg-elevated': '#FFFFFF',
        '--lp-surface': 'rgba(255,255,255,0.78)',
        '--lp-text': '#101018',
        '--lp-muted': '#5B6170',
        '--lp-faint': '#8B919E',
        '--lp-border': 'rgba(16,16,24,0.1)',
        '--lp-grid': 'rgba(16,16,24,0.06)',
        '--lp-primary': '#FF6B35',
        '--lp-accent': '#0891B2',
        '--lp-primary-rgb': '255, 107, 53',
        '--lp-accent-rgb': '8, 145, 178',
        '--lp-hero-base': 'linear-gradient(160deg, #F8FAFC 0%, #EEF2F7 45%, #E8ECF2 100%)',
        '--lp-noise': '0.04',
        // Bridge for DownloadApps / shared components
        '--color-primary': '#FF6B35',
        '--color-accent': '#0891B2',
        '--color-primary-rgb': '255, 107, 53',
        '--color-accent-rgb': '8, 145, 178',
        '--bg-app': '#F3F5F8',
        '--bg-card': '#FFFFFF',
        '--bg-elevated': '#FFFFFF',
        '--bg-muted': '#EEF0F4',
        '--text-primary': '#101018',
        '--text-secondary': '#5B6170',
        '--text-muted': '#8B919E',
        '--border-subtle': 'rgba(16,16,24,0.1)',
        '--border-strong': 'rgba(16,16,24,0.16)'
      }
    }
    return {
      '--lp-bg': '#07070C',
      '--lp-bg-elevated': '#101018',
      '--lp-surface': 'rgba(16,16,24,0.72)',
      '--lp-text': '#F7F7FA',
      '--lp-muted': '#A1A1AA',
      '--lp-faint': '#71717A',
      '--lp-border': 'rgba(255,255,255,0.1)',
      '--lp-grid': 'rgba(255,255,255,0.045)',
      '--lp-primary': '#FF6B35',
      '--lp-accent': '#00F5FF',
      '--lp-primary-rgb': '255, 107, 53',
      '--lp-accent-rgb': '0, 245, 255',
      '--lp-hero-base': 'linear-gradient(160deg, #05050A 0%, #0C0C14 50%, #07070C 100%)',
      '--lp-noise': '0.045',
      '--color-primary': '#FF6B35',
      '--color-accent': '#00F5FF',
      '--color-primary-rgb': '255, 107, 53',
      '--color-accent-rgb': '0, 245, 255',
      '--bg-app': '#07070C',
      '--bg-card': '#14141C',
      '--bg-elevated': '#101018',
      '--bg-muted': '#1A1A24',
      '--text-primary': '#F7F7FA',
      '--text-secondary': '#A1A1AA',
      '--text-muted': '#71717A',
      '--border-subtle': 'rgba(255,255,255,0.1)',
      '--border-strong': 'rgba(255,255,255,0.16)'
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <div
      className="landing-root relative min-h-screen overflow-x-hidden"
      data-landing-theme={theme}
      style={{
        ...vars,
        background: 'var(--lp-bg)',
        color: 'var(--lp-text)',
        transition: 'background-color 0.35s ease, color 0.35s ease'
      }}
    >
      {/* Ambient field */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'var(--lp-hero-base)' }} />
        <FloatingOrb
          reduceMotion={reduceMotion}
          className="left-[-10%] top-[-10%] h-[42rem] w-[42rem]"
          color="rgba(var(--lp-primary-rgb), 0.22)"
          delay={0}
        />
        <FloatingOrb
          reduceMotion={reduceMotion}
          className="bottom-[-15%] right-[-8%] h-[36rem] w-[36rem]"
          color="rgba(var(--lp-accent-rgb), 0.14)"
          delay={1.5}
        />
        <FloatingOrb
          reduceMotion={reduceMotion}
          className="left-[40%] top-[45%] h-[22rem] w-[22rem]"
          color="rgba(var(--lp-primary-rgb), 0.08)"
          delay={0.8}
        />
        <div
          className="absolute inset-0 opacity-[var(--lp-noise)]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
          }}
        />
      </div>

      {/* Nav — floats over full-bleed hero photography */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <motion.nav
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 sm:px-5 backdrop-blur-xl"
          style={{
            background: theme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(16,16,24,0.55)',
            borderColor: 'rgba(255,255,255,0.14)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.28)'
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <motion.div
              animate={reduceMotion ? undefined : { rotate: [0, 4, -4, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <QyntraLogo size="lg" withGlow />
            </motion.div>
            <div className="min-w-0">
              <span className="font-display block text-2xl tracking-[0.14em] leading-none sm:text-3xl">
                QYNTRA
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.32em] sm:text-xs"
                style={{ color: 'var(--lp-primary)' }}
              >
                GYM OS
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition hover:scale-105 active:scale-95"
              style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-muted)' }}
              aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
              </motion.span>
            </button>
            <Link
              to="/login"
              className="hidden px-3 py-2 text-sm transition sm:inline"
              style={{ color: 'var(--lp-muted)' }}
            >
              Ingresar
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold sm:px-5"
              style={{ background: 'var(--lp-primary)', color: '#0A0A0F' }}
            >
              Comenzar <FiArrowRight className="hidden sm:inline" />
            </Link>
          </div>
        </motion.nav>
      </header>

      {/* HERO — brand first, full-bleed gym photography */}
      <section className="relative z-10 min-h-[100svh] overflow-hidden">
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 scale-110">
          <LandingPicture
            image={LANDING_IMAGES.hero}
            priority
            sizes="100vw"
            className="absolute inset-0 block h-full w-full"
            imgClassName="h-full w-full object-cover object-[center_35%]"
          />
        </motion.div>

        {/* Readability stack — always cinematic so brand/CTAs stay crisp */}
        <div
          className="absolute inset-0"
          style={{
            background:
              theme === 'light'
                ? 'linear-gradient(180deg, rgba(247,248,252,0.55) 0%, rgba(10,10,16,0.55) 38%, rgba(7,7,12,0.88) 100%)'
                : 'linear-gradient(180deg, rgba(7,7,12,0.45) 0%, rgba(7,7,12,0.62) 42%, rgba(7,7,12,0.92) 100%)'
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 28%, rgba(var(--lp-primary-rgb),0.28), transparent 52%), radial-gradient(ellipse at 85% 75%, rgba(var(--lp-accent-rgb),0.14), transparent 42%)'
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at center, black 18%, transparent 72%)'
          }}
        />

        {/* Soft orbit accent (doesn't compete with photo) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-50">
          <div className="relative h-[min(88vw,38rem)] w-[min(88vw,38rem)]">
            <EnergyRing reduceMotion={reduceMotion} size={1} delay={0} />
            <EnergyRing reduceMotion={reduceMotion} size={0.68} delay={0.4} />
            {!reduceMotion && (
              <motion.div
                className="absolute inset-[12%]"
                animate={{ rotate: -360 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              >
                <span
                  className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                  style={{ background: 'var(--lp-accent)', boxShadow: '0 0 16px var(--lp-accent)' }}
                />
              </motion.div>
            )}
          </div>
        </div>

        {!reduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(var(--lp-accent-rgb),0.55), transparent)'
            }}
            animate={{ top: ['12%', '82%', '12%'], opacity: [0.12, 0.45, 0.12] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <motion.div
          style={{ y: heroParallax, opacity: heroFade }}
          className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pb-16 pt-28 text-center sm:px-6 sm:pb-20 sm:pt-32"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.86, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-7 flex justify-center"
          >
            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: [0, -10, 0],
                      filter: [
                        'drop-shadow(0 0 0 rgba(255,107,53,0))',
                        'drop-shadow(0 0 28px rgba(255,107,53,0.55))',
                        'drop-shadow(0 0 0 rgba(255,107,53,0))'
                      ]
                    }
              }
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <QyntraLogo size="xl" withGlow />
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="landing-force-white font-display text-[clamp(3.5rem,16vw,9.5rem)] leading-[0.88] tracking-[0.08em]"
          >
            <span className="landing-gradient-text">QYNTRA</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.65 }}
            className="landing-force-white-soft mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-xl"
          >
            El sistema operativo del gimnasio: entrena, conecta y mide tu evolución en una app instalable.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.65 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/register"
                className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold"
                style={{ background: 'var(--lp-primary)', color: '#0A0A0F' }}
              >
                Entrar a entrenar <FiArrowRight />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <a
                href="#descargas"
                className="landing-hero-secondary-btn inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold backdrop-blur-md"
              >
                <FiDownload /> Descargar app
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Atmosphere — train */}
      <section className="relative z-10 overflow-hidden">
        <div className="grid min-h-[min(72svh,40rem)] lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="relative order-2 min-h-[18rem] sm:min-h-[24rem] lg:order-1 lg:min-h-full"
          >
            <LandingPicture
              image={LANDING_IMAGES.train}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="absolute inset-0 block h-full w-full"
              imgClassName="h-full w-full object-cover object-center"
            />
            <div
              className="absolute inset-0 lg:hidden"
              style={{
                background:
                  'linear-gradient(to top, var(--lp-bg) 0%, transparent 55%)'
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-32 lg:block"
              style={{
                background: 'linear-gradient(to left, var(--lp-bg), transparent)'
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="order-1 flex flex-col justify-center px-4 py-14 sm:px-6 sm:py-20 lg:order-2 lg:px-14"
          >
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.35em]"
              style={{ color: 'var(--lp-primary)' }}
            >
              Sesión en vivo
            </p>
            <h2 className="font-display text-4xl tracking-wide sm:text-5xl lg:text-6xl">
              CADA SERIE,
              <br />
              <span className="landing-gradient-text">CON PROPÓSITO</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed sm:text-lg" style={{ color: 'var(--lp-muted)' }}>
              Timers, progreso y foco total en el rack. Qyntra convierte tu entreno en un flujo medible, sin fricción.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="mb-12 max-w-2xl"
          >
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.35em]"
              style={{ color: 'var(--lp-primary)' }}
            >
              Tecnofitness
            </p>
            <h2 className="font-display text-4xl tracking-wide sm:text-6xl">
              HECHO PARA EL{' '}
              <span className="landing-gradient-text">GIMNASIO MODERNO</span>
            </h2>
            <p className="mt-4 text-lg" style={{ color: 'var(--lp-muted)' }}>
              Cada módulo combina rendimiento, comunidad y diseño nativo para que entrenar se sienta como usar tecnología de elite.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 32, rotateX: 8 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduceMotion ? undefined : { y: -6, transition: { duration: 0.25 } }}
                className="group relative overflow-hidden rounded-[1.5rem] border p-6"
                style={{
                  borderColor: 'var(--lp-border)',
                  background: 'var(--lp-surface)',
                  backdropFilter: 'blur(16px)'
                }}
              >
                <motion.div
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: 'rgba(var(--lp-primary-rgb), 0.25)' }}
                />
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: 'rgba(var(--lp-primary-rgb), 0.14)',
                    color: 'var(--lp-primary)'
                  }}
                >
                  <feature.icon size={22} />
                </div>
                <h3 className="font-display text-2xl tracking-wide">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lp-muted)' }}>
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Community — full-bleed visual band */}
      <section className="relative z-10 min-h-[min(70svh,36rem)] overflow-hidden">
        <LandingPicture
          image={LANDING_IMAGES.community}
          sizes="100vw"
          className="absolute inset-0 block h-full w-full"
          imgClassName="h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              theme === 'light'
                ? 'linear-gradient(90deg, rgba(243,245,248,0.94) 0%, rgba(243,245,248,0.78) 42%, rgba(243,245,248,0.35) 100%)'
                : 'linear-gradient(90deg, rgba(7,7,12,0.92) 0%, rgba(7,7,12,0.72) 45%, rgba(7,7,12,0.35) 100%)'
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-[min(70svh,36rem)] max-w-7xl items-center px-4 py-16 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65 }}
            className="max-w-xl"
          >
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.35em]"
              style={{ color: 'var(--lp-primary)' }}
            >
              Comunidad
            </p>
            <h2 className="font-display text-4xl tracking-wide sm:text-5xl lg:text-6xl">
              NO ENTRENAS{' '}
              <span className="landing-gradient-text">SOLO</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed sm:text-lg" style={{ color: 'var(--lp-muted)' }}>
              Historias, feed y retos: la energía del gym también vive en tu red. Comparte el momento y empuja a tu círculo.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Downloads */}
      <section
        id="descargas"
        className="relative z-10 overflow-hidden border-y px-4 py-20 sm:px-6 sm:py-24"
        style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-bg-elevated)' }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] opacity-40 lg:block">
          <LandingPicture
            image={LANDING_IMAGES.app}
            sizes="42vw"
            className="absolute inset-0 block h-full w-full"
            imgClassName="h-full w-full object-cover object-left"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, var(--lp-bg-elevated), transparent 35%, transparent 70%, var(--lp-bg-elevated))'
            }}
          />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <DownloadApps />
          </motion.div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 overflow-hidden px-4 py-24 sm:px-6 sm:py-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65 }}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border px-6 py-16 text-center sm:px-12"
          style={{ borderColor: 'var(--lp-border)' }}
        >
          <LandingPicture
            image={LANDING_IMAGES.app}
            sizes="(max-width: 896px) 100vw, 896px"
            className="absolute inset-0 block h-full w-full"
            imgClassName="h-full w-full object-cover object-center opacity-35"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(var(--lp-primary-rgb),0.35), rgba(7,7,12,0.88) 55%, rgba(var(--lp-accent-rgb),0.18))'
            }}
          />
          {!reduceMotion && (
            <motion.div
              className="pointer-events-none absolute -left-20 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full blur-3xl"
              style={{ background: 'rgba(var(--lp-primary-rgb), 0.35)' }}
              animate={{ x: [0, 40, 0], opacity: [0.4, 0.75, 0.4] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <div className="relative z-10">
            <h2 className="landing-force-white font-display text-4xl tracking-wide sm:text-6xl">
              TU PRÓXIMO PR EMPIEZA AQUÍ
            </h2>
            <p className="landing-force-white-soft mx-auto mt-4 max-w-xl text-lg">
              Únete a Qyntra Gym y convierte cada sesión en progreso compartido, medible y motivador.
            </p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="mt-8 inline-flex">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold"
                style={{ background: 'var(--lp-primary)', color: '#0A0A0F' }}
              >
                Crear cuenta <FiArrowRight />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <footer
        className="relative z-10 border-t px-4 py-10 sm:px-6"
        style={{ borderColor: 'var(--lp-border)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <QyntraLogo size="md" />
            <span className="font-display text-2xl tracking-wider">QYNTRA GYM</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--lp-faint)' }}>
            © {new Date().getFullYear()} QYNTRA GYM. Todos los derechos reservados.
          </p>
          <div className="flex gap-6 text-sm" style={{ color: 'var(--lp-muted)' }}>
            <a href="#features" className="transition hover:opacity-100" style={{ opacity: 0.85 }}>
              Funciones
            </a>
            <a href="#descargas" className="transition hover:opacity-100" style={{ opacity: 0.85 }}>
              Descargas
            </a>
            <Link to="/login" className="transition hover:opacity-100" style={{ opacity: 0.85 }}>
              Ingresar
            </Link>
            <button type="button" onClick={toggleTheme} className="transition hover:opacity-100" style={{ opacity: 0.85 }}>
              Tema {theme === 'dark' ? 'claro' : 'oscuro'}
            </button>
          </div>
        </div>
      </footer>

      <style>{`
        .landing-gradient-text {
          background: linear-gradient(105deg, var(--lp-primary) 0%, var(--lp-accent) 55%, var(--lp-primary) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: landing-shine 5.5s ease-in-out infinite;
        }
        @keyframes landing-shine {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-gradient-text { animation: none; }
        }
        .landing-root img {
          -webkit-user-select: none;
          user-select: none;
        }
        /* Defeat html.light remaps on photographic / cinematic surfaces */
        .landing-root .landing-force-white,
        html.light .landing-root .landing-force-white {
          color: #ffffff !important;
        }
        .landing-root .landing-force-white-soft,
        html.light .landing-root .landing-force-white-soft {
          color: rgba(255, 255, 255, 0.86) !important;
        }
        .landing-root .landing-hero-secondary-btn,
        html.light .landing-root .landing-hero-secondary-btn {
          color: #ffffff !important;
          background: rgba(0, 0, 0, 0.45) !important;
          border: 1px solid rgba(255, 255, 255, 0.38) !important;
        }
        .landing-root .landing-hero-secondary-btn:hover,
        html.light .landing-root .landing-hero-secondary-btn:hover {
          background: rgba(0, 0, 0, 0.58) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
        }
        .landing-root .landing-hero-secondary-btn svg,
        html.light .landing-root .landing-hero-secondary-btn svg {
          color: #ffffff !important;
          stroke: #ffffff !important;
        }
      `}</style>
    </div>
  )
}
