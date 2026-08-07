import { useEffect, useState } from 'react'
import { Toaster, ToastBar, toast } from 'react-hot-toast'
import { motion, useMotionValue, useTransform } from 'framer-motion'

function themeToastStyle() {
  const root = typeof document !== 'undefined' ? document.documentElement : null
  const isLight = root?.classList.contains('light')
  if (isLight) {
    return {
      background: 'var(--bg-elevated, #ffffff)',
      color: 'var(--text-primary, #111827)',
      border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
      boxShadow: '0 10px 40px rgba(15, 23, 42, 0.12)'
    }
  }
  return {
    background: 'var(--bg-elevated, #14141C)',
    color: 'var(--text-primary, #fff)',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
    boxShadow: '0 10px 40px rgba(0,0,0,0.35)'
  }
}

function SwipeToast({ t, children }) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-160, 0, 160], [0.2, 1, 0.2])

  return (
    <motion.div
      style={{ x, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 72 || Math.abs(info.velocity.x) > 450) {
          toast.dismiss(t.id)
        }
      }}
      className="cursor-grab touch-pan-y active:cursor-grabbing"
    >
      {children}
    </motion.div>
  )
}

/**
 * Theme-aware toasts (light/dark) with swipe-to-dismiss.
 */
export default function AppToaster() {
  const [style, setStyle] = useState(() => themeToastStyle())

  useEffect(() => {
    const sync = () => setStyle(themeToastStyle())
    sync()
    const root = document.documentElement
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('qyntra:theme', sync)
    return () => {
      obs.disconnect()
      window.removeEventListener('qyntra:theme', sync)
    }
  }, [])

  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerStyle={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
      toastOptions={{
        duration: 4000,
        style: {
          ...style,
          maxWidth: 'min(420px, calc(100vw - 1.5rem))',
          padding: '10px 14px',
          borderRadius: '14px',
          fontSize: '14px',
          fontWeight: 500
        },
        success: {
          iconTheme: {
            primary: '#22C55E',
            secondary: style.background
          }
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: style.background
          }
        }
      }}
    >
      {(t) => (
        <SwipeToast t={t}>
          <ToastBar
            toast={t}
            style={{
              ...t.style,
              ...style
            }}
          />
        </SwipeToast>
      )}
    </Toaster>
  )
}
