import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMail, FiLock, FiLogIn, FiX, FiKey } from 'react-icons/fi'
import { useAuthStore } from '../store/authStore'
import api from '../utils/api'
import toast from 'react-hot-toast'
import TermsModal from '../components/TermsModal'
import CodeAccessModal from '../components/CodeAccessModal'
import AuthShell, { AuthLabel } from '../components/AuthShell'
import GoogleAuthButton, { AuthDivider } from '../components/GoogleAuthButton'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showRequestAccess, setShowRequestAccess] = useState(false)
  const [requestEmail, setRequestEmail] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showCodeAccess, setShowCodeAccess] = useState(false)
  const { login, loading, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Completa todos los campos')
      return
    }

    const result = await login(email, password, { remember: rememberMe })

    if (result.success) {
      toast.success('¡Bienvenido!')
      const params = new URLSearchParams(window.location.search)
      const redirect = params.get('redirect')
      const safeRedirect =
        redirect &&
        redirect.startsWith('/') &&
        !redirect.startsWith('//') &&
        redirect !== '/' &&
        redirect !== '/login'
          ? redirect
          : '/dashboard'
      navigate(safeRedirect, { replace: true })
    } else {
      toast.error(result.message)
    }
  }

  const handleRequestAccess = async () => {
    if (!requestEmail.trim()) {
      toast.error('Por favor ingresa tu correo')
      return
    }

    setRequesting(true)
    try {
      await api.post('/auth/request-access', { email: requestEmail })
      setShowRequestAccess(false)
      setShowTerms(true)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al enviar solicitud')
    } finally {
      setRequesting(false)
    }
  }

  const handleAcceptTerms = () => {
    setShowTerms(false)
    toast.success(
      'Solicitud enviada. Completa tu proceso de suscripción con tu administrador de Qyntra Gym para obtener tu código de acceso y continuar con tu registro en nuestra app',
      { duration: 6000 }
    )
    setRequestEmail('')
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Accede a tu cuenta y continúa donde lo dejaste."
      panelHeadline="TU SESIÓN EMPIEZA AQUÍ"
    >
      <GoogleAuthButton label="Continuar con Google" disabled={loading} />

      <AuthDivider label="o con email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <AuthLabel>Email</AuthLabel>
          <div className="relative">
            <FiMail
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field pl-12"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>
        </div>

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
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="auth-label flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border"
              style={{
                accentColor: 'var(--color-primary)',
                borderColor: 'var(--border-strong)'
              }}
            />
            Recordarme
          </label>
          <Link
            to="/forgot-password"
            className="font-medium hover:opacity-90"
            style={{ color: 'var(--color-primary)' }}
          >
            Olvidé mi contraseña
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black/80" />
          ) : (
            <>
              <FiLogIn /> Iniciar sesión
            </>
          )}
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowCodeAccess(true)}
          className="btn-secondary flex w-full items-center justify-center gap-2"
        >
          <FiKey size={18} />
          Tengo una clave de acceso
        </button>
      </div>

      <div className="mt-6 text-center">
        <p className="auth-readable-secondary mb-2 text-sm">¿No tienes cuenta?</p>
        <button
          type="button"
          onClick={() => setShowRequestAccess(true)}
          className="font-medium hover:opacity-90"
          style={{ color: 'var(--color-primary)' }}
        >
          Solicitar acceso
        </button>
        <p className="auth-readable-secondary mt-3 text-sm">
          ¿Ya tienes código?{' '}
          <Link to="/register" className="font-medium" style={{ color: 'var(--color-primary)' }}>
            Crear cuenta
          </Link>
        </p>
      </div>

      <AnimatePresence>
        {showRequestAccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="card w-full max-w-md"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-xl tracking-wide">Solicitar acceso</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestAccess(false)
                    setRequestEmail('')
                  }}
                  className="rounded-lg p-2 transition"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-muted)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <FiX size={22} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <AuthLabel>Correo electrónico</AuthLabel>
                  <input
                    type="email"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="input-field w-full"
                    placeholder="tu@email.com"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestAccess(false)
                      setRequestEmail('')
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestAccess}
                    disabled={requesting || !requestEmail.trim()}
                    className="btn-primary flex flex-1 items-center justify-center gap-2"
                  >
                    {requesting ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black/80" />
                    ) : (
                      'Continuar'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={handleAcceptTerms}
      />

      <CodeAccessModal
        isOpen={showCodeAccess}
        onClose={() => setShowCodeAccess(false)}
        onSuccess={() => {
          setShowCodeAccess(false)
          navigate('/dashboard')
        }}
      />
    </AuthShell>
  )
}
