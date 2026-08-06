import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FiAtSign, FiCheck, FiX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { normalizeUsername, validateUsernameFormat } from '../utils/username'
import QyntraLogo from './QyntraLogo'

/**
 * Blocking gate: existing users without username must claim one.
 */
export default function UsernameSetupModal({ open }) {
  const updateUser = useAuthStore((s) => s.updateUser)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState({ checking: false, available: false, message: '' })
  const [saving, setSaving] = useState(false)

  const format = useMemo(() => validateUsernameFormat(value), [value])

  useEffect(() => {
    if (!open) return
    if (!format.ok) {
      setStatus({ checking: false, available: false, message: format.message })
      return
    }
    let cancelled = false
    setStatus((s) => ({ ...s, checking: true }))
    const t = window.setTimeout(async () => {
      try {
        const { data } = await api.get(
          `/users/username/check?u=${encodeURIComponent(format.username)}`
        )
        if (cancelled) return
        setStatus({
          checking: false,
          available: Boolean(data.available),
          message: data.message || ''
        })
      } catch {
        if (!cancelled) {
          setStatus({ checking: false, available: false, message: 'No se pudo validar' })
        }
      }
    }, 380)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, format.ok, format.username, format.message])

  const canSubmit = format.ok && status.available && !status.checking && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const { data } = await api.post('/users/username', { username: format.username })
      updateUser(data.user)
      toast.success('Username registrado')
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo registrar el username')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-2xl overflow-hidden"
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <QyntraLogo size="md" />
            <div>
              <h2 className="font-display text-xl">Elige tu username</h2>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Es obligatorio para continuar. Así te encontrarán y te mencionarán con @.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--text-muted)] mb-1.5 block">
              Username
            </label>
            <div className="relative">
              <FiAtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(normalizeUsername(e.target.value))}
                placeholder="tunombre"
                maxLength={20}
                className="input-field w-full pl-10 pr-10"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {status.checking ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-primary-500" />
                ) : status.available && format.ok ? (
                  <FiCheck className="text-green-500" />
                ) : value ? (
                  <FiX className="text-red-400" />
                ) : null}
              </span>
            </div>
            <p
              className={`mt-1.5 text-xs ${
                status.available && format.ok ? 'text-green-500' : 'text-[color:var(--text-muted)]'
              }`}
            >
              {value ? status.message || format.message : '3–20 caracteres: letras, números, . y _'}
            </p>
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {saving ? 'Registrando…' : 'Registrar username'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
