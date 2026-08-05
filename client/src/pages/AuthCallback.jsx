import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import AuthShell from '../components/AuthShell'
import {
  savePendingGoogleRegistration,
  clearPendingGoogleRegistration
} from '../utils/googleAuth'

async function waitForSession({ timeoutMs = 8000 } = {}) {
  const existing = await supabase.auth.getSession()
  if (existing.data?.session?.access_token) {
    return existing.data.session
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (session) => {
      if (settled) return
      settled = true
      subscription?.unsubscribe?.()
      clearTimeout(timer)
      resolve(session || null)
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        finish(session)
      }
    })

    const timer = setTimeout(async () => {
      const retry = await supabase.auth.getSession()
      finish(retry.data?.session || null)
    }, timeoutMs)
  })
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLink = searchParams.get('link') === '1'
  const loginWithGoogleSession = useAuthStore((s) => s.loginWithGoogleSession)
  const [status, setStatus] = useState('Procesando tu cuenta de Google…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      try {
        const session = await waitForSession()
        if (!session?.access_token || !session?.refresh_token) {
          toast.error('No se pudo obtener la sesión de Google')
          navigate('/login', { replace: true })
          return
        }

        setStatus(isLink ? 'Vinculando Google…' : 'Verificando tu cuenta…')

        const result = await loginWithGoogleSession(session.access_token, session.refresh_token, {
          remember: true
        })

        if (result.success) {
          clearPendingGoogleRegistration()
          toast.success(isLink ? 'Google vinculado correctamente' : '¡Bienvenido!')
          navigate(isLink ? '/settings?section=account' : '/dashboard', { replace: true })
          return
        }

        if (result.code === 'EMAIL_EXISTS_NEEDS_LINK') {
          await supabase.auth.signOut().catch(() => {})
          toast.error(result.message)
          navigate('/login', { replace: true })
          return
        }

        if (result.code === 'NEEDS_REGISTRATION' || result.status === 403) {
          savePendingGoogleRegistration({
            email: result.email,
            name: result.name,
            avatar: result.avatar
          })
          // Keep Supabase session so /register and código de acceso can attach the profile
          toast(
            'Completa tu registro con los datos restantes. El correo de Google ya está listo.',
            { icon: '🔐', duration: 5000 }
          )
          navigate('/register?google=1', { replace: true })
          return
        }

        await supabase.auth.signOut().catch(() => {})
        toast.error(result.message || 'No se pudo iniciar sesión con Google')
        navigate(isLink ? '/settings?section=account' : '/login', { replace: true })
      } catch (error) {
        console.error('Auth callback error:', error)
        toast.error('Error al procesar Google')
        navigate('/login', { replace: true })
      }
    })()
  }, [isLink, loginWithGoogleSession, navigate])

  return (
    <AuthShell
      title="Google"
      subtitle={status}
      panelHeadline="CONECTANDO"
      showBackHome={false}
    >
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
