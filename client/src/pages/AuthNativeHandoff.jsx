import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import AuthShell from '../components/AuthShell'
import { clearPendingGoogleRegistration } from '../utils/googleAuth'

/**
 * Receives Supabase tokens from the public OAuth callback (Vercel) and restores
 * the session on the Capacitor local origin so native plugins work.
 */
export default function AuthNativeHandoff() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loginWithGoogleSession = useAuthStore((s) => s.loginWithGoogleSession)
  const [status, setStatus] = useState('Volviendo a la app…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      try {
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')
        const nextRaw = searchParams.get('next') || '/dashboard'
        const next = nextRaw.startsWith('/') ? nextRaw : '/dashboard'

        if (!accessToken || !refreshToken) {
          navigate('/login', { replace: true })
          return
        }

        setStatus('Restaurando sesión…')
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        if (error) throw error

        const result = await loginWithGoogleSession(accessToken, refreshToken, { remember: true })
        if (result.success) {
          clearPendingGoogleRegistration()
          navigate(next, { replace: true })
          return
        }

        if (result.code === 'NEEDS_REGISTRATION' || result.status === 403) {
          navigate('/register?google=1', { replace: true })
          return
        }

        toast.error(result.message || 'No se pudo restaurar la sesión')
        navigate('/login', { replace: true })
      } catch (err) {
        console.error('Native handoff error:', err)
        toast.error('Error al volver a la app')
        navigate('/login', { replace: true })
      }
    })()
  }, [loginWithGoogleSession, navigate, searchParams])

  return (
    <AuthShell title="Qyntra" subtitle={status} panelHeadline="APP" showBackHome={false}>
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2"
          style={{
            borderColor: 'var(--border-subtle)',
            borderTopColor: 'var(--color-primary)'
          }}
        />
        <p className="auth-readable-secondary text-center text-sm">{status}</p>
      </div>
    </AuthShell>
  )
}
