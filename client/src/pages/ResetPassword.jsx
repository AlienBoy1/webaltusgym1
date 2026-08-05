import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AuthShell, { AuthLabel } from '../components/AuthShell'
import { supabase } from '../lib/supabase'
import api from '../utils/api'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    let settled = false

    const markReady = () => {
      if (!mounted || settled) return
      settled = true
      setReady(true)
      setChecking(false)
    }

    const markInvalid = () => {
      if (!mounted || settled) return
      settled = true
      setReady(false)
      setChecking(false)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        markReady()
      }
    })

    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          markReady()
          return
        }

        const tokenHash = params.get('token_hash') || hashParams.get('token_hash')
        const type = params.get('type') || hashParams.get('type')
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type
          })
          if (error) throw error
          markReady()
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          markReady()
          return
        }

        await new Promise((r) => setTimeout(r, 800))
        if (!mounted || settled) return
        const again = await supabase.auth.getSession()
        if (again.data?.session) markReady()
        else markInvalid()
      } catch {
        if (mounted) markInvalid()
      }
    })()

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Mínimo 6 caracteres')
      return
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (accessToken) {
        await api.post(
          '/auth/update-password',
          { password },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      }

      setDone(true)
      toast.success('Contraseña actualizada')
      setTimeout(() => navigate('/login'), 1500)
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'No se pudo actualizar')
    } finally {
      setLoading(false)
    }
  }

  const title = done
    ? 'Listo'
    : checking
      ? 'Verificando enlace…'
      : !ready
        ? 'Enlace inválido'
        : 'Nueva contraseña'

  const subtitle = done
    ? 'Tu contraseña fue actualizada.'
    : checking
      ? 'Un momento mientras validamos tu solicitud.'
      : !ready
        ? 'Abre el enlace más reciente del correo de recuperación.'
        : 'Elige una contraseña segura para tu cuenta.'

  return (
    <AuthShell title={title} subtitle={subtitle} panelHeadline="RESTABLECE TU ACCESO">
      {done ? (
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(34, 197, 94, 0.15)' }}
          >
            <FiCheck style={{ color: '#22C55E' }} size={32} />
          </div>
          <p className="auth-readable-secondary mb-6 text-sm">Redirigiendo al login…</p>
          <Link to="/login" className="btn-primary inline-flex">
            Ir al login
          </Link>
        </div>
      ) : checking ? (
        <div className="flex justify-center py-6">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2"
            style={{
              borderColor: 'var(--border-subtle)',
              borderTopColor: 'var(--color-primary)'
            }}
          />
        </div>
      ) : !ready ? (
        <div className="space-y-4 text-center">
          <p className="auth-readable-secondary text-sm">
            Si el enlace expiró, solicita uno nuevo desde recuperar contraseña.
          </p>
          <Link to="/forgot-password" className="btn-primary inline-flex">
            Solicitar nuevo enlace
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <AuthLabel>Contraseña</AuthLabel>
            <div className="relative">
              <FiLock
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-12"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <AuthLabel>Confirmar</AuthLabel>
            <div className="relative">
              <FiLock
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field pl-12"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
