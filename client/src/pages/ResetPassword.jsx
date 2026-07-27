import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiLock, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'
import QyntraLogo from '../components/QyntraLogo'
import { supabase } from '../lib/supabase'
import api from '../utils/api'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    // Also try to parse session from URL hash (email link)
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true)
    })

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
        // Prefer API with admin update for reliability
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-400 via-dark-300 to-dark-400 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <QyntraLogo size="xl" withGlow />
          </div>
          <h1 className="font-display text-4xl mb-2">
            <span className="text-primary-500">QYNTRA</span> GYM
          </h1>
        </div>

        <div className="glass rounded-3xl p-8">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="text-accent-green" size={32} />
              </div>
              <h2 className="font-display text-2xl mb-2">¡Listo!</h2>
              <p className="text-gray-400 mb-6">Tu contraseña fue actualizada. Redirigiendo al login…</p>
              <Link to="/login" className="btn-primary inline-block">
                Ir al Login
              </Link>
            </div>
          ) : !ready ? (
            <div className="text-center space-y-4">
              <h2 className="font-display text-2xl">Enlace inválido o expirado</h2>
              <p className="text-gray-400">
                Abre el enlace desde el correo de recuperación. Si no tienes cuenta en Supabase aún,
                regístrate primero.
              </p>
              <Link to="/forgot-password" className="btn-primary inline-block">
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl text-center mb-2">Nueva contraseña</h2>
              <p className="text-gray-400 text-center mb-6">Elige una contraseña segura para tu cuenta</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-12"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirmar</label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="input-field pl-12"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
