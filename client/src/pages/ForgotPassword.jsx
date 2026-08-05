import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMail, FiArrowLeft, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AuthShell, { AuthLabel } from '../components/AuthShell'
import api from '../utils/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      toast.error('Ingresa tu email')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success('Email enviado')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al enviar correo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={sent ? 'Email enviado' : 'Recuperar contraseña'}
      subtitle={
        sent
          ? 'Revisa tu bandeja y carpeta de spam.'
          : 'Te enviaremos un enlace para restablecer tu acceso.'
      }
      panelHeadline="RECUPERA TU ACCESO"
    >
      {sent ? (
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(34, 197, 94, 0.15)' }}
          >
            <FiCheck style={{ color: '#22C55E' }} size={32} />
          </div>
          <p className="auth-readable-secondary mb-6 text-sm">
            Revisa tu bandeja de entrada y spam. El enlace abre la página para crear tu nueva contraseña.
          </p>
          <Link to="/login" className="btn-primary inline-flex">
            Volver al login
          </Link>
        </div>
      ) : (
        <>
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black/80" />
              ) : (
                'Enviar enlace'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="auth-readable-secondary inline-flex items-center justify-center gap-2 text-sm font-medium transition hover:opacity-90"
            >
              <FiArrowLeft /> Volver al login
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  )
}
