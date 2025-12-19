import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiArrowLeft, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'

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
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setLoading(false)
    setSent(true)
    toast.success('Email enviado')
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-400 via-dark-300 to-dark-400 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl mb-2"><span className="text-primary-500">ALTUS</span> GYM</h1>
        </div>
        
        <div className="glass rounded-3xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="text-accent-green" size={32} />
              </div>
              <h2 className="font-display text-2xl mb-2">¡Email Enviado!</h2>
              <p className="text-gray-400 mb-6">Revisa tu bandeja de entrada para restablecer tu contraseña.</p>
              <Link to="/login" className="btn-primary inline-block">Volver al Login</Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl text-center mb-2">Recuperar Contraseña</h2>
              <p className="text-gray-400 text-center mb-6">Te enviaremos un enlace para restablecer tu contraseña</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-12" placeholder="tu@email.com" />
                  </div>
                </div>
                
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enviar Enlace'}
                </button>
              </form>
              
              <div className="mt-6 text-center">
                <Link to="/login" className="text-gray-400 hover:text-white flex items-center justify-center gap-2">
                  <FiArrowLeft /> Volver al Login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

