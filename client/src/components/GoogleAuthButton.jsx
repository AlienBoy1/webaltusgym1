import { useState } from 'react'
import toast from 'react-hot-toast'
import GoogleIcon from './GoogleIcon'
import { startGoogleOAuth } from '../utils/googleAuth'

/**
 * Shared Google OAuth CTA for Login / Register.
 * Uses secondary auth styling so it doesn't compete with primary email CTA.
 */
export default function GoogleAuthButton({
  label = 'Continuar con Google',
  className = '',
  disabled = false
}) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading || disabled) return
    setLoading(true)
    try {
      await startGoogleOAuth()
    } catch (error) {
      console.error('Google OAuth error:', error)
      toast.error(error?.message || 'No se pudo conectar con Google')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className={`btn-secondary flex w-full items-center justify-center gap-3 ${className}`}
      aria-label={label}
    >
      {loading ? (
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-black/70"
          style={{ borderTopColor: 'var(--color-primary)' }}
        />
      ) : (
        <GoogleIcon size={20} />
      )}
      <span>{loading ? 'Conectando…' : label}</span>
    </button>
  )
}

export function AuthDivider({ label = 'o' }) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label={label}>
      <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
      <span className="auth-readable-secondary text-xs uppercase tracking-wider">{label}</span>
      <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
    </div>
  )
}
